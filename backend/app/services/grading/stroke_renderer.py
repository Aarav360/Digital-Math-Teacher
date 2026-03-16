"""Render strokes_json JSONB data to a PNG image using Pillow."""
import base64
import io
from typing import Any

from PIL import Image, ImageDraw


def render_strokes_to_png_bytes(
    strokes_json: dict[str, Any],
    width: int,
    height: int,
) -> bytes:
    """
    Convert a strokes_json JSONB dict (from CanvasSnapshot) into a
    white-background PNG, returned as raw bytes.

    Points may be a flat list [x1,y1,x2,y2,...] or a list of {x,y} dicts.
    Eraser strokes (tool == "eraser") are drawn in white to simulate erasure.
    """
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    strokes = strokes_json.get("strokes", [])
    for stroke in strokes:
        raw_points = stroke.get("points", [])
        color = stroke.get("color", "#000000")
        line_width = max(1, int(stroke.get("width", 2.0)))
        tool = stroke.get("tool", "pen")

        # Normalise flat list or dict list to (x, y) tuple list
        if raw_points and isinstance(raw_points[0], dict):
            coords = [(p["x"], p["y"]) for p in raw_points]
        else:
            coords = [
                (raw_points[i], raw_points[i + 1])
                for i in range(0, len(raw_points) - 1, 2)
            ]

        if len(coords) < 2:
            continue

        fill = (255, 255, 255) if tool == "eraser" else _hex_to_rgb(color)
        draw.line(coords, fill=fill, width=line_width)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def render_strokes_to_base64(
    strokes_json: dict[str, Any],
    width: int,
    height: int,
) -> str:
    """Return base64-encoded PNG string (no data URI prefix)."""
    return base64.b64encode(
        render_strokes_to_png_bytes(strokes_json, width, height)
    ).decode()


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return r, g, b
