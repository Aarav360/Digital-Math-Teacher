import { useState, useRef, useCallback, useEffect } from "react";
import type { ImageItem } from "../types";
import { MIN_IMAGE_SIZE } from "../constants";
import type { WhiteboardContent } from "./useWhiteboardContent";
import type { ViewTransform } from "./useViewTransform";
import type { useWhiteboardHistory } from "./useWhiteboardHistory";
import type { RedrawSignal } from "./useRedrawSignal";

type History = ReturnType<typeof useWhiteboardHistory>;

interface ImageLayerArgs {
  content: WhiteboardContent;
  view: ViewTransform;
  history: History;
  redraw: RedrawSignal;
}

export function useImageLayer({ content, view, history, redraw }: ImageLayerArgs) {
  const { __unsafeSetters, imageCacheRef } = content;
  const { setImageItems } = __unsafeSetters;
  const { scale, viewTransformRef } = view;
  const { requestRedraw } = redraw;

  const canvasSizeRef = useRef({ width: 0, height: 0 });

  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const imageDragStartRef = useRef<{
    pageX: number;
    pageY: number;
    itemX: number;
    itemY: number;
  } | null>(null);
  // Baseline captured at drag start for undo entry (fix undo gap)
  const imageDragBaselineRef = useRef<{ x: number; y: number } | null>(null);

  const [resizingImageId, setResizingImageId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const imageResizeStartRef = useRef<{
    pageX: number;
    pageY: number;
    itemX: number;
    itemY: number;
    itemW: number;
    itemH: number;
    aspectRatio: number;
  } | null>(null);
  // Baseline bounds captured at resize start for undo entry (fix undo gap)
  const resizeBaselineRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);

  // Global cursor while dragging / resizing
  useEffect(() => {
    if (draggingImageId) {
      document.body.style.cursor = "grabbing";
      return () => {
        document.body.style.cursor = "";
      };
    }
  }, [draggingImageId]);

  useEffect(() => {
    if (resizingImageId) {
      document.body.style.cursor = "nwse-resize";
      return () => {
        document.body.style.cursor = "";
      };
    }
  }, [resizingImageId]);

  // Global image drag: ephemeral preview on move, commit undo entry on up
  useEffect(() => {
    if (!draggingImageId || !imageDragStartRef.current) return;
    const onMove = (e: MouseEvent) => {
      if (!imageDragStartRef.current) return;
      const dx = (e.clientX - imageDragStartRef.current.pageX) / scale;
      const dy = (e.clientY - imageDragStartRef.current.pageY) / scale;
      // Ephemeral preview — does NOT push undo entry (Guardrail 2)
      setImageItems((prev) =>
        prev.map((img) =>
          img.id === draggingImageId
            ? {
                ...img,
                x: imageDragStartRef.current!.itemX + dx,
                y: imageDragStartRef.current!.itemY + dy,
              }
            : img,
        ),
      );
    };
    const onUp = (e: MouseEvent) => {
      // Commit undo entry: from = baseline captured at drag start, to = final position
      if (imageDragBaselineRef.current && imageDragStartRef.current) {
        const dx = (e.clientX - imageDragStartRef.current.pageX) / scale;
        const dy = (e.clientY - imageDragStartRef.current.pageY) / scale;
        const to = {
          x: imageDragStartRef.current.itemX + dx,
          y: imageDragStartRef.current.itemY + dy,
        };
        history.commitMoveImage(draggingImageId, imageDragBaselineRef.current, to);
      }
      setDraggingImageId(null);
      imageDragStartRef.current = null;
      imageDragBaselineRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingImageId, scale, history, setImageItems]);

  // Global image resize: proportional by default, Shift = free-form; anchor = top-left
  useEffect(() => {
    if (!resizingImageId || !imageResizeStartRef.current) return;
    const onMove = (e: MouseEvent) => {
      const start = imageResizeStartRef.current;
      if (!start) return;
      const dw = (e.clientX - start.pageX) / scale;
      const dh = (e.clientY - start.pageY) / scale;
      let newW: number;
      let newH: number;
      if (e.shiftKey) {
        newW = Math.max(MIN_IMAGE_SIZE, start.itemW + dw);
        newH = Math.max(MIN_IMAGE_SIZE, start.itemH + dh);
      } else {
        newW = Math.max(MIN_IMAGE_SIZE, start.itemW + dw);
        newH = newW / start.aspectRatio;
        if (newH < MIN_IMAGE_SIZE) {
          newH = MIN_IMAGE_SIZE;
          newW = newH * start.aspectRatio;
        }
      }
      // Ephemeral preview — does NOT push undo entry (Guardrail 2)
      setImageItems((prev) =>
        prev.map((img) =>
          img.id === resizingImageId
            ? { ...img, x: start.itemX, y: start.itemY, width: newW, height: newH }
            : img,
        ),
      );
    };
    const onUp = (e: MouseEvent) => {
      // Commit undo entry: from = baseline captured at resize start, to = final bounds
      if (resizeBaselineRef.current && imageResizeStartRef.current) {
        const start = imageResizeStartRef.current;
        const dw = (e.clientX - start.pageX) / scale;
        const dh = (e.clientY - start.pageY) / scale;
        let newW = Math.max(MIN_IMAGE_SIZE, start.itemW + dw);
        let newH: number;
        if (e.shiftKey) {
          newH = Math.max(MIN_IMAGE_SIZE, start.itemH + dh);
        } else {
          newH = newW / start.aspectRatio;
          if (newH < MIN_IMAGE_SIZE) {
            newH = MIN_IMAGE_SIZE;
            newW = newH * start.aspectRatio;
          }
        }
        history.commitResizeImage(resizingImageId, resizeBaselineRef.current, {
          x: start.itemX,
          y: start.itemY,
          width: newW,
          height: newH,
        });
      }
      setResizingImageId(null);
      imageResizeStartRef.current = null;
      resizeBaselineRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingImageId, scale, history, setImageItems]);

  const startImageDrag = useCallback(
    (img: ImageItem, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedImageId(img.id);
      // Capture baseline before any preview mutations
      imageDragBaselineRef.current = { x: img.x, y: img.y };
      setDraggingImageId(img.id);
      imageDragStartRef.current = {
        pageX: e.clientX,
        pageY: e.clientY,
        itemX: img.x,
        itemY: img.y,
      };
    },
    [],
  );

  const startImageResize = useCallback(
    (img: ImageItem, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setResizingImageId(img.id);
      setDraggingImageId(null);
      imageDragStartRef.current = null;
      imageDragBaselineRef.current = null;
      // Capture baseline before any preview mutations
      resizeBaselineRef.current = {
        x: img.x,
        y: img.y,
        width: img.width,
        height: img.height,
      };
      imageResizeStartRef.current = {
        pageX: e.clientX,
        pageY: e.clientY,
        itemX: img.x,
        itemY: img.y,
        itemW: img.width,
        itemH: img.height,
        aspectRatio: img.width / img.height,
      };
    },
    [],
  );

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const handleInsertImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const type = file.type?.toLowerCase();
      if (!type || !ALLOWED_IMAGE_TYPES.includes(type)) {
        console.warn("Insert image: only JPEG, PNG, WebP, and GIF are allowed.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        if (!dataUrl || typeof dataUrl !== "string") return;
        const img = new Image();
        img.onload = () => {
          const maxW = 400, maxH = 300;
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > maxW || h > maxH) {
            const r = Math.min(maxW / w, maxH / h);
            w = Math.round(w * r);
            h = Math.round(h * r);
          }
          const id = Date.now().toString();
          const { pan: p, scale: s } = viewTransformRef.current;
          const { width: W, height: H } = canvasSizeRef.current;
          const viewCenterX = (W / 2 - p.x) / s;
          const viewCenterY = (H / 2 - p.y) / s;
          const x = viewCenterX - w / 2;
          const y = viewCenterY - h / 2;
          const newItem: ImageItem = { id, x, y, width: w, height: h, dataUrl };
          imageCacheRef.current.set(id, img);
          history.addImage(newItem);
          setTimeout(() => requestRedraw(), 0);
        };
        img.onerror = () => {
          console.warn("Image load failed for upload");
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        console.warn("FileReader failed to read image");
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [history, imageCacheRef, viewTransformRef, canvasSizeRef, requestRedraw],
  );

  return {
    draggingImageId,
    resizingImageId,
    selectedImageId,
    setSelectedImageId,
    imageInputRef,
    startImageDrag,
    startImageResize,
    handleInsertImage,
  };
}
