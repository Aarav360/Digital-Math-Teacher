"""OAuth account linkage model."""
from sqlalchemy import ForeignKey, String, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class OAuthAccount(Base, TimestampMixin):
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_oauth_accounts_provider_user"),
        Index("ix_oauth_accounts_provider_email", "provider", "provider_email"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)

    user: Mapped["User"] = relationship("User")
