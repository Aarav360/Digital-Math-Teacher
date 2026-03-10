"""Add account settings and placeholder account-tied tables.

Revision ID: 007
Revises: 006_oauth_and_last_seen
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "007"
down_revision = "006_oauth_and_last_seen"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("persona", sa.String(length=32), nullable=False, server_default="calm"),
        sa.Column("help_level", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("theme", sa.String(length=16), nullable=False, server_default="light"),
        sa.Column("pen_thickness", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column("smooth_strokes", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("show_grid", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("zoom_speed", sa.Float(), nullable=False, server_default="1.1"),
        sa.Column("constant_grid_size", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("save_history", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("grade_level", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "user_usage_counters",
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("chat_messages", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("analysis_runs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "billing_profiles",
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("provider", sa.String(length=32), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=True),
        sa.Column("external_customer_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "user_integrations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_user_integrations_user_id", "user_integrations", ["user_id"], unique=False)

    op.create_table(
        "user_files",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("storage_key", sa.String(length=255), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=True),
        sa.Column("mime_type", sa.String(length=128), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_user_files_user_id", "user_files", ["user_id"], unique=False)

    op.create_table(
        "user_activity",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_user_activity_user_id", "user_activity", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_activity_user_id", table_name="user_activity")
    op.drop_table("user_activity")

    op.drop_index("ix_user_files_user_id", table_name="user_files")
    op.drop_table("user_files")

    op.drop_index("ix_user_integrations_user_id", table_name="user_integrations")
    op.drop_table("user_integrations")

    op.drop_table("billing_profiles")
    op.drop_table("user_usage_counters")
    op.drop_table("user_settings")
