"""Make sessions.problem_id nullable and add sessions.title column.

Both DDL changes are combined in a single migration to avoid partial-state
deploys. Run this migration before deploying any frontend or backend code
that creates blank (problem_id=null) sessions.

NOTE: downgrade() will fail with a constraint violation if any sessions with
problem_id = NULL exist at rollback time. Delete all blank sessions first, or
do not run downgrade after blank sessions have been created.

Revision ID: 003
Revises: 002
Create Date: 2026-02-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Drop NOT NULL constraint on problem_id.
    #    The FK constraint to problems(id) is preserved; NULL is now allowed.
    conn.execute(sa.text(
        "ALTER TABLE sessions ALTER COLUMN problem_id DROP NOT NULL"
    ))

    # 2. Add optional title column for user-editable whiteboard names.
    conn.execute(sa.text(
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS title VARCHAR(512)"
    ))


def downgrade() -> None:
    conn = op.get_bind()

    # Remove the title column.
    conn.execute(sa.text(
        "ALTER TABLE sessions DROP COLUMN IF EXISTS title"
    ))

    # Re-apply NOT NULL on problem_id.
    # This will fail if any rows have problem_id = NULL.
    conn.execute(sa.text(
        "ALTER TABLE sessions ALTER COLUMN problem_id SET NOT NULL"
    ))
