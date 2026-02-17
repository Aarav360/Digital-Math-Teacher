"""Canvas snapshot request/response schemas."""
from datetime import datetime
from pydantic import BaseModel


class StrokePoint(BaseModel):
    x: float
    y: float


class StrokeIn(BaseModel):
    id: str | None = None
    points: list[float] | list[StrokePoint]  # [x1,y1,x2,y2,...] or [{x,y},...]
    color: str = "#000000"
    width: float = 2.0
    tool: str = "pen"
    timestamp: str | None = None


class CanvasSnapshotCreate(BaseModel):
    session_id: str
    strokes: list[StrokeIn] | list[dict]
    width: int
    height: int
    image_base64: str | None = None


class CanvasSnapshotRead(BaseModel):
    id: str
    session_id: str
    width: int
    height: int
    image_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
