"""Canvas snapshot request/response schemas."""
from datetime import datetime
import re
from pydantic import BaseModel, field_validator

HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
RGBA_COLOR_RE = re.compile(
    r"^rgba\(\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:1(?:\.0+)?|0?\.\d+|0)\s*\)$",
    re.IGNORECASE,
)


class StrokePoint(BaseModel):
    x: float
    y: float


class StrokeIn(BaseModel):
    id: str | None = None
    points: list[float] | list[StrokePoint]  # [x1,y1,x2,y2,...] or [{x,y},...]
    color: str | None = None
    width: float = 2.0
    tool: str = "pen"
    timestamp: str | None = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if HEX_COLOR_RE.match(value) or RGBA_COLOR_RE.match(value):
            return value
        raise ValueError("color must be a hex or rgba() string")


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


class SnapshotUpdate(BaseModel):
    """Request schema for PUT /sessions/{session_id}/snapshot"""
    strokes_json: dict  # {strokes, shapes, textItems, imageItems}
    width: int
    height: int


class SnapshotResponse(BaseModel):
    """Response schema for snapshot endpoints"""
    id: str
    strokes_json: dict
    width: int
    height: int
    created_at: datetime

    model_config = {"from_attributes": True}
