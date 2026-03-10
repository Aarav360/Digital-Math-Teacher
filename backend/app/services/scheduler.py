"""Background cleanup scheduler."""
from datetime import timedelta
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import delete, select, and_, or_

from app.core.config import settings
from app.db.session import async_session_factory
from app.models.base import utc_now
from app.models.oauth_state import OAuthState
from app.models.oauth_login_code import OAuthLoginCode
from app.models.user import User

_scheduler: Optional[AsyncIOScheduler] = None


async def cleanup_oauth_states() -> None:
    now = utc_now()
    async with async_session_factory() as db:
        await db.execute(
            delete(OAuthState).where(
                (OAuthState.expires_at < now) | (OAuthState.consumed_at.is_not(None))
            )
        )
        await db.commit()


async def cleanup_oauth_login_codes() -> None:
    now = utc_now()
    async with async_session_factory() as db:
        await db.execute(
            delete(OAuthLoginCode).where(
                (OAuthLoginCode.expires_at < now) | (OAuthLoginCode.consumed_at.is_not(None))
            )
        )
        await db.commit()


async def cleanup_inactive_guests() -> None:
    now = utc_now()
    hard_cutoff = now - timedelta(days=settings.guest_hard_delete_days)
    async with async_session_factory() as db:
        result = await db.execute(
            select(User).where(
                User.is_guest.is_(True),
                or_(
                    User.last_seen_at < hard_cutoff,
                    and_(User.last_seen_at.is_(None), User.created_at < hard_cutoff),
                ),
            )
        )
        for user in result.scalars():
            await db.delete(user)
        await db.commit()


def start_scheduler() -> None:
    global _scheduler
    if not settings.enable_scheduler:
        return
    if _scheduler is not None:
        return
    scheduler = AsyncIOScheduler()
    scheduler.add_job(cleanup_oauth_states, "interval", hours=1, id="cleanup_oauth_states", coalesce=True, max_instances=1)
    scheduler.add_job(cleanup_oauth_login_codes, "interval", hours=1, id="cleanup_oauth_login_codes", coalesce=True, max_instances=1)
    scheduler.add_job(cleanup_inactive_guests, "interval", hours=1, id="cleanup_inactive_guests", coalesce=True, max_instances=1)
    scheduler.start()
    _scheduler = scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    _scheduler.shutdown(wait=False)
    _scheduler = None
