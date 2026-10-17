import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.database import get_session
from backend.app.models import AccountSession, UserAccount

PASSWORD_ITERATIONS = 310_000
SESSION_LIFETIME = timedelta(days=30)
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PASSWORD_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode("ascii").rstrip("="),
        base64.urlsafe_b64encode(digest).decode("ascii").rstrip("="),
    )


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = encoded_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        if not 100_000 <= iterations <= 1_000_000:
            return False

        def decode(value: str) -> bytes:
            return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))

        salt = decode(salt_text)
        expected = decode(digest_text)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_account_session(db: Session, user: UserAccount) -> str:
    token = secrets.token_urlsafe(32)
    db.add(AccountSession(
        token_hash=token_digest(token),
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + SESSION_LIFETIME,
    ))
    return token


def current_account(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_session)],
) -> UserAccount | None:
    if credentials is None:
        return None
    session = db.scalar(
        select(AccountSession).where(AccountSession.token_hash == token_digest(credentials.credentials))
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid account session")
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account session expired")
    user = db.get(UserAccount, session.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid account session")
    return user


OptionalAccount = Annotated[UserAccount | None, Depends(current_account)]


def require_account(user: OptionalAccount) -> UserAccount:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to access this resource")
    return user


CurrentAccount = Annotated[UserAccount, Depends(require_account)]
