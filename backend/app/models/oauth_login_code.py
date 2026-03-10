"""Short-lived OAuth login code for frontend exchange."""
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class OAuthLoginCode(Base, TimestampMixin):
    __tablename__ = "oauth_login_codes"

    code: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User")
