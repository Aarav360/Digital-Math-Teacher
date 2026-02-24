"""Notebook problem model (links a notebook entry to a session/whiteboard)."""
from sqlalchemy import Integer, String, Text, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class NotebookProblem(Base, TimestampMixin):
    __tablename__ = "notebook_problems"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_notebook_problems_session_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    notebook_id: Mapped[str] = mapped_column(String(36), ForeignKey("notebooks.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(256))
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    source_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    notebook: Mapped["Notebook"] = relationship("Notebook", back_populates="problems")
    session: Mapped["Session | None"] = relationship("Session", back_populates="notebook_problem")
