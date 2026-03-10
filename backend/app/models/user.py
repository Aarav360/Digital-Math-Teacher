"""User model (authenticated or guest)."""
from datetime import datetime
from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin
from app.models.base import utc_now


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_guest: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=True)

    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="user", lazy="selectin")
    notebooks: Mapped[list["Notebook"]] = relationship("Notebook", back_populates="user", lazy="selectin")
