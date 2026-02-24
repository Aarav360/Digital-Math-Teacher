"""Aggregate all v1 routers."""
from fastapi import APIRouter
from app.core.config import settings
from app.api.v1 import health, auth, problems, sessions, canvas, analysis, chat, notebooks

api_router = APIRouter(prefix=settings.api_v1_prefix)

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(problems.router)
api_router.include_router(sessions.router)
api_router.include_router(canvas.router)
api_router.include_router(analysis.router)
api_router.include_router(chat.router)
api_router.include_router(notebooks.router)
