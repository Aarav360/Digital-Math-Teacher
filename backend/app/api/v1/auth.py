"""Auth: token creation (e.g. for guest), me."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from app.api.deps import CurrentUserId, CurrentUser, DbSession
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserRead)
async def me(user: CurrentUser):
    """Return current user profile."""
    return user


@router.post("/guest")
async def create_guest_token(db: DbSession):
    """Create a guest user and return an access token. No auth required."""
    import uuid
    guest = User(
        id=str(uuid.uuid4()),
        email=None,
        name=None,
        is_guest=True,
    )
    db.add(guest)
    await db.flush()
    token = create_access_token(guest.id, extra_claims={"guest": True})
    return {"access_token": token, "token_type": "bearer", "user_id": guest.id}
