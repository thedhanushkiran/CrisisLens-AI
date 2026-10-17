"""Audit human misinformation review decisions.

Revision ID: 0002_claim_review_audit
Revises: 0001_initial
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_claim_review_audit"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "claim_audit_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "claim_id",
            sa.String(64),
            sa.ForeignKey("misinformation_claims.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("actor", sa.String(120), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("claim_audit_events")
