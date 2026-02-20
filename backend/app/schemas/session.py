"""Session request/response schemas."""
from datetime import datetime
from pydantic import BaseModel
from app.schemas.problem import ProblemListEntry, ProblemPublicRead


class SessionCreate(BaseModel):
    problem_id: str | None = None


class SessionUpdate(BaseModel):
    status: str | None = None  # not_started | in_progress | evaluating | feedback_ready | completed
    title: str | None = None


class SessionRead(BaseModel):
    id: str
    user_id: str
    problem_id: str | None = None
    title: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionWithProblem(SessionRead):
    problem: ProblemPublicRead | None = None


class SessionListEntry(BaseModel):
    id: str
    problem_id: str | None = None
    title: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    problem_title: str | None = None
    topic: str | None = None
    steps_correct: int | None = None
    steps_total: int | None = None

    model_config = {"from_attributes": True}
