"""Session model (user working on a problem)."""
from sqlalchemy import ForeignKey, String, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.models.base import Base, TimestampMixin


class SessionStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    EVALUATING = "evaluating"
    FEEDBACK_READY = "feedback_ready"
    COMPLETED = "completed"


class Session(Base, TimestampMixin):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    problem_id: Mapped[str] = mapped_column(String(36), ForeignKey("problems.id", ondelete="CASCADE"), index=True)
    status: Mapped[SessionStatus] = mapped_column(SQLEnum(SessionStatus), default=SessionStatus.NOT_STARTED)

    user: Mapped["User"] = relationship("User", back_populates="sessions")
    problem: Mapped["Problem"] = relationship("Problem", back_populates="sessions")
    canvas_snapshots: Mapped[list["CanvasSnapshot"]] = relationship(
        "CanvasSnapshot", back_populates="session", lazy="selectin"
    )
    steps: Mapped[list["Step"]] = relationship(
        "Step", back_populates="session", lazy="selectin"
    )
    chat_messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="session", lazy="selectin"
    )
