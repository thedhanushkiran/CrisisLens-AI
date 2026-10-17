import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.account_security import (
    CurrentAccount,
    create_account_session,
    hash_password,
    token_digest,
    verify_password,
)
from backend.app.database import get_session
from backend.app.models import AccountSession, Report, UserAccount
from backend.app.schemas import AccountAuthResponse, AccountLogin, AccountProfile, AccountRegister
from backend.app.api.reports import report_response

logger = logging.getLogger("crisislens.accounts")
router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])
DbSession = Annotated[Session, Depends(get_session)]
bearer = HTTPBearer(auto_error=False)
_dummy_hash = hash_password("nonexistent-account-password")


def profile_response(user: UserAccount) -> AccountProfile:
    return AccountProfile(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        phone=user.phone,
        created_at=user.created_at,
    )


def auth_response(user: UserAccount, token: str) -> AccountAuthResponse:
    return AccountAuthResponse(access_token=token, user=profile_response(user))


@router.post("/register", response_model=AccountAuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: AccountRegister, db: DbSession):
    user = UserAccount(
        display_name=payload.display_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.flush()
        token = create_account_session(db, user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")
    db.refresh(user)
    logger.info("Account registered account_id=%s", user.id)
    return auth_response(user, token)


@router.post("/login", response_model=AccountAuthResponse)
def login(payload: AccountLogin, db: DbSession):
    user = db.scalar(select(UserAccount).where(UserAccount.email == payload.email))
    password_hash = user.password_hash if user else _dummy_hash
    if not verify_password(payload.password, password_hash) or user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_account_session(db, user)
    db.commit()
    return auth_response(user, token)


@router.get("/me", response_model=AccountProfile)
def get_me(user: CurrentAccount):
    return profile_response(user)


@router.get("/me/reports")
def list_my_reports(user: CurrentAccount, db: DbSession):
    reports = db.scalars(
        select(Report).where(Report.user_id == user.id).order_by(Report.created_at.desc()).limit(100)
    ).all()
    return [report_response(report) for report in reports]


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    user: CurrentAccount,
    db: DbSession,
):
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account session required")
    session = db.get(AccountSession, token_digest(credentials.credentials))
    if session is not None and session.user_id == user.id:
        db.delete(session)
        db.commit()
