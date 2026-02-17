"""Initial schema: users, problems, sessions, canvas_snapshots, steps, step_evaluations, chat_messages.

Revision ID: 001
Revises:
Create Date: 2026-02-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.String(512), nullable=True),
        sa.Column("is_guest", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "problems",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("topic", sa.String(128), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(128), nullable=False),
        sa.Column("estimated_time", sa.String(32), nullable=True),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column("solution_canonical", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("problem_id", sa.String(36), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), server_default="not_started"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_problem_id", "sessions", ["problem_id"])

    op.create_table(
        "canvas_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("strokes_json", JSONB(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("image_url", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_canvas_snapshots_session_id", "canvas_snapshots", ["session_id"])

    op.create_table(
        "steps",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snapshot_id", sa.String(36), sa.ForeignKey("canvas_snapshots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("step_index", sa.Integer(), nullable=False),
        sa.Column("stroke_group", JSONB(), nullable=True),
        sa.Column("latex_raw", sa.Text(), nullable=True),
        sa.Column("bounding_box", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_steps_session_id", "steps", ["session_id"])

    op.create_table(
        "step_evaluations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("step_id", sa.String(36), sa.ForeignKey("steps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("verdict", sa.String(256), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("suggestion", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_step_evaluations_step_id", "step_evaluations", ["step_id"], unique=True)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_chat_messages_session_id", "chat_messages", ["session_id"])


def downgrade() -> None:
    op.drop_table("chat_messages")
    op.drop_table("step_evaluations")
    op.drop_table("steps")
    op.drop_table("canvas_snapshots")
    op.drop_table("sessions")
    op.drop_table("problems")
    op.drop_table("users")
