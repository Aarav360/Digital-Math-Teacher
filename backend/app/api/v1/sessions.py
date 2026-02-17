"""Sessions: create, get, list, update."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUserId, DbSession
from app.models.session import Session, SessionStatus
from app.models.problem import Problem
from app.models.step import Step, StepEvaluation
from app.schemas.session import SessionCreate, SessionUpdate, SessionRead, SessionWithProblem, SessionListEntry

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionRead)
async def create_session(body: SessionCreate, user_id: CurrentUserId, db: DbSession):
    # Verify problem exists
    result = await db.execute(select(Problem).where(Problem.id == body.problem_id))
    problem = result.scalar_one_or_none()
    if problem is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    session = Session(
        user_id=user_id,
        problem_id=body.problem_id,
        status=SessionStatus.NOT_STARTED,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


@router.get("", response_model=list[SessionListEntry])
async def list_sessions(
    user_id: CurrentUserId,
    db: DbSession,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("recent", description="recent | name | topic"),
):
    q = (
        select(Session, Problem.title.label("problem_title"), Problem.topic)
        .join(Problem, Session.problem_id == Problem.id)
        .where(Session.user_id == user_id)
    )
    if sort == "recent":
        q = q.order_by(Session.updated_at.desc())
    elif sort == "name":
        q = q.order_by(Problem.title)
    elif sort == "topic":
        q = q.order_by(Problem.topic, Session.updated_at.desc())
    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    rows = result.all()
    # Build list with step counts (simplified: no subquery here, just session id)
    out = []
    for row in rows:
        sess, problem_title, topic = row
        # Optional: query steps_correct/total per session
        count_result = await db.execute(
            select(func.count(Step.id)).where(Step.session_id == sess.id)
        )
        steps_total = count_result.scalar() or 0
        correct_result = await db.execute(
            select(func.count(StepEvaluation.id))
            .select_from(StepEvaluation)
            .join(Step, StepEvaluation.step_id == Step.id)
            .where(Step.session_id == sess.id, StepEvaluation.status == "correct")
        )
        steps_correct = correct_result.scalar() or 0
        out.append(
            SessionListEntry(
                id=sess.id,
                problem_id=sess.problem_id,
                status=sess.status.value,
                created_at=sess.created_at,
                updated_at=sess.updated_at,
                problem_title=problem_title,
                topic=topic,
                steps_correct=steps_correct,
                steps_total=steps_total,
            )
        )
    return out


@router.get("/{session_id}", response_model=SessionWithProblem)
async def get_session(session_id: str, user_id: CurrentUserId, db: DbSession):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user_id).options(selectinload(Session.problem))
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


@router.patch("/{session_id}", response_model=SessionRead)
async def update_session(session_id: str, body: SessionUpdate, user_id: CurrentUserId, db: DbSession):
    result = await db.execute(select(Session).where(Session.id == session_id, Session.user_id == user_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if body.status is not None:
        session.status = SessionStatus(body.status)
    await db.flush()
    await db.refresh(session)
    return session
