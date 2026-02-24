"""Add notebooks tables and extend session status.

Revision ID: 004
Revises: 003
Create Date: 2026-02-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new enum value for needs_review (idempotent for Postgres)
    op.execute("ALTER TYPE sessionstatus ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW'")

    # Normalize legacy statuses to in_progress
    op.execute(
        "UPDATE sessions SET status = 'IN_PROGRESS' "
        "WHERE status IN ('EVALUATING', 'FEEDBACK_READY')"
    )

    op.create_table(
        "notebooks",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("overall_prompt", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "notebook_problems",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("notebook_id", sa.String(length=36), sa.ForeignKey("notebooks.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("session_id", sa.String(length=36), sa.ForeignKey("sessions.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("notebook_problems")
    op.drop_table("notebooks")
    # Note: Postgres enums cannot drop values safely; leave NEEDS_REVIEW in type.
