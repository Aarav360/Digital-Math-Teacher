"""Qwen API integration for keyframe analysis."""
import os
import re
import base64
import tempfile
from datetime import datetime
from typing import List, Dict, Any, Optional
from huggingface_hub import InferenceClient
from config import Config


class QwenAnalyzer:
    """Analyzes whiteboard keyframes using Qwen vision-language model."""

    def __init__(self):
        """Initialize Qwen API client."""
        if not Config.HF_TOKEN:
            raise ValueError("HF_TOKEN not found in environment variables")

        self.client = InferenceClient(
            api_key=Config.HF_TOKEN,
            timeout=Config.QWEN_TIMEOUT
        )

    def analyze_keyframes(
        self, whiteboard_app
    ) -> Dict[str, Any]:
        """
        Export keyframes and analyze them with Qwen.

        Args:
            whiteboard_app: WhiteboardApp instance

        Returns:
            Dictionary with summaries and event coordinates
        """
        # Step 1: Export keyframes to temporary directory
        keyframe_dir = self._export_keyframes_to_temp(whiteboard_app)

        # Step 2: Load all keyframe image paths
        keyframe_files = sorted(
            [
                os.path.join(keyframe_dir, f)
                for f in os.listdir(keyframe_dir)
                if f.endswith(".png")
            ]
        )

        if not keyframe_files:
            raise ValueError("No keyframes found")

        # Step 3: Send all keyframes to Qwen in single API call
        qwen_response = self._send_all_frames_to_qwen(keyframe_files)

        # Step 4: Parse Qwen's response into structured format
        summaries = self._parse_qwen_response(qwen_response)

        # Step 5: Extract event coordinates from whiteboard
        event_coordinates = self._extract_event_coordinates(whiteboard_app)

        # Step 6: Match summaries with event IDs
        for i, summary in enumerate(summaries):
            if i < len(event_coordinates):
                summary["event_id"] = event_coordinates[i]["event_id"]

        return {
            "summaries": summaries,
            "event_coordinates": event_coordinates,
            "metadata": {
                "total_frames": len(keyframe_files),
                "analysis_timestamp": datetime.now().isoformat(),
                "model_used": Config.QWEN_MODEL,
            },
        }

    def analyze_event_live(
        self,
        frame_number: int,
        current_frame_path: str,
        prev_frame_path: Optional[str],
        prev_analysis: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Analyze a single event's frame in real-time (called as the user draws).

        Args:
            frame_number: 1-based index for this event
            current_frame_path: Path to the rendered PNG for this event
            prev_frame_path: Path to the previous event's PNG, or None for first event
            prev_analysis: Structured analysis dict from previous event, or None

        Returns:
            Structured summary dict for this event
        """
        return self._analyze_single_frame(
            frame_number=frame_number,
            current_frame_path=current_frame_path,
            prev_frame_path=prev_frame_path,
            prev_analysis=prev_analysis,
        )

    def analyze_keyframes_incremental(
        self, whiteboard_app
    ) -> Dict[str, Any]:
        """
        Analyze keyframes one at a time, passing each frame the previous frame image
        and previous analysis for context instead of batching all frames together.

        Args:
            whiteboard_app: WhiteboardApp instance

        Returns:
            Dictionary with summaries and event coordinates (same shape as analyze_keyframes)
        """
        if not whiteboard_app.events:
            raise ValueError("No events to analyze")

        drawing_events = [e for e in whiteboard_app.events if e.type == "drawing"]
        if not drawing_events:
            raise ValueError("No drawing events found")

        summaries = []
        cumulative_stroke_ids = []
        prev_frame_path: Optional[str] = None
        prev_analysis: Optional[Dict[str, Any]] = None

        session_dir = os.path.join(
            tempfile.gettempdir(),
            f"keyframes_incremental_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        )
        os.makedirs(session_dir, exist_ok=True)

        for frame_number, event in enumerate(drawing_events, start=1):
            cumulative_stroke_ids.extend(event.stroke_ids)

            # Render current cumulative canvas state
            img = whiteboard_app._render_canvas_to_image(cumulative_stroke_ids)
            current_frame_path = os.path.join(
                session_dir,
                f"frame_{frame_number:03d}_event_{event.id}.png"
            )
            img.save(current_frame_path)

            print(f"Analyzing frame {frame_number}/{len(drawing_events)} (event {event.id})...")

            summary = self._analyze_single_frame(
                frame_number=frame_number,
                current_frame_path=current_frame_path,
                prev_frame_path=prev_frame_path,
                prev_analysis=prev_analysis,
            )
            summary["event_id"] = event.id
            summaries.append(summary)

            prev_frame_path = current_frame_path
            prev_analysis = summary

        event_coordinates = self._extract_event_coordinates(whiteboard_app)

        return {
            "summaries": summaries,
            "event_coordinates": event_coordinates,
            "metadata": {
                "total_frames": len(drawing_events),
                "analysis_timestamp": datetime.now().isoformat(),
                "model_used": Config.QWEN_MODEL,
                "mode": "incremental",
            },
        }

    def _analyze_single_frame(
        self,
        frame_number: int,
        current_frame_path: str,
        prev_frame_path: Optional[str],
        prev_analysis: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Send a single frame (plus optional previous frame and analysis) to Qwen.

        Args:
            frame_number: 1-based index of this frame
            current_frame_path: Path to the current keyframe PNG
            prev_frame_path: Path to the previous keyframe PNG, or None for first frame
            prev_analysis: Structured analysis dict from previous frame, or None

        Returns:
            Structured summary dict for this frame
        """
        import time

        prompt = self._build_incremental_prompt(frame_number, prev_analysis)

        # Build message content: optional prev frame, then current frame, then prompt
        message_content: List[Any] = []

        if prev_frame_path is not None:
            with open(prev_frame_path, "rb") as f:
                prev_data = base64.b64encode(f.read()).decode()
            message_content.append({"type": "text", "text": "Previous frame:"})
            message_content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{prev_data}"},
            })

        with open(current_frame_path, "rb") as f:
            curr_data = base64.b64encode(f.read()).decode()
        message_content.append({"type": "text", "text": "Current frame:"})
        message_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{curr_data}"},
        })

        message_content.append({"type": "text", "text": prompt})

        last_error = None
        for attempt in range(Config.QWEN_MAX_RETRIES):
            try:
                print(f"  Qwen frame-{frame_number} attempt {attempt + 1}/{Config.QWEN_MAX_RETRIES}...")
                completion = self.client.chat.completions.create(
                    model=Config.QWEN_MODEL,
                    messages=[{"role": "user", "content": message_content}],
                )
                raw_response = completion.choices[0].message.content
                return self._parse_single_frame_response(frame_number, raw_response)

            except Exception as e:
                last_error = e
                detail = repr(e)
                if hasattr(e, 'response') and e.response is not None:
                    try:
                        detail += f" | HTTP {e.response.status_code}: {e.response.text[:500]}"
                    except Exception:
                        pass
                print(f"  Attempt {attempt + 1} failed: {detail}")
                if attempt < Config.QWEN_MAX_RETRIES - 1:
                    delay = Config.QWEN_RETRY_DELAY * (2 ** attempt)
                    print(f"  Retrying in {delay}s...")
                    time.sleep(delay)

        err_detail = repr(last_error)
        if hasattr(last_error, 'response') and last_error.response is not None:
            try:
                err_detail += f" | HTTP {last_error.response.status_code}: {last_error.response.text[:500]}"
            except Exception:
                pass
        raise RuntimeError(
            f"Qwen single-frame call failed after {Config.QWEN_MAX_RETRIES} attempts: {err_detail}"
        )

    def _build_incremental_prompt(
        self, frame_number: int, prev_analysis: Optional[Dict[str, Any]]
    ) -> str:
        """Build the per-frame analysis prompt with previous analysis as context."""
        if frame_number == 1 or prev_analysis is None:
            context_section = "This is the first frame — there is no previous step."
        else:
            context_section = (
                "Previous frame analysis:\n"
                f"  Mathematical state: {prev_analysis.get('mathematical_state', 'unknown')}\n"
                f"  Purpose: {prev_analysis.get('purpose', 'unknown')}\n"
                f"  Classification: {prev_analysis.get('classification', 'unknown')}"
            )

        is_first = frame_number == 1
        transformation_instruction = (
            "Skip this section (first frame)." if is_first
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

    def _parse_single_frame_response(self, frame_number: int, response_text: str) -> Dict[str, Any]:
        """Parse a single-frame Qwen response into a summary dict."""
        return {
            "frame_number": frame_number,
            "visual_summary": self._extract_section(response_text, "Visual Summary"),
            "mathematical_state": self._extract_section(response_text, "Mathematical State"),
            "transformation": self._extract_section(response_text, "Transformation From Previous Frame"),
            "purpose": self._extract_section(response_text, "Purpose of the Step"),
            "classification": self._extract_section(response_text, "Classification"),
        }

    def _export_keyframes_to_temp(self, whiteboard_app) -> str:
        """Export keyframes using whiteboard's logic to temp directory."""
        if not whiteboard_app.events:
            raise ValueError("No events to export")

        # Create temp directory for keyframes
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        keyframe_dir = os.path.join(tempfile.gettempdir(), f"keyframes_{timestamp}")
        os.makedirs(keyframe_dir, exist_ok=True)

        # Track which strokes have been drawn cumulatively
        cumulative_stroke_ids = []
        keyframe_count = 0

        for event in whiteboard_app.events:
            if event.type in ["drawing"]:  # Only show drawing events
                cumulative_stroke_ids.extend(event.stroke_ids)

                # Render image with all strokes up to this point
                img = whiteboard_app._render_canvas_to_image(cumulative_stroke_ids)

                # Save keyframe
                filename = os.path.join(
                    keyframe_dir,
                    f"keyframe_{keyframe_count:03d}_event_{event.id}_{event.type}.png",
                )
                img.save(filename)
                keyframe_count += 1

        return keyframe_dir

    def _send_all_frames_to_qwen(self, keyframe_files: List[str]) -> str:
        """
        Send all keyframes to Qwen in a single API call with retry logic.

        Args:
            keyframe_files: List of paths to keyframe images

        Returns:
            Qwen's text response
        """
        import time

        # Load prompt template
        prompt = self._load_qwen_prompt()

        # Prepare all images as base64-encoded content
        image_contents = []
        for frame_path in keyframe_files:
            with open(frame_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode()
            image_contents.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_data}"},
                }
            )

        # Construct message with prompt + all images
        message_content = [{"type": "text", "text": prompt}, *image_contents]

        # Make API call with retry logic
        last_error = None
        for attempt in range(Config.QWEN_MAX_RETRIES):
            try:
                print(f"Qwen API call attempt {attempt + 1}/{Config.QWEN_MAX_RETRIES} (timeout: {Config.QWEN_TIMEOUT}s)...")

                completion = self.client.chat.completions.create(
                    model=Config.QWEN_MODEL,
                    messages=[{"role": "user", "content": message_content}],
                )

                return completion.choices[0].message.content

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
                    delay = Config.QWEN_RETRY_DELAY * (2 ** attempt)  # Exponential backoff
                    print(f"Retrying in {delay} seconds...")
                    time.sleep(delay)
                else:
                    print("All retry attempts exhausted")

        err_detail = repr(last_error)
        if hasattr(last_error, 'response') and last_error.response is not None:
            try:
                err_detail += f" | HTTP {last_error.response.status_code}: {last_error.response.text[:500]}"
            except Exception:
                pass
        raise RuntimeError(f"Qwen API call failed after {Config.QWEN_MAX_RETRIES} attempts: {err_detail}")

    def _load_qwen_prompt(self) -> str:
        """Load Qwen prompt template from Prompts file."""
        try:
            with open(Config.PROMPTS_FILE, "r") as f:
                content = f.read()

            # Extract Qwen prompt (everything before Claude prompt section)
            if "---" in content:
                qwen_section = content.split("---")[0]
            else:
                qwen_section = content

            return qwen_section.strip()

        except FileNotFoundError:
            raise FileNotFoundError(f"Prompts file not found: {Config.PROMPTS_FILE}")

    def _parse_qwen_response(self, response_text: str) -> List[Dict[str, Any]]:
        """
        Parse Qwen's response into structured summaries.

        Args:
            response_text: Raw text response from Qwen

        Returns:
            List of frame summaries
        """
        summaries = []

        # Split response by "### Frame" sections
        frame_sections = re.split(r"###\s*Frame\s+(\d+)", response_text)

        # Process each frame section (skip index 0 which is before first frame)
        for i in range(1, len(frame_sections), 2):
            frame_number = int(frame_sections[i])
            frame_content = frame_sections[i + 1] if i + 1 < len(frame_sections) else ""

            # Extract each subsection
            summary = {
                "frame_number": frame_number,
                "visual_summary": self._extract_section(
                    frame_content, "Visual Summary"
                ),
                "mathematical_state": self._extract_section(
                    frame_content, "Mathematical State"
                ),
                "transformation": self._extract_section(
                    frame_content, "Transformation From Previous Frame"
                ),
                "purpose": self._extract_section(frame_content, "Purpose of the Step"),
                "classification": self._extract_section(
                    frame_content, "Classification"
                ),
            }

            summaries.append(summary)

        return summaries

    def _extract_section(self, text: str, section_name: str) -> str:
        """Extract content from a named section."""
        # Pattern: **Section Name:**\n(content)
        pattern = rf"\*\*{re.escape(section_name)}:\*\*\s*\n(.*?)(?=\n\*\*|$)"
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)

        if match:
            return match.group(1).strip()
        return ""

    def _extract_event_coordinates(self, whiteboard_app) -> List[Dict[str, Any]]:
        """
        Extract bounding box coordinates for each drawing event.

        Args:
            whiteboard_app: WhiteboardApp instance

        Returns:
            List of event coordinates
        """
        coordinates = []

        # Create stroke lookup
        stroke_map = {s.id: s for s in whiteboard_app.strokes}

        for event in whiteboard_app.events:
            if event.type in ["drawing"]:
                # Get all strokes for this event
                event_strokes = [stroke_map[sid] for sid in event.stroke_ids if sid in stroke_map]

                if not event_strokes:
                    continue

                # Calculate bounding box from strokes
                all_x = []
                all_y = []
                for stroke in event_strokes:
                    if not stroke.is_eraser:
                        for point in stroke.points:
                            all_x.append(point["x"])
                            all_y.append(point["y"])

                if not all_x or not all_y:
                    continue

                min_x = min(all_x)
                max_x = max(all_x)
                min_y = min(all_y)
                max_y = max(all_y)

                # Calculate center point
                center_x = (min_x + max_x) / 2
                center_y = (min_y + max_y) / 2

                coordinates.append(
                    {
                        "event_id": event.id,
                        "bounding_box": {
                            "x_min": int(min_x),
                            "y_min": int(min_y),
                            "x_max": int(max_x),
                            "y_max": int(max_y),
                        },
                        "center": {"x": int(center_x), "y": int(center_y)},
                    }
                )

        return coordinates
