"""Math pipeline: temporal stroke grouping, per-step Qwen analysis, grading, DB persistence."""
import asyncio
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.canvas_snapshot import CanvasSnapshot
from app.models.chat_message import ChatMessage
from app.models.session import Session
from app.models.step import Step, StepEvaluation
from app.services.grading.qwen_analyzer import QwenAnalyzer
from app.services.grading.qwen_grader import QwenGraderService
from app.services.grading.stroke_renderer import render_strokes_to_base64

# Role prefix to distinguish grading conversation turns from the tutor chat
_GRADER_ROLE_PREFIX = "grader_"


async def run_analysis(
    db: AsyncSession,
    session: Session,
    snapshot: CanvasSnapshot,
    image_base64: str | None = None,
) -> int:
    """
    Run the full grading pipeline:
      1. Resolve the final canvas image (caller-supplied base64 or server-rendered).
      2. Group strokes into steps by temporal pause (>1500 ms).
      3. Per-step: render cumulative PNG, call QwenAnalyzer.
      4. Call QwenGraderService with all step summaries + final image.
      5. Persist Step + StepEvaluation rows mapped from grading output.
      6. Persist grading conversation history in ChatMessage (role "grader_*").

    Returns the number of Step rows created.
    """
    strokes_data: list[dict[str, Any]] = (
        snapshot.strokes_json.get("strokes", [])
        if isinstance(snapshot.strokes_json, dict)
        else []
    )
    if not strokes_data:
        return 0

    width = snapshot.width or settings.qwen_canvas_width
    height = snapshot.height or settings.qwen_canvas_height

    # --- 1. Resolve final full-canvas image ---
    # Prefer the caller-supplied base64 (frontend-rendered, highest fidelity).
    # Fall back to server-side Pillow render from stroke data.
    if image_base64:
        final_image_b64 = image_base64
    else:
        final_image_b64 = await asyncio.to_thread(
            render_strokes_to_base64,
            snapshot.strokes_json,
            width,
            height,
        )

    # --- 2. Group strokes into steps ---
    step_groups = _derive_step_groups(strokes_data)

    # --- 3. Per-step Qwen analysis ---
    analyzer = QwenAnalyzer()
    summaries: list[dict[str, Any]] = []
    event_coordinates: list[dict[str, Any]] = []
    prev_image_b64: str | None = None
    prev_analysis: dict[str, Any] | None = None
    cumulative_strokes: list[dict[str, Any]] = []

    for step_idx, group in enumerate(step_groups):
        cumulative_strokes = cumulative_strokes + group["strokes"]
        partial_strokes_json = {"strokes": cumulative_strokes}

        partial_image_b64 = await asyncio.to_thread(
            render_strokes_to_base64,
            partial_strokes_json,
            width,
            height,
        )

        summary = await asyncio.to_thread(
            analyzer.analyze_step_image,
            step_idx + 1,
            partial_image_b64,
            prev_image_b64,
            prev_analysis,
        )
        summary["event_id"] = step_idx
        summaries.append(summary)

        bbox = _compute_bounding_box(group["strokes"])
        event_coordinates.append({
            "event_id": step_idx,
            "bounding_box": bbox,
            "center": {
                "x": (bbox["x_min"] + bbox["x_max"]) // 2,
                "y": (bbox["y_min"] + bbox["y_max"]) // 2,
            },
        })

        prev_image_b64 = partial_image_b64
        prev_analysis = summary

    # --- 4. Final grading ---
    grader = QwenGraderService()
    qwen_analysis = {"summaries": summaries, "event_coordinates": event_coordinates}
    grading_data, conversation_history = await asyncio.to_thread(
        grader.grade_work,
        qwen_analysis,
        final_image_b64,
    )

    # --- 5. Map grading output to Step + StepEvaluation rows ---
    mistakes_by_event: dict[int, list[dict[str, Any]]] = {}
    for mistake in grading_data.get("mistakes", []):
        eid = mistake.get("event_id", 0)
        mistakes_by_event.setdefault(eid, []).append(mistake)

    overall_feedback = grading_data.get("overall_feedback", "")
    steps_created = 0

    for step_idx, (group, summary) in enumerate(zip(step_groups, summaries)):
        step = Step(
            session_id=session.id,
            snapshot_id=snapshot.id,
            step_index=step_idx,
            latex_raw=summary.get("mathematical_state", ""),
            stroke_group={"stroke_ids": [s.get("id") for s in group["strokes"]]},
            bounding_box=event_coordinates[step_idx]["bounding_box"],
        )
        db.add(step)
        await db.flush()

        mistakes = mistakes_by_event.get(step_idx, [])
        status, verdict, explanation, suggestion = _map_mistakes_to_evaluation(
            mistakes,
            overall_feedback,
            step_idx,
            len(step_groups),
        )

        ev = StepEvaluation(
            step_id=step.id,
            status=status,
            verdict=verdict,
            explanation=explanation,
            suggestion=suggestion,
        )
        db.add(ev)
        await db.flush()
        steps_created += 1

    # --- 6. Persist grading conversation history ---
    for turn in conversation_history:
        cm = ChatMessage(
            session_id=session.id,
            role=f"{_GRADER_ROLE_PREFIX}{turn['role']}",  # "grader_user" / "grader_assistant"
            content=turn["content"],
        )
        db.add(cm)
    await db.flush()

    return steps_created


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _derive_step_groups(strokes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Group strokes into steps by temporal pause (>1500 ms between consecutive strokes).

    If timestamps are unavailable, all strokes are treated as a single step.
    Returns a list of {"strokes": [...]} dicts.
    """
    PAUSE_THRESHOLD_MS = 1500

    if not strokes:
        return []

    has_timestamps = any(s.get("timestamp") is not None for s in strokes)

    if not has_timestamps:
        return [{"strokes": strokes}]

    groups: list[dict[str, Any]] = []
    current_group: list[dict[str, Any]] = [strokes[0]]
    prev_ts = _parse_timestamp(strokes[0].get("timestamp"))

    for stroke in strokes[1:]:
        ts = _parse_timestamp(stroke.get("timestamp"))
        if ts is not None and prev_ts is not None:
            # Timestamps may be in seconds (float) or milliseconds (int > 10^9)
            gap = ts - prev_ts
            gap_ms = gap if gap > 1000 else gap * 1000
            if gap_ms > PAUSE_THRESHOLD_MS:
                groups.append({"strokes": current_group})
                current_group = []
        current_group.append(stroke)
        if ts is not None:
            prev_ts = ts

    if current_group:
        groups.append({"strokes": current_group})

    # Merge singleton groups into the previous group to avoid noise
    merged: list[dict[str, Any]] = []
    for g in groups:
        if merged and len(g["strokes"]) == 1:
            merged[-1]["strokes"] = merged[-1]["strokes"] + g["strokes"]
        else:
            merged.append({"strokes": list(g["strokes"])})

    return merged if merged else [{"strokes": strokes}]


def _parse_timestamp(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _compute_bounding_box(strokes: list[dict[str, Any]]) -> dict[str, int]:
    """Compute a bounding box covering all points in the given strokes."""
    all_x: list[float] = []
    all_y: list[float] = []

    for stroke in strokes:
        raw_points = stroke.get("points", [])
        if raw_points and isinstance(raw_points[0], dict):
            for p in raw_points:
                all_x.append(p.get("x", 0))
                all_y.append(p.get("y", 0))
        else:
            for i in range(0, len(raw_points) - 1, 2):
                all_x.append(raw_points[i])
                all_y.append(raw_points[i + 1])

    if not all_x or not all_y:
        return {"x_min": 0, "y_min": 0, "x_max": 0, "y_max": 0}

    return {
        "x_min": int(min(all_x)),
        "y_min": int(min(all_y)),
        "x_max": int(max(all_x)),
        "y_max": int(max(all_y)),
    }


def _map_mistakes_to_evaluation(
    mistakes: list[dict[str, Any]],
    overall_feedback: str,
    step_idx: int,
    total_steps: int,
) -> tuple[str, str, str, str | None]:
    """
    Map a list of Qwen mistakes for one step to StepEvaluation fields.

    Severity mapping:
      critical / moderate  →  "incorrect"
      minor only           →  "warning"
      no mistakes          →  "correct"

    Returns (status, verdict, explanation, suggestion).
    """
    if not mistakes:
        explanation = (
            overall_feedback
            if step_idx == total_steps - 1 and overall_feedback
            else "No errors found in this step."
        )
        return "correct", "Correct", explanation, None

    severities = {m.get("severity", "minor") for m in mistakes}
    if "critical" in severities or "moderate" in severities:
        status = "incorrect"
    else:
        status = "warning"

    verdict = (
        mistakes[0].get("mistake_type", "error")
        .replace("_", " ")
        .title()
    )
    descriptions = "; ".join(
        m.get("description", "") for m in mistakes if m.get("description")
    )
    suggestions = [
        m["annotation"]["text"]
        for m in mistakes
        if m.get("annotation", {}).get("text")
    ]
    suggestion = " | ".join(suggestions) if suggestions else None

    return status, verdict, descriptions or "Error detected", suggestion
