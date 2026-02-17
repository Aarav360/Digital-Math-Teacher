"""Step and StepEvaluation schemas."""
from datetime import datetime
from pydantic import BaseModel


class StepEvaluationRead(BaseModel):
    id: str
    step_id: str
    status: str
    verdict: str
    explanation: str
    suggestion: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StepRead(BaseModel):
    id: str
    session_id: str
    step_index: int
    latex_raw: str | None = None
    evaluation: StepEvaluationRead | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalysisRequest(BaseModel):
    session_id: str
    snapshot_id: str | None = None


class AnalysisResponse(BaseModel):
    steps: list[StepRead]
    summary: str | None = None
