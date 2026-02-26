import { useState, useRef, useCallback, useEffect } from "react";
import type { MathfieldElement } from "mathlive";
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
    initialLatex?: string;
  } | null>(null);
  const mathFieldRef = useRef<MathfieldElement>(null);
  const [textEditValue, setTextEditValue] = useState<{ latex: string; text: string }>({
    latex: "",
    text: "",
  });

  // Hover / drag state
  const [hoveredTextId, setHoveredTextId] = useState<string | null>(null);
  const [hoveredInDragZone, setHoveredInDragZone] = useState(false);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
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
        const field = mathFieldRef.current;
        if (!field) return;
        if (typeof field.focus === "function") {
          try {
            // Avoid recentering/scroll jumps when focusing a new text box.
            field.focus({ preventScroll: true } as FocusOptions);
          } catch {
            field.focus();
          }
        }
      });
      return () => cancelAnimationFrame(id);
    }
  }, [textEditState]);

  useEffect(() => {
    if (!textEditState) {
      setTextEditValue({ latex: "", text: "" });
      return;
    }
    setTextEditValue({
      latex: textEditState.initialLatex ?? textEditState.initialText ?? "",
      text: textEditState.initialText ?? "",
    });
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
    const latexValue = textEditValue.latex.trim();
    const plainValue = textEditValue.text.trim();
    if (!textEditState) {
      setTextEditState(null);
      return;
    }
    if (textEditState.id) {
      const prevText = textEditState.initialText ?? "";
      const prevLatex = textEditState.initialLatex;
      if (plainValue || latexValue) {
        if (plainValue !== prevText || latexValue !== prevLatex) {
          history.editText(
            textEditState.id,
            prevText,
            plainValue,
            prevLatex,
            latexValue,
          );
        }
      } else {
        const item = content.state.textItems.find((t) => t.id === textEditState.id);
        if (item) {
          history.deleteItems({ strokes: [], shapes: [], textItems: [item], imageItems: [] });
        }
      }
    } else if (plainValue || latexValue) {
      const baselineOffset = 14;
      const newText: TextItem = {
        id: crypto.randomUUID(),
        x: textEditState.x,
        y: textEditState.y + baselineOffset,
        text: plainValue || latexValue,
        latex: latexValue || undefined,
        color: penColor,
        fontSize: 16,
      };
      history.addText(newText);
    }
    setTextEditState(null);
  }, [textEditState, textEditValue, penColor, history, content.state.textItems]);

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
      const dx = (e.clientX - dragStartRef.current.clientX) / scale;
      const dy = (e.clientY - dragStartRef.current.clientY) / scale;
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
        const dx = (e.clientX - dragStartRef.current.clientX) / scale;
        const dy = (e.clientY - dragStartRef.current.clientY) / scale;
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
        clientX: e.clientX,
        clientY: e.clientY,
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
    mathFieldRef,
    textEditValue,
    setTextEditValue,
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
