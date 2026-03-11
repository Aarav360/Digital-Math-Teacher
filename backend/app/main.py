"""FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.services.scheduler import start_scheduler, stop_scheduler
from app.services.sample_problems import seed_sample_problems

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://mathteacher.ai",
        "https://www.mathteacher.ai",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
async def on_startup() -> None:
    start_scheduler()
    await seed_sample_problems()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    stop_scheduler()
