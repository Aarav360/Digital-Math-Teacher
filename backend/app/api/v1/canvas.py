"""Canvas: submit snapshot (strokes + dimensions)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUserId, DbSession
from app.models.session import Session
from app.models.canvas_snapshot import CanvasSnapshot
from app.schemas.canvas import CanvasSnapshotCreate, CanvasSnapshotRead

router = APIRouter(prefix="/canvas", tags=["canvas"])


@router.post("/snapshot", response_model=CanvasSnapshotRead)
async def create_snapshot(body: CanvasSnapshotCreate, user_id: CurrentUserId, db: DbSession):
    result = await db.execute(select(Session).where(Session.id == body.session_id, Session.user_id == user_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    # Normalize strokes to list of dicts for JSONB
    strokes = [s if isinstance(s, dict) else s.model_dump() for s in body.strokes]
    snapshot = CanvasSnapshot(
        session_id=body.session_id,
        strokes_json={"strokes": strokes},
        width=body.width,
        height=body.height,
        image_url=None,  # TODO: upload image_base64 to blob storage and set URL
    )
    db.add(snapshot)
    await db.flush()
    await db.refresh(snapshot)
    return snapshot
