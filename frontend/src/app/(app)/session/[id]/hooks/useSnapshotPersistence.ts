import { useState, useRef, useEffect, useCallback } from "react";
import { saveSnapshot, loadSnapshot } from "@/lib/api";
import { getToken, getApiBase } from "@/lib/auth";
import { getCssVar, resolveCssColor } from "@/lib/theme";
import { toast } from "sonner";
import type { Stroke, ShapeItem, TextItem, ImageItem, GraphItem } from "../types";
import {
  AUTOSAVE_DEBOUNCE_MS,
  MIN_TIME_BETWEEN_SAVES_MS,
  MIGRATION_FLAG_PREFIX,
  WHITEBOARD_STORAGE_KEY_PREFIX,
} from "../constants";
import type { WhiteboardContent } from "./useWhiteboardContent";
import type { Session } from "./useSession";

interface PersistenceArgs {
  sessionId: string;
  content: WhiteboardContent;
  session: Session;
  resetWithSnapshot: () => void;
  requestRedraw: () => void;
  currentUserId: string | undefined;
}

export function useSnapshotPersistence({
  sessionId,
  content,
  session,
  resetWithSnapshot,
  requestRedraw,
  currentUserId,
}: PersistenceArgs) {
  const { refs, replaceAll, rebuildImageCache, rebuildGraphCache, state } = content;
  const { strokesRef, shapesRef, textItemsRef, imageItemsRef, graphItemsRef } = refs;
  const { isLoadingSession, sessionError, pendingBlankMigrationRef } = session;

  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);

  const lastSavedRef = useRef<string>("");
  const lastSaveTimestampRef = useRef<number>(0);
  const saveControllerRef = useRef<AbortController | null>(null);
  const pendingSaveRef = useRef<NodeJS.Timeout | null>(null);
  const migrationAttemptedRef = useRef<boolean>(false);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const imagesDirtyRef = useRef(false);
  const graphsDirtyRef = useRef(false);
  const getDefaultInkColor = useCallback(
    () => getCssVar("--ink-default") || "var(--ink-default)",
    [],
  );
  const resolveColorValue = useCallback((value: string) => {
    const fallback = getCssVar("--ink-default") || value;
    return resolveCssColor(value, fallback);
  }, []);

  const normalizeStrokes = useCallback(
    (strokes: Stroke[]) =>
      strokes.map((stroke) => ({
        ...stroke,
        color: resolveColorValue(stroke.color),
      })),
    [resolveColorValue],
  );

  const normalizeShapes = useCallback(
    (shapes: ShapeItem[]) =>
      shapes.map((shape) => ({
        ...shape,
        color: resolveColorValue(shape.color),
      })),
    [resolveColorValue],
  );

  const normalizeTextItems = useCallback(
    (textItems: TextItem[]) =>
      textItems.map((item) => ({
        ...item,
        color: resolveColorValue(item.color),
      })),
    [resolveColorValue],
  );

  // Tracks component mount state so autosave cleanup doesn't cancel saves on unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    imagesDirtyRef.current = true;
  }, [state.imageItems]);

  useEffect(() => {
    graphsDirtyRef.current = true;
  }, [state.graphItems]);

  const getDraftKey = useCallback(
    (suffix: string) => {
      if (!currentUserId) return null;
      return `${WHITEBOARD_STORAGE_KEY_PREFIX}${currentUserId}-${suffix}`;
    },
    [currentUserId],
  );

  const tryWriteLocalBackup = useCallback(
    (
      sid: string,
      payload: {
        strokes: Stroke[];
        shapes: ShapeItem[];
        textItems: TextItem[];
        width: number;
        height: number;
      },
    ): boolean => {
      const key = getDraftKey(sid);
      if (!key || typeof window === "undefined") return false;
      try {
        window.localStorage.setItem(key, JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    },
    [getDraftKey],
  );

  // ── Load snapshot on mount ───────────────────────────────────────────────

  useEffect(() => {
    if (isLoadingSession || sessionError) return;
    if (!currentUserId) return;

    setIsLoadingSnapshot(true);
    loadSnapshot(sessionId)
      .then(async (result) => {
        if (result.ok && result.data) {
          const { strokes_json, width, height } = result.data;
          const defaultColor = getDefaultInkColor();
          const loadedStrokes = strokes_json.strokes?.length
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (strokes_json.strokes as Array<any>).map((s, i) => ({
                ...s,
                id: s.id ?? `loaded-stroke-${i}`,
                color: s.color || defaultColor,
              })) as Stroke[]
            : [];
          const loadedShapes = strokes_json.shapes?.length
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (strokes_json.shapes as Array<any>).map((s, i) => ({
                ...s,
                id: s.id ?? `loaded-shape-${i}`,
                color: s.color || defaultColor,
              })) as ShapeItem[]
            : [];
          const loadedText = ((strokes_json.textItems as TextItem[]) ?? []).map((item) => ({
            ...item,
            color: item.color || defaultColor,
          }));
          const loadedImages = (strokes_json.imageItems as ImageItem[]) ?? [];
          const loadedGraphs = (strokes_json.graphItems as GraphItem[]) ?? [];

          replaceAll({
            strokes: loadedStrokes,
            shapes: loadedShapes,
            textItems: loadedText,
            imageItems: loadedImages,
            graphItems: loadedGraphs,
          });
          resetWithSnapshot();

          // Mark content as saved (exclude imageItems from dirty-check to match autosave)
          lastSavedRef.current = JSON.stringify({
            strokes: strokes_json.strokes || [],
            shapes: strokes_json.shapes || [],
            textItems: strokes_json.textItems || [],
          });
          lastSaveTimestampRef.current = Date.now();
          void width; void height; // metadata only, not used beyond this point

          // isLoadingSnapshot must remain true until cache rebuild completes (invariant)
          await rebuildImageCache(loadedImages, requestRedraw);
          await rebuildGraphCache(loadedGraphs, requestRedraw);
          imagesDirtyRef.current = false;
          graphsDirtyRef.current = false;
        } else if (!result.ok && result.status === 404) {
          // No snapshot yet — attempt localStorage migration
          if (!currentUserId) return;

          const migratedOldKey = pendingBlankMigrationRef.current?.oldKey ?? null;
          const data = (() => {
            if (pendingBlankMigrationRef.current) {
              const { data: d } = pendingBlankMigrationRef.current;
              pendingBlankMigrationRef.current = null;
              return d;
            }
            const key = getDraftKey(sessionId);
            const migrationFlagKey = `${MIGRATION_FLAG_PREFIX}${currentUserId}-${sessionId}`;
            if (!key || migrationAttemptedRef.current || typeof window === "undefined") return null;
            if (window.localStorage.getItem(migrationFlagKey)) return null;
            try {
              const raw = window.localStorage.getItem(key);
              return raw
                ? (JSON.parse(raw) as {
                    strokes?: Stroke[];
                    shapes?: ShapeItem[];
                    textItems?: TextItem[];
                    imageItems?: ImageItem[];
                    graphItems?: GraphItem[];
                  })
                : null;
            } catch {
              return null;
            }
          })();

          if (data && (data.strokes || data.shapes || data.textItems || data.imageItems || data.graphItems)) {
            const defaultColor = getDefaultInkColor();
            const migrStrokes = data.strokes?.length
              ? (data.strokes as Array<Stroke & { id?: string }>).map((s, i) => ({
                  ...s,
                  id: s.id ?? `loaded-stroke-${i}`,
                  color: s.color || defaultColor,
                }))
              : [];
            const migrShapes = data.shapes?.length
              ? (data.shapes as Array<ShapeItem & { id?: string }>).map((s, i) => ({
                  ...s,
                  id: s.id ?? `loaded-shape-${i}`,
                  color: s.color || defaultColor,
                }))
              : [];
            const migrTextItems = (data.textItems ?? []).map((item) => ({
              ...item,
              color: item.color || defaultColor,
            }));
            const migrImages = data.imageItems ?? [];
            const migrGraphs = data.graphItems ?? [];

            replaceAll({
              strokes: migrStrokes,
              shapes: migrShapes,
              textItems: migrTextItems,
              imageItems: migrImages,
              graphItems: migrGraphs,
            });
            resetWithSnapshot();
            await rebuildImageCache(migrImages, requestRedraw);
            await rebuildGraphCache(migrGraphs, requestRedraw);

            migrationAttemptedRef.current = true;
            const { width, height } = canvasSizeRef.current;
            const normalizedMigrStrokes = normalizeStrokes(migrStrokes);
            const normalizedMigrShapes = normalizeShapes(migrShapes);
            const normalizedMigrTextItems = normalizeTextItems(migrTextItems);
            saveSnapshot(sessionId, {
                strokes_json: {
                  strokes: normalizedMigrStrokes,
                  shapes: normalizedMigrShapes,
                  textItems: normalizedMigrTextItems,
                  imageItems: migrImages,
                  graphItems: migrGraphs,
                },
                width,
                height,
              })
              .then((migrateResult) => {
                if (migrateResult.ok) {
                  const key = getDraftKey(sessionId);
                  if (key) window.localStorage.removeItem(key);
                  if (migratedOldKey) window.localStorage.removeItem(migratedOldKey);
                  window.localStorage.setItem(
                    `${MIGRATION_FLAG_PREFIX}${currentUserId}-${sessionId}`,
                    "1",
                  );
                  imagesDirtyRef.current = false;
                  graphsDirtyRef.current = false;
                  toast.success("Draft migrated to cloud");
                } else {
                  console.error("Failed to migrate draft:", migrateResult.error);
                  toast.error("Failed to migrate draft. Your work is still saved locally.");
                }
              })
              .catch((err) => {
                console.error("Error migrating draft:", err);
                toast.error("Failed to migrate draft. Your work is still saved locally.");
              });
          }
        }
      })
      .catch(() => {
        // Network error — silently fail, start empty
      })
      .finally(() => {
        setIsLoadingSnapshot(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentUserId, isLoadingSession, sessionError]);

  // ── Autosave ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Guard: wait for session + snapshot load before autosaving.
    // Without this, autosave fires with empty state before the real snapshot
    // arrives and silently wipes the session (critical invariant).
    if (isLoadingSession || isLoadingSnapshot || sessionError) return;
    if (!currentUserId) return;

    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
    if (saveControllerRef.current) {
      saveControllerRef.current.abort();
      saveControllerRef.current = null;
    }

    pendingSaveRef.current = setTimeout(() => {
      const timeSinceLastSave = Date.now() - lastSaveTimestampRef.current;
      if (timeSinceLastSave < MIN_TIME_BETWEEN_SAVES_MS) {
        if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
        pendingSaveRef.current = setTimeout(() => {
          pendingSaveRef.current = null;
          performSave();
        }, MIN_TIME_BETWEEN_SAVES_MS - timeSinceLastSave);
        return;
      }
      pendingSaveRef.current = null;
      performSave();
    }, AUTOSAVE_DEBOUNCE_MS);

    const performSave = () => {
      const { width, height } = canvasSizeRef.current;
      const serialized = JSON.stringify({
        strokes: strokesRef.current,
        shapes: shapesRef.current,
        textItems: textItemsRef.current,
      });
      const normalizedStrokes = normalizeStrokes(strokesRef.current);
      const normalizedShapes = normalizeShapes(shapesRef.current);
      const normalizedTextItems = normalizeTextItems(textItemsRef.current);
      const currentPayload = {
        strokes: normalizedStrokes,
        shapes: normalizedShapes,
        textItems: normalizedTextItems,
        width,
        height,
      };
      if (serialized === lastSavedRef.current) return;

      const controller = new AbortController();
      saveControllerRef.current = controller;
      setIsSavingSnapshot(true);

      saveSnapshot(sessionId, {
        strokes_json: {
          strokes: normalizedStrokes,
          shapes: normalizedShapes,
          textItems: normalizedTextItems,
          // imageItems/graphItems intentionally excluded from autosave
        },
        width,
        height,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (result.ok) {
            lastSavedRef.current = serialized;
            lastSaveTimestampRef.current = Date.now();
          } else {
            if (result.status === 403 || result.status === 404) {
              toast.error(result.error || "Failed to save");
            } else if (result.status === 500) {
              const backupSucceeded = tryWriteLocalBackup(sessionId, currentPayload);
              toast.error(
                backupSucceeded
                  ? "Server error. Your work is saved locally."
                  : "Server error. Your work may not be saved.",
              );
            } else {
              toast.error("Failed to save");
            }
          }
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          void err;
          toast.error("Failed to save. Check your connection.");
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSavingSnapshot(false);
            saveControllerRef.current = null;
          }
        });
    };

    return () => {
      // Intentional: on unmount let the pending timer fire naturally so the
      // final autosave completes after navigation. Only cancel during re-renders.
      if (!isMountedRef.current) return;
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
      if (saveControllerRef.current) {
        saveControllerRef.current.abort();
        saveControllerRef.current = null;
      }
    };
  }, [
    sessionId,
    currentUserId,
    state.strokes,
    state.shapes,
    state.textItems,
    isLoadingSession,
    isLoadingSnapshot,
    sessionError,
    strokesRef,
    shapesRef,
    textItemsRef,
    tryWriteLocalBackup,
  ]);

  // ── Force immediate save (used by useFeedback before analysis) ───────────

  const forceImmediateSave = useCallback(async (): Promise<void> => {
    if (!currentUserId) return;

    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
    if (saveControllerRef.current) {
      saveControllerRef.current.abort();
    }

    const controller = new AbortController();
    saveControllerRef.current = controller;
    setIsSavingSnapshot(true);

    const { width, height } = canvasSizeRef.current;
    const serializedBeforeSave = JSON.stringify({
      strokes: strokesRef.current,
      shapes: shapesRef.current,
      textItems: textItemsRef.current,
    });
    const normalizedStrokes = normalizeStrokes(strokesRef.current);
    const normalizedShapes = normalizeShapes(shapesRef.current);
    const normalizedTextItems = normalizeTextItems(textItemsRef.current);
    try {
      const result = await saveSnapshot(sessionId, {
        strokes_json: {
          strokes: normalizedStrokes,
          shapes: normalizedShapes,
          textItems: normalizedTextItems,
          imageItems: imageItemsRef.current, // include images on explicit action
          graphItems: graphItemsRef.current,
        },
        width,
        height,
      });

      if (!controller.signal.aborted) {
        if (result.ok) {
          lastSavedRef.current = serializedBeforeSave;
          lastSaveTimestampRef.current = Date.now();
          imagesDirtyRef.current = false;
          graphsDirtyRef.current = false;
        } else {
          toast.error("Failed to save on exit");
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        toast.error("Failed to save before analysis");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSavingSnapshot(false);
        saveControllerRef.current = null;
      }
    }
  }, [
    sessionId,
    currentUserId,
    strokesRef,
    shapesRef,
    textItemsRef,
    imageItemsRef,
    graphItemsRef,
    normalizeStrokes,
    normalizeShapes,
    normalizeTextItems,
  ]);

  // ── Back-navigation save (keepalive for small payloads) ──────────────────

  const saveOnExit = useCallback(async (): Promise<void> => {
    if (!currentUserId) return;

    // Cancel pending autosave — we fire our own save here
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
    if (saveControllerRef.current) {
      saveControllerRef.current.abort();
      saveControllerRef.current = null;
    }

    const serialized = JSON.stringify({
      strokes: strokesRef.current,
      shapes: shapesRef.current,
      textItems: textItemsRef.current,
    });
    const strokesDirty = serialized !== lastSavedRef.current;

    if (!strokesDirty && !imagesDirtyRef.current && !graphsDirtyRef.current) return;

    const { width, height } = canvasSizeRef.current;
    const normalizedStrokes = normalizeStrokes(strokesRef.current);
    const normalizedShapes = normalizeShapes(shapesRef.current);
    const normalizedTextItems = normalizeTextItems(textItemsRef.current);
    const payload = {
      strokes_json: {
        strokes: normalizedStrokes,
        shapes: normalizedShapes,
        textItems: normalizedTextItems,
        imageItems: imageItemsRef.current,
        graphItems: graphItemsRef.current,
      },
      width,
      height,
    };

    const KEEPALIVE_LIMIT = 45 * 1024;
    /** Chrome/Firefox/Safari ≈ 64 KB total budget for sendBeacon/keepalive; larger payloads are silently dropped. */
    const BROWSER_KEEPALIVE_CEILING = 64 * 1024;
    const byteLength = new TextEncoder().encode(JSON.stringify(payload)).length;

    if (byteLength <= KEEPALIVE_LIMIT) {
      const token = getToken();
      // Fire-and-forget; attach .catch to avoid unhandled promise rejections (payload already under 64 KB here).
      fetch(`${getApiBase()}/api/v1/sessions/${sessionId}/snapshot`, {
        method: "PUT",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      }).catch(() => {});
      imagesDirtyRef.current = false;
      graphsDirtyRef.current = false;
      // Fire-and-forget — browser completes this after navigation
    } else {
      const { width, height } = canvasSizeRef.current;
      let backupSucceeded = false;
      try {
        backupSucceeded = tryWriteLocalBackup(sessionId, {
          strokes: normalizedStrokes,
          shapes: normalizedShapes,
          textItems: normalizedTextItems,
          width,
          height,
        });
      } catch {
        backupSucceeded = false;
      }
      try {
        const result = await saveSnapshot(sessionId, payload);
        if (result.ok) {
          imagesDirtyRef.current = false;
          graphsDirtyRef.current = false;
        } else {
          toast.error("Failed to save before analysis");
          imagesDirtyRef.current = true;
          graphsDirtyRef.current = true;
        }
      } catch (err) {
        console.error("Exit snapshot failed (payload > 45KB):", err);
        if (!backupSucceeded) {
          toast.error("Snapshot may not be saved. Check your connection.");
        }
        // Best-effort keepalive retry only when payload is under browser ~64 KB ceiling (Chrome/Firefox/Safari);
        // larger payloads are silently dropped by the browser, so we skip keepalive and rely on local backup.
        if (byteLength > BROWSER_KEEPALIVE_CEILING) {
          console.warn(
            "Exit snapshot keepalive retry skipped: payload exceeds browser keepalive ceiling (~64 KB). Rely on local backup."
          );
        } else {
          try {
            const token = getToken();
            fetch(`${getApiBase()}/api/v1/sessions/${sessionId}/snapshot`, {
              method: "PUT",
              keepalive: true,
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify(payload),
            }).catch(() => {});
          } catch {
            // best effort
          }
        }
      }
    }
  }, [
    sessionId,
    currentUserId,
    strokesRef,
    shapesRef,
    textItemsRef,
    imageItemsRef,
    graphItemsRef,
    tryWriteLocalBackup,
    normalizeStrokes,
    normalizeShapes,
    normalizeTextItems,
  ]);

  return {
    isLoadingSnapshot,
    isSavingSnapshot,
    canvasSizeRef,
    forceImmediateSave,
    saveOnExit,
  };
}

export type SnapshotPersistence = ReturnType<typeof useSnapshotPersistence>;
