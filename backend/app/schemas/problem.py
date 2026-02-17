"""Problem request/response schemas."""
from datetime import datetime
from pydantic import BaseModel


class ProblemBase(BaseModel):
    title: str
    topic: str
    difficulty: int
    type: str
    estimated_time: str | None = None
    statement: str
    solution_canonical: str | None = None


class ProblemCreate(ProblemBase):
    id: str


class ProblemRead(ProblemBase):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProblemListEntry(BaseModel):
    id: str
    title: str
    topic: str
    difficulty: int
    type: str
    estimated_time: str | None = None

    model_config = {"from_attributes": True}
