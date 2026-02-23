import { useState, useRef, useCallback, useEffect } from "react";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP_DEFAULT, ZOOM_STEP_MIN, ZOOM_STEP_MAX, ZOOM_SPEED_STORAGE_KEY, CONSTANT_GRID_STORAGE_KEY } from "../constants";
import type { Point } from "../types";

export function useViewTransform(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Last mouse position for zoom-toward-cursor
  const lastMouseRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });

  // Sync pan/scale for async usage (e.g. place new image at view center)
  const viewTransformRef = useRef({ pan: { x: 0, y: 0 }, scale: 1 });
  viewTransformRef.current = { pan, scale };

  const [zoomStep, setZoomStep] = useState(() => {
    if (typeof window === "undefined") return ZOOM_STEP_DEFAULT;
    const stored = window.localStorage.getItem(ZOOM_SPEED_STORAGE_KEY);
    if (stored == null) return ZOOM_STEP_DEFAULT;
    const n = parseFloat(stored);
    if (!Number.isFinite(n) || n < ZOOM_STEP_MIN || n > ZOOM_STEP_MAX) return ZOOM_STEP_DEFAULT;
    return n;
  });

  const [constantGridSize, setConstantGridSize] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(CONSTANT_GRID_STORAGE_KEY);
    if (stored == null) return true;
    return stored === "1" || stored === "true";
  });

  // Re-read settings from localStorage on tab focus so cross-tab changes apply
  useEffect(() => {
    const syncFromStorage = () => {
      const z = window.localStorage.getItem(ZOOM_SPEED_STORAGE_KEY);
      if (z != null) {
        const n = parseFloat(z);
        if (Number.isFinite(n) && n >= ZOOM_STEP_MIN && n <= ZOOM_STEP_MAX) setZoomStep(n);
      }
      const g = window.localStorage.getItem(CONSTANT_GRID_STORAGE_KEY);
      if (g != null) setConstantGridSize(g === "1" || g === "true");
    };
    window.addEventListener("focus", syncFromStorage);
    return () => window.removeEventListener("focus", syncFromStorage);
  }, []);

  /** Convert screen (clientX, clientY) → world coordinates */
  const getPos = useCallback(
    (clientX: number, clientY: number): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      return { x: (screenX - pan.x) / scale, y: (screenY - pan.y) / scale };
    },
    [canvasRef, pan, scale],
  );

  const handleZoomIn = useCallback(() => {
    const canvas = canvasRef.current;
    const newScale = Math.min(MAX_ZOOM, scale * zoomStep);
    if (!canvas || newScale === scale) {
      setScale(newScale);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const { clientX, clientY } = lastMouseRef.current;
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    setPan({
      x: screenX - ((screenX - pan.x) / scale) * newScale,
      y: screenY - ((screenY - pan.y) / scale) * newScale,
    });
    setScale(newScale);
  }, [canvasRef, scale, pan.x, pan.y, zoomStep]);

  const handleZoomOut = useCallback(() => {
    const canvas = canvasRef.current;
    const newScale = Math.max(MIN_ZOOM, scale / zoomStep);
    if (!canvas || newScale === scale) {
      setScale(newScale);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const { clientX, clientY } = lastMouseRef.current;
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    setPan({
      x: screenX - ((screenX - pan.x) / scale) * newScale,
      y: screenY - ((screenY - pan.y) / scale) * newScale,
    });
    setScale(newScale);
  }, [canvasRef, scale, pan.x, pan.y, zoomStep]);

  // Mouse wheel zoom (passive: false so preventDefault works)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      lastMouseRef.current = { clientX: e.clientX, clientY: e.clientY };
      if (e.deltaY < 0) handleZoomIn();
      else if (e.deltaY > 0) handleZoomOut();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvasRef, handleZoomIn, handleZoomOut]);

  return {
    scale,
    setScale,
    pan,
    setPan,
    isPanning,
    setIsPanning,
    panStartRef,
    lastMouseRef,
    viewTransformRef,
    zoomStep,
    constantGridSize,
    getPos,
    handleZoomIn,
    handleZoomOut,
  };
}

export type ViewTransform = ReturnType<typeof useViewTransform>;
