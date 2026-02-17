"""Step and StepEvaluation (per-step analysis result)."""
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.models.base import Base, TimestampMixin


class StepStatus(str, enum.Enum):
    CORRECT = "correct"
    INCORRECT = "incorrect"
    WARNING = "warning"


class Step(Base, TimestampMixin):
    __tablename__ = "steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    snapshot_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("canvas_snapshots.id", ondelete="SET NULL"), nullable=True)
    step_index: Mapped[int] = mapped_column(Integer)
    stroke_group: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # indices or stroke ids
    latex_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    bounding_box: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    session: Mapped["Session"] = relationship("Session", back_populates="steps")
    evaluation: Mapped["StepEvaluation | None"] = relationship(
        "StepEvaluation", back_populates="step", uselist=False, lazy="selectin"
    )


class StepEvaluation(Base, TimestampMixin):
    __tablename__ = "step_evaluations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    step_id: Mapped[str] = mapped_column(String(36), ForeignKey("steps.id", ondelete="CASCADE"), unique=True, index=True)
    status: Mapped[StepStatus] = mapped_column(String(32))  # correct | incorrect | warning
    verdict: Mapped[str] = mapped_column(String(256))
    explanation: Mapped[str] = mapped_column(Text)
    suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)

    step: Mapped["Step"] = relationship("Step", back_populates="evaluation")
