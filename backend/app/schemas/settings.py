"""User settings schemas."""
from pydantic import BaseModel


class UserSettingsBase(BaseModel):
    persona: str | None = None
    help_level: int | None = None
    theme: str | None = None
    pen_thickness: str | None = None
    smooth_strokes: bool | None = None
    show_grid: bool | None = None
    zoom_speed: float | None = None
    constant_grid_size: bool | None = None
    save_history: bool | None = None
    grade_level: str | None = None


class UserSettingsRead(UserSettingsBase):
    user_id: str
    name: str | None = None
    email: str | None = None


class UserSettingsUpdate(UserSettingsBase):
    name: str | None = None
