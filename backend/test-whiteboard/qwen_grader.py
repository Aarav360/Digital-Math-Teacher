"""Qwen API integration for final grading of student work."""
import json
import base64
import time
from typing import Dict, Any, List, Optional
from huggingface_hub import InferenceClient
from config import Config
from chat_interface import ChatInterface


class QwenGrader:
    """Grades student work using a large Qwen vision-language model via HuggingFace."""

    def __init__(self, root=None):
        """Initialize HuggingFace Inference client for grading."""
        if not Config.HF_TOKEN:
            raise ValueError("HF_TOKEN not found in environment variables")

        self.client = InferenceClient(
            api_key=Config.HF_TOKEN,
            timeout=Config.QWEN_GRADER_TIMEOUT,
        )
        self.conversation_history: List[Dict[str, Any]] = []
        self.chat_interface = ChatInterface()
        if root:
            self.chat_interface.set_root(root)

    def grade_work(
        self, qwen_analysis: Dict[str, Any], final_image_path: str
    ) -> Dict[str, Any]:
        """
        Grade student work with a large Qwen model.

        Args:
            qwen_analysis: Analysis from incremental Qwen (summaries + coordinates)
            final_image_path: Path to final rendered whiteboard image

        Returns:
            Dictionary with mistakes and annotations (same format as ClaudeGrader)
        """
        prompt = self._construct_grading_prompt(qwen_analysis)
        image_base64 = self._encode_image(final_image_path)

        response = self._send_message_with_image(prompt, image_base64)
        grading_data = self._parse_grading_response(response)

        if grading_data.get("has_questions", False):
            questions = grading_data.get("questions", [])
            grading_data = self._handle_clarification_chat(questions)

        return grading_data

    def _construct_grading_prompt(self, qwen_analysis: Dict[str, Any]) -> str:
        """Construct grading prompt from Qwen analysis data."""
        template = self._load_grading_prompt_template()
        summaries_json = json.dumps(qwen_analysis["summaries"], indent=2)
        coordinates_json = json.dumps(qwen_analysis["event_coordinates"], indent=2)
        prompt = template.replace("{qwen_summaries}", summaries_json)
        prompt = prompt.replace("{event_coordinates}", coordinates_json)
        return prompt

    def _load_grading_prompt_template(self) -> str:
        """Load grading prompt template from Prompts file (section after ---)."""
        try:
            with open(Config.PROMPTS_FILE, "r") as f:
                content = f.read()

            if "---" in content:
                parts = content.split("---")
                if len(parts) > 1:
                    return parts[1].strip()

            raise ValueError("Grading prompt template not found in Prompts file (expected section after ---)")

        except FileNotFoundError:
            raise FileNotFoundError(f"Prompts file not found: {Config.PROMPTS_FILE}")

    def _encode_image(self, image_path: str) -> str:
        """Encode image file as base64."""
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode()

    def _send_message_with_image(self, prompt: str, image_base64: str) -> str:
        """
        Send grading prompt + final whiteboard image to Qwen grader model.

        Args:
            prompt: Text grading prompt
            image_base64: Base64-encoded PNG of the final whiteboard state

        Returns:
            Qwen's text response
        """
        message_content = [
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{image_base64}"},
            },
            {"type": "text", "text": prompt},
        ]

        last_error = None
        for attempt in range(Config.QWEN_MAX_RETRIES):
            try:
                print(
                    f"Qwen grader attempt {attempt + 1}/{Config.QWEN_MAX_RETRIES} "
                    f"(model: {Config.QWEN_GRADER_MODEL})..."
                )
                completion = self.client.chat.completions.create(
                    model=Config.QWEN_GRADER_MODEL,
                    messages=[{"role": "user", "content": message_content}],
                )
                response_text = completion.choices[0].message.content

                # Store in conversation history for follow-up turns
                self.conversation_history.append({"role": "user", "content": prompt})
                self.conversation_history.append({"role": "assistant", "content": response_text})

                return response_text

            except Exception as e:
                last_error = e
                detail = repr(e)
                if hasattr(e, 'response') and e.response is not None:
                    try:
                        detail += f" | HTTP {e.response.status_code}: {e.response.text[:500]}"
                    except Exception:
                        pass
                print(f"Attempt {attempt + 1} failed: {detail}")
                if attempt < Config.QWEN_MAX_RETRIES - 1:
                    delay = Config.QWEN_RETRY_DELAY * (2 ** attempt)
                    print(f"Retrying in {delay}s...")
                    time.sleep(delay)

        err_detail = repr(last_error)
        if hasattr(last_error, 'response') and last_error.response is not None:
            try:
                err_detail += f" | HTTP {last_error.response.status_code}: {last_error.response.text[:500]}"
            except Exception:
                pass
        raise RuntimeError(
            f"Qwen grader failed after {Config.QWEN_MAX_RETRIES} attempts: {err_detail}"
        )

    def _send_followup_message(self, user_message: str) -> str:
        """
        Send a follow-up clarification message in the conversation.

        Args:
            user_message: Student's clarification response

        Returns:
            Qwen's follow-up response
        """
        # Build text-only conversation history
        messages = [
            msg for msg in self.conversation_history
            if isinstance(msg.get("content"), str)
        ]
        messages.append({"role": "user", "content": user_message})

        last_error = None
        for attempt in range(Config.QWEN_MAX_RETRIES):
            try:
                completion = self.client.chat.completions.create(
                    model=Config.QWEN_GRADER_MODEL,
                    messages=messages,
                )
                response_text = completion.choices[0].message.content

                self.conversation_history.append({"role": "user", "content": user_message})
                self.conversation_history.append({"role": "assistant", "content": response_text})

                return response_text

            except Exception as e:
                last_error = e
                detail = repr(e)
                if hasattr(e, 'response') and e.response is not None:
                    try:
                        detail += f" | HTTP {e.response.status_code}: {e.response.text[:500]}"
                    except Exception:
                        pass
                print(f"Followup attempt {attempt + 1} failed: {detail}")
                if attempt < Config.QWEN_MAX_RETRIES - 1:
                    time.sleep(Config.QWEN_RETRY_DELAY * (2 ** attempt))

        err_detail = repr(last_error)
        if hasattr(last_error, 'response') and last_error.response is not None:
            try:
                err_detail += f" | HTTP {last_error.response.status_code}: {last_error.response.text[:500]}"
            except Exception:
                pass
        raise RuntimeError(f"Qwen grader followup failed: {err_detail}")

    def _parse_grading_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Qwen's grading response into structured format."""
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.find("```", start)
                if end > start:
                    return json.loads(response_text[start:end].strip())

            return {
                "has_questions": False,
                "questions": [],
                "mistakes": [],
                "overall_feedback": response_text,
                "parse_error": True,
            }

    def _handle_clarification_chat(self, initial_questions: List[str]) -> Dict[str, Any]:
        """Handle clarification chat with student when Qwen has questions."""
        self.chat_interface.start_chat(initial_questions)

        while True:
            user_response = self.chat_interface.get_user_response()

            if user_response.lower() in ["exit", "quit", "cancel"]:
                return {
                    "has_questions": False,
                    "questions": [],
                    "mistakes": [],
                    "overall_feedback": "Grading cancelled by user",
                    "cancelled": True,
                }

            qwen_response = self._send_followup_message(user_response)
            self.chat_interface.display_message("assistant", qwen_response)

            grading_data = self._parse_grading_response(qwen_response)

            if not grading_data.get("has_questions", False):
                self.chat_interface.close()
                return grading_data

            for question in grading_data.get("questions", []):
                print(f"\nQwen: {question}")
