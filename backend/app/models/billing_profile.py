"""Billing profile placeholder tied to account."""
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class BillingProfile(Base, TimestampMixin):
    __tablename__ = "billing_profiles"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    external_customer_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
