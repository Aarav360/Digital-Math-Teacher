"""Auth: token creation (e.g. for guest), me, OAuth."""
from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select, update

from app.api.deps import CurrentUser, DbSession, get_optional_user_id
from app.core.config import settings
from app.core.security import create_access_token
from app.models.base import utc_now
from app.models.oauth_account import OAuthAccount
from app.models.oauth_state import OAuthState
from app.models.oauth_login_code import OAuthLoginCode
from app.models.session import Session
from app.models.notebook import Notebook
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.auth import OAuthFinishRequest, TokenResponse
from app.schemas.settings import UserSettingsRead, UserSettingsUpdate
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_TOKENINFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_PROVIDER = "google"


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
        last_seen_at=utc_now(),
    )
    db.add(guest)
    await db.flush()
    token = create_access_token(guest.id, extra_claims={"guest": True})
    return {"access_token": token, "token_type": "bearer", "user_id": guest.id}


async def _get_or_create_settings(db: DbSession, user: User) -> UserSettings:
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings_row = result.scalar_one_or_none()
    if settings_row is None:
        settings_row = UserSettings(user_id=user.id)
        db.add(settings_row)
        await db.flush()
    return settings_row


@router.get("/settings", response_model=UserSettingsRead)
async def get_settings(user: CurrentUser, db: DbSession):
    settings_row = await _get_or_create_settings(db, user)
    return UserSettingsRead(
        user_id=user.id,
        name=user.name,
        email=user.email,
        persona=settings_row.persona,
        help_level=settings_row.help_level,
        theme=settings_row.theme,
        pen_thickness=settings_row.pen_thickness,
        smooth_strokes=settings_row.smooth_strokes,
        show_grid=settings_row.show_grid,
        zoom_speed=settings_row.zoom_speed,
        constant_grid_size=settings_row.constant_grid_size,
        save_history=settings_row.save_history,
        grade_level=settings_row.grade_level,
    )


@router.put("/settings", response_model=UserSettingsRead)
async def update_settings(body: UserSettingsUpdate, user: CurrentUser, db: DbSession):
    settings_row = await _get_or_create_settings(db, user)
    if body.name is not None:
        user.name = body.name.strip() or None
    if body.persona is not None:
        settings_row.persona = body.persona
    if body.help_level is not None:
        settings_row.help_level = body.help_level
    if body.theme is not None:
        settings_row.theme = body.theme
    if body.pen_thickness is not None:
        settings_row.pen_thickness = body.pen_thickness
    if body.smooth_strokes is not None:
        settings_row.smooth_strokes = body.smooth_strokes
    if body.show_grid is not None:
        settings_row.show_grid = body.show_grid
    if body.zoom_speed is not None:
        settings_row.zoom_speed = body.zoom_speed
    if body.constant_grid_size is not None:
        settings_row.constant_grid_size = body.constant_grid_size
    if body.save_history is not None:
        settings_row.save_history = body.save_history
    if body.grade_level is not None:
        settings_row.grade_level = body.grade_level.strip() or None
    await db.flush()
    return UserSettingsRead(
        user_id=user.id,
        name=user.name,
        email=user.email,
        persona=settings_row.persona,
        help_level=settings_row.help_level,
        theme=settings_row.theme,
        pen_thickness=settings_row.pen_thickness,
        smooth_strokes=settings_row.smooth_strokes,
        show_grid=settings_row.show_grid,
        zoom_speed=settings_row.zoom_speed,
        constant_grid_size=settings_row.constant_grid_size,
        save_history=settings_row.save_history,
        grade_level=settings_row.grade_level,
    )


def _pkce_verifier() -> str:
    return secrets.token_urlsafe(64)


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("utf-8")


def _google_auth_url(state: str, code_challenge: str) -> str:
    if not settings.google_client_id or not settings.google_redirect_uri:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    params = {
        "response_type": "code",
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "scope": "openid email profile",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


async def _exchange_code_for_tokens(code: str, code_verifier: str) -> dict | None:
    if not settings.google_client_id or not settings.google_client_secret or not settings.google_redirect_uri:
        return None
    payload = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.post(GOOGLE_TOKEN_ENDPOINT, data=payload)
        except httpx.HTTPError:
            return None
    if res.status_code != 200:
        return None
    try:
        return res.json()
    except ValueError:
        return None


async def _fetch_token_info(id_token: str) -> dict | None:
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.get(GOOGLE_TOKENINFO_ENDPOINT, params={"id_token": id_token})
        except httpx.HTTPError:
            return None
    if res.status_code != 200:
        return None
    try:
        return res.json()
    except ValueError:
        return None


def _redirect_with_error(code: str) -> RedirectResponse:
    url = f"{settings.frontend_base_url}/auth?error={code}"
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.post("/google/start")
async def google_start(
    db: DbSession,
    user_id: str | None = Depends(get_optional_user_id),
):
    if not settings.google_client_id or not settings.google_redirect_uri:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    state = secrets.token_urlsafe(32)
    code_verifier = _pkce_verifier()
    expires_at = utc_now() + timedelta(minutes=settings.oauth_state_ttl_minutes)
    guest_user_id = None
    if user_id:
        result = await db.execute(select(User).where(User.id == user_id, User.is_guest.is_(True)))
        guest = result.scalar_one_or_none()
        if guest is not None:
            guest_user_id = user_id

    oauth_state = OAuthState(
        state=state,
        code_verifier=code_verifier,
        guest_user_id=guest_user_id,
        expires_at=expires_at,
    )
    db.add(oauth_state)
    await db.flush()
    auth_url = _google_auth_url(state, _pkce_challenge(code_verifier))
    return {"auth_url": auth_url}


@router.get("/google/callback")
async def google_callback(state: str, code: str, db: DbSession):
    now = utc_now()
    result = await db.execute(select(OAuthState).where(OAuthState.state == state))
    oauth_state = result.scalar_one_or_none()
    if oauth_state is None or oauth_state.expires_at < now or oauth_state.consumed_at is not None:
        return _redirect_with_error("OAUTH_STATE_INVALID")

    oauth_state.consumed_at = now
    await db.flush()

    tokens = await _exchange_code_for_tokens(code, oauth_state.code_verifier)
    if not tokens or "id_token" not in tokens:
        return _redirect_with_error("OAUTH_TOKEN_EXCHANGE_FAILED")

    token_info = await _fetch_token_info(tokens["id_token"])
    if not token_info:
        return _redirect_with_error("OAUTH_TOKENINFO_FAILED")

    aud = token_info.get("aud")
    iss = token_info.get("iss")
    email = token_info.get("email")
    email_verified = token_info.get("email_verified")
    sub = token_info.get("sub")
    exp = token_info.get("exp")

    if aud != settings.google_client_id:
        return _redirect_with_error("OAUTH_TOKENINFO_FAILED")
    if iss not in ("accounts.google.com", "https://accounts.google.com"):
        return _redirect_with_error("OAUTH_TOKENINFO_FAILED")
    if not sub:
        return _redirect_with_error("OAUTH_TOKENINFO_FAILED")
    if email_verified not in (True, "true", "True"):
        return _redirect_with_error("OAUTH_EMAIL_UNVERIFIED")
    if exp is not None:
        try:
            exp_int = int(exp)
            if datetime.fromtimestamp(exp_int, tz=timezone.utc) < now:
                return _redirect_with_error("OAUTH_TOKENINFO_FAILED")
        except (TypeError, ValueError):
            return _redirect_with_error("OAUTH_TOKENINFO_FAILED")

    existing_account = None
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == GOOGLE_PROVIDER,
            OAuthAccount.provider_user_id == sub,
        )
    )
    existing_account = result.scalar_one_or_none()

    email_user = None
    if email:
        result = await db.execute(select(User).where(User.email == email))
        email_user = result.scalar_one_or_none()

    if existing_account is not None:
        user = await db.get(User, existing_account.user_id)
        if user is None:
            return _redirect_with_error("OAUTH_ACCOUNT_CONFLICT")
        if email_user is not None and email_user.id != user.id:
            return _redirect_with_error("OAUTH_ACCOUNT_CONFLICT")
    elif email_user is not None:
        user = email_user
    else:
        user = User(
            id=str(__import__("uuid").uuid4()),
            email=email,
            name=token_info.get("name"),
            avatar_url=token_info.get("picture"),
            is_guest=False,
            last_seen_at=now,
        )
        db.add(user)
        await db.flush()

    if oauth_state.guest_user_id and oauth_state.guest_user_id != user.id:
        guest_user = await db.get(User, oauth_state.guest_user_id)
        if guest_user is not None and guest_user.is_guest:
            await db.execute(
                update(Session).where(Session.user_id == oauth_state.guest_user_id).values(user_id=user.id)
            )
            await db.execute(
                update(Notebook).where(Notebook.user_id == oauth_state.guest_user_id).values(user_id=user.id)
            )
            await db.delete(guest_user)

    user.is_guest = False
    user.last_seen_at = now
    if email:
        user.email = email
    if token_info.get("name"):
        user.name = token_info.get("name")
    if token_info.get("picture"):
        user.avatar_url = token_info.get("picture")

    if existing_account is None:
        existing_account = OAuthAccount(
            provider=GOOGLE_PROVIDER,
            provider_user_id=sub,
            provider_email=email,
            user_id=user.id,
        )
        db.add(existing_account)
    else:
        existing_account.provider_email = email

    login_code = secrets.token_urlsafe(32)
    login_expires_at = now + timedelta(minutes=settings.oauth_login_code_ttl_minutes)
    db.add(
        OAuthLoginCode(
            code=login_code,
            user_id=user.id,
            expires_at=login_expires_at,
        )
    )
    await db.flush()

    callback_url = f"{settings.frontend_base_url}/auth/callback?code={login_code}"
    return RedirectResponse(url=callback_url, status_code=status.HTTP_302_FOUND)


@router.post("/google/finish", response_model=TokenResponse)
async def google_finish(body: OAuthFinishRequest, db: DbSession):
    now = utc_now()
    result = await db.execute(select(OAuthLoginCode).where(OAuthLoginCode.code == body.code))
    login_code = result.scalar_one_or_none()
    if login_code is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid login code")
    if login_code.consumed_at is not None or login_code.expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Login code expired")

    login_code.consumed_at = now
    user = await db.get(User, login_code.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    expiry_days = 7 if user.is_guest else 30
    token = create_access_token(
        user.id,
        expires_delta=timedelta(days=expiry_days),
        extra_claims={"guest": user.is_guest},
    )
    user.last_seen_at = now

    return {"access_token": token, "token_type": "bearer", "user_id": user.id}
