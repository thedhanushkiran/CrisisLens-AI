from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.app.auth import ResponderOrAdmin
from backend.app.database import get_session
from backend.app.models import ClaimAuditEvent, MisinformationClaim
from backend.app.schemas import ClaimCreate, ClaimPublic, ClaimResponder, ClaimReview

router = APIRouter(prefix="/api/v1/misinformation", tags=["misinformation"])
DbSession = Annotated[Session, Depends(get_session)]
VALID_STATUSES = {"unverified", "needs_review", "corroborated", "disputed"}


@router.post("/claims", response_model=ClaimPublic, status_code=201)
def create_claim(payload: ClaimCreate, db: DbSession):
    if db.get(MisinformationClaim, payload.id):
        raise HTTPException(status_code=409, detail="Claim ID already exists")
    claim = MisinformationClaim(**payload.model_dump(), status="unverified")
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim


@router.get("/claims", response_model=list[ClaimPublic])
def list_claims(
    db: DbSession,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
):
    query = select(MisinformationClaim)
    if status_filter:
        if status_filter not in VALID_STATUSES:
            raise HTTPException(status_code=422, detail="Unsupported misinformation status")
        query = query.where(MisinformationClaim.status == status_filter)
    return db.scalars(query.order_by(desc(MisinformationClaim.created_at))).all()


@router.patch("/claims/{claim_id}", response_model=ClaimResponder)
def review_claim(claim_id: str, payload: ClaimReview, db: DbSession, actor: ResponderOrAdmin):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Unsupported misinformation status")
    claim = db.get(MisinformationClaim, claim_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found")
    claim.status = payload.status
    claim.evidence = payload.evidence
    claim.reviewer_decision = payload.reviewer_decision
    db.add(ClaimAuditEvent(
        claim_id=claim.id,
        actor=actor.name,
        action="claim_reviewed",
        details=f"Status changed to {claim.status}",
    ))
    db.commit()
    db.refresh(claim)
    return claim


@router.get("/audit", response_model=list[dict])
def claim_audit(db: DbSession, actor: ResponderOrAdmin):
    events = db.scalars(select(ClaimAuditEvent).order_by(desc(ClaimAuditEvent.created_at)).limit(100)).all()
    return [
        {
            "claim_id": event.claim_id,
            "actor": event.actor,
            "action": event.action,
            "details": event.details,
            "created_at": event.created_at,
        }
        for event in events
    ]
