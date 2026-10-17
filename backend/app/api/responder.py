from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.app.auth import AdminOnly, ResponderOrAdmin
from backend.app.database import get_session
from backend.app.models import AuditEvent, Report, ReportNote
from backend.app.schemas import NoteCreate, ReportResponder, ReportUpdate
from backend.app.api.reports import report_response

router = APIRouter(prefix="/api/v1/responder", tags=["responder"])
admin_router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
DbSession = Annotated[Session, Depends(get_session)]


@router.get("/reports", response_model=list[ReportResponder])
def list_reports(
    db: DbSession,
    actor: ResponderOrAdmin,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0, le=100000)] = 0,
):
    reports = db.scalars(select(Report).order_by(desc(Report.created_at)).offset(offset).limit(limit)).all()
    return [report_response(report, include_private=True) for report in reports]


@router.patch("/reports/{report_id}", response_model=ReportResponder)
def update_report(
    report_id: str,
    payload: ReportUpdate,
    db: DbSession,
    actor: ResponderOrAdmin,
):
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(report, field, value.value if hasattr(value, "value") else value)
    db.add(AuditEvent(
        report_id=report.id,
        actor=actor.name,
        action="review_updated",
        details=", ".join(sorted(updates.keys())) or "no-op",
    ))
    db.commit()
    db.refresh(report)
    return report_response(report, include_private=True)


@router.post("/reports/{report_id}/notes", response_model=dict, status_code=201)
def add_note(
    report_id: str,
    payload: NoteCreate,
    db: DbSession,
    actor: ResponderOrAdmin,
):
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    note = ReportNote(report_id=report.id, author=actor.name, text=payload.text)
    db.add(note)
    db.add(AuditEvent(
        report_id=report.id,
        actor=actor.name,
        action="internal_note_added",
        details="Internal note added",
    ))
    db.commit()
    db.refresh(note)
    return {"id": note.id, "author": note.author, "text": note.text, "created_at": note.created_at}


@router.get("/audit", response_model=list[dict])
def audit_events(db: DbSession, actor: ResponderOrAdmin, limit: Annotated[int, Query(ge=1, le=100)] = 50):
    events = db.scalars(select(AuditEvent).order_by(desc(AuditEvent.created_at)).limit(limit)).all()
    return [
        {
            "report_id": event.report_id,
            "actor": event.actor,
            "action": event.action,
            "details": event.details,
            "created_at": event.created_at,
        }
        for event in events
    ]


@admin_router.get("/audit", response_model=list[dict])
def admin_audit_events(
    db: DbSession,
    actor: AdminOnly,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    events = db.scalars(select(AuditEvent).order_by(desc(AuditEvent.created_at)).limit(limit)).all()
    return [
        {
            "report_id": event.report_id,
            "actor": event.actor,
            "action": event.action,
            "details": event.details,
            "created_at": event.created_at,
        }
        for event in events
    ]
