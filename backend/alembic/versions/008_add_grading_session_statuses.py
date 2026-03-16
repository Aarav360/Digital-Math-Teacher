"""Add evaluating and feedback_ready session statuses for grading pipeline.

Revision ID: 008
Revises: 007
Create Date: 2026-03-16
"""
from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE sessionstatus ADD VALUE IF NOT EXISTS 'evaluating'")
    op.execute("ALTER TYPE sessionstatus ADD VALUE IF NOT EXISTS 'feedback_ready'")


def downgrade() -> None:
    # PostgreSQL does not support removing values from an enum type.
    # To fully revert, recreate the type without these values.
    pass
