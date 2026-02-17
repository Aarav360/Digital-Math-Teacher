"""Problems: list and get by id."""
from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select
from app.api.deps import DbSession
from app.models.problem import Problem
from app.schemas.problem import ProblemRead, ProblemListEntry

router = APIRouter(prefix="/problems", tags=["problems"])


@router.get("", response_model=list[ProblemListEntry])
async def list_problems(
    db: DbSession,
    topic: str | None = Query(None, description="Filter by topic"),
    difficulty: int | None = Query(None, ge=1, le=5),
    type: str | None = Query(None),
    search: str | None = Query(None),
):
    q = select(Problem)
    if topic:
        q = q.where(Problem.topic == topic)
    if difficulty is not None:
        q = q.where(Problem.difficulty == difficulty)
    if type:
        q = q.where(Problem.type == type)
    if search:
        q = q.where(Problem.title.ilike(f"%{search}%"))
    q = q.order_by(Problem.title)
    result = await db.execute(q)
    problems = result.scalars().all()
    return problems


@router.get("/{problem_id}", response_model=ProblemRead)
async def get_problem(problem_id: str, db: DbSession):
    result = await db.execute(select(Problem).where(Problem.id == problem_id))
    problem = result.scalar_one_or_none()
    if problem is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    return problem
