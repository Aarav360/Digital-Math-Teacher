"""Qwen API integration for per-step image analysis.

Adapted from test-whiteboard/qwen_analyzer.py.
Accepts pre-encoded base64 images instead of file paths.
Imports settings from app.core.config.
Sync — call via asyncio.to_thread() from async code.
"""
import re
import time
from typing import Any

from huggingface_hub import InferenceClient

from app.core.config import settings


class QwenAnalyzer:
    """Analyzes whiteboard step images using Qwen vision-language model."""

    def __init__(self) -> None:
        if not settings.hf_token:
            raise ValueError("HF_TOKEN not configured in settings")
        self.client = InferenceClient(
            api_key=settings.hf_token,
            timeout=settings.qwen_analyzer_timeout,
        )

    def analyze_step_image(
        self,
        frame_number: int,
        current_image_base64: str,
        prev_image_base64: str | None,
        prev_analysis: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """
        Analyze a single step image.

        Args:
            frame_number: 1-based step index.
            current_image_base64: Base64-encoded PNG of the cumulative canvas at this step.
            prev_image_base64: Base64-encoded PNG of the previous step, or None for the first.
            prev_analysis: Structured analysis dict from the previous step, or None.

        Returns:
            Structured summary dict for this step.
        """
        prompt = self._build_incremental_prompt(frame_number, prev_analysis)

        message_content: list[Any] = []

        if prev_image_base64 is not None:
            message_content.append({"type": "text", "text": "Previous frame:"})
            message_content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{prev_image_base64}"},
            })

        message_content.append({"type": "text", "text": "Current frame:"})
        message_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{current_image_base64}"},
        })
        message_content.append({"type": "text", "text": prompt})

        last_error: Exception | None = None
        for attempt in range(settings.qwen_max_retries):
            try:
                print(
                    f"  Qwen frame-{frame_number} attempt {attempt + 1}/{settings.qwen_max_retries}..."
                )
                completion = self.client.chat.completions.create(
                    model=settings.qwen_analyzer_model,
                    messages=[{"role": "user", "content": message_content}],
                )
                raw_response = completion.choices[0].message.content
                return self._parse_single_frame_response(frame_number, raw_response)

            except Exception as e:
                last_error = e
                detail = repr(e)
                if hasattr(e, "response") and e.response is not None:
                    try:
                        detail += f" | HTTP {e.response.status_code}: {e.response.text[:500]}"
                    except Exception:
                        pass
                print(f"  Attempt {attempt + 1} failed: {detail}")
                if attempt < settings.qwen_max_retries - 1:
                    delay = settings.qwen_retry_delay * (2 ** attempt)
                    print(f"  Retrying in {delay}s...")
                    time.sleep(delay)

        err_detail = repr(last_error)
        if last_error is not None and hasattr(last_error, "response") and last_error.response is not None:
            try:
                err_detail += (
                    f" | HTTP {last_error.response.status_code}: {last_error.response.text[:500]}"
                )
            except Exception:
                pass
        raise RuntimeError(
            f"Qwen single-frame call failed after {settings.qwen_max_retries} attempts: {err_detail}"
        )

    def _build_incremental_prompt(
        self, frame_number: int, prev_analysis: dict[str, Any] | None
    ) -> str:
        if frame_number == 1 or prev_analysis is None:
            context_section = "This is the first frame — there is no previous step."
        else:
            context_section = (
                "Previous frame analysis:\n"
                f"  Mathematical state: {prev_analysis.get('mathematical_state', 'unknown')}\n"
                f"  Purpose: {prev_analysis.get('purpose', 'unknown')}\n"
                f"  Classification: {prev_analysis.get('classification', 'unknown')}"
            )

        transformation_instruction = (
            "Skip this section (first frame)."
            if frame_number == 1
            else "Describe the exact mathematical operation applied. Reference the previous analysis above."
        )

        return (
            f"You are analyzing frame {frame_number} of a student's math solution on a whiteboard.\n\n"
            f"{context_section}\n\n"
            "Produce exactly this output format:\n\n"
            f"### Frame {frame_number}\n\n"
            "**Visual Summary:**\n"
            "(Describe what is shown with clarity.)\n\n"
            "**Mathematical State:**\n"
            "(Rewrite the full expression/equation as it appears.)\n\n"
            "**Transformation From Previous Frame:**\n"
            f"({transformation_instruction})\n\n"
            "**Purpose of the Step:**\n"
            "(Explain why that operation is valid or typical.)\n\n"
            "**Classification:**\n"
            "(One of: simplification, factoring, distributing, combining like terms, "
            "isolating variable, substitution, arithmetic operation, graph adjustment, etc.)\n\n"
            "Use correct mathematical vocabulary. Do not hallucinate information not visible in the frame."
        )

    def _parse_single_frame_response(
        self, frame_number: int, response_text: str
    ) -> dict[str, Any]:
        return {
            "frame_number": frame_number,
            "visual_summary": self._extract_section(response_text, "Visual Summary"),
            "mathematical_state": self._extract_section(response_text, "Mathematical State"),
            "transformation": self._extract_section(
                response_text, "Transformation From Previous Frame"
            ),
            "purpose": self._extract_section(response_text, "Purpose of the Step"),
            "classification": self._extract_section(response_text, "Classification"),
        }

    def _extract_section(self, text: str, section_name: str) -> str:
        pattern = rf"\*\*{re.escape(section_name)}:\*\*\s*\n(.*?)(?=\n\*\*|$)"
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return ""
