import { useState, useRef, useCallback, useEffect } from "react";
import type { TextItem } from "../types";
import type { WhiteboardContent } from "./useWhiteboardContent";
import type { ViewTransform } from "./useViewTransform";
import type { useWhiteboardHistory } from "./useWhiteboardHistory";
import type { RedrawSignal } from "./useRedrawSignal";

type History = ReturnType<typeof useWhiteboardHistory>;

interface TextLayerArgs {
  content: WhiteboardContent;
  view: ViewTransform;
  history: History;
  redraw: RedrawSignal;
  penColor: string;
}

export function useTextLayer({ content, view, history, redraw, penColor }: TextLayerArgs) {
  const { __unsafeSetters } = content;
  const { setTextItems } = __unsafeSetters;
  const { scale, pan } = view;
  const { requestRedraw } = redraw;

  // Text edit overlay: { x, y } in world coords; id + initialText when editing existing
  const [textEditState, setTextEditState] = useState<{
    x: number;
    y: number;
    id?: string;
    initialText?: string;
  } | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Hover / drag state
  const [hoveredTextId, setHoveredTextId] = useState<string | null>(null);
  const [hoveredInDragZone, setHoveredInDragZone] = useState(false);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const dragStartRef = useRef<{
    pageX: number;
    pageY: number;
    itemX: number;
    itemY: number;
  } | null>(null);
  // Baseline captured at drag start for undo entry (fix undo gap)
  const dragBaselineRef = useRef<{ x: number; y: number } | null>(null);

  const textItemWrapperRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const textItemInnerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Focus textarea when text overlay opens
  useEffect(() => {
    if (textEditState !== null) {
      const id = requestAnimationFrame(() => {
        textAreaRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [textEditState]);

  // Global cursor while dragging
  useEffect(() => {
    if (!draggingTextId) return;
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = "";
    };
  }, [draggingTextId]);

  const commitTextOverlay = useCallback(() => {
    const value = textAreaRef.current?.value?.trim() ?? "";
    if (!textEditState) {
      setTextEditState(null);
      return;
    }
    if (textEditState.id) {
      if (value) {
        setTextItems((prev) =>
          prev.map((t) =>
            t.id === textEditState.id ? { ...t, text: value } : t,
          ),
        );
      } else {
        setTextItems((prev) => prev.filter((t) => t.id !== textEditState.id));
      }
    } else if (value) {
      const baselineOffset = 14;
      const newText: TextItem = {
        id: Date.now().toString(),
        x: textEditState.x,
        y: textEditState.y + baselineOffset,
        text: value,
        color: penColor,
        fontSize: 16,
      };
      history.addText(newText);
    }
    setTextEditState(null);
  }, [textEditState, penColor, history, setTextItems]);

  /** Hit test: is (clientX, clientY) in the 8px perimeter of a text item? */
  const getTextHit = useCallback(
    (
      clientX: number,
      clientY: number,
    ): { id: string; inDragZone: boolean } | null => {
      const textItems = content.state.textItems;
      for (const t of textItems) {
        const wrapper = textItemWrapperRefs.current.get(t.id);
        const inner = textItemInnerRefs.current.get(t.id);
        if (!wrapper || !inner) continue;
        const wr = wrapper.getBoundingClientRect();
        const ir = inner.getBoundingClientRect();
        const inWrapper =
          clientX >= wr.left &&
          clientX <= wr.right &&
          clientY >= wr.top &&
          clientY <= wr.bottom;
        const inInner =
          clientX >= ir.left &&
          clientX <= ir.right &&
          clientY >= ir.top &&
          clientY <= ir.bottom;
        if (inWrapper) return { id: t.id, inDragZone: inWrapper && !inInner };
      }
      return null;
    },
    [content.state.textItems],
  );

  // Global drag: ephemeral preview mutations on move, commit undo entry on up
  useEffect(() => {
    if (!draggingTextId || !dragStartRef.current) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = (e.clientX - dragStartRef.current.pageX) / scale;
      const dy = (e.clientY - dragStartRef.current.pageY) / scale;
      // Ephemeral preview — does NOT push undo entry (Guardrail 2)
      setTextItems((prev) =>
        prev.map((t) =>
          t.id === draggingTextId
            ? {
                ...t,
                x: dragStartRef.current!.itemX + dx,
                y: dragStartRef.current!.itemY + dy,
              }
            : t,
        ),
      );
    };
    const onUp = (e: MouseEvent) => {
      // Commit undo entry: from = baseline captured at drag start, to = final position
      if (dragBaselineRef.current && dragStartRef.current) {
        const dx = (e.clientX - dragStartRef.current.pageX) / scale;
        const dy = (e.clientY - dragStartRef.current.pageY) / scale;
        const to = {
          x: dragStartRef.current.itemX + dx,
          y: dragStartRef.current.itemY + dy,
        };
        history.commitMoveText(draggingTextId, dragBaselineRef.current, to);
      }
      setDraggingTextId(null);
      dragStartRef.current = null;
      dragBaselineRef.current = null;
      setHoveredTextId(null);
      setHoveredInDragZone(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingTextId, scale, history, setTextItems]);

  const startTextDrag = useCallback(
    (id: string, e: React.MouseEvent, item: TextItem) => {
      e.preventDefault();
      e.stopPropagation();
      // Capture baseline before any preview mutations
      dragBaselineRef.current = { x: item.x, y: item.y };
      setDraggingTextId(id);
      dragStartRef.current = {
        pageX: e.clientX,
        pageY: e.clientY,
        itemX: item.x,
        itemY: item.y,
      };
      setHoveredTextId(id);
      setHoveredInDragZone(true);
    },
    [],
  );

  return {
    textEditState,
    setTextEditState,
    textAreaRef,
    hoveredTextId,
    setHoveredTextId,
    hoveredInDragZone,
    setHoveredInDragZone,
    draggingTextId,
    textItemWrapperRefs,
    textItemInnerRefs,
    commitTextOverlay,
    getTextHit,
    startTextDrag,
  };
}
