"""Problem model (math problem and canonical solution)."""
from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class Problem(Base, TimestampMixin):
    __tablename__ = "problems"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(512))
    topic: Mapped[str] = mapped_column(String(128))
    difficulty: Mapped[int] = mapped_column(Integer)  # 1-5
    type: Mapped[str] = mapped_column(String(128))  # Equations, Word Problems, Proof/Reasoning
    estimated_time: Mapped[str] = mapped_column(String(32), nullable=True)
    statement: Mapped[str] = mapped_column(Text)
    solution_canonical: Mapped[str | None] = mapped_column(Text, nullable=True)  # LaTeX or structured for backend

    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="problem", lazy="selectin")
