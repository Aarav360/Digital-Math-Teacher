"""Analysis: run step segmentation + OCR + evaluation (stub)."""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUserId, DbSession
from app.models.session import Session
from app.models.canvas_snapshot import CanvasSnapshot
from app.models.step import Step, StepEvaluation
from app.models.session import SessionStatus
from app.schemas.step import AnalysisRequest, AnalysisResponse, StepRead, StepEvaluationRead

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/steps", response_model=AnalysisResponse)
async def analyze_steps(body: AnalysisRequest, user_id: CurrentUserId, db: DbSession):
    session_id = body.session_id
    snapshot_id = body.snapshot_id
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user_id).options(
            selectinload(Session.canvas_snapshots), selectinload(Session.problem)
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    # Mark in progress while analysis runs (simpler status set)
    session.status = SessionStatus.IN_PROGRESS
    await db.flush()
    # Get latest snapshot or by id
    if snapshot_id:
        snap_result = await db.execute(
            select(CanvasSnapshot).where(
                CanvasSnapshot.id == snapshot_id, CanvasSnapshot.session_id == session_id
            )
        )
        snapshot = snap_result.scalar_one_or_none()
    else:
        snap_result = await db.execute(
            select(CanvasSnapshot)
            .where(CanvasSnapshot.session_id == session_id)
            .order_by(CanvasSnapshot.created_at.desc())
            .limit(1)
        )
        snapshot = snap_result.scalar_one_or_none()
    if snapshot is None:
        session.status = SessionStatus.IN_PROGRESS
        await db.flush()
        return AnalysisResponse(steps=[], summary="No snapshot to analyze.")
    # Stub: call math pipeline service (temporal grouping, OCR, SymPy, LLM)
    # For scaffold we return empty steps; real impl in services/math_pipeline
    from app.services.math_pipeline import run_analysis
    steps_created = await run_analysis(db, session, snapshot)
    # Load steps with evaluations for response
    steps_result = await db.execute(
        select(Step).where(Step.session_id == session_id).options(selectinload(Step.evaluation)).order_by(Step.step_index)
    )
    steps = steps_result.scalars().all()
    # Auto-status based on evaluations
    if steps_created == 0 or not steps:
        session.status = SessionStatus.IN_PROGRESS
    else:
        has_issue = any(
            s.evaluation and s.evaluation.status in ("incorrect", "warning")
            for s in steps
        )
        session.status = SessionStatus.NEEDS_REVIEW if has_issue else SessionStatus.COMPLETED
    await db.flush()
    step_reads = [
        StepRead(
            id=s.id,
            session_id=s.session_id,
            step_index=s.step_index,
            latex_raw=s.latex_raw,
            evaluation=StepEvaluationRead(
                id=e.id, step_id=e.step_id, status=e.status, verdict=e.verdict,
                explanation=e.explanation, suggestion=e.suggestion, created_at=e.created_at,
            ) if (e := s.evaluation) else None,
            created_at=s.created_at,
        )
        for s in steps
    ]
    return AnalysisResponse(steps=step_reads, summary=f"{len(step_reads)} steps analyzed.")
