import { useState, useRef, useEffect } from "react";
import { getSession, getProblem } from "@/lib/api";
import type { SessionProblem, Stroke, ShapeItem, TextItem, ImageItem } from "../types";
import { DEFAULT_WHITEBOARD_TITLE, WHITEBOARD_STORAGE_KEY_PREFIX } from "../constants";

export interface SessionState {
  problem: SessionProblem | null;
  isLoadingSession: boolean;
  sessionError: string | null;
  isBlank: boolean;
  /** Pending blank-board localStorage migration data captured during session load */
  pendingBlankMigrationRef: React.RefObject<{
    data: {
      strokes?: Stroke[];
      shapes?: ShapeItem[];
      textItems?: TextItem[];
      imageItems?: ImageItem[];
    };
    oldKey: string;
  } | null>;
  /** Called by useWhiteboardTitle to set the title from session data */
  onTitleReady: (title: string) => void;
}

/**
 * Loads the session and its associated problem.
 * Fires `onTitleReady(title)` once the session data arrives so
 * `useWhiteboardTitle` can set the canonical initial title before
 * `problem` state is set (preserving the R4 priority order).
 */
export function useSession(
  sessionId: string,
  currentUserId: string | undefined,
  onTitleReady: (title: string) => void,
) {
  const [problem, setProblem] = useState<SessionProblem | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isBlank, setIsBlank] = useState(false);

  const pendingBlankMigrationRef = useRef<{
    data: {
      strokes?: Stroke[];
      shapes?: ShapeItem[];
      textItems?: TextItem[];
      imageItems?: ImageItem[];
    };
    oldKey: string;
  } | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setIsLoadingSession(true);
    setSessionError(null);

    getSession(sessionId)
      .then((sessionRes) => {
        if (cancelled) return;
        if (!sessionRes.ok) {
          setSessionError(sessionRes.status === 404 ? "Session not found" : sessionRes.error);
          setIsLoadingSession(false);
          return;
        }
        const sess = sessionRes.data;

        // Set title before setProblem() to prevent problem-sync effect override (R4)
        const initialTitle = sess.title ?? sess.problem?.title ?? DEFAULT_WHITEBOARD_TITLE;
        onTitleReady(initialTitle);

        if (!sess.problem_id) {
          setIsBlank(true);
          setIsLoadingSession(false);

          // One-time migration: capture any old blank-board localStorage data
          if (currentUserId && typeof window !== "undefined") {
            const oldKey = `${WHITEBOARD_STORAGE_KEY_PREFIX}${currentUserId}-blank`;
            try {
              const raw = window.localStorage.getItem(oldKey);
              if (raw) {
                const data = JSON.parse(raw) as {
                  strokes?: Stroke[];
                  shapes?: ShapeItem[];
                  textItems?: TextItem[];
                  imageItems?: ImageItem[];
                };
                pendingBlankMigrationRef.current = { data, oldKey };
              }
            } catch {
              // ignore invalid old data
            }
          }
        } else if (sess.problem) {
          const p = sess.problem;
          setProblem({
            id: p.id,
            title: p.title,
            topic: p.topic,
            difficulty: p.difficulty,
            type: p.type,
            estimatedTime: p.estimatedTime,
            statement: p.statement,
          });
          setIsLoadingSession(false);
        } else {
          return getProblem(sess.problem_id).then((probRes) => {
            if (cancelled) return;
            if (probRes.ok) {
              const p = probRes.data;
              setProblem({
                id: p.id,
                title: p.title,
                topic: p.topic,
                difficulty: p.difficulty,
                type: p.type,
                estimatedTime: p.estimatedTime,
                statement: p.statement,
              });
            } else {
              setSessionError("Problem not found");
            }
            setIsLoadingSession(false);
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessionError("Failed to load session");
          setIsLoadingSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, currentUserId, onTitleReady]);

  return {
    problem,
    isLoadingSession,
    sessionError,
    isBlank,
    pendingBlankMigrationRef,
  };
}

export type Session = ReturnType<typeof useSession>;
