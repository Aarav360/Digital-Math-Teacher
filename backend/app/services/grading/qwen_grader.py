"""Qwen API integration for final grading of student work.

Adapted from test-whiteboard/qwen_grader.py.
Key changes:
  - Stateless: conversation history is passed in and returned (not stored on instance).
  - ChatInterface and _handle_clarification_chat removed (clarification via HTTP endpoint).
  - grade_work() accepts image_base64 directly (no file I/O).
  - Prompts file loaded relative to this package directory.
  - Imports settings from app.core.config.
Sync — call via asyncio.to_thread() from async code.
"""
import json
import pathlib
import time
from typing import Any

from huggingface_hub import InferenceClient

from app.core.config import settings

_PROMPTS_FILE = pathlib.Path(__file__).parent / "Prompts"


class QwenGraderService:
    """Grades student work using Qwen2.5-VL-72B via HuggingFace Inference API."""

    def __init__(self) -> None:
        if not settings.hf_token:
            raise ValueError("HF_TOKEN not configured in settings")
        self.client = InferenceClient(
            api_key=settings.hf_token,
            timeout=settings.qwen_grader_timeout,
        )

    def grade_work(
        self,
        qwen_analysis: dict[str, Any],
        image_base64: str,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        """
        Grade student work with the large Qwen grader model.

        Args:
            qwen_analysis: Dict with "summaries" and "event_coordinates" from QwenAnalyzer.
            image_base64: Base64-encoded PNG of the final full whiteboard canvas.

        Returns:
            (grading_data, conversation_history) where:
              - grading_data is the parsed JSON response from Qwen.
              - conversation_history is the [user, assistant] turn list to persist.
        """
        prompt = self._construct_grading_prompt(qwen_analysis)
        response_text = self._send_message_with_image(prompt, image_base64)
        grading_data = self._parse_grading_response(response_text)
        conversation_history = [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": response_text},
        ]
        return grading_data, conversation_history

    def send_followup(
        self,
        user_message: str,
        existing_history: list[dict[str, Any]],
    ) -> tuple[str, list[dict[str, Any]]]:
        """
        Send a follow-up clarification message using persisted conversation history.

        Args:
            user_message: The student's clarification or follow-up text.
            existing_history: Prior turns as [{"role": "user"|"assistant", "content": str}, ...].

        Returns:
            (response_text, updated_history) — caller should persist the updated history.
        """
        messages = [
            msg for msg in existing_history
            if isinstance(msg.get("content"), str)
        ]
        messages.append({"role": "user", "content": user_message})

        last_error: Exception | None = None
        for attempt in range(settings.qwen_max_retries):
            try:
                completion = self.client.chat.completions.create(
                    model=settings.qwen_grader_model,
                    messages=messages,
                )
                response_text = completion.choices[0].message.content
                updated = existing_history + [
                    {"role": "user", "content": user_message},
                    {"role": "assistant", "content": response_text},
                ]
                return response_text, updated

            except Exception as e:
                last_error = e
                detail = repr(e)
                if hasattr(e, "response") and e.response is not None:
                    try:
                        detail += f" | HTTP {e.response.status_code}: {e.response.text[:500]}"
                    except Exception:
                        pass
                print(f"Followup attempt {attempt + 1} failed: {detail}")
                if attempt < settings.qwen_max_retries - 1:
                    time.sleep(settings.qwen_retry_delay * (2 ** attempt))

        err_detail = repr(last_error)
        if last_error is not None and hasattr(last_error, "response") and last_error.response is not None:
            try:
                err_detail += (
                    f" | HTTP {last_error.response.status_code}: {last_error.response.text[:500]}"
                )
            except Exception:
                pass
        raise RuntimeError(f"Qwen grader followup failed after {settings.qwen_max_retries} attempts: {err_detail}")

    def _construct_grading_prompt(self, qwen_analysis: dict[str, Any]) -> str:
        template = self._load_grading_prompt_template()
        summaries_json = json.dumps(qwen_analysis["summaries"], indent=2)
        coordinates_json = json.dumps(qwen_analysis["event_coordinates"], indent=2)
        prompt = template.replace("{qwen_summaries}", summaries_json)
        prompt = prompt.replace("{event_coordinates}", coordinates_json)
        return prompt

    def _load_grading_prompt_template(self) -> str:
        content = _PROMPTS_FILE.read_text()
        if "---" in content:
            parts = content.split("---")
            if len(parts) > 1:
                return parts[1].strip()
        raise ValueError(
            f"Grading prompt template not found in {_PROMPTS_FILE} (expected section after ---)"
        )

    def _send_message_with_image(self, prompt: str, image_base64: str) -> str:
        message_content = [
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{image_base64}"},
            },
            {"type": "text", "text": prompt},
        ]

        last_error: Exception | None = None
        for attempt in range(settings.qwen_max_retries):
            try:
                print(
                    f"Qwen grader attempt {attempt + 1}/{settings.qwen_max_retries} "
                    f"(model: {settings.qwen_grader_model})..."
                )
                completion = self.client.chat.completions.create(
                    model=settings.qwen_grader_model,
                    messages=[{"role": "user", "content": message_content}],
                )
                return completion.choices[0].message.content

            except Exception as e:
                last_error = e
                detail = repr(e)
                if hasattr(e, "response") and e.response is not None:
                    try:
                        detail += f" | HTTP {e.response.status_code}: {e.response.text[:500]}"
                    except Exception:
                        pass
                print(f"Attempt {attempt + 1} failed: {detail}")
                if attempt < settings.qwen_max_retries - 1:
                    delay = settings.qwen_retry_delay * (2 ** attempt)
                    print(f"Retrying in {delay}s...")
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
            f"Qwen grader failed after {settings.qwen_max_retries} attempts: {err_detail}"
        )

    def _parse_grading_response(self, response_text: str) -> dict[str, Any]:
        """Parse Qwen's grading response into a structured dict."""
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.find("```", start)
                if end > start:
                    try:
                        return json.loads(response_text[start:end].strip())
                    except json.JSONDecodeError:
                        pass
            return {
                "has_questions": False,
                "questions": [],
                "mistakes": [],
                "overall_feedback": response_text,
                "parse_error": True,
            }
