"""User file placeholder tied to account."""
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class UserFile(Base, TimestampMixin):
    __tablename__ = "user_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
