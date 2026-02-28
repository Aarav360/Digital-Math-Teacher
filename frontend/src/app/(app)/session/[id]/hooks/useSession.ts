import { useState, useRef, useEffect, type RefObject } from "react";
import { getSession, getProblem } from "@/lib/api";
import type { SessionProblem, SessionNotebookProblem, Stroke, ShapeItem, TextItem, ImageItem, GraphItem } from "../types";
import { DEFAULT_WHITEBOARD_TITLE, WHITEBOARD_STORAGE_KEY_PREFIX } from "../constants";

export interface SessionState {
  problem: SessionProblem | null;
  notebookProblem: SessionNotebookProblem | null;
  isLoadingSession: boolean;
  sessionError: string | null;
  isBlank: boolean;
  status: string;
  setStatus: (status: string) => void;
  /** Pending blank-board localStorage migration data captured during session load */
  pendingBlankMigrationRef: RefObject<{
    data: {
      strokes?: Stroke[];
      shapes?: ShapeItem[];
      textItems?: TextItem[];
      imageItems?: ImageItem[];
      graphItems?: GraphItem[];
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
  const [notebookProblem, setNotebookProblem] = useState<SessionNotebookProblem | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isBlank, setIsBlank] = useState(false);
  const [status, setStatus] = useState("not_started");
  const [problemOverride, setProblemOverride] = useState<string | null>(null);

  const pendingBlankMigrationRef = useRef<{
    data: {
      strokes?: Stroke[];
      shapes?: ShapeItem[];
      textItems?: TextItem[];
      imageItems?: ImageItem[];
      graphItems?: GraphItem[];
    };
    oldKey: string;
  } | null>(null);

  const titleReadyRef = useRef(onTitleReady);
  useEffect(() => {
    titleReadyRef.current = onTitleReady;
  }, [onTitleReady]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setIsLoadingSession(true);
    setSessionError(null);
    setProblem(null);
    setNotebookProblem(null);
    setIsBlank(false);

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
        titleReadyRef.current(initialTitle);
        setStatus(sess.status);
        setProblemOverride(sess.problem_override ?? null);

        if (!sess.problem_id) {
          if (sess.notebook_problem) {
            setNotebookProblem({
              id: sess.notebook_problem.id,
              notebook_id: sess.notebook_problem.notebook_id,
              title: sess.notebook_problem.title,
              prompt: sess.notebook_problem.prompt ?? null,
            });
            setIsBlank(false);
          } else {
            setIsBlank(true);
          }
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
                  graphItems?: GraphItem[];
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
          setIsBlank(false);
          setIsLoadingSession(false);
        } else {
          return getProblem(sess.problem_id)
            .then((probRes) => {
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
                setIsBlank(false);
              } else {
                setSessionError("Problem not found");
              }
              setIsLoadingSession(false);
            })
            .catch(() => {
              if (!cancelled) {
                setSessionError("Failed to load problem");
                setIsLoadingSession(false);
              }
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
  }, [sessionId, currentUserId]);

  return {
    problem,
    notebookProblem,
    isLoadingSession,
    sessionError,
    isBlank,
    status,
    setStatus,
    problemOverride,
    setProblemOverride,
    pendingBlankMigrationRef,
  };
}

export type Session = ReturnType<typeof useSession>;
