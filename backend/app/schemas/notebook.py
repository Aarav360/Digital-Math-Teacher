"""Notebook request/response schemas."""
from datetime import datetime
from pydantic import BaseModel


class NotebookProblemCreate(BaseModel):
    title: str
    prompt: str | None = None
    order_index: int | None = None
    source_metadata: dict | None = None


class NotebookCreate(BaseModel):
    title: str
    overall_prompt: str | None = None
    problems: list[NotebookProblemCreate] | None = None


class NotebookUpdate(BaseModel):
    title: str | None = None
    overall_prompt: str | None = None


class NotebookProblemUpdate(BaseModel):
    title: str | None = None
    prompt: str | None = None
    order_index: int | None = None
    source_metadata: dict | None = None


class NotebookProblemReorderItem(BaseModel):
    id: str
    order_index: int


class NotebookProblemReorder(BaseModel):
    items: list[NotebookProblemReorderItem]


class NotebookProblemRead(BaseModel):
    id: str
    notebook_id: str
    session_id: str | None
    title: str
    prompt: str | None = None
    order_index: int
    source_metadata: dict | None = None
    session_status: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotebookRead(BaseModel):
    id: str
    title: str
    overall_prompt: str | None = None
    created_at: datetime
    updated_at: datetime
    problems: list[NotebookProblemRead]

    model_config = {"from_attributes": True}


class NotebookListEntry(BaseModel):
    id: str
    title: str
    updated_at: datetime
    problem_count: int

    model_config = {"from_attributes": True}
