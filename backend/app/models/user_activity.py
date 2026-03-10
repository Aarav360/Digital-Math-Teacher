"""User activity log placeholder tied to account."""
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class UserActivity(Base, TimestampMixin):
    __tablename__ = "user_activity"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    action: Mapped[str] = mapped_column(String(128))
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
