"""Common dependencies: auth, db, optional user for guest."""
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta
from sqlalchemy import select, update

from app.db.session import get_db
from app.core.security import get_subject_from_token
from app.core.config import settings
from app.models.base import utc_now
from app.models.user import User

security = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> str:
    """Require valid Bearer token; return user id. Raises 401 if missing or invalid."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = get_subject_from_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.is_guest and user.last_seen_at is not None:
        idle_cutoff = utc_now() - timedelta(hours=settings.guest_idle_ttl_hours)
        if user.last_seen_at < idle_cutoff:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Guest session expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
    await db.execute(update(User).where(User.id == user_id).values(last_seen_at=utc_now()))
    return user_id


async def get_current_user(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Load current user from DB; 404 if not found."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def get_optional_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> str | None:
    """Return user id if valid Bearer present, else None (for optional auth)."""
    if credentials is None:
        return None
    user_id = get_subject_from_token(credentials.credentials)
    if user_id is None:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return None
    if user.is_guest and user.last_seen_at is not None:
        idle_cutoff = utc_now() - timedelta(hours=settings.guest_idle_ttl_hours)
        if user.last_seen_at < idle_cutoff:
            return None
    await db.execute(update(User).where(User.id == user_id).values(last_seen_at=utc_now()))
    return user_id


# Type aliases for route injection
CurrentUserId = Annotated[str, Depends(get_current_user_id)]
CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
