"""Analysis: run step segmentation + Qwen evaluation, and grading follow-up chat."""
import asyncio

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUserId, DbSession
from app.models.chat_message import ChatMessage
from app.models.canvas_snapshot import CanvasSnapshot
from app.models.session import Session, SessionStatus
from app.models.step import Step, StepEvaluation
from app.models.user_usage_counter import UserUsageCounter
from app.schemas.step import (
    AnalysisRequest,
    AnalysisResponse,
    GradingChatRequest,
    GradingChatResponse,
    StepEvaluationRead,
    StepRead,
)

router = APIRouter(prefix="/analysis", tags=["analysis"])

_GRADER_ROLES = ("grader_user", "grader_assistant")


@router.post("/steps", response_model=AnalysisResponse)
async def analyze_steps(body: AnalysisRequest, user_id: CurrentUserId, db: DbSession):
    session_id = body.session_id
    snapshot_id = body.snapshot_id

    result = await db.execute(
        select(Session)
        .where(Session.id == session_id, Session.user_id == user_id)
        .options(selectinload(Session.canvas_snapshots), selectinload(Session.problem))
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Track usage
    await db.execute(
        insert(UserUsageCounter)
        .values(user_id=user_id, analysis_runs=1)
        .on_conflict_do_update(
            index_elements=[UserUsageCounter.user_id],
            set_={"analysis_runs": UserUsageCounter.analysis_runs + 1},
        )
    )

    session.status = SessionStatus.EVALUATING
    await db.flush()

    if snapshot_id:
        snap_result = await db.execute(
            select(CanvasSnapshot).where(
                CanvasSnapshot.id == snapshot_id,
                CanvasSnapshot.session_id == session_id,
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

    from app.services.math_pipeline import run_analysis

    steps_created = await run_analysis(
        db, session, snapshot, image_base64=body.image_base64
    )

    session.status = SessionStatus.FEEDBACK_READY
    await db.flush()

    steps_result = await db.execute(
        select(Step)
        .where(Step.session_id == session_id)
        .options(selectinload(Step.evaluation))
        .order_by(Step.step_index)
    )
    steps = steps_result.scalars().all()

    step_reads = [
        StepRead(
            id=s.id,
            session_id=s.session_id,
            step_index=s.step_index,
            latex_raw=s.latex_raw,
            evaluation=StepEvaluationRead(
                id=e.id,
                step_id=e.step_id,
                status=e.status,
                verdict=e.verdict,
                explanation=e.explanation,
                suggestion=e.suggestion,
                created_at=e.created_at,
            )
            if (e := s.evaluation)
            else None,
            created_at=s.created_at,
        )
        for s in steps
    ]
    return AnalysisResponse(
        steps=step_reads, summary=f"{len(step_reads)} steps analyzed."
    )


@router.post("/chat", response_model=GradingChatResponse)
async def grading_chat(
    body: GradingChatRequest, user_id: CurrentUserId, db: DbSession
):
    """Send a follow-up clarification message to the Qwen grader after analysis."""
    result = await db.execute(
        select(Session).where(
            Session.id == body.session_id, Session.user_id == user_id
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Load existing grading conversation history from DB
    history_result = await db.execute(
        select(ChatMessage)
        .where(
            ChatMessage.session_id == body.session_id,
            ChatMessage.role.in_(_GRADER_ROLES),
        )
        .order_by(ChatMessage.created_at)
    )
    history_rows = history_result.scalars().all()

    if not history_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No grading session found. Run POST /analysis/steps first.",
        )

    existing_history = [
        {
            "role": row.role.removeprefix("grader_"),  # "user" or "assistant"
            "content": row.content,
        }
        for row in history_rows
    ]

    from app.services.grading.qwen_grader import QwenGraderService

    grader = QwenGraderService()
    try:
        response_text, updated_history = await asyncio.to_thread(
            grader.send_followup,
            body.message,
            existing_history,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )

    # Persist only the new turns appended by send_followup
    new_turns = updated_history[len(existing_history):]
    for turn in new_turns:
        db.add(
            ChatMessage(
                session_id=body.session_id,
                role=f"grader_{turn['role']}",
                content=turn["content"],
            )
        )
    await db.flush()

    grading_data = grader._parse_grading_response(response_text)
    has_more = grading_data.get("has_questions", False)

    return GradingChatResponse(reply=response_text, has_more_questions=has_more)
