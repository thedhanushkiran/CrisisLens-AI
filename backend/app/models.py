from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserAccount(Base):
    __tablename__ = "user_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(40))
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class AccountSession(Base):
    __tablename__ = "account_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    categories: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location_text: Mapped[str] = mapped_column(String(500), nullable=False)
    landmark: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    coordinates_consented: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    urgency: Mapped[str] = mapped_column(String(16), nullable=False)
    suggested_urgency: Mapped[str] = mapped_column(String(16), nullable=False)
    triage_reasons: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    triage_uncertainty: Mapped[str] = mapped_column(String(32), nullable=False)
    contact_primary: Mapped[str | None] = mapped_column(String(120))
    contact_alternate: Mapped[str | None] = mapped_column(String(120))
    client_sync_status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    server_sync_status: Mapped[str] = mapped_column(String(32), nullable=False, default="received")
    review_status: Mapped[str] = mapped_column(String(32), nullable=False, default="unreviewed")
    assigned_to: Mapped[str | None] = mapped_column(String(120))
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("user_accounts.id", ondelete="SET NULL", name="fk_reports_user_id_user_accounts")
    )
    request_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )
    notes: Mapped[list["ReportNote"]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="ReportNote.created_at"
    )


class ReportNote(Base):
    __tablename__ = "report_notes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    author: Mapped[str] = mapped_column(String(120), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    report: Mapped[Report] = relationship(back_populates="notes")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    actor: Mapped[str] = mapped_column(String(120), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class MisinformationClaim(Base):
    __tablename__ = "misinformation_claims"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="unverified")
    evidence: Mapped[str | None] = mapped_column(Text)
    reviewer_decision: Mapped[str | None] = mapped_column(Text)
    reporter_contact: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )


class ClaimAuditEvent(Base):
    __tablename__ = "claim_audit_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    claim_id: Mapped[str] = mapped_column(
        ForeignKey("misinformation_claims.id", ondelete="CASCADE"), nullable=False
    )
    actor: Mapped[str] = mapped_column(String(120), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
