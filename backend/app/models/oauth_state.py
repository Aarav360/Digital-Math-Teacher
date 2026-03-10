"""OAuth state + PKCE verifier storage."""
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class OAuthState(Base, TimestampMixin):
    __tablename__ = "oauth_states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    state: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    code_verifier: Mapped[str] = mapped_column(String(512))
    guest_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    guest_user: Mapped["User | None"] = relationship("User")
