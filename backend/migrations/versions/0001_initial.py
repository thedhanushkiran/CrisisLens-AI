"""Create core report, review, audit, and misinformation tables.

Revision ID: 0001_initial
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("categories", sa.JSON(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location_text", sa.String(length=500), nullable=False),
        sa.Column("landmark", sa.String(length=500)),
        sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()),
        sa.Column("coordinates_consented", sa.Boolean(), nullable=False),
        sa.Column("urgency", sa.String(length=16), nullable=False),
        sa.Column("suggested_urgency", sa.String(length=16), nullable=False),
        sa.Column("triage_reasons", sa.JSON(), nullable=False),
        sa.Column("triage_uncertainty", sa.String(length=32), nullable=False),
        sa.Column("contact_primary", sa.String(length=120)),
        sa.Column("contact_alternate", sa.String(length=120)),
        sa.Column("client_sync_status", sa.String(length=32), nullable=False),
        sa.Column("server_sync_status", sa.String(length=32), nullable=False),
        sa.Column("review_status", sa.String(length=32), nullable=False),
        sa.Column("assigned_to", sa.String(length=120)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_reports_created_at", "reports", ["created_at"])
    op.create_table(
        "report_notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("report_id", sa.String(64), sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author", sa.String(120), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("report_id", sa.String(64), sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor", sa.String(120), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "misinformation_claims",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("claim", sa.Text(), nullable=False),
        sa.Column("location", sa.String(500)),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("evidence", sa.Text()),
        sa.Column("reviewer_decision", sa.Text()),
        sa.Column("reporter_contact", sa.String(120)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_misinformation_claims_status", "misinformation_claims", ["status"])


def downgrade() -> None:
    op.drop_index("ix_misinformation_claims_status", table_name="misinformation_claims")
    op.drop_table("misinformation_claims")
    op.drop_table("audit_events")
    op.drop_table("report_notes")
    op.drop_index("ix_reports_created_at", table_name="reports")
    op.drop_table("reports")
