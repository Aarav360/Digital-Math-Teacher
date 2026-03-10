"""Add OAuth tables and last_seen_at on users.

Revision ID: 006_oauth_and_last_seen
Revises: 005_session_problem_override
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa

revision = "006_oauth_and_last_seen"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "oauth_accounts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("provider_user_id", sa.String(length=255), nullable=False),
        sa.Column("provider_email", sa.String(length=255), nullable=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("provider", "provider_user_id", name="uq_oauth_accounts_provider_user"),
    )
    op.create_index(
        "ix_oauth_accounts_provider_email",
        "oauth_accounts",
        ["provider", "provider_email"],
        unique=False,
    )
    op.create_index("ix_oauth_accounts_user_id", "oauth_accounts", ["user_id"], unique=False)

    op.create_table(
        "oauth_states",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("state", sa.String(length=255), nullable=False),
        sa.Column("code_verifier", sa.String(length=512), nullable=False),
        sa.Column("guest_user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_oauth_states_state", "oauth_states", ["state"], unique=True)
    op.create_index("ix_oauth_states_guest_user_id", "oauth_states", ["guest_user_id"], unique=False)

    op.create_table(
        "oauth_login_codes",
        sa.Column("code", sa.String(length=128), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_oauth_login_codes_user_id", "oauth_login_codes", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_oauth_login_codes_user_id", table_name="oauth_login_codes")
    op.drop_table("oauth_login_codes")

    op.drop_index("ix_oauth_states_guest_user_id", table_name="oauth_states")
    op.drop_index("ix_oauth_states_state", table_name="oauth_states")
    op.drop_table("oauth_states")

    op.drop_index("ix_oauth_accounts_user_id", table_name="oauth_accounts")
    op.drop_index("ix_oauth_accounts_provider_email", table_name="oauth_accounts")
    op.drop_table("oauth_accounts")

    op.drop_column("users", "last_seen_at")
