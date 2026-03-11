import { useCallback, useEffect, useRef } from "react";
import type { Point, Tool } from "../types";
import { GRID_STEP, GRID_COLOR_VAR } from "../constants";
import type { WhiteboardContent } from "./useWhiteboardContent";
import type { RedrawSignal } from "./useRedrawSignal";
import type { ViewTransform } from "./useViewTransform";
import { getCssVar, resolveCssColor } from "@/lib/theme";
import { useTheme } from "@/hooks/useTheme";

interface CanvasDrawingArgs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  content: WhiteboardContent;
  view: ViewTransform;
  redraw: RedrawSignal;
  canvasSizeRef: React.RefObject<{ width: number; height: number }>;
  isLoadingSession: boolean;
  isLoadingSnapshot: boolean;
  // Current tool / pen state for in-progress stroke rendering
  tool: Tool;
  penColor: string;
  penWidth: number;
  currentStrokeRef: React.RefObject<Point[]>;
  // Selection state (indices) for highlight rendering
  selectedStrokeIndices: Set<number>;
  selectedShapeIndices: Set<number>;
  // Lasso / selection box overlays
  lassoPoints: Point[];
  selectionBoxStartRef: React.RefObject<Point | null>;
  selectionBoxEndRef: React.RefObject<Point | null>;
  // Preview shape (during shape drag)
  previewShape: (Omit<import("../types").ShapeItem, "id"> & { type: import("../types").Tool }) | null;
  showGrid: boolean;
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  s: {
    type: string;
    start: Point;
    end: Point;
    color: string;
    width: number;
  },
  overrideColor?: string,
  overrideWidth?: number,
) {
  ctx.strokeStyle = overrideColor ?? s.color;
  ctx.lineWidth = overrideWidth ?? s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const x0 = s.start.x, y0 = s.start.y, x1 = s.end.x, y1 = s.end.y;
  if (s.type === "line" || s.type === "arrow") {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (s.type === "arrow") {
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const len = 12;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - len * Math.cos(angle - 0.4), y1 - len * Math.sin(angle - 0.4));
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - len * Math.cos(angle + 0.4), y1 - len * Math.sin(angle + 0.4));
      ctx.stroke();
    }
  } else if (s.type === "rectangle") {
    ctx.strokeRect(
      Math.min(x0, x1),
      Math.min(y0, y1),
      Math.abs(x1 - x0),
      Math.abs(y1 - y0),
    );
  } else if (s.type === "circle") {
    const r = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
    ctx.beginPath();
    ctx.arc(x0, y0, r, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

export function useCanvasDrawing({
  canvasRef,
  content,
  view,
  redraw,
  canvasSizeRef,
  isLoadingSession,
  isLoadingSnapshot,
  tool,
  penColor,
  penWidth,
  currentStrokeRef,
  selectedStrokeIndices,
  selectedShapeIndices,
  lassoPoints,
  selectionBoxStartRef,
  selectionBoxEndRef,
  previewShape,
  showGrid,
}: CanvasDrawingArgs) {
  const { state, imageCacheRef, graphCacheRef } = content;
  const { strokes, shapes, imageItems, graphItems } = state;
  const { scale, pan, constantGridSize } = view;
  const { registerRedrawHandler, requestRedraw } = redraw;
  const failedImagesRef = useRef<Set<string>>(new Set());
  const failedGraphsRef = useRef<Set<string>>(new Set());
  const { resolvedTheme } = useTheme();
  const themeColorsRef = useRef({
    canvasBg: getCssVar("--canvas-bg"),
    canvasGrid: getCssVar(GRID_COLOR_VAR),
    selection: getCssVar("--canvas-selection"),
    selectionStrong: getCssVar("--canvas-selection-strong"),
  });

  useEffect(() => {
    themeColorsRef.current = {
      canvasBg: getCssVar("--canvas-bg"),
      canvasGrid: getCssVar(GRID_COLOR_VAR),
      selection: getCssVar("--canvas-selection"),
      selectionStrong: getCssVar("--canvas-selection-strong"),
    };
    requestRedraw();
  }, [resolvedTheme, requestRedraw]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: W, height: H } = canvasSizeRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { canvasBg, canvasGrid, selection, selectionStrong } = themeColorsRef.current;
    const resolvedPenColor = resolveCssColor(penColor, penColor);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!(showGrid && constantGridSize)) {
      ctx.fillStyle = canvasBg;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);

    // Grid on canvas (only when grid is on and NOT constant size; constant-size grid is CSS on wrapper)
    if (showGrid && !constantGridSize) {
      ctx.strokeStyle = canvasGrid;
      ctx.lineWidth = 1;
      const left = -pan.x / scale - 50;
      const top = -pan.y / scale - 50;
      const right = (W - pan.x) / scale + 50;
      const bottom = (H - pan.y) / scale + 50;
      for (let x = Math.floor(left / GRID_STEP) * GRID_STEP; x <= right; x += GRID_STEP) {
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
      }
      for (let y = Math.floor(top / GRID_STEP) * GRID_STEP; y <= bottom; y += GRID_STEP) {
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
      }
    }

    // Images (under shapes) — use cache so they draw once loaded; skip permanently failed
    for (const item of imageItems) {
      if (failedImagesRef.current.has(item.id)) continue;
      let img = imageCacheRef.current.get(item.id);
      if (!img) {
        img = new Image();
        img.onload = () => requestRedraw();
        img.onerror = () => {
          failedImagesRef.current.add(item.id);
          requestRedraw();
        };
        img.src = item.dataUrl;
        imageCacheRef.current.set(item.id, img);
      }
      if (img.complete && img.naturalWidth) {
        ctx.drawImage(img, item.x, item.y, item.width, item.height);
      }
    }

    // Graphs (thumbnails) — use cache so they draw once loaded; skip permanently failed
    for (const item of graphItems) {
      if (failedGraphsRef.current.has(item.id)) continue;
      let img = graphCacheRef.current.get(item.id);
      if (!img) {
        img = new Image();
        img.onload = () => requestRedraw();
        img.onerror = () => {
          failedGraphsRef.current.add(item.id);
          requestRedraw();
        };
        img.src = item.thumbnailDataUrl;
        graphCacheRef.current.set(item.id, img);
      }
      if (img.complete && img.naturalWidth) {
        ctx.drawImage(img, item.x, item.y, item.width, item.height);
      }
    }

    // Shapes
    for (let i = 0; i < shapes.length; i++) {
      const s = shapes[i];
      const selected = selectedShapeIndices.has(i);
      drawShape(ctx, s, selected ? selection : undefined, selected ? s.width + 2 : undefined);
    }

    // Preview shape (live drag preview: dashed, slightly transparent)
    if (previewShape) {
      ctx.globalAlpha = 0.7;
      ctx.setLineDash([6, 4]);
      drawShape(ctx, previewShape);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Strokes
    for (let i = 0; i < strokes.length; i++) {
      const stroke = strokes[i];
      if (stroke.points.length < 2) continue;
      const selected = selectedStrokeIndices.has(i);
      ctx.strokeStyle = selected
        ? selection
        : stroke.tool === "eraser" || stroke.tool === "eraserPartial"
          ? canvasBg
          : resolveCssColor(stroke.color, stroke.color);
      ctx.lineWidth = selected
        ? stroke.width + 2
        : stroke.tool === "eraser"
          ? stroke.width * 5
          : stroke.tool === "eraserPartial"
            ? stroke.width * 2
            : stroke.tool === "highlighter"
              ? stroke.width * 4
              : stroke.width;
      if (stroke.tool === "highlighter" && !selected) ctx.globalAlpha = 0.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let j = 1; j < stroke.points.length; j++) ctx.lineTo(stroke.points[j].x, stroke.points[j].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Current stroke in progress
    const cur = currentStrokeRef.current;
    if (cur.length >= 2) {
      ctx.strokeStyle =
        tool === "eraser" || tool === "eraserPartial" ? canvasBg : resolvedPenColor;
      ctx.lineWidth =
        tool === "eraser"
          ? penWidth * 5
          : tool === "eraserPartial"
            ? penWidth * 2
            : tool === "highlighter"
              ? penWidth * 4
              : penWidth;
      if (tool === "highlighter") ctx.globalAlpha = 0.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cur[0].x, cur[0].y);
      for (let i = 1; i < cur.length; i++) ctx.lineTo(cur[i].x, cur[i].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Selection lasso overlay
    if (lassoPoints.length >= 2) {
      ctx.strokeStyle = selectionStrong;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
      for (let i = 1; i < lassoPoints.length; i++) ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const boxStart = selectionBoxStartRef.current;
    if (boxStart) {
      const boxEnd = selectionBoxEndRef.current;
      if (boxEnd) {
        ctx.strokeStyle = selectionStrong;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(
          Math.min(boxStart.x, boxEnd.x),
          Math.min(boxStart.y, boxEnd.y),
          Math.abs(boxEnd.x - boxStart.x),
          Math.abs(boxEnd.y - boxStart.y),
        );
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }, [
    canvasRef,
    canvasSizeRef,
    strokes,
    shapes,
    imageItems,
    graphItems,
    imageCacheRef,
    graphCacheRef,
    previewShape,
    showGrid,
    constantGridSize,
    scale,
    pan,
    tool,
    penColor,
    penWidth,
    currentStrokeRef,
    selectedStrokeIndices,
    selectedShapeIndices,
    lassoPoints,
    selectionBoxStartRef,
    selectionBoxEndRef,
    requestRedraw,
  ]);

  useEffect(() => {
    registerRedrawHandler(redrawCanvas);
  }, [registerRedrawHandler, redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Resize canvas on mount and when layout changes (depends on loading flags so
  // the effect re-runs once gates lift and canvas is in DOM)
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const updateSize = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      const { width: prevW, height: prevH } = canvasSizeRef.current;
      if (w === prevW && h === prevH) return;
      canvasSizeRef.current = { width: w, height: h };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      requestRedraw();
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(parent);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingSession, isLoadingSnapshot]);

  // Force redraw when strokes change (ensures new stroke visible after mouse up)
  useEffect(() => {
    requestRedraw();
  }, [strokes, requestRedraw]);

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width: W, height: H } = canvasSizeRef.current;
    const { strokes: allStrokes, shapes: allShapes, textItems, imageItems: allImages, graphItems: allGraphs } = content.state;
    const off = document.createElement("canvas");
    off.width = W * dpr;
    off.height = H * dpr;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = getCssVar("--canvas-bg");
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);

    for (const item of allImages) {
      let img = imageCacheRef.current.get(item.id);
      if (img?.complete && img.naturalWidth) {
        ctx.drawImage(img, item.x, item.y, item.width, item.height);
      } else {
        try {
          img = await loadImage(item.dataUrl);
          ctx.drawImage(img, item.x, item.y, item.width, item.height);
        } catch {
          // Skip failed image in export
        }
      }
    }
    for (const item of allGraphs) {
      let img = graphCacheRef.current.get(item.id);
      if (img?.complete && img.naturalWidth) {
        ctx.drawImage(img, item.x, item.y, item.width, item.height);
      } else {
        try {
          img = await loadImage(item.thumbnailDataUrl);
          ctx.drawImage(img, item.x, item.y, item.width, item.height);
        } catch {
          // Skip failed graph thumbnail in export
        }
      }
    }
    for (const s of allShapes) {
      drawShape(ctx, s);
    }
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle =
        stroke.tool === "eraser" || stroke.tool === "eraserPartial"
          ? getCssVar("--canvas-bg")
          : resolveCssColor(stroke.color, stroke.color);
      ctx.lineWidth =
        stroke.tool === "eraser"
          ? stroke.width * 5
          : stroke.tool === "eraserPartial"
            ? stroke.width * 2
            : stroke.tool === "highlighter"
              ? stroke.width * 4
              : stroke.width;
      if (stroke.tool === "highlighter") ctx.globalAlpha = 0.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const lineHeight = 1.2;
    ctx.textBaseline = "top";
    for (const t of textItems) {
      ctx.font = `${t.fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      const lines = t.text.split("\n");
      let y = t.y;
      for (const line of lines) {
        ctx.fillText(line, t.x, y);
        y += t.fontSize * lineHeight;
      }
    }
    ctx.restore();
    const link = document.createElement("a");
    link.download = "whiteboard.png";
    link.href = off.toDataURL("image/png");
    link.click();
  }, [canvasRef, canvasSizeRef, content.state, imageCacheRef, graphCacheRef, pan, scale]);

  return { redrawCanvas, handleExport };
}
