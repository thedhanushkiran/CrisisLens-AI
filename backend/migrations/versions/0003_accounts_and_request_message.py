"""Add persistent citizen accounts and responder request messages.

Revision ID: 0003_accounts_and_request_message
Revises: 0002_claim_review_audit
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_accounts_and_request_message"
down_revision = "0002_claim_review_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("user_accounts"):
        op.create_table(
            "user_accounts",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("display_name", sa.String(length=120), nullable=False),
            sa.Column("email", sa.String(length=254), nullable=False),
            sa.Column("phone", sa.String(length=40)),
            sa.Column("password_hash", sa.String(length=256), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("email", name="uq_user_accounts_email"),
        )
    if not any(index["name"] == "ix_user_accounts_email" for index in sa.inspect(bind).get_indexes("user_accounts")):
        op.create_index("ix_user_accounts_email", "user_accounts", ["email"])

    inspector = sa.inspect(bind)
    if not inspector.has_table("account_sessions"):
        op.create_table(
            "account_sessions",
            sa.Column("token_hash", sa.String(length=64), primary_key=True),
            sa.Column(
                "user_id",
                sa.String(length=36),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
    if not any(index["name"] == "ix_account_sessions_user_id" for index in sa.inspect(bind).get_indexes("account_sessions")):
        op.create_index("ix_account_sessions_user_id", "account_sessions", ["user_id"])

    report_columns = {column["name"] for column in sa.inspect(bind).get_columns("reports")}
    report_fks = sa.inspect(bind).get_foreign_keys("reports")
    has_user_fk = any(
        fk.get("constrained_columns") == ["user_id"] and fk.get("referred_table") == "user_accounts"
        for fk in report_fks
    )
    with op.batch_alter_table("reports") as batch_op:
        if "request_message" not in report_columns:
            batch_op.add_column(sa.Column("request_message", sa.Text(), nullable=True))
        if "user_id" not in report_columns:
            batch_op.add_column(sa.Column("user_id", sa.String(length=36), nullable=True))
        if not has_user_fk:
            batch_op.create_foreign_key(
                "fk_reports_user_id_user_accounts",
                "user_accounts",
                ["user_id"],
                ["id"],
                ondelete="SET NULL",
            )
    if not any(index["name"] == "ix_reports_user_id" for index in sa.inspect(bind).get_indexes("reports")):
        op.create_index("ix_reports_user_id", "reports", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_reports_user_id", table_name="reports")
    with op.batch_alter_table("reports") as batch_op:
        batch_op.drop_column("user_id")
        batch_op.drop_column("request_message")
    op.drop_index("ix_account_sessions_user_id", table_name="account_sessions")
    op.drop_table("account_sessions")
    op.drop_index("ix_user_accounts_email", table_name="user_accounts")
    op.drop_table("user_accounts")
