import { useState, useRef, useCallback } from "react";
import type { Point, Stroke, ShapeItem } from "../types";
import type { WhiteboardContent } from "./useWhiteboardContent";
import type { ViewTransform } from "./useViewTransform";
import type { useWhiteboardHistory } from "./useWhiteboardHistory";

type History = ReturnType<typeof useWhiteboardHistory>;

interface SelectionArgs {
  content: WhiteboardContent;
  view: ViewTransform;
  history: History;
}

function pointInPolygon(p: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y, xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function useSelection({ content, view, history }: SelectionArgs) {
  const { state, __unsafeSetters } = content;
  const { setStrokes, setShapes } = __unsafeSetters;
  const { scale, pan } = view;

  const [selectedStrokeIndices, setSelectedStrokeIndices] = useState<Set<number>>(new Set());
  const [selectedShapeIndices, setSelectedShapeIndices] = useState<Set<number>>(new Set());
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const selectionBoxStartRef = useRef<Point | null>(null);
  const selectionBoxEndRef = useRef<Point | null>(null);
  const isSelectingRef = useRef(false);

  // Mirror ref kept in sync for synchronous reads in event handlers
  const selectionRef = useRef<{ strokes: Set<number>; shapes: Set<number> }>({
    strokes: new Set(),
    shapes: new Set(),
  });
  selectionRef.current = { strokes: selectedStrokeIndices, shapes: selectedShapeIndices };

  const isMovingSelectionRef = useRef(false);
  const moveSelectionStartRef = useRef<{ pageX: number; pageY: number } | null>(null);

  // Clipboard for cut/copy/paste
  const clipboardRef = useRef<{ strokes: Stroke[]; shapes: ShapeItem[] } | null>(null);

  /** Clear all selection state (called by orchestrator on clearAll / replaceAll). */
  const clear = useCallback(() => {
    setSelectedStrokeIndices(new Set());
    setSelectedShapeIndices(new Set());
    setLassoPoints([]);
    selectionBoxStartRef.current = null;
    selectionBoxEndRef.current = null;
    isSelectingRef.current = false;
    isMovingSelectionRef.current = false;
    moveSelectionStartRef.current = null;
  }, []);

  /** Bounding box of current selection in world coords; null if empty. */
  const getSelectionBounds = useCallback(():
    | { minX: number; minY: number; maxX: number; maxY: number }
    | null => {
    const { strokes: si, shapes: sh } = selectionRef.current;
    const { strokes, shapes } = state;
    if (si.size === 0 && sh.size === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    si.forEach((i) => {
      const s = strokes[i];
      if (!s) return;
      s.points.forEach((p) => {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      });
    });
    sh.forEach((i) => {
      const s = shapes[i];
      if (!s) return;
      minX = Math.min(minX, s.start.x, s.end.x); maxX = Math.max(maxX, s.start.x, s.end.x);
      minY = Math.min(minY, s.start.y, s.end.y); maxY = Math.max(maxY, s.start.y, s.end.y);
    });
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }, [state]);

  const finalizeLassoSelection = useCallback(() => {
    const { strokes, shapes } = state;
    const poly = lassoPoints;
    const selectedStrokes = new Set<number>();
    strokes.forEach((stroke, i) => {
      const cx = stroke.points.reduce((s, p) => s + p.x, 0) / stroke.points.length;
      const cy = stroke.points.reduce((s, p) => s + p.y, 0) / stroke.points.length;
      if (pointInPolygon({ x: cx, y: cy }, poly)) selectedStrokes.add(i);
    });
    const selectedShapes = new Set<number>();
    shapes.forEach((s, i) => {
      const cx = (s.start.x + s.end.x) / 2, cy = (s.start.y + s.end.y) / 2;
      if (pointInPolygon({ x: cx, y: cy }, poly)) selectedShapes.add(i);
    });
    setSelectedStrokeIndices(selectedStrokes);
    setSelectedShapeIndices(selectedShapes);
    setLassoPoints([]);
    isSelectingRef.current = false;
  }, [state, lassoPoints]);

  const finalizeBoxSelection = useCallback(() => {
    const { strokes, shapes } = state;
    const start = selectionBoxStartRef.current;
    const end = selectionBoxEndRef.current;
    if (start && end) {
      const r = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        w: Math.abs(end.x - start.x),
        h: Math.abs(end.y - start.y),
      };
      const selectedStrokes = new Set<number>();
      strokes.forEach((stroke, i) => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of stroke.points) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
        if (minX !== Infinity && rectsOverlap(r, { x: minX, y: minY, w: maxX - minX, h: maxY - minY }))
          selectedStrokes.add(i);
      });
      const selectedShapes = new Set<number>();
      shapes.forEach((s, i) => {
        const minX = Math.min(s.start.x, s.end.x), maxX = Math.max(s.start.x, s.end.x);
        const minY = Math.min(s.start.y, s.end.y), maxY = Math.max(s.start.y, s.end.y);
        if (rectsOverlap(r, { x: minX, y: minY, w: maxX - minX, h: maxY - minY }))
          selectedShapes.add(i);
      });
      setSelectedStrokeIndices(selectedStrokes);
      setSelectedShapeIndices(selectedShapes);
    }
    selectionBoxStartRef.current = null;
    selectionBoxEndRef.current = null;
    isSelectingRef.current = false;
  }, [state]);

  const deleteSelected = useCallback(() => {
    const { strokes: si, shapes: sh } = selectionRef.current;
    const { strokes, shapes } = state;
    if (si.size === 0 && sh.size === 0) return;
    const removedStrokes = strokes.filter((_, i) => si.has(i));
    const removedShapes = shapes.filter((_, i) => sh.has(i));
    history.deleteItems({ strokes: removedStrokes, shapes: removedShapes, textItems: [], imageItems: [], graphItems: [] });
    setSelectedStrokeIndices(new Set());
    setSelectedShapeIndices(new Set());
  }, [state, history]);

  const copySelection = useCallback(() => {
    const { strokes: si, shapes: sh } = selectionRef.current;
    const { strokes, shapes } = state;
    if (si.size === 0 && sh.size === 0) return;
    const strokesToCopy = strokes
      .filter((_, i) => si.has(i))
      .map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) }));
    const shapesToCopy = shapes
      .filter((_, i) => sh.has(i))
      .map((s) => ({ ...s, start: { ...s.start }, end: { ...s.end } }));
    clipboardRef.current = { strokes: strokesToCopy, shapes: shapesToCopy };
  }, [state]);

  const cutSelection = useCallback(() => {
    copySelection();
    deleteSelected();
  }, [copySelection, deleteSelected]);

  const pasteSelection = useCallback(
    (canvasSizeRef: React.RefObject<{ width: number; height: number }>) => {
      const clip = clipboardRef.current;
      if (!clip || (clip.strokes.length === 0 && clip.shapes.length === 0)) return;
      const size = canvasSizeRef.current;
      if (!size) return;
      const { width: W, height: H } = size;
      const allPoints: Point[] = [];
      clip.strokes.forEach((s) => s.points.forEach((p) => allPoints.push(p)));
      clip.shapes.forEach((s) => {
        allPoints.push(s.start);
        allPoints.push(s.end);
      });
      if (allPoints.length === 0) return;
      const centroid = {
        x: allPoints.reduce((a, p) => a + p.x, 0) / allPoints.length,
        y: allPoints.reduce((a, p) => a + p.y, 0) / allPoints.length,
      };
      const pasteCenter = {
        x: (W / 2 - pan.x) / scale,
        y: (H / 2 - pan.y) / scale,
      };
      const dx = pasteCenter.x - centroid.x;
      const dy = pasteCenter.y - centroid.y;
      const newStrokes: Stroke[] = clip.strokes.map((s) => ({
        ...s,
        id: history.nextId(),
        points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      }));
      const newShapes: ShapeItem[] = clip.shapes.map((s) => ({
        ...s,
        id: history.nextId(),
        start: { x: s.start.x + dx, y: s.start.y + dy },
        end: { x: s.end.x + dx, y: s.end.y + dy },
      }));
      const baseStroke = state.strokes.length;
      const baseShape = state.shapes.length;
      history.pasteSelection({ strokes: newStrokes, shapes: newShapes, textItems: [], imageItems: [], graphItems: [] });
      setSelectedStrokeIndices(
        new Set(Array.from({ length: newStrokes.length }, (_, i) => baseStroke + i)),
      );
      setSelectedShapeIndices(
        new Set(Array.from({ length: newShapes.length }, (_, i) => baseShape + i)),
      );
    },
    [pan.x, pan.y, scale, state.strokes.length, state.shapes.length, history],
  );

  const moveSelection = useCallback(
    (dx: number, dy: number, requestRedraw: () => void) => {
      const { strokes: si, shapes: sh } = selectionRef.current;
      // Ephemeral preview — does NOT push undo entry
      setStrokes((prev) =>
        prev.map((stroke, i) =>
          si.has(i)
            ? { ...stroke, points: stroke.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
            : stroke,
        ),
      );
      setShapes((prev) =>
        prev.map((shape, i) =>
          sh.has(i)
            ? {
                ...shape,
                start: { x: shape.start.x + dx, y: shape.start.y + dy },
                end: { x: shape.end.x + dx, y: shape.end.y + dy },
              }
            : shape,
        ),
      );
      requestRedraw();
    },
    [setStrokes, setShapes],
  );

  return {
    selectedStrokeIndices,
    setSelectedStrokeIndices,
    selectedShapeIndices,
    setSelectedShapeIndices,
    lassoPoints,
    setLassoPoints,
    selectionBoxStartRef,
    selectionBoxEndRef,
    isSelectingRef,
    selectionRef,
    isMovingSelectionRef,
    moveSelectionStartRef,
    clear,
    getSelectionBounds,
    finalizeLassoSelection,
    finalizeBoxSelection,
    deleteSelected,
    copySelection,
    cutSelection,
    pasteSelection,
    moveSelection,
  };
}

export type Selection = ReturnType<typeof useSelection>;
