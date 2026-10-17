from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy import String, asc, cast, desc, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.account_security import OptionalAccount
from backend.app.auth import ResponderOrAdmin
from backend.app.database import get_session
from backend.app.models import AuditEvent, Report, UserAccount
from backend.app.schemas import (
    Category,
    ReportCreate,
    ReportPublic,
    ReportUpdate,
    ReviewStatus,
    SyncBatchResponse,
    SyncItemResult,
    TriageSuggestion,
    Urgency,
)
from backend.app.services.triage import triage_provider

router = APIRouter(prefix="/api/v1", tags=["reports"])
DbSession = Annotated[Session, Depends(get_session)]


def report_response(report: Report, *, include_private: bool = False) -> dict:
    result = {
        "id": report.id,
        "categories": report.categories,
        "description": report.description,
        "location_text": report.location_text,
        "landmark": report.landmark,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "coordinates_consented": report.coordinates_consented,
        "urgency": report.urgency,
        "triage": {
            "suggested_priority": report.suggested_urgency,
            "reasons": report.triage_reasons,
            "uncertainty": report.triage_uncertainty,
            "is_human_decision": False,
        },
        "client_sync_status": report.client_sync_status,
        "server_sync_status": report.server_sync_status,
        "review_status": report.review_status,
        "assigned_to": report.assigned_to,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }
    if include_private:
        result.update(
            contact_primary=report.contact_primary,
            contact_alternate=report.contact_alternate,
            request_message=report.request_message,
            notes=report.notes,
        )
    return result


def new_report(payload: ReportCreate, owner: UserAccount | None = None) -> Report:
    triage = triage_provider.suggest(payload.description, payload.categories)
    return Report(
        id=payload.id,
        categories=[category.value for category in payload.categories],
        description=payload.description,
        request_message=payload.request_message,
        location_text=payload.location_text,
        landmark=payload.landmark,
        latitude=payload.latitude if payload.coordinates_consented else None,
        longitude=payload.longitude if payload.coordinates_consented else None,
        coordinates_consented=payload.coordinates_consented,
        urgency=payload.urgency.value,
        suggested_urgency=triage.suggested_priority.value,
        triage_reasons=triage.reasons,
        triage_uncertainty=triage.uncertainty,
        contact_primary=payload.contact_primary,
        contact_alternate=payload.contact_alternate,
        client_sync_status=payload.client_sync_status.value,
        server_sync_status="received",
        review_status="unreviewed",
        user_id=owner.id if owner else None,
    )


def matches_existing_report(existing: Report, payload: ReportCreate) -> bool:
    return (
        existing.categories == [category.value for category in payload.categories]
        and existing.description == payload.description
        and existing.request_message == payload.request_message
        and existing.location_text == payload.location_text
        and existing.landmark == payload.landmark
        and existing.latitude == payload.latitude
        and existing.longitude == payload.longitude
        and existing.coordinates_consented == payload.coordinates_consented
        and existing.urgency == payload.urgency.value
        and existing.contact_primary == payload.contact_primary
        and existing.contact_alternate == payload.contact_alternate
    )


@router.post("/reports", response_model=ReportPublic, status_code=status.HTTP_201_CREATED)
def create_report(payload: ReportCreate, db: DbSession, owner: OptionalAccount):
    if db.get(Report, payload.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Report ID already exists")
    report = new_report(payload, owner)
    db.add(report)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Report ID already exists")
    db.refresh(report)
    return report_response(report)


@router.post("/reports/sync", response_model=SyncBatchResponse)
def sync_reports(items: list[object], db: DbSession, owner: OptionalAccount):
    if not items or len(items) > 100:
        raise HTTPException(status_code=422, detail="Submit between 1 and 100 reports per batch")

    acknowledgements: list[SyncItemResult] = []
    for item in items:
        if not isinstance(item, dict):
            acknowledgements.append(SyncItemResult(
                client_id=None,
                status="invalid",
                message="Each batch item must be a report object",
            ))
            continue
        client_id = item.get("id")
        try:
            payload = ReportCreate.model_validate(item)
        except ValidationError:
            acknowledgements.append(SyncItemResult(
                client_id=str(client_id)[:64] if client_id is not None else None,
                status="invalid",
                message="Report fields failed validation",
            ))
            continue

        existing = db.get(Report, payload.id)
        if existing:
            if matches_existing_report(existing, payload):
                if owner and existing.user_id is None:
                    existing.user_id = owner.id
                    db.commit()
                acknowledgements.append(SyncItemResult(
                    client_id=payload.id,
                    status="duplicate",
                    server_status=existing.server_sync_status,
                    message="This client report ID was already received",
                ))
            else:
                acknowledgements.append(SyncItemResult(
                    client_id=payload.id,
                    status="invalid",
                    message="Client report ID is already associated with different report data",
                ))
            continue

        report = new_report(payload, owner)
        db.add(report)
        try:
            db.commit()
            acknowledgements.append(SyncItemResult(
                client_id=payload.id,
                status="accepted",
                server_status=report.server_sync_status,
                message="Stored by CrisisLens API; this is not an emergency-services delivery receipt",
            ))
        except IntegrityError:
            db.rollback()
            existing = db.get(Report, payload.id)
            if existing and matches_existing_report(existing, payload):
                acknowledgements.append(SyncItemResult(
                    client_id=payload.id,
                    status="duplicate",
                    server_status=existing.server_sync_status,
                    message="This client report ID was already received",
                ))
            else:
                acknowledgements.append(SyncItemResult(
                    client_id=payload.id,
                    status="invalid",
                    message="Report ID conflicts with an existing record",
                ))
        except SQLAlchemyError:
            db.rollback()
            acknowledgements.append(SyncItemResult(
                client_id=payload.id,
                status="retryable_failure",
                message="Temporary storage failure; retain this report and retry",
            ))

    return {"acknowledgements": acknowledgements}


@router.get("/reports", response_model=list[ReportPublic])
def list_reports(
    db: DbSession,
    category: Category | None = None,
    urgency: Urgency | None = None,
    review_status: ReviewStatus | None = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    sort_by: Annotated[str, Query(pattern="^(created_at|urgency)$")] = "created_at",
    sort_order: Annotated[str, Query(pattern="^(asc|desc)$")] = "desc",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0, le=100000)] = 0,
):
    query = select(Report)
    if category:
        query = query.where(cast(Report.categories, String).like(f'%"{category.value}"%'))
    if urgency:
        query = query.where(Report.urgency == urgency.value)
    if review_status:
        query = query.where(Report.review_status == review_status.value)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(or_(Report.description.ilike(term), Report.location_text.ilike(term)))
    sort_column = Report.created_at if sort_by == "created_at" else Report.urgency
    query = query.order_by(desc(sort_column) if sort_order == "desc" else asc(sort_column))
    reports = db.scalars(query.offset(offset).limit(limit)).all()
    return [report_response(report) for report in reports]


@router.get("/reports/{report_id}", response_model=ReportPublic)
def get_report(report_id: str, db: DbSession):
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return report_response(report)


@router.patch("/reports/{report_id}", response_model=ReportPublic)
def update_report(report_id: str, payload: ReportUpdate, db: DbSession, actor: ResponderOrAdmin):
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    updates = payload.model_dump(exclude_unset=True)
    if "urgency" in updates and updates["urgency"] is not None:
        updates["urgency"] = updates["urgency"].value
    if "review_status" in updates and updates["review_status"] is not None:
        updates["review_status"] = updates["review_status"].value
    for field, value in updates.items():
        setattr(report, field, value)
    db.add(AuditEvent(
        report_id=report.id,
        actor=actor.name,
        action="report_updated",
        details=", ".join(sorted(updates.keys())) or "no-op",
    ))
    db.commit()
    db.refresh(report)
    return report_response(report)
