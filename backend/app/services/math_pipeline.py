"""Math pipeline: temporal grouping, OCR, SymPy compare, step evaluations. Stub implementation."""
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.session import Session
from app.models.canvas_snapshot import CanvasSnapshot
from app.models.step import Step, StepEvaluation


async def run_analysis(
    db: AsyncSession,
    session: Session,
    snapshot: CanvasSnapshot,
) -> int:
    """
    Group strokes by temporal pause (>1.5s), run OCR/LLM per group, compare to canonical solution,
    create Step + StepEvaluation records. Returns number of steps created.
    Stub: creates one placeholder step with a mock evaluation.
    """
    strokes_data = snapshot.strokes_json.get("strokes", []) if isinstance(snapshot.strokes_json, dict) else []
    if not strokes_data:
        return 0
    # Stub: create one step and one evaluation
    step = Step(
        session_id=session.id,
        snapshot_id=snapshot.id,
        step_index=0,
        latex_raw="2x = 8",
        stroke_group={"indices": [0]},
    )
    db.add(step)
    await db.flush()
    ev = StepEvaluation(
        step_id=step.id,
        status="correct",
        verdict="Correct",
        explanation="Stub evaluation. Implement temporal grouping + OCR + SymPy + LLM.",
        suggestion=None,
    )
    db.add(ev)
    await db.flush()
    return 1
