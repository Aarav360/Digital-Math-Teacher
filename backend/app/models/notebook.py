"""Notebook model (collection of related whiteboards)."""
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class Notebook(Base, TimestampMixin):
    __tablename__ = "notebooks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(256))
    overall_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="notebooks")
    problems: Mapped[list["NotebookProblem"]] = relationship(
        "NotebookProblem",
        back_populates="notebook",
        lazy="selectin",
        order_by="NotebookProblem.order_index",
        cascade="all, delete-orphan",
    )
