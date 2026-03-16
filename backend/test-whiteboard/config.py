"""Configuration file for AI-powered whiteboard grading pipeline."""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Central configuration for API keys and settings."""

    # API Keys
    HF_TOKEN = os.environ.get("HF_TOKEN")
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

    # Models
    QWEN_MODEL = "Qwen/Qwen3-VL-8B-Instruct"          # incremental per-frame analysis
    QWEN_GRADER_MODEL = "Qwen/Qwen2.5-VL-72B-Instruct"  # final grading (higher param)

    # Claude models to try in order (newest to oldest)
    CLAUDE_MODELS = [
        "claude-sonnet-4-5",  # Latest naming convention
        "claude-opus-4",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-sonnet-20240620",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
    ]

    # Canvas
    CANVAS_WIDTH = 800
    CANVAS_HEIGHT = 600

    # Annotation Colors
    ERROR_COLOR = "#D23636"  # Red (removed alpha channel)
    HIGHLIGHT_COLOR = "#FF0000"  # Red outline for box
    TEXTBOX_BG = "#11110C"  # Light yellow
    TEXTBOX_FG = "#000000"  # Black text
    CIRCLE_COLOR = "#FF0000"  # Red
    ARROW_COLOR = "#FF0000"  # Red

    # Annotation Sizes
    CIRCLE_RADIUS = 25
    TEXTBOX_MAX_WIDTH = 200
    TEXTBOX_PADDING = 5
    ARROW_WIDTH = 3
    HIGHLIGHT_WIDTH = 2

    # Font
    TEXTBOX_FONT = ("Arial", 10)

    # Timeouts (seconds)
    QWEN_TIMEOUT = 60          # per-frame timeout for incremental analysis
    QWEN_GRADER_TIMEOUT = 180  # grader timeout (larger model, more time)
    CLAUDE_TIMEOUT = 90

    # Retry settings
    QWEN_MAX_RETRIES = 3
    QWEN_RETRY_DELAY = 5  # seconds

    # Paths
    PROMPTS_FILE = "Prompts"
