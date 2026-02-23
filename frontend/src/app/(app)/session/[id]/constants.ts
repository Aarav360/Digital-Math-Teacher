import type { SessionProblem } from "./types";

export const GRID_STEP = 24;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ZOOM_STEP_MIN = 1.05;
export const ZOOM_STEP_MAX = 1.4;
export const ZOOM_STEP_DEFAULT = 1.1;
export const ZOOM_SPEED_STORAGE_KEY = "whiteboard-zoom-speed";
export const CONSTANT_GRID_STORAGE_KEY = "whiteboard-constant-grid-size";
export const STATIC_GRID_SIZE_PX = 20;
export const GRID_COLOR = "#f0f0f0";

export const DEFAULT_PEN_COLOR = "#1d1d1f";
export const TOOLBAR_BUTTON_HOVER =
  "transition-all duration-150 hover:brightness-[0.97] active:brightness-95";
export const DEFAULT_WHITEBOARD_TITLE = "Untitled Whiteboard";
export const WHITEBOARD_STORAGE_KEY_PREFIX = "whiteboard-draft-";
export const WHITEBOARD_NO_CLEAR_WARNING_PREFIX = "whiteboard-no-clear-warning-";
export const PERSIST_DEBOUNCE_MS = 800;
export const AUTOSAVE_DEBOUNCE_MS = 2500;
export const MIN_TIME_BETWEEN_SAVES_MS = 2000;
export const MIGRATION_FLAG_PREFIX = "migrated-snapshot-";

export const HANDLE_SIZE = 16;
export const MIN_IMAGE_SIZE = 24;

export const BLANK_PROBLEM: SessionProblem = {
  id: "blank",
  title: "Untitled Whiteboard",
  topic: "Scratch",
  difficulty: 0,
  type: "Free",
  estimatedTime: "",
  statement: "",
};
