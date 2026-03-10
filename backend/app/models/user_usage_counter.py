"""Usage counters tied to account."""
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class UserUsageCounter(Base, TimestampMixin):
    __tablename__ = "user_usage_counters"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    chat_messages: Mapped[int] = mapped_column(Integer, default=0)
    analysis_runs: Mapped[int] = mapped_column(Integer, default=0)
