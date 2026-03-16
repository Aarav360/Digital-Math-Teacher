"""FastAPI server for AI-powered whiteboard grading pipeline.

Endpoints:
  POST   /session/{user_id}/step   — submit one incremental step image
  POST   /session/{user_id}/grade  — submit final image and trigger grading
  POST   /session/{user_id}/chat   — send a follow-up chat message
  DELETE /session/{user_id}        — clear session state
"""
import os
import re
import shutil
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from config import Config
from qwen_analyzer import QwenAnalyzer
from qwen_grader import QwenGrader


app = FastAPI(title="Whiteboard Grading API")

# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------

@dataclass
class SessionState:
    summaries: List[Dict[str, Any]] = field(default_factory=list)
    event_coordinates: List[Dict[str, Any]] = field(default_factory=list)
    prev_frame_path: Optional[str] = None
    frame_counter: int = 0
    session_dir: str = ""
    grader: Optional[QwenGrader] = None   # created on first grade call


# Global sessions dict — keyed by user_id
sessions: Dict[str, SessionState] = {}

# Shared analyzer (stateless between calls — no per-session state needed)
_analyzer = QwenAnalyzer()


def _get_session(user_id: str) -> SessionState:
    if user_id not in sessions:
        session_dir = os.path.join(
            tempfile.gettempdir(),
            f"wb_api_{user_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        )
        os.makedirs(session_dir, exist_ok=True)
        sessions[user_id] = SessionState(session_dir=session_dir)
    return sessions[user_id]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_step_refs(text: str) -> List[int]:
    """Extract step/frame/event numbers mentioned in feedback text."""
    hits = re.findall(
        r'\b(?:step|frame|event)\s*#?\s*(\d+)\b',
        text,
        re.IGNORECASE,
    )
    # Deduplicate, preserve order
    seen = set()
    result = []
    for n in hits:
        v = int(n)
        if v not in seen:
            seen.add(v)
            result.append(v)
    return result


def _format_grading_messages(grading_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Convert a grading result into a list of chat messages with step_refs."""
    messages = []

    mistakes = grading_result.get("mistakes", [])
    overall = grading_result.get("overall_feedback", "")

    if mistakes:
        for mistake in mistakes:
            event_id = mistake.get("event_id")
            description = mistake.get("description", "")
            annotation_text = mistake.get("annotation", {}).get("text", "")
            severity = mistake.get("severity", "")
            mistake_type = mistake.get("mistake_type", "")

            # Build a natural-language message referencing the step
            parts = []
            if event_id is not None:
                parts.append(f"In step {event_id}")
            if mistake_type:
                parts.append(f"({mistake_type})")
            if severity:
                parts.append(f"[{severity}]")
            parts.append("—")
            if description:
                parts.append(description)
            if annotation_text and annotation_text != description:
                parts.append(annotation_text)

            content = " ".join(parts)
            step_refs = _extract_step_refs(content)
            # Always include the event_id as a step ref if present
            if event_id is not None and event_id not in step_refs:
                step_refs.insert(0, event_id)

            messages.append({
                "role": "assistant",
                "content": content,
                "step_refs": step_refs,
            })

    # Overall feedback as a final message
    if overall:
        messages.append({
            "role": "assistant",
            "content": overall,
            "step_refs": _extract_step_refs(overall),
        })

    # If no structured mistakes, surface raw feedback
    if not messages:
        raw = grading_result.get("overall_feedback", "Grading complete.")
        messages.append({
            "role": "assistant",
            "content": raw,
            "step_refs": _extract_step_refs(raw),
        })

    return messages


# ---------------------------------------------------------------------------
# POST /session/{user_id}/step
# ---------------------------------------------------------------------------

@app.post("/session/{user_id}/step")
async def submit_step(
    user_id: str,
    image: UploadFile = File(...),
    event_id: int = Form(...),
):
    """Submit one incremental step image for live analysis.

    Returns the Qwen summary for that step.
    """
    session = _get_session(user_id)
    session.frame_counter += 1
    frame_number = session.frame_counter

    # Save uploaded image to session temp dir
    frame_path = os.path.join(session.session_dir, f"frame_{frame_number:04d}.png")
    contents = await image.read()
    with open(frame_path, "wb") as f:
        f.write(contents)

    # Retrieve previous summary for sliding context
    prev_summary = session.summaries[-1] if session.summaries else None

    try:
        summary = _analyzer.analyze_event_live(
            frame_number=frame_number,
            current_frame_path=frame_path,
            prev_frame_path=session.prev_frame_path,
            prev_analysis=prev_summary,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Qwen analysis failed: {e}")

    # Tag with event_id and store
    summary["event_id"] = event_id
    session.summaries.append(summary)

    # Store bounding box placeholder — client may pass real coords later;
    # for now we record event_id so the grader can reference it
    session.event_coordinates.append({
        "event_id": event_id,
        "bounding_box": {"x_min": 0, "y_min": 0, "x_max": 0, "y_max": 0},
        "center": {"x": 0, "y": 0},
    })

    session.prev_frame_path = frame_path

    return JSONResponse(content=summary)


# ---------------------------------------------------------------------------
# POST /session/{user_id}/grade
# ---------------------------------------------------------------------------

@app.post("/session/{user_id}/grade")
async def grade(
    user_id: str,
    image: UploadFile = File(...),
):
    """Submit the final canvas image to trigger grading.

    Returns structured chat messages with step references.
    """
    session = _get_session(user_id)

    if not session.summaries:
        raise HTTPException(
            status_code=400,
            detail="No steps submitted yet. Send at least one step before grading.",
        )

    # Save final image
    final_image_path = os.path.join(session.session_dir, "final.png")
    contents = await image.read()
    with open(final_image_path, "wb") as f:
        f.write(contents)

    # Build qwen_analysis dict expected by QwenGrader
    qwen_analysis = {
        "summaries": session.summaries,
        "event_coordinates": session.event_coordinates,
        "metadata": {
            "total_frames": session.frame_counter,
            "analysis_timestamp": datetime.utcnow().isoformat(),
            "model_used": Config.QWEN_MODEL,
            "mode": "api",
        },
    }

    # Create a grader for this session (holds conversation_history for follow-ups)
    session.grader = QwenGrader(root=None)

    try:
        grading_result = session.grader.grade_work(qwen_analysis, final_image_path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Grading failed: {e}")

    messages = _format_grading_messages(grading_result)

    # Store grader conversation history already updated by grade_work
    return JSONResponse(content={
        "messages": messages,
        "has_questions": grading_result.get("has_questions", False),
        "questions": grading_result.get("questions", []),
    })


# ---------------------------------------------------------------------------
# POST /session/{user_id}/chat
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str


@app.post("/session/{user_id}/chat")
async def chat(user_id: str, body: ChatRequest):
    """Send a follow-up message after grading (clarification or question).

    Returns the assistant's reply with step references.
    """
    if user_id not in sessions or sessions[user_id].grader is None:
        raise HTTPException(
            status_code=400,
            detail="No active grading session. Call /grade first.",
        )

    session = sessions[user_id]

    try:
        response_text = session.grader._send_followup_message(body.message)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Follow-up failed: {e}")

    # Try to parse as structured grading JSON; fall back to plain text
    grader_parsed = session.grader._parse_grading_response(response_text)

    if grader_parsed.get("parse_error"):
        # Plain text response
        messages = [{
            "role": "assistant",
            "content": response_text,
            "step_refs": _extract_step_refs(response_text),
        }]
        has_questions = False
        questions = []
    else:
        messages = _format_grading_messages(grader_parsed)
        has_questions = grader_parsed.get("has_questions", False)
        questions = grader_parsed.get("questions", [])

    return JSONResponse(content={
        "messages": messages,
        "has_questions": has_questions,
        "questions": questions,
    })


# ---------------------------------------------------------------------------
# DELETE /session/{user_id}
# ---------------------------------------------------------------------------

@app.delete("/session/{user_id}")
async def delete_session(user_id: str):
    """Clear session state and delete temp files."""
    if user_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    session = sessions.pop(user_id)
    try:
        shutil.rmtree(session.session_dir, ignore_errors=True)
    except Exception:
        pass

    return {"deleted": True, "user_id": user_id}


# ---------------------------------------------------------------------------
# Run with: uvicorn api_server:app --reload
# ---------------------------------------------------------------------------
