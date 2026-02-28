import { useState, useRef, useEffect, useCallback } from "react";
import type { Stroke, ShapeItem, TextItem, ImageItem, GraphItem } from "../types";

/**
 * Canonical whiteboard state owner.
 *
 * Guardrail 1: This is the ONLY hook that may define strokes/shapes/textItems/
 * imageItems state, their mirror refs, or imageCacheRef.
 *
 * Guardrail 2: Raw setters are NOT part of the public return value. They are
 * exposed only via `__unsafeSetters` to `useWhiteboardHistory`. All other hooks
 * must call domain operations on history instead of calling setters directly,
 * except for ephemeral drag-preview mutations (which must never push undo entries).
 *
 * Guardrail 3: Any cache or ref that is shared across async work (e.g. image
 * cache rebuild) must use a generation or mounted guard so updates do not run
 * after unmount or after a newer run has started.
 *
 * Guardrail 4: any cache clear must be paired with `requestRedraw()`.
 */
export function useWhiteboardContent() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [shapes, setShapes] = useState<ShapeItem[]>([]);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [graphItems, setGraphItems] = useState<GraphItem[]>([]);

  // Mirror refs kept in sync for autosave (avoids stale closures)
  const strokesRef = useRef<Stroke[]>([]);
  const shapesRef = useRef<ShapeItem[]>([]);
  const textItemsRef = useRef<TextItem[]>([]);
  const imageItemsRef = useRef<ImageItem[]>([]);
  const graphItemsRef = useRef<GraphItem[]>([]);

  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  useEffect(() => { shapesRef.current = shapes; }, [shapes]);
  useEffect(() => { textItemsRef.current = textItems; }, [textItems]);
  useEffect(() => { imageItemsRef.current = imageItems; }, [imageItems]);
  useEffect(() => { graphItemsRef.current = graphItems; }, [graphItems]);

  // Image cache: keyed by ImageItem.id; populated lazily in redrawCanvas
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const graphCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const imageCacheGenerationRef = useRef(0);
  const graphCacheGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Replace all content without pushing an undo entry (for load / clear-all). */
  const replaceAll = useCallback(
    (data: {
      strokes: Stroke[];
      shapes: ShapeItem[];
      textItems: TextItem[];
      imageItems: ImageItem[];
      graphItems: GraphItem[];
    }) => {
      setStrokes(data.strokes);
      setShapes(data.shapes);
      setTextItems(data.textItems);
      setImageItems(data.imageItems);
      setGraphItems(data.graphItems);
    },
    [],
  );

  /**
   * Rebuild the image cache after a snapshot load.
   * Must be called after `replaceAll` settles. Clears any stale cache entries
   * before creating new Image objects so the canvas repaints cleanly.
   * Uses a generation guard so concurrent calls do not overwrite each other.
   */
  const rebuildImageCache = useCallback(
    async (
      items: ImageItem[],
      requestRedraw: () => void,
    ): Promise<void> => {
      imageCacheGenerationRef.current += 1;
      const thisGen = imageCacheGenerationRef.current;
      imageCacheRef.current.clear();
      requestRedraw();
      const loads = items.map(
        (item) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              if (!mountedRef.current || imageCacheGenerationRef.current !== thisGen) {
                resolve();
                return;
              }
              imageCacheRef.current.set(item.id, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = item.dataUrl;
          }),
      );
      await Promise.all(loads);
      if (mountedRef.current && imageCacheGenerationRef.current === thisGen) {
        requestRedraw();
      }
    },
    [],
  );

  const rebuildGraphCache = useCallback(
    async (
      items: GraphItem[],
      requestRedraw: () => void,
    ): Promise<void> => {
      graphCacheGenerationRef.current += 1;
      const thisGen = graphCacheGenerationRef.current;
      graphCacheRef.current.clear();
      requestRedraw();
      const loads = items.map(
        (item) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              if (!mountedRef.current || graphCacheGenerationRef.current !== thisGen) {
                resolve();
                return;
              }
              graphCacheRef.current.set(item.id, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = item.thumbnailDataUrl;
          }),
      );
      await Promise.all(loads);
      if (mountedRef.current && graphCacheGenerationRef.current === thisGen) {
        requestRedraw();
      }
    },
    [],
  );

  /** Snapshot of current state for history reads (avoids closure staleness). */
  const getState = useCallback(
    () => ({
      strokes: strokesRef.current,
      shapes: shapesRef.current,
      textItems: textItemsRef.current,
      imageItems: imageItemsRef.current,
      graphItems: graphItemsRef.current,
    }),
    [],
  );

  return {
    state: { strokes, shapes, textItems, imageItems, graphItems },
    refs: { strokesRef, shapesRef, textItemsRef, imageItemsRef, graphItemsRef },
    imageCacheRef,
    graphCacheRef,
    replaceAll,
    rebuildImageCache,
    rebuildGraphCache,
    getState,
    /** Only for useWhiteboardHistory — do NOT use elsewhere */
    __unsafeSetters: { setStrokes, setShapes, setTextItems, setImageItems, setGraphItems },
  };
}

export type WhiteboardContent = ReturnType<typeof useWhiteboardContent>;
