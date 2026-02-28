import { useState, useRef, useCallback, useEffect } from "react";
import type { GraphItem } from "../types";
import type { WhiteboardContent } from "./useWhiteboardContent";
import type { ViewTransform } from "./useViewTransform";
import type { useWhiteboardHistory } from "./useWhiteboardHistory";
import type { RedrawSignal } from "./useRedrawSignal";

type History = ReturnType<typeof useWhiteboardHistory>;

interface GraphLayerArgs {
  content: WhiteboardContent;
  view: ViewTransform;
  history: History;
  redraw: RedrawSignal;
}

export function useGraphLayer({ content, view, history, redraw }: GraphLayerArgs) {
  const { __unsafeSetters } = content;
  const { setGraphItems } = __unsafeSetters;
  const { scale } = view;
  const { requestRedraw } = redraw;

  const [draggingGraphId, setDraggingGraphId] = useState<string | null>(null);
  const [resizingGraphId, setResizingGraphId] = useState<string | null>(null);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);

  const graphDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    itemX: number;
    itemY: number;
  } | null>(null);
  const graphDragBaselineRef = useRef<{ x: number; y: number } | null>(null);

  const graphResizeStartRef = useRef<{
    clientX: number;
    clientY: number;
    itemX: number;
    itemY: number;
    itemW: number;
    itemH: number;
  } | null>(null);
  const resizeBaselineRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Global cursor while dragging / resizing
  useEffect(() => {
    if (draggingGraphId) {
      document.body.style.cursor = "grabbing";
      return () => {
        document.body.style.cursor = "";
      };
    }
  }, [draggingGraphId]);

  useEffect(() => {
    if (resizingGraphId) {
      document.body.style.cursor = "nwse-resize";
      return () => {
        document.body.style.cursor = "";
      };
    }
  }, [resizingGraphId]);

  // Global graph drag: ephemeral preview on move, commit undo entry on up
  useEffect(() => {
    if (!draggingGraphId || !graphDragStartRef.current) return;
    const onMove = (e: MouseEvent) => {
      const start = graphDragStartRef.current;
      if (!start) return;
      const dx = (e.clientX - start.clientX) / scale;
      const dy = (e.clientY - start.clientY) / scale;
      const newX = start.itemX + dx;
      const newY = start.itemY + dy;
      setGraphItems((prev) =>
        prev.map((g) =>
          g.id === draggingGraphId ? { ...g, x: newX, y: newY } : g,
        ),
      );
      requestRedraw();
    };
    const onUp = (e: MouseEvent) => {
      if (graphDragBaselineRef.current && graphDragStartRef.current) {
        const dx = (e.clientX - graphDragStartRef.current.clientX) / scale;
        const dy = (e.clientY - graphDragStartRef.current.clientY) / scale;
        const to = {
          x: graphDragStartRef.current.itemX + dx,
          y: graphDragStartRef.current.itemY + dy,
        };
        history.commitMoveGraph(draggingGraphId, graphDragBaselineRef.current, to);
      }
      setDraggingGraphId(null);
      graphDragStartRef.current = null;
      graphDragBaselineRef.current = null;
      requestRedraw();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingGraphId, scale, history, setGraphItems, requestRedraw]);

  // Global graph resize: free-form resize
  useEffect(() => {
    if (!resizingGraphId || !graphResizeStartRef.current) return;
    const onMove = (e: MouseEvent) => {
      const start = graphResizeStartRef.current;
      if (!start) return;
      const dw = (e.clientX - start.clientX) / scale;
      const dh = (e.clientY - start.clientY) / scale;
      const newW = Math.max(40, start.itemW + dw);
      const newH = Math.max(40, start.itemH + dh);
      setGraphItems((prev) =>
        prev.map((g) =>
          g.id === resizingGraphId
            ? { ...g, x: start.itemX, y: start.itemY, width: newW, height: newH }
            : g,
        ),
      );
      requestRedraw();
    };
    const onUp = (e: MouseEvent) => {
      if (resizeBaselineRef.current && graphResizeStartRef.current) {
        const start = graphResizeStartRef.current;
        const dw = (e.clientX - start.clientX) / scale;
        const dh = (e.clientY - start.clientY) / scale;
        const newW = Math.max(40, start.itemW + dw);
        const newH = Math.max(40, start.itemH + dh);
        history.commitResizeGraph(resizingGraphId, resizeBaselineRef.current, {
          x: start.itemX,
          y: start.itemY,
          width: newW,
          height: newH,
        });
      }
      setResizingGraphId(null);
      graphResizeStartRef.current = null;
      resizeBaselineRef.current = null;
      requestRedraw();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingGraphId, scale, history, setGraphItems, requestRedraw]);

  const startGraphDrag = useCallback(
    (graph: GraphItem, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedGraphId(graph.id);
      graphDragBaselineRef.current = { x: graph.x, y: graph.y };
      setDraggingGraphId(graph.id);
      graphDragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        itemX: graph.x,
        itemY: graph.y,
      };
    },
    [],
  );

  const startGraphResize = useCallback(
    (graph: GraphItem, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setResizingGraphId(graph.id);
      setDraggingGraphId(null);
      graphDragStartRef.current = null;
      graphDragBaselineRef.current = null;
      resizeBaselineRef.current = {
        x: graph.x,
        y: graph.y,
        width: graph.width,
        height: graph.height,
      };
      graphResizeStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        itemX: graph.x,
        itemY: graph.y,
        itemW: graph.width,
        itemH: graph.height,
      };
    },
    [],
  );

  return {
    draggingGraphId,
    resizingGraphId,
    selectedGraphId,
    setSelectedGraphId,
    startGraphDrag,
    startGraphResize,
  };
}
