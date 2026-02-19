"""Convert sessions.status from VARCHAR to native Postgres enum.

The ORM model uses SQLEnum(SessionStatus) which expects a native
``sessionstatus`` type, but 001_initial created the column as
VARCHAR(32). This migration creates the enum type and alters the
column so that Alembic-only deployments stay in sync with the model.

Revision ID: 002
Revises: 001
Create Date: 2026-02-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ENUM_NAME = "sessionstatus"
ENUM_VALUES = ("NOT_STARTED", "IN_PROGRESS", "EVALUATING", "FEEDBACK_READY", "COMPLETED")


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Create the enum type (idempotent for envs where init_db() ran).
    conn.execute(sa.text(
        f"DO $$ BEGIN "
        f"  CREATE TYPE {ENUM_NAME} AS ENUM ({', '.join(repr(v) for v in ENUM_VALUES)}); "
        f"EXCEPTION WHEN duplicate_object THEN NULL; "
        f"END $$;"
    ))

    # 2. Drop the existing VARCHAR default — Postgres cannot auto-cast it
    #    to the enum type during ALTER COLUMN TYPE.
    conn.execute(sa.text(
        "ALTER TABLE sessions ALTER COLUMN status DROP DEFAULT"
    ))

    # 3. Convert column. Existing rows store lowercase ('not_started')
    #    from the VARCHAR era; the enum labels are uppercase. UPPER() bridges them.
    conn.execute(sa.text(
        f"ALTER TABLE sessions "
        f"ALTER COLUMN status TYPE {ENUM_NAME} "
        f"USING UPPER(status::text)::{ENUM_NAME}"
    ))

    # 4. Re-set the default using the enum value.
    conn.execute(sa.text(
        f"ALTER TABLE sessions "
        f"ALTER COLUMN status SET DEFAULT 'NOT_STARTED'"
    ))


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text(
        "ALTER TABLE sessions ALTER COLUMN status DROP DEFAULT"
    ))

    conn.execute(sa.text(
        "ALTER TABLE sessions "
        "ALTER COLUMN status TYPE VARCHAR(32) "
        "USING LOWER(status::text)"
    ))

    conn.execute(sa.text(
        "ALTER TABLE sessions "
        "ALTER COLUMN status SET DEFAULT 'not_started'"
    ))

    conn.execute(sa.text(f"DROP TYPE IF EXISTS {ENUM_NAME}"))
