import { useState, useRef, useCallback } from "react";
import type {
  Stroke,
  ShapeItem,
  TextItem,
  ImageItem,
  GraphItem,
  HistoryEntry,
} from "../types";

// ── Extended HistoryEntry with move/resize ops ───────────────────────────────
// (defined here before applyUndo/applyRedo since both helpers use this type)

type MoveTextEntry = { kind: "moveText"; id: string; from: { x: number; y: number }; to: { x: number; y: number } };
type MoveImageEntry = { kind: "moveImage"; id: string; from: { x: number; y: number }; to: { x: number; y: number } };
type MoveGraphEntry = { kind: "moveGraph"; id: string; from: { x: number; y: number }; to: { x: number; y: number } };
type ResizeImageEntry = {
  kind: "resizeImage";
  id: string;
  oldBounds: { x: number; y: number; width: number; height: number };
  newBounds: { x: number; y: number; width: number; height: number };
};
type ResizeGraphEntry = {
  kind: "resizeGraph";
  id: string;
  oldBounds: { x: number; y: number; width: number; height: number };
  newBounds: { x: number; y: number; width: number; height: number };
};
type EditTextEntry = {
  kind: "editText";
  id: string;
  prevText: string;
  nextText: string;
  prevLatex?: string;
  nextLatex?: string;
};
type EditGraphEntry = {
  kind: "editGraph";
  id: string;
  prevState: unknown | null;
  nextState: unknown | null;
  prevThumbnail: string;
  nextThumbnail: string;
};

type ExtendedHistoryEntry =
  | HistoryEntry
  | MoveTextEntry
  | MoveImageEntry
  | MoveGraphEntry
  | ResizeImageEntry
  | ResizeGraphEntry
  | EditTextEntry
  | EditGraphEntry;

// ── Internal apply helpers ───────────────────────────────────────────────────

function applyUndo(
  entry: ExtendedHistoryEntry,
  setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>,
  setShapes: React.Dispatch<React.SetStateAction<ShapeItem[]>>,
  setTextItems: React.Dispatch<React.SetStateAction<TextItem[]>>,
  setImageItems: React.Dispatch<React.SetStateAction<ImageItem[]>>,
  setGraphItems: React.Dispatch<React.SetStateAction<GraphItem[]>>,
  imageCacheRef: React.RefObject<Map<string, HTMLImageElement>>,
  graphCacheRef: React.RefObject<Map<string, HTMLImageElement>>,
  requestRedraw: () => void,
) {
  switch (entry.kind) {
    case "stroke":
      setStrokes((prev) => prev.filter((s) => s.id !== entry.item.id));
      break;
    case "shape":
      setShapes((prev) => prev.filter((s) => s.id !== entry.item.id));
      break;
    case "text":
      setTextItems((prev) => prev.filter((t) => t.id !== entry.item.id));
      break;
    case "image":
      setImageItems((prev) => prev.filter((i) => i.id !== entry.item.id));
      break;
    case "graph":
      setGraphItems((prev) => prev.filter((g) => g.id !== entry.item.id));
      break;
    case "moveText": {
      const { id, from } = entry;
      setTextItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, x: from.x, y: from.y } : t)),
      );
      break;
    }
    case "moveImage": {
      const { id, from } = entry;
      setImageItems((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, x: from.x, y: from.y } : img,
        ),
      );
      break;
    }
    case "moveGraph": {
      const { id, from } = entry;
      setGraphItems((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, x: from.x, y: from.y } : g,
        ),
      );
      break;
    }
    case "resizeImage": {
      const { id, oldBounds } = entry;
      setImageItems((prev) =>
        prev.map((img) =>
          img.id === id
            ? {
                ...img,
                x: oldBounds.x,
                y: oldBounds.y,
                width: oldBounds.width,
                height: oldBounds.height,
              }
            : img,
        ),
      );
      break;
    }
    case "resizeGraph": {
      const { id, oldBounds } = entry;
      setGraphItems((prev) =>
        prev.map((g) =>
          g.id === id
            ? {
                ...g,
                x: oldBounds.x,
                y: oldBounds.y,
                width: oldBounds.width,
                height: oldBounds.height,
              }
            : g,
        ),
      );
      break;
    }
    case "editText": {
      const { id, prevText, prevLatex } = entry;
      setTextItems((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                text: prevText,
                latex: prevLatex,
              }
            : t,
        ),
      );
      break;
    }
    case "editGraph": {
      const { id, prevState, prevThumbnail } = entry;
      setGraphItems((prev) =>
        prev.map((g) =>
          g.id === id
            ? {
                ...g,
                state: prevState,
                thumbnailDataUrl: prevThumbnail,
              }
            : g,
        ),
      );
      if (graphCacheRef.current) {
        const img = new Image();
        img.onload = () => requestRedraw();
        img.src = prevThumbnail;
        graphCacheRef.current.set(id, img);
      }
      break;
    }
    case "paste": {
      const sIds = new Set(entry.strokes.map((s) => s.id));
      const shIds = new Set(entry.shapes.map((s) => s.id));
      const tIds = new Set(entry.textItems.map((t) => t.id));
      const iIds = new Set(entry.imageItems.map((i) => i.id));
      const gIds = new Set(entry.graphItems.map((g) => g.id));
      setStrokes((prev) => prev.filter((s) => !sIds.has(s.id)));
      setShapes((prev) => prev.filter((s) => !shIds.has(s.id)));
      setTextItems((prev) => prev.filter((t) => !tIds.has(t.id)));
      setImageItems((prev) => prev.filter((i) => !iIds.has(i.id)));
      setGraphItems((prev) => prev.filter((g) => !gIds.has(g.id)));
      break;
    }
    case "delete": {
      if (entry.strokes.length) setStrokes((prev) => [...prev, ...entry.strokes]);
      if (entry.shapes.length) setShapes((prev) => [...prev, ...entry.shapes]);
      if (entry.textItems.length) setTextItems((prev) => [...prev, ...entry.textItems]);
      if (entry.imageItems.length) {
        setImageItems((prev) => [...prev, ...entry.imageItems]);
        entry.imageItems.forEach((item) => {
          if (!imageCacheRef.current?.has(item.id)) {
            const img = new Image();
            img.onload = () => requestRedraw();
            img.src = item.dataUrl;
            imageCacheRef.current?.set(item.id, img);
          }
        });
      }
      if (entry.graphItems.length) {
        setGraphItems((prev) => [...prev, ...entry.graphItems]);
        entry.graphItems.forEach((item) => {
          if (!graphCacheRef.current?.has(item.id)) {
            const img = new Image();
            img.onload = () => requestRedraw();
            img.src = item.thumbnailDataUrl;
            graphCacheRef.current?.set(item.id, img);
          }
        });
      }
      break;
    }
  }
}

function applyRedo(
  entry: ExtendedHistoryEntry,
  setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>,
  setShapes: React.Dispatch<React.SetStateAction<ShapeItem[]>>,
  setTextItems: React.Dispatch<React.SetStateAction<TextItem[]>>,
  setImageItems: React.Dispatch<React.SetStateAction<ImageItem[]>>,
  setGraphItems: React.Dispatch<React.SetStateAction<GraphItem[]>>,
  imageCacheRef: React.RefObject<Map<string, HTMLImageElement>>,
  graphCacheRef: React.RefObject<Map<string, HTMLImageElement>>,
  requestRedraw: () => void,
) {
  switch (entry.kind) {
    case "stroke":
      setStrokes((prev) => [...prev, entry.item]);
      break;
    case "shape":
      setShapes((prev) => [...prev, entry.item]);
      break;
    case "text":
      setTextItems((prev) => [...prev, entry.item]);
      break;
    case "image":
      setImageItems((prev) => [...prev, entry.item]);
      if (!imageCacheRef.current?.has(entry.item.id)) {
        const img = new Image();
        img.onload = () => requestRedraw();
        img.src = entry.item.dataUrl;
        imageCacheRef.current?.set(entry.item.id, img);
      }
      break;
    case "graph":
      setGraphItems((prev) => [...prev, entry.item]);
      if (!graphCacheRef.current?.has(entry.item.id)) {
        const img = new Image();
        img.onload = () => requestRedraw();
        img.src = entry.item.thumbnailDataUrl;
        graphCacheRef.current?.set(entry.item.id, img);
      }
      break;
    case "moveText": {
      const { id, to } = entry;
      setTextItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, x: to.x, y: to.y } : t)),
      );
      break;
    }
    case "moveImage": {
      const { id, to } = entry;
      setImageItems((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, x: to.x, y: to.y } : img,
        ),
      );
      break;
    }
    case "moveGraph": {
      const { id, to } = entry;
      setGraphItems((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, x: to.x, y: to.y } : g,
        ),
      );
      break;
    }
    case "resizeImage": {
      const { id, newBounds } = entry;
      setImageItems((prev) =>
        prev.map((img) =>
          img.id === id
            ? {
                ...img,
                x: newBounds.x,
                y: newBounds.y,
                width: newBounds.width,
                height: newBounds.height,
              }
            : img,
        ),
      );
      break;
    }
    case "resizeGraph": {
      const { id, newBounds } = entry;
      setGraphItems((prev) =>
        prev.map((g) =>
          g.id === id
            ? {
                ...g,
                x: newBounds.x,
                y: newBounds.y,
                width: newBounds.width,
                height: newBounds.height,
              }
            : g,
        ),
      );
      break;
    }
    case "editText": {
      const { id, nextText, nextLatex } = entry;
      setTextItems((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                text: nextText,
                latex: nextLatex,
              }
            : t,
        ),
      );
      break;
    }
    case "editGraph": {
      const { id, nextState, nextThumbnail } = entry;
      setGraphItems((prev) =>
        prev.map((g) =>
          g.id === id
            ? {
                ...g,
                state: nextState,
                thumbnailDataUrl: nextThumbnail,
              }
            : g,
        ),
      );
      if (graphCacheRef.current) {
        const img = new Image();
        img.onload = () => requestRedraw();
        img.src = nextThumbnail;
        graphCacheRef.current.set(id, img);
      }
      break;
    }
    case "paste":
      setStrokes((prev) => [...prev, ...entry.strokes]);
      setShapes((prev) => [...prev, ...entry.shapes]);
      setTextItems((prev) => [...prev, ...entry.textItems]);
      if (entry.imageItems.length) {
        setImageItems((prev) => [...prev, ...entry.imageItems]);
        entry.imageItems.forEach((item) => {
          if (!imageCacheRef.current?.has(item.id)) {
            const img = new Image();
            img.onload = () => requestRedraw();
            img.src = item.dataUrl;
            imageCacheRef.current?.set(item.id, img);
          }
        });
      }
      if (entry.graphItems.length) {
        setGraphItems((prev) => [...prev, ...entry.graphItems]);
        entry.graphItems.forEach((item) => {
          if (!graphCacheRef.current?.has(item.id)) {
            const img = new Image();
            img.onload = () => requestRedraw();
            img.src = item.thumbnailDataUrl;
            graphCacheRef.current?.set(item.id, img);
          }
        });
      }
      break;
    case "delete": {
      const sIds = new Set(entry.strokes.map((s) => s.id));
      const shIds = new Set(entry.shapes.map((s) => s.id));
      const tIds = new Set(entry.textItems.map((t) => t.id));
      const iIds = new Set(entry.imageItems.map((i) => i.id));
      const gIds = new Set(entry.graphItems.map((g) => g.id));
      if (entry.strokes.length) setStrokes((prev) => prev.filter((s) => !sIds.has(s.id)));
      if (entry.shapes.length) setShapes((prev) => prev.filter((s) => !shIds.has(s.id)));
      if (entry.textItems.length) setTextItems((prev) => prev.filter((t) => !tIds.has(t.id)));
      if (entry.imageItems.length) setImageItems((prev) => prev.filter((i) => !iIds.has(i.id)));
      if (entry.graphItems.length) setGraphItems((prev) => prev.filter((g) => !gIds.has(g.id)));
      break;
    }
  }
}

// ── Hook types ───────────────────────────────────────────────────────────────

export interface WhiteboardContentSetters {
  __unsafeSetters: {
    setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>;
    setShapes: React.Dispatch<React.SetStateAction<ShapeItem[]>>;
    setTextItems: React.Dispatch<React.SetStateAction<TextItem[]>>;
    setImageItems: React.Dispatch<React.SetStateAction<ImageItem[]>>;
    setGraphItems: React.Dispatch<React.SetStateAction<GraphItem[]>>;
  };
  getState: () => { strokes: Stroke[]; shapes: ShapeItem[]; textItems: TextItem[]; imageItems: ImageItem[]; graphItems: GraphItem[] };
  replaceAll: (data: { strokes: Stroke[]; shapes: ShapeItem[]; textItems: TextItem[]; imageItems: ImageItem[]; graphItems: GraphItem[] }) => void;
  imageCacheRef: React.RefObject<Map<string, HTMLImageElement>>;
  graphCacheRef: React.RefObject<Map<string, HTMLImageElement>>;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useWhiteboardHistory(
  content: WhiteboardContentSetters,
  requestRedraw: () => void,
) {
  const { __unsafeSetters, imageCacheRef, replaceAll } = content;
  const { setStrokes, setShapes, setTextItems, setImageItems, setGraphItems } = __unsafeSetters;
  const { graphCacheRef } = content;

  const [history, setHistory] = useState<ExtendedHistoryEntry[]>([]);
  const [future, setFuture] = useState<ExtendedHistoryEntry[]>([]);
  const historyRef = useRef<ExtendedHistoryEntry[]>([]);
  const futureRef = useRef<ExtendedHistoryEntry[]>([]);
  historyRef.current = history;
  futureRef.current = future;

  const nextId = useCallback(() => crypto.randomUUID(), []);

  const _push = useCallback((entry: ExtendedHistoryEntry) => {
    setHistory((prev) => [...prev, entry]);
    setFuture([]);
  }, []);

  // ── Domain operations ────────────────────────────────────────────────────

  const addStroke = useCallback(
    (stroke: Stroke) => {
      setStrokes((prev) => [...prev, stroke]);
      _push({ kind: "stroke", item: stroke });
    },
    [setStrokes, _push],
  );

  const addShape = useCallback(
    (shape: ShapeItem) => {
      setShapes((prev) => [...prev, shape]);
      _push({ kind: "shape", item: shape });
    },
    [setShapes, _push],
  );

  const addText = useCallback(
    (item: TextItem) => {
      setTextItems((prev) => [...prev, item]);
      _push({ kind: "text", item });
    },
    [setTextItems, _push],
  );

  const addImage = useCallback(
    (item: ImageItem) => {
      setImageItems((prev) => [...prev, item]);
      _push({ kind: "image", item });
    },
    [setImageItems, _push],
  );

  const addGraph = useCallback(
    (item: GraphItem) => {
      setGraphItems((prev) => [...prev, item]);
      _push({ kind: "graph", item });
    },
    [setGraphItems, _push],
  );

  const deleteItems = useCallback(
    (payload: {
      strokes: Stroke[];
      shapes: ShapeItem[];
      textItems: TextItem[];
      imageItems: ImageItem[];
      graphItems: GraphItem[];
    }) => {
      const sIds = new Set(payload.strokes.map((s) => s.id));
      const shIds = new Set(payload.shapes.map((s) => s.id));
      const tIds = new Set(payload.textItems.map((t) => t.id));
      const iIds = new Set(payload.imageItems.map((i) => i.id));
      const gIds = new Set(payload.graphItems.map((g) => g.id));
      if (sIds.size) setStrokes((prev) => prev.filter((s) => !sIds.has(s.id)));
      if (shIds.size) setShapes((prev) => prev.filter((s) => !shIds.has(s.id)));
      if (tIds.size) setTextItems((prev) => prev.filter((t) => !tIds.has(t.id)));
      if (iIds.size) setImageItems((prev) => prev.filter((i) => !iIds.has(i.id)));
      if (gIds.size) setGraphItems((prev) => prev.filter((g) => !gIds.has(g.id)));
      _push({
        kind: "delete",
        strokes: payload.strokes,
        shapes: payload.shapes,
        textItems: payload.textItems,
        imageItems: payload.imageItems,
        graphItems: payload.graphItems,
      });
    },
    [setStrokes, setShapes, setTextItems, setImageItems, setGraphItems, _push],
  );

  const pasteSelection = useCallback(
    (payload: {
      strokes: Stroke[];
      shapes: ShapeItem[];
      textItems?: TextItem[];
      imageItems?: ImageItem[];
      graphItems?: GraphItem[];
    }) => {
      const textItems = payload.textItems ?? [];
      const imageItems = payload.imageItems ?? [];
      const graphItems = payload.graphItems ?? [];
      setStrokes((prev) => [...prev, ...payload.strokes]);
      setShapes((prev) => [...prev, ...payload.shapes]);
      setTextItems((prev) => [...prev, ...textItems]);
      setImageItems((prev) => [...prev, ...imageItems]);
      setGraphItems((prev) => [...prev, ...graphItems]);
      _push({
        kind: "paste",
        strokes: payload.strokes,
        shapes: payload.shapes,
        textItems,
        imageItems,
        graphItems,
      });
    },
    [setStrokes, setShapes, setTextItems, setImageItems, setGraphItems, _push],
  );

  const commitMoveText = useCallback(
    (id: string, from: { x: number; y: number }, to: { x: number; y: number }) => {
      _push({ kind: "moveText", id, from, to });
    },
    [_push],
  );

  const editText = useCallback(
    (
      id: string,
      prevText: string,
      nextText: string,
      prevLatex?: string,
      nextLatex?: string,
    ) => {
      setTextItems((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                text: nextText,
                latex: nextLatex,
              }
            : t,
        ),
      );
      _push({ kind: "editText", id, prevText, nextText, prevLatex, nextLatex });
    },
    [setTextItems, _push],
  );

  const commitMoveImage = useCallback(
    (id: string, from: { x: number; y: number }, to: { x: number; y: number }) => {
      _push({ kind: "moveImage", id, from, to });
    },
    [_push],
  );

  const commitResizeImage = useCallback(
    (
      id: string,
      oldBounds: { x: number; y: number; width: number; height: number },
      newBounds: { x: number; y: number; width: number; height: number },
    ) => {
      _push({ kind: "resizeImage", id, oldBounds, newBounds });
    },
    [_push],
  );

  const commitMoveGraph = useCallback(
    (id: string, from: { x: number; y: number }, to: { x: number; y: number }) => {
      _push({ kind: "moveGraph", id, from, to });
    },
    [_push],
  );

  const commitResizeGraph = useCallback(
    (
      id: string,
      oldBounds: { x: number; y: number; width: number; height: number },
      newBounds: { x: number; y: number; width: number; height: number },
    ) => {
      _push({ kind: "resizeGraph", id, oldBounds, newBounds });
    },
    [_push],
  );

  const updateGraphState = useCallback(
    (
      id: string,
      nextState: unknown | null,
      nextThumbnail: string,
      prevState: unknown | null,
      prevThumbnail: string,
    ) => {
      setGraphItems((prev) =>
        prev.map((g) =>
          g.id === id
            ? {
                ...g,
                state: nextState,
                thumbnailDataUrl: nextThumbnail,
              }
            : g,
        ),
      );
      if (graphCacheRef.current) {
        const img = new Image();
        img.onload = () => requestRedraw();
        img.src = nextThumbnail;
        graphCacheRef.current.set(id, img);
      }
      _push({ kind: "editGraph", id, prevState, nextState, prevThumbnail, nextThumbnail });
    },
    [setGraphItems, graphCacheRef, requestRedraw, _push],
  );

  const clearAll = useCallback(() => {
    replaceAll({ strokes: [], shapes: [], textItems: [], imageItems: [], graphItems: [] });
    setHistory([]);
    setFuture([]);
  }, [replaceAll]);

  const resetWithSnapshot = useCallback(() => {
    setHistory([]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1]!;
      applyUndo(
        entry,
        setStrokes,
        setShapes,
        setTextItems,
        setImageItems,
        setGraphItems,
        imageCacheRef,
        graphCacheRef,
        requestRedraw,
      );
      setFuture((f) => [...f, entry]);
      return prev.slice(0, -1);
    });
  }, [setStrokes, setShapes, setTextItems, setImageItems, imageCacheRef, requestRedraw]);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1]!;
      applyRedo(
        entry,
        setStrokes,
        setShapes,
        setTextItems,
        setImageItems,
        setGraphItems,
        imageCacheRef,
        graphCacheRef,
        requestRedraw,
      );
      setHistory((h) => [...h, entry]);
      return prev.slice(0, -1);
    });
  }, [setStrokes, setShapes, setTextItems, setImageItems, imageCacheRef, requestRedraw]);

  return {
    nextId,
    addStroke,
    addShape,
    addText,
    addImage,
    addGraph,
    editText,
    updateGraphState,
    deleteItems,
    pasteSelection,
    commitMoveText,
    commitMoveImage,
    commitResizeImage,
    commitMoveGraph,
    commitResizeGraph,
    clearAll,
    resetWithSnapshot,
    undo,
    redo,
  };
}
