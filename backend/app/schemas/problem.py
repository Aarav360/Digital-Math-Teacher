"""Problem request/response schemas. API responses use camelCase (e.g. estimatedTime) for frontend 1:1 consumption."""
from datetime import datetime
from pydantic import BaseModel, Field


class ProblemBase(BaseModel):
    title: str
    topic: str
    difficulty: int
    type: str
    estimated_time: str | None = Field(None, serialization_alias="estimatedTime")
    statement: str
    solution_canonical: str | None = None


class ProblemCreate(ProblemBase):
    id: str


class ProblemRead(ProblemBase):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProblemPublicRead(BaseModel):
    """Public-facing problem detail — excludes solution_canonical."""
    id: str
    title: str
    topic: str
    difficulty: int
    type: str
    estimated_time: str | None = Field(None, serialization_alias="estimatedTime")
    statement: str
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class ProblemListEntry(BaseModel):
    id: str
    title: str
    topic: str
    difficulty: int
    type: str
    estimated_time: str | None = Field(None, serialization_alias="estimatedTime")

    model_config = {"from_attributes": True}
