"""User settings/preferences tied to account."""
from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class UserSettings(Base, TimestampMixin):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    persona: Mapped[str] = mapped_column(String(32), default="calm")
    help_level: Mapped[int] = mapped_column(Integer, default=2)
    theme: Mapped[str] = mapped_column(String(16), default="light")
    pen_thickness: Mapped[str] = mapped_column(String(16), default="medium")
    smooth_strokes: Mapped[bool] = mapped_column(Boolean, default=True)
    show_grid: Mapped[bool] = mapped_column(Boolean, default=False)
    zoom_speed: Mapped[float] = mapped_column(Float, default=1.1)
    constant_grid_size: Mapped[bool] = mapped_column(Boolean, default=True)
    save_history: Mapped[bool] = mapped_column(Boolean, default=True)
    grade_level: Mapped[str | None] = mapped_column(String(64), nullable=True)
