import { useState, useRef, useCallback, useEffect } from "react";
import { updateSessionTitle } from "@/lib/api";
import { toast } from "sonner";
import type { SessionProblem } from "../types";
import { DEFAULT_WHITEBOARD_TITLE } from "../constants";

/**
 * Manages the whiteboard title with a strict 3-level priority order (R4):
 *
 * 1. Session load sets the canonical title via `setInitialTitle()` and marks
 *    `titleLoadedRef.current = true`.
 * 2. The problem-sync effect may only set the title from `problem.title` if
 *    `!titleLoadedRef.current` (i.e., before session data arrived).
 * 3. Once loaded, only an explicit user rename may change the title.
 *
 * Breaking this order causes the problem-sync effect to silently overwrite a
 * server-side title on re-render.
 */
export function useWhiteboardTitle(
  sessionId: string,
  problem: SessionProblem | null,
) {
  const [whiteboardTitle, setWhiteboardTitle] = useState(DEFAULT_WHITEBOARD_TITLE);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleBeforeEditRef = useRef(DEFAULT_WHITEBOARD_TITLE);

  // Prevents the problem-sync effect from overwriting a loaded title (R4)
  const titleLoadedRef = useRef(false);
  // Tracks the last successfully persisted title for flush-on-exit (R5)
  const titleSavedRef = useRef(DEFAULT_WHITEBOARD_TITLE);

  /**
   * Called by useSession once session data arrives (before setProblem fires).
   * This is the canonical title source — it gates the problem-sync effect.
   */
  const setInitialTitle = useCallback((title: string) => {
    setWhiteboardTitle(title);
    titleSavedRef.current = title;
    titleLoadedRef.current = true;
  }, []);

  // Problem-sync effect: only allowed before session title has loaded (R4)
  useEffect(() => {
    if (!titleLoadedRef.current && problem) {
      setWhiteboardTitle(problem.title);
      titleBeforeEditRef.current = problem.title;
    }
  }, [problem]);

  // Focus + select the input when entering edit mode
  useEffect(() => {
    if (isEditingTitle) {
      titleBeforeEditRef.current = whiteboardTitle;
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle, whiteboardTitle]);

  const saveTitle = useCallback(() => {
    const trimmed = whiteboardTitle.trim() || DEFAULT_WHITEBOARD_TITLE;
    setWhiteboardTitle(trimmed);
    setIsEditingTitle(false);
    if (sessionId) {
      updateSessionTitle(sessionId, trimmed).then((res) => {
        if (res.ok) {
          titleSavedRef.current = trimmed;
        } else {
          toast.error("Failed to save title");
        }
      });
    }
  }, [whiteboardTitle, sessionId]);

  const cancelTitleEdit = useCallback(() => {
    setWhiteboardTitle(titleBeforeEditRef.current);
    setIsEditingTitle(false);
  }, []);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveTitle();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        cancelTitleEdit();
      }
    },
    [saveTitle, cancelTitleEdit],
  );

  return {
    whiteboardTitle,
    setWhiteboardTitle,
    isEditingTitle,
    setIsEditingTitle,
    titleInputRef,
    titleSavedRef,
    setInitialTitle,
    saveTitle,
    cancelTitleEdit,
    handleTitleKeyDown,
  };
}

export type WhiteboardTitle = ReturnType<typeof useWhiteboardTitle>;
