"""JWT creation and validation; optional guest token handling."""
from datetime import datetime, timedelta, timezone
from typing import Any
from jose import JWTError, jwt
from app.core.config import settings


def create_access_token(
    subject: str | int,
    *,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Create a JWT access token. Subject is typically user id (str or int)."""
    to_encode: dict[str, Any] = {"sub": str(subject)}
    if extra_claims:
        to_encode.update(extra_claims)
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode["exp"] = expire
    to_encode["iat"] = datetime.now(timezone.utc)
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and validate JWT; returns payload or None on failure."""
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        return payload
    except JWTError:
        return None


def get_subject_from_token(token: str) -> str | None:
    """Return the 'sub' claim (user id) from a valid token, else None."""
    payload = decode_access_token(token)
    if payload is None:
        return None
    return payload.get("sub")
