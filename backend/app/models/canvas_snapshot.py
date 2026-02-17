"""Canvas snapshot (strokes + dimensions, optional image URL)."""
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class CanvasSnapshot(Base, TimestampMixin):
    __tablename__ = "canvas_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    strokes_json: Mapped[dict] = mapped_column(JSONB)  # list of stroke objects
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    session: Mapped["Session"] = relationship("Session", back_populates="canvas_snapshots")
