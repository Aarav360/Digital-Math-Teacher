"""Notebooks: create, list, update, and manage problems."""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUserId, DbSession
from app.models.notebook import Notebook
from app.models.notebook_problem import NotebookProblem
from app.models.session import Session, SessionStatus
from app.models.base import utc_now
from app.schemas.notebook import (
    NotebookCreate,
    NotebookUpdate,
    NotebookRead,
    NotebookListEntry,
    NotebookProblemCreate,
    NotebookProblemRead,
    NotebookProblemUpdate,
    NotebookProblemReorder,
)

router = APIRouter(prefix="/notebooks", tags=["notebooks"])


async def _build_notebook_read(db: DbSession, notebook: Notebook) -> NotebookRead:
    problems_result = await db.execute(
        select(NotebookProblem, Session)
        .join(Session, NotebookProblem.session_id == Session.id)
        .where(NotebookProblem.notebook_id == notebook.id)
        .order_by(NotebookProblem.order_index.asc())
    )
    problems = []
    for problem, session in problems_result.all():
        problems.append(
            NotebookProblemRead(
                id=problem.id,
                notebook_id=problem.notebook_id,
                session_id=problem.session_id,
                title=problem.title,
                prompt=problem.prompt,
                order_index=problem.order_index,
                source_metadata=problem.source_metadata,
                session_status=session.status.value,
                created_at=problem.created_at,
                updated_at=problem.updated_at,
            )
        )
    return NotebookRead(
        id=notebook.id,
        title=notebook.title,
        overall_prompt=notebook.overall_prompt,
        created_at=notebook.created_at,
        updated_at=notebook.updated_at,
        problems=problems,
    )


async def _create_problem(
    db: DbSession,
    user_id: str,
    notebook: Notebook,
    body: NotebookProblemCreate,
    order_index: int,
) -> NotebookProblem:
    title = body.title.strip() or f"Problem {order_index + 1}"
    session = Session(
        user_id=user_id,
        problem_id=None,
        title=title,
        status=SessionStatus.NOT_STARTED,
    )
    db.add(session)
    await db.flush()
    problem = NotebookProblem(
        notebook_id=notebook.id,
        session_id=session.id,
        title=title,
        prompt=body.prompt,
        order_index=order_index,
        source_metadata=body.source_metadata,
    )
    db.add(problem)
    await db.flush()
    return problem


@router.get("", response_model=list[NotebookListEntry])
async def list_notebooks(user_id: CurrentUserId, db: DbSession):
    result = await db.execute(
        select(Notebook, func.count(NotebookProblem.id))
        .outerjoin(NotebookProblem, NotebookProblem.notebook_id == Notebook.id)
        .where(Notebook.user_id == user_id)
        .group_by(Notebook.id)
        .order_by(Notebook.updated_at.desc())
    )
    rows = result.all()
    return [
        NotebookListEntry(
            id=notebook.id,
            title=notebook.title,
            updated_at=notebook.updated_at,
            problem_count=count or 0,
        )
        for notebook, count in rows
    ]


@router.post("", response_model=NotebookRead, status_code=status.HTTP_201_CREATED)
async def create_notebook(body: NotebookCreate, user_id: CurrentUserId, db: DbSession):
    title = body.title.strip()[:256] if body.title else "Untitled Notebook"
    notebook = Notebook(
        user_id=user_id,
        title=title,
        overall_prompt=body.overall_prompt,
    )
    db.add(notebook)
    await db.flush()

    problems = body.problems or []
    for idx, problem in enumerate(problems):
        order_index = problem.order_index if problem.order_index is not None else idx
        await _create_problem(db, user_id, notebook, problem, order_index)

    await db.refresh(notebook)
    return await _build_notebook_read(db, notebook)


@router.get("/{notebook_id}", response_model=NotebookRead)
async def get_notebook(notebook_id: str, user_id: CurrentUserId, db: DbSession):
    result = await db.execute(
        select(Notebook)
        .where(Notebook.id == notebook_id, Notebook.user_id == user_id)
    )
    notebook = result.scalar_one_or_none()
    if notebook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notebook not found")
    return await _build_notebook_read(db, notebook)


@router.patch("/{notebook_id}", response_model=NotebookRead)
async def update_notebook(notebook_id: str, body: NotebookUpdate, user_id: CurrentUserId, db: DbSession):
    result = await db.execute(
        select(Notebook)
        .where(Notebook.id == notebook_id, Notebook.user_id == user_id)
    )
    notebook = result.scalar_one_or_none()
    if notebook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notebook not found")
    if body.title is not None:
        notebook.title = body.title.strip()[:256]
    if body.overall_prompt is not None:
        notebook.overall_prompt = body.overall_prompt
    await db.flush()
    await db.refresh(notebook)
    return await _build_notebook_read(db, notebook)


@router.post("/{notebook_id}/problems", response_model=list[NotebookProblemRead], status_code=status.HTTP_201_CREATED)
async def add_notebook_problems(
    notebook_id: str,
    problems: list[NotebookProblemCreate],
    user_id: CurrentUserId,
    db: DbSession,
):
    result = await db.execute(
        select(Notebook)
        .where(Notebook.id == notebook_id, Notebook.user_id == user_id)
    )
    notebook = result.scalar_one_or_none()
    if notebook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notebook not found")

    # Determine starting order index
    max_order_result = await db.execute(
        select(func.coalesce(func.max(NotebookProblem.order_index), -1))
        .where(NotebookProblem.notebook_id == notebook.id)
    )
    start_index = (max_order_result.scalar() or -1) + 1

    created = []
    for idx, problem in enumerate(problems):
        order_index = problem.order_index if problem.order_index is not None else start_index + idx
        created_problem = await _create_problem(db, user_id, notebook, problem, order_index)
        created.append(created_problem)
    notebook.updated_at = utc_now()

    # Build read models with status
    created_ids = [p.id for p in created]
    problems_result = await db.execute(
        select(NotebookProblem, Session)
        .join(Session, NotebookProblem.session_id == Session.id)
        .where(NotebookProblem.id.in_(created_ids))
        .order_by(NotebookProblem.order_index.asc())
    )
    out = []
    for problem, session in problems_result.all():
        out.append(
            NotebookProblemRead(
                id=problem.id,
                notebook_id=problem.notebook_id,
                session_id=problem.session_id,
                title=problem.title,
                prompt=problem.prompt,
                order_index=problem.order_index,
                source_metadata=problem.source_metadata,
                session_status=session.status.value,
                created_at=problem.created_at,
                updated_at=problem.updated_at,
            )
        )
    return out


@router.patch("/problems/{problem_id}", response_model=NotebookProblemRead)
async def update_notebook_problem(
    problem_id: str,
    body: NotebookProblemUpdate,
    user_id: CurrentUserId,
    db: DbSession,
):
    result = await db.execute(
        select(NotebookProblem)
        .options(selectinload(NotebookProblem.notebook))
        .where(NotebookProblem.id == problem_id)
    )
    problem = result.scalar_one_or_none()
    if problem is None or problem.notebook.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    if body.title is not None:
        problem.title = body.title.strip()[:256]
    if body.prompt is not None:
        problem.prompt = body.prompt
    if body.order_index is not None:
        problem.order_index = body.order_index
    if body.source_metadata is not None:
        problem.source_metadata = body.source_metadata
    await db.flush()
    await db.refresh(problem)

    session_result = await db.execute(select(Session).where(Session.id == problem.session_id))
    session = session_result.scalar_one()
    if body.title is not None:
        session.title = problem.title
        await db.flush()
    return NotebookProblemRead(
        id=problem.id,
        notebook_id=problem.notebook_id,
        session_id=problem.session_id,
        title=problem.title,
        prompt=problem.prompt,
        order_index=problem.order_index,
        source_metadata=problem.source_metadata,
        session_status=session.status.value,
        created_at=problem.created_at,
        updated_at=problem.updated_at,
    )


@router.delete("/problems/{problem_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notebook_problem(problem_id: str, user_id: CurrentUserId, db: DbSession):
    result = await db.execute(
        select(NotebookProblem)
        .options(selectinload(NotebookProblem.notebook))
        .where(NotebookProblem.id == problem_id)
    )
    problem = result.scalar_one_or_none()
    if problem is None or problem.notebook.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    session_id = problem.session_id
    await db.delete(problem)
    problem.notebook.updated_at = utc_now()
    if session_id:
        session_result = await db.execute(
            select(Session).where(Session.id == session_id, Session.user_id == user_id)
        )
        session = session_result.scalar_one_or_none()
        if session is not None:
            await db.delete(session)
    await db.flush()
    return None


@router.patch("/{notebook_id}/problems/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_notebook_problems(
    notebook_id: str,
    body: NotebookProblemReorder,
    user_id: CurrentUserId,
    db: DbSession,
):
    result = await db.execute(
        select(Notebook)
        .where(Notebook.id == notebook_id, Notebook.user_id == user_id)
    )
    notebook = result.scalar_one_or_none()
    if notebook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notebook not found")

    ids = [item.id for item in body.items]
    problems_result = await db.execute(
        select(NotebookProblem)
        .where(NotebookProblem.notebook_id == notebook.id, NotebookProblem.id.in_(ids))
    )
    problems = {p.id: p for p in problems_result.scalars().all()}
    for item in body.items:
        if item.id in problems:
            problems[item.id].order_index = item.order_index
    notebook.updated_at = utc_now()
    await db.flush()
    return None
