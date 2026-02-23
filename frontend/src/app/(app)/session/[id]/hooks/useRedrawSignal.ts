import { useRef, useCallback } from "react";

/**
 * Shared redraw coordination.
 *
 * `useCanvasDrawing` calls `registerRedrawHandler` once with the real draw
 * function. All other hooks call `requestRedraw()`. The internal handler is
 * initialized to a no-op so any call before registration is silently dropped
 * rather than throwing, regardless of hook instantiation order.
 */
export function useRedrawSignal() {
  const handlerRef = useRef<() => void>(() => {});

  const registerRedrawHandler = useCallback((fn: () => void) => {
    handlerRef.current = fn;
  }, []);

  const requestRedraw = useCallback(() => {
    handlerRef.current();
  }, []);

  return { requestRedraw, registerRedrawHandler };
}

export type RedrawSignal = ReturnType<typeof useRedrawSignal>;
