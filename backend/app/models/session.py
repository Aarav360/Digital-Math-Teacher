"""Session model (user working on a problem)."""
from sqlalchemy import ForeignKey, String, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.models.base import Base, TimestampMixin


class SessionStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    NEEDS_REVIEW = "needs_review"


class Session(Base, TimestampMixin):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    problem_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("problems.id", ondelete="CASCADE"), nullable=True, index=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[SessionStatus] = mapped_column(SQLEnum(SessionStatus), default=SessionStatus.NOT_STARTED)
    problem_override: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="sessions")
    problem: Mapped["Problem | None"] = relationship("Problem", back_populates="sessions")
    canvas_snapshots: Mapped[list["CanvasSnapshot"]] = relationship(
        "CanvasSnapshot", back_populates="session", lazy="selectin", passive_deletes=True
    )
    steps: Mapped[list["Step"]] = relationship(
        "Step", back_populates="session", lazy="selectin", passive_deletes=True
    )
    chat_messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="session", lazy="selectin", passive_deletes=True
    )
    notebook_problem: Mapped["NotebookProblem | None"] = relationship(
        "NotebookProblem", back_populates="session", uselist=False, lazy="selectin"
    )
