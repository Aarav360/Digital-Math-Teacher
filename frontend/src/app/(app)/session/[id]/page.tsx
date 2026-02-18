"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  PenTool, Eraser, Undo2, Redo2, Trash2, Hand, ZoomIn, ZoomOut,
  Type, ChevronLeft, ChevronRight, Send, Check, X, AlertTriangle,
  ArrowLeft, Loader2, MousePointer2, Lasso, BoxSelect, ChevronDown,
  Highlighter, Minus, Square, Circle, ArrowRight, Grid3X3, ImagePlus, Download,
} from "lucide-react";
import { PROBLEMS, MOCK_FEEDBACK, type Problem, type StepFeedback, type ChatMessage } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/contexts/user-context";
import { saveSnapshot, loadSnapshot } from "@/lib/api";
import { toast } from "sonner";

type Tool = "pen" | "eraser" | "eraserPartial" | "highlighter" | "hand" | "text" | "lasso" | "selectionBox" | "line" | "rectangle" | "circle" | "arrow";
type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; width: number; tool: "pen" | "eraser" | "eraserPartial" | "highlighter" };
type ShapeItem = { type: "line" | "rectangle" | "circle" | "arrow"; start: Point; end: Point; color: string; width: number };
type TextItem = { id: string; x: number; y: number; text: string; color: string; fontSize: number };
type ImageItem = { id: string; x: number; y: number; width: number; height: number; dataUrl: string };

const GRID_STEP = 24;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP_MIN = 1.05;
const ZOOM_STEP_MAX = 1.4;
const ZOOM_STEP_DEFAULT = 1.1;
const ZOOM_SPEED_STORAGE_KEY = "whiteboard-zoom-speed";
const CONSTANT_GRID_STORAGE_KEY = "whiteboard-constant-grid-size";
const STATIC_GRID_SIZE_PX = 20;
const GRID_COLOR = "#f0f0f0";

const DEFAULT_PEN_COLOR = "#1d1d1f";
const TOOLBAR_BUTTON_HOVER = "transition-all duration-150 hover:brightness-[0.97] active:brightness-95";
const DEFAULT_WHITEBOARD_TITLE = "Untitled Whiteboard";
const WHITEBOARD_STORAGE_KEY_PREFIX = "whiteboard-draft-";
const WHITEBOARD_NO_CLEAR_WARNING_PREFIX = "whiteboard-no-clear-warning-";
const PERSIST_DEBOUNCE_MS = 800;
const AUTOSAVE_DEBOUNCE_MS = 2500; // 2.5 seconds
const MIN_TIME_BETWEEN_SAVES_MS = 2000; // 2 seconds minimum between saves
const MIGRATION_FLAG_PREFIX = "migrated-snapshot-";

const BLANK_PROBLEM: Problem = {
  id: "blank",
  title: "Untitled Whiteboard",
  topic: "Scratch",
  difficulty: 0,
  type: "Free",
  estimatedTime: "",
  statement: "",
};

export default function SessionPage() {
  const params = useParams();
  const { currentUser } = useUser();
  const isBlank = params.id === "blank";
  const problem = isBlank
    ? BLANK_PROBLEM
    : PROBLEMS.find((p) => p.id === params.id) || PROBLEMS[0];

  // Helper function for draft key with user_id
  const getDraftKey = useCallback((suffix: string) => {
    if (!currentUser) return null; // Don't load/save if no user
    return `${WHITEBOARD_STORAGE_KEY_PREFIX}${currentUser.id}-${suffix}`;
  }, [currentUser]);

  // Snapshot persistence state
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const lastSavedRef = useRef<string>("");
  const lastSaveTimestampRef = useRef<number>(0);
  const saveControllerRef = useRef<AbortController | null>(null);
  const pendingSaveRef = useRef<NodeJS.Timeout | null>(null);
  const migrationAttemptedRef = useRef<boolean>(false);

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [penColor, setPenColor] = useState(DEFAULT_PEN_COLOR);
  const [penWidth, setPenWidth] = useState(2);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStroke = useRef<Point[]>([]);

  // Tool dropdowns
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const [showEraserDropdown, setShowEraserDropdown] = useState(false);
  const [showShapesDropdown, setShowShapesDropdown] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const selectBtnRef = useRef<HTMLDivElement>(null);
  const eraserBtnRef = useRef<HTMLDivElement>(null);
  const shapesBtnRef = useRef<HTMLDivElement>(null);

  // Zoom speed and constant grid: read from localStorage (set in Settings page); re-read on focus so other tab changes apply
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

  // Shapes (line, rectangle, circle, arrow)
  const [shapes, setShapes] = useState<ShapeItem[]>([]);
  const [undoneShapes, setUndoneShapes] = useState<ShapeItem[]>([]);
  const [previewShape, setPreviewShape] = useState<ShapeItem | null>(null);
  const shapeStartRef = useRef<Point | null>(null);

  // Zoom & pan (view transform: world = (screen - pan) / scale, screen = world * scale + pan)
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Canvas logical size (for HiDPI we use this for drawing; canvas buffer is size * dpr)
  const canvasSizeRef = useRef({ width: 800, height: 600 });
  // Current pan/scale for async use (e.g. place new image at view center)
  const viewTransformRef = useRef({ pan: { x: 0, y: 0 }, scale: 1 });
  viewTransformRef.current = { pan, scale };

  // Text and image layers
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [undoneTextItems, setUndoneTextItems] = useState<TextItem[]>([]);
  const [undoneImageItems, setUndoneImageItems] = useState<ImageItem[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Text tool overlay: { x, y } in world coords; id + initialText when editing existing
  const [textEditState, setTextEditState] = useState<{ x: number; y: number; id?: string; initialText?: string } | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Text item hover/drag: which text is hovered, in drag zone (8px perimeter), or being dragged
  const [hoveredTextId, setHoveredTextId] = useState<string | null>(null);
  const [hoveredInDragZone, setHoveredInDragZone] = useState(false);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const dragStartRef = useRef<{ pageX: number; pageY: number; itemX: number; itemY: number } | null>(null);
  const textItemWrapperRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const textItemInnerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Image drag and resize
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const imageDragStartRef = useRef<{ pageX: number; pageY: number; itemX: number; itemY: number } | null>(null);
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

  // Clipboard for cut/copy/paste (strokes and shapes only)
  const clipboardRef = useRef<{ strokes: Stroke[]; shapes: ShapeItem[] } | null>(null);
  const HANDLE_SIZE = 16;
  const MIN_IMAGE_SIZE = 24;

  // Selection move (drag selected strokes/shapes)
  const isMovingSelectionRef = useRef(false);
  const moveSelectionStartRef = useRef<{ pageX: number; pageY: number } | null>(null);

  // Last mouse position for zoom-toward-cursor
  const lastMouseRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });
  const handleCheckStepsRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Selection (indices into strokes and shapes)
  const [selectedStrokeIndices, setSelectedStrokeIndices] = useState<Set<number>>(new Set());
  const [selectedShapeIndices, setSelectedShapeIndices] = useState<Set<number>>(new Set());
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const selectionBoxStartRef = useRef<Point | null>(null);
  const selectionBoxEndRef = useRef<Point | null>(null);
  const isSelectingRef = useRef(false);

  const redrawCanvasRef = useRef<() => void>(() => {});
  const selectionRef = useRef<{ strokes: Set<number>; shapes: Set<number> }>({ strokes: new Set(), shapes: new Set() });
  selectionRef.current = { strokes: selectedStrokeIndices, shapes: selectedShapeIndices };

  // Resizable feedback sidebar (10–40% width); width = distance from cursor to right edge
  const [sidebarWidth, setSidebarWidth] = useState(20);
  const [isResizing, setIsResizing] = useState(false);

  // Clear-all confirmation dialog
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState(false);
  const [clearConfirmDontAskAgain, setClearConfirmDontAskAgain] = useState(false);

  // Whiteboard title (Google Docs–style rename)
  const [whiteboardTitle, setWhiteboardTitle] = useState(problem.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleBeforeEditRef = useRef(problem.title);

  useEffect(() => {
    setWhiteboardTitle(problem.title);
  }, [problem.title]);

  // Persistence: load from backend API on mount
  useEffect(() => {
    const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "blank";
    
    // Skip API calls for blank sessions (use localStorage only)
    if (isBlank || sessionId === "blank" || !currentUser) {
      // Fallback to localStorage for blank sessions
      const key = getDraftKey(sessionId);
      if (key) {
        try {
          const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
          if (raw) {
            const data = JSON.parse(raw) as { strokes?: Stroke[]; shapes?: ShapeItem[]; textItems?: TextItem[]; imageItems?: ImageItem[] };
            if (data.strokes?.length) setStrokes(data.strokes);
            if (data.shapes?.length) setShapes(data.shapes);
            if (data.textItems?.length) setTextItems(data.textItems);
            if (data.imageItems?.length) {
              setImageItems(data.imageItems);
              data.imageItems.forEach((item) => {
                const img = new Image();
                img.onload = () => redrawCanvasRef.current();
                img.src = item.dataUrl;
                imageCacheRef.current.set(item.id, img);
              });
            }
          }
        } catch {
          // ignore invalid or old data
        }
      }
      return;
    }

    // Load from backend API
    setIsLoadingSnapshot(true);
    loadSnapshot(sessionId)
      .then((result) => {
        if (result.ok && result.data) {
          const { strokes_json, width, height } = result.data;
          if (strokes_json.strokes?.length) setStrokes(strokes_json.strokes as Stroke[]);
          if (strokes_json.shapes?.length) setShapes(strokes_json.shapes as ShapeItem[]);
          if (strokes_json.textItems?.length) setTextItems(strokes_json.textItems as TextItem[]);
          if (strokes_json.imageItems?.length) {
            const imageItemsArray = strokes_json.imageItems as ImageItem[];
            setImageItems(imageItemsArray);
            imageItemsArray.forEach((item) => {
              const img = new Image();
              img.onload = () => redrawCanvasRef.current();
              img.src = item.dataUrl;
              imageCacheRef.current.set(item.id, img);
            });
          }
          // Update canvas size if needed
          if (width && height) {
            canvasSizeRef.current = { width, height };
          }
          // Mark as saved
          const saved = JSON.stringify({
            strokes: strokes_json.strokes || [],
            shapes: strokes_json.shapes || [],
            textItems: strokes_json.textItems || [],
            width,
            height,
          });
          lastSavedRef.current = saved;
          lastSaveTimestampRef.current = Date.now();
        } else if (!result.ok && result.status === 404) {
          // No snapshot yet - check for localStorage migration
          const key = getDraftKey(sessionId);
          const migrationFlagKey = `${MIGRATION_FLAG_PREFIX}${currentUser.id}-${sessionId}`;
          
          if (key && !migrationAttemptedRef.current && typeof window !== "undefined") {
            const hasMigrationFlag = window.localStorage.getItem(migrationFlagKey);
            if (!hasMigrationFlag) {
              try {
                const raw = window.localStorage.getItem(key);
                if (raw) {
                  const data = JSON.parse(raw) as { strokes?: Stroke[]; shapes?: ShapeItem[]; textItems?: TextItem[]; imageItems?: ImageItem[] };
                  if (data.strokes || data.shapes || data.textItems || data.imageItems) {
                    // Attempt migration
                    migrationAttemptedRef.current = true;
                    const { width, height } = canvasSizeRef.current;
                    saveSnapshot(sessionId, {
                      strokes_json: {
                        strokes: data.strokes || [],
                        shapes: data.shapes || [],
                        textItems: data.textItems || [],
                        imageItems: data.imageItems || [],
                      },
                      width,
                      height,
                    })
                      .then((migrateResult) => {
                        if (migrateResult.ok) {
                          // Clear localStorage and set flag
                          window.localStorage.removeItem(key);
                          window.localStorage.setItem(migrationFlagKey, "1");
                          toast.success("Draft migrated to cloud");
                        } else {
                          toast.error("Failed to migrate draft");
                        }
                      })
                      .catch(() => {
                        toast.error("Failed to migrate draft");
                      });
                  }
                }
              } catch {
                // ignore migration errors
              }
            }
          }
        }
      })
      .catch(() => {
        // Network error - silently fail, start empty
      })
      .finally(() => {
        setIsLoadingSnapshot(false);
      });
  }, [params.id, currentUser?.id, isBlank, getDraftKey]);

  // Persistence: save to backend API when whiteboard state changes (debounced, excludes imageItems)
  useEffect(() => {
    const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "blank";
    
    // Skip API calls for blank sessions (use localStorage only)
    if (isBlank || sessionId === "blank" || !currentUser) {
      // Fallback to localStorage for blank sessions
      const key = getDraftKey(sessionId);
      if (!key) return;
      const t = setTimeout(() => {
        try {
          const payload = { strokes, shapes, textItems, imageItems };
          window.localStorage.setItem(key, JSON.stringify(payload));
        } catch {
          // quota or disabled
        }
      }, PERSIST_DEBOUNCE_MS);
      return () => clearTimeout(t);
    }

    // Backend autosave (excludes imageItems)
    const { width, height } = canvasSizeRef.current;
    const currentPayload = {
      strokes,
      shapes,
      textItems,
      // Exclude imageItems from autosave
      width,
      height,
    };
    const serialized = JSON.stringify(currentPayload);
    
    // Skip if identical to last saved state
    if (serialized === lastSavedRef.current) {
      return;
    }

    // Cancel previous debounce timer
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
    }

    // Cancel in-flight request
    if (saveControllerRef.current) {
      saveControllerRef.current.abort();
    }

    // Set new debounce timer
    pendingSaveRef.current = setTimeout(() => {
      // Check minimum time between saves
      const timeSinceLastSave = Date.now() - lastSaveTimestampRef.current;
      if (timeSinceLastSave < MIN_TIME_BETWEEN_SAVES_MS) {
        // Reschedule for later
        pendingSaveRef.current = setTimeout(() => {
          performSave();
        }, MIN_TIME_BETWEEN_SAVES_MS - timeSinceLastSave);
        return;
      }

      performSave();
    }, AUTOSAVE_DEBOUNCE_MS);

    const performSave = () => {
      // Create new AbortController
      const controller = new AbortController();
      saveControllerRef.current = controller;
      setIsSavingSnapshot(true);

      saveSnapshot(sessionId, {
        strokes_json: {
          strokes,
          shapes,
          textItems,
          // Exclude imageItems from autosave
        },
        width,
        height,
      })
        .then((result) => {
          if (controller.signal.aborted) return;

          if (result.ok) {
            lastSavedRef.current = serialized;
            lastSaveTimestampRef.current = Date.now();
          } else {
            // Error handling
            if (result.status === 403 || result.status === 404) {
              toast.error(result.error || "Failed to save");
            } else if (result.status === 500) {
              toast.error("Server error. Your work is saved locally.");
            } else {
              toast.error("Failed to save");
            }
          }
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          // Network error
          toast.error("Failed to save. Check your connection.");
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSavingSnapshot(false);
            saveControllerRef.current = null;
          }
        });
    };

    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
      }
      if (saveControllerRef.current) {
        saveControllerRef.current.abort();
        saveControllerRef.current = null;
      }
    };
  }, [params.id, currentUser?.id, strokes, shapes, textItems, isBlank, getDraftKey]);

  useEffect(() => {
    if (isEditingTitle) {
      titleBeforeEditRef.current = whiteboardTitle;
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const saveTitle = useCallback(() => {
    const trimmed = whiteboardTitle.trim();
    setWhiteboardTitle(trimmed || DEFAULT_WHITEBOARD_TITLE);
    setIsEditingTitle(false);
  }, [whiteboardTitle]);

  const cancelTitleEdit = useCallback(() => {
    setWhiteboardTitle(titleBeforeEditRef.current);
    setIsEditingTitle(false);
  }, []);

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelTitleEdit();
    }
  };

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const widthPercent = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      setSidebarWidth(Math.min(Math.max(widthPercent, 10), 40));
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsResizing(true);
  };

  const canvasCursor =
    draggingTextId
      ? "grabbing"
      : tool === "hand"
        ? "grab"
        : hoveredInDragZone
          ? "move"
          : tool === "lasso" || tool === "selectionBox"
            ? "crosshair"
            : tool === "text"
              ? "text"
              : "crosshair";

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectBtnRef.current?.contains(e.target as Node)) return;
      if (eraserBtnRef.current?.contains(e.target as Node)) return;
      if (shapesBtnRef.current?.contains(e.target as Node)) return;
      setShowSelectDropdown(false);
      setShowEraserDropdown(false);
      setShowShapesDropdown(false);
    };
    if (showSelectDropdown || showEraserDropdown || showShapesDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSelectDropdown, showEraserDropdown, showShapesDropdown]);

  // Analysis state
  const [showCheckButton, setShowCheckButton] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeText, setAnalyzeText] = useState("Reading your steps...");
  const [feedback, setFeedback] = useState<StepFeedback[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "1", role: "assistant", content: "Start writing your solution on the whiteboard, and I'll help once there's something to read.", timestamp: new Date().toISOString() },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Idle timer for check button
  const idleTimer = useRef<NodeJS.Timeout | null>(null);

  const resetIdleTimer = useCallback(() => {
    setShowCheckButton(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (strokes.length > 0 || currentStroke.current.length > 0) {
      idleTimer.current = setTimeout(() => setShowCheckButton(true), 3000);
    }
  }, [strokes.length]);

  // Canvas drawing (world coords; view transform applied inside)
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: W, height: H } = canvasSizeRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!(showGrid && constantGridSize)) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);

    // Grid on canvas (only when grid is on and NOT constant size; constant-size grid is drawn via CSS on wrapper)
    if (showGrid && !constantGridSize) {
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      const left = (-pan.x / scale) - 50;
      const top = (-pan.y / scale) - 50;
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

    // Images (under shapes) — use cache so they draw once loaded
    for (const item of imageItems) {
      let img = imageCacheRef.current.get(item.id);
      if (!img) {
        img = new Image();
        img.onload = () => redrawCanvasRef.current();
        img.src = item.dataUrl;
        imageCacheRef.current.set(item.id, img);
      }
      if (img.complete && img.naturalWidth) {
        ctx.drawImage(img, item.x, item.y, item.width, item.height);
      }
    }

    // Shapes
    for (let i = 0; i < shapes.length; i++) {
      const s = shapes[i];
      ctx.strokeStyle = selectedShapeIndices.has(i) ? "#3b82f6" : s.color;
      ctx.lineWidth = selectedShapeIndices.has(i) ? s.width + 2 : s.width;
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
        ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      } else if (s.type === "circle") {
        const r = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
        ctx.beginPath();
        ctx.arc(x0, y0, r, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    // Preview shape (live drag preview: dashed, slightly transparent)
    if (previewShape) {
      const s = previewShape;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.7;
      ctx.setLineDash([6, 4]);
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
        ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      } else if (s.type === "circle") {
        const r = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
        ctx.beginPath();
        ctx.arc(x0, y0, r, 0, 2 * Math.PI);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Strokes
    for (let i = 0; i < strokes.length; i++) {
      const stroke = strokes[i];
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = selectedStrokeIndices.has(i) ? "#3b82f6" : (stroke.tool === "eraser" || stroke.tool === "eraserPartial" ? "#ffffff" : stroke.color);
      ctx.lineWidth = (selectedStrokeIndices.has(i) ? stroke.width + 2 : stroke.tool === "eraser" ? stroke.width * 5 : stroke.tool === "eraserPartial" ? stroke.width * 2 : stroke.tool === "highlighter" ? stroke.width * 4 : stroke.width);
      if (stroke.tool === "highlighter" && !selectedStrokeIndices.has(i)) ctx.globalAlpha = 0.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let j = 1; j < stroke.points.length; j++) {
        ctx.lineTo(stroke.points[j].x, stroke.points[j].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Current stroke in progress (so it never disappears before state commits)
    const cur = currentStroke.current;
    if (cur.length >= 2) {
      ctx.strokeStyle = tool === "eraser" || tool === "eraserPartial" ? "#ffffff" : penColor;
      ctx.lineWidth = tool === "eraser" ? penWidth * 5 : tool === "eraserPartial" ? penWidth * 2 : tool === "highlighter" ? penWidth * 4 : penWidth;
      if (tool === "highlighter") ctx.globalAlpha = 0.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cur[0].x, cur[0].y);
      for (let i = 1; i < cur.length; i++) ctx.lineTo(cur[i].x, cur[i].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Text items are rendered as DOM overlays (see below) for hover/drag/edit; only export draws them on canvas

    // Selection lasso/box overlay
    if (lassoPoints.length >= 2) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
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
        ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(
          Math.min(boxStart.x, boxEnd.x), Math.min(boxStart.y, boxEnd.y),
          Math.abs(boxEnd.x - boxStart.x), Math.abs(boxEnd.y - boxStart.y)
        );
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }, [strokes, shapes, previewShape, textItems, imageItems, showGrid, constantGridSize, scale, pan, tool, penColor, penWidth, selectedStrokeIndices, selectedShapeIndices, lassoPoints]);

  redrawCanvasRef.current = redrawCanvas;
  useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

  // Resize canvas only when container size actually changes (skip when unchanged to avoid clearing canvas and redrawing with stale strokes)
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const updateSize = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      if (w === 0 || h === 0) return;
      const { width: prevW, height: prevH } = canvasSizeRef.current;
      if (w === prevW && h === prevH) return;
      canvasSizeRef.current = { width: w, height: h };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      redrawCanvasRef.current();
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // Force redraw when strokes change so the new stroke is visible after mouse up (in case effect order or observer cleared the canvas)
  useEffect(() => {
    redrawCanvasRef.current();
  }, [strokes]);

  // Focus textarea when text overlay opens (defer so DOM has committed)
  useEffect(() => {
    if (textEditState !== null) {
      const id = requestAnimationFrame(() => {
        textAreaRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [textEditState]);

  const commitTextOverlay = useCallback(() => {
    const value = textAreaRef.current?.value?.trim() ?? "";
    if (!textEditState) {
      setTextEditState(null);
      return;
    }
    if (textEditState.id) {
      if (value) {
        setTextItems((prev) =>
          prev.map((t) => (t.id === textEditState.id ? { ...t, text: value } : t))
        );
      } else {
        setTextItems((prev) => prev.filter((t) => t.id !== textEditState.id));
      }
    } else if (value) {
      const baselineOffset = 14;
      setTextItems((prev) => [
        ...prev,
        { id: Date.now().toString(), x: textEditState.x, y: textEditState.y + baselineOffset, text: value, color: penColor, fontSize: 16 },
      ]);
      setUndoneTextItems([]);
    }
    setTextEditState(null);
  }, [textEditState, penColor]);

  const getPos = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    return { x: (screenX - pan.x) / scale, y: (screenY - pan.y) / scale };
  }, [pan, scale]);

  // Hit test: is (clientX, clientY) in the 8px perimeter of a text item (wrapper rect minus inner rect)?
  const getTextHit = useCallback((clientX: number, clientY: number): { id: string; inDragZone: boolean } | null => {
    const x = clientX;
    const y = clientY;
    for (const t of textItems) {
      const wrapper = textItemWrapperRefs.current.get(t.id);
      const inner = textItemInnerRefs.current.get(t.id);
      if (!wrapper || !inner) continue;
      const wr = wrapper.getBoundingClientRect();
      const ir = inner.getBoundingClientRect();
      const inWrapper = x >= wr.left && x <= wr.right && y >= wr.top && y <= wr.bottom;
      const inInner = x >= ir.left && x <= ir.right && y >= ir.top && y <= ir.bottom;
      if (inWrapper) return { id: t.id, inDragZone: inWrapper && !inInner };
    }
    return null;
  }, [textItems]);

  // While dragging or resizing text/image, set global cursor
  useEffect(() => {
    if (draggingTextId || draggingImageId) {
      document.body.style.cursor = "grabbing";
      return () => {
        document.body.style.cursor = "";
      };
    }
    if (resizingImageId) {
      document.body.style.cursor = "nwse-resize";
      return () => {
        document.body.style.cursor = "";
      };
    }
  }, [draggingTextId, draggingImageId, resizingImageId]);

  // Global drag: update text position on mouse move, clear on mouse up
  useEffect(() => {
    if (!draggingTextId || !dragStartRef.current) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = (e.clientX - dragStartRef.current.pageX) / scale;
      const dy = (e.clientY - dragStartRef.current.pageY) / scale;
      setTextItems((prev) =>
        prev.map((t) =>
          t.id === draggingTextId
            ? { ...t, x: dragStartRef.current!.itemX + dx, y: dragStartRef.current!.itemY + dy }
            : t
        )
      );
    };
    const onUp = () => {
      setDraggingTextId(null);
      dragStartRef.current = null;
      setHoveredTextId(null);
      setHoveredInDragZone(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingTextId, scale]);

  // Global image drag
  useEffect(() => {
    if (!draggingImageId || !imageDragStartRef.current) return;
    const onMove = (e: MouseEvent) => {
      if (!imageDragStartRef.current) return;
      const dx = (e.clientX - imageDragStartRef.current.pageX) / scale;
      const dy = (e.clientY - imageDragStartRef.current.pageY) / scale;
      setImageItems((prev) =>
        prev.map((img) =>
          img.id === draggingImageId
            ? { ...img, x: imageDragStartRef.current!.itemX + dx, y: imageDragStartRef.current!.itemY + dy }
            : img
        )
      );
    };
    const onUp = () => {
      setDraggingImageId(null);
      imageDragStartRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingImageId, scale]);

  // Global image resize (bottom-right handle): proportional by default, Shift = free-form; anchor = top-left (opposite corner)
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
      setImageItems((prev) =>
        prev.map((img) =>
          img.id === resizingImageId
            ? { ...img, x: start.itemX, y: start.itemY, width: newW, height: newH }
            : img
        )
      );
    };
    const onUp = () => {
      setResizingImageId(null);
      imageResizeStartRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingImageId, scale]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setSelectedImageId(null);
    if (e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    const pos = getPos(e.clientX, e.clientY);
    if (tool === "hand") {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    if (tool === "text") {
      setTextEditState({ x: pos.x, y: pos.y });
      return;
    }
    if (tool === "lasso") {
      isSelectingRef.current = true;
      setLassoPoints([pos]);
      setSelectedStrokeIndices(new Set());
      setSelectedShapeIndices(new Set());
      return;
    }
    if (tool === "selectionBox") {
      isSelectingRef.current = true;
      selectionBoxStartRef.current = pos;
      selectionBoxEndRef.current = pos;
      setSelectedStrokeIndices(new Set());
      setSelectedShapeIndices(new Set());
      return;
    }
    if (tool === "line" || tool === "rectangle" || tool === "circle" || tool === "arrow") {
      shapeStartRef.current = pos;
      setPreviewShape({ type: tool, start: pos, end: pos, color: penColor, width: penWidth });
      return;
    }
    // Start moving selection if click is inside selection bounds
    const bounds = getSelectionBounds();
    if (bounds && (selectedStrokeIndices.size > 0 || selectedShapeIndices.size > 0)) {
      const pad = 4;
      if (pos.x >= bounds.minX - pad && pos.x <= bounds.maxX + pad && pos.y >= bounds.minY - pad && pos.y <= bounds.maxY + pad) {
        isMovingSelectionRef.current = true;
        moveSelectionStartRef.current = { pageX: e.clientX, pageY: e.clientY };
        return;
      }
    }
    setIsDrawing(true);
    currentStroke.current = [pos];
    resetIdleTimer();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    lastMouseRef.current = { clientX: e.clientX, clientY: e.clientY };
    const pos = getPos(e.clientX, e.clientY);
    if (isMovingSelectionRef.current && moveSelectionStartRef.current) {
      const dx = (e.clientX - moveSelectionStartRef.current.pageX) / scale;
      const dy = (e.clientY - moveSelectionStartRef.current.pageY) / scale;
      moveSelectionStartRef.current = { pageX: e.clientX, pageY: e.clientY };
      setStrokes((prev) =>
        prev.map((stroke, i) =>
          selectedStrokeIndices.has(i)
            ? { ...stroke, points: stroke.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
            : stroke
        )
      );
      setShapes((prev) =>
        prev.map((shape, i) =>
          selectedShapeIndices.has(i)
            ? {
                ...shape,
                start: { x: shape.start.x + dx, y: shape.start.y + dy },
                end: { x: shape.end.x + dx, y: shape.end.y + dy },
              }
            : shape
        )
      );
      redrawCanvasRef.current();
      return;
    }
    if (!draggingTextId) {
      const hit = getTextHit(e.clientX, e.clientY);
      if (!hit) {
        setHoveredTextId(null);
        setHoveredInDragZone(false);
      }
    }
    if (isPanning && panStartRef.current) {
      setPan({ x: panStartRef.current.panX + (e.clientX - panStartRef.current.x), y: panStartRef.current.panY + (e.clientY - panStartRef.current.y) });
      return;
    }
    if (shapeStartRef.current !== null && (tool === "line" || tool === "rectangle" || tool === "circle" || tool === "arrow")) {
      setPreviewShape((prev) => prev ? { ...prev, end: pos } : null);
      return;
    }
    if (isSelectingRef.current && tool === "lasso") {
      setLassoPoints((prev) => [...prev, pos]);
      return;
    }
    if (isSelectingRef.current && tool === "selectionBox" && selectionBoxStartRef.current) {
      selectionBoxEndRef.current = pos;
      redrawCanvasRef.current();
      return;
    }
    if (!isDrawing) return;
    currentStroke.current.push(pos);
    redrawCanvasRef.current();
  };

  function pointInPolygon(p: Point, polygon: Point[]): boolean {
    if (polygon.length < 3) return false;
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y, xj = polygon[j].x, yj = polygon[j].y;
      if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /** Bounding box of current selection (strokes + shapes) in world coords; null if empty. */
  function getSelectionBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const { strokes: si, shapes: sh } = selectionRef.current;
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
  }

  /** For full eraser: return indices of strokes that intersect the eraser path (within radius). */
  function getStrokesUnderEraser(eraserPath: Point[], eraserRadius: number, strokeList: Stroke[]): Set<number> {
    const toRemove = new Set<number>();
    for (let i = 0; i < strokeList.length; i++) {
      const stroke = strokeList[i];
      for (const p of stroke.points) {
        for (const q of eraserPath) {
          const dx = p.x - q.x, dy = p.y - q.y;
          if (dx * dx + dy * dy <= eraserRadius * eraserRadius) {
            toRemove.add(i);
            break;
          }
        }
        if (toRemove.has(i)) break;
      }
    }
    return toRemove;
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e.clientX, e.clientY);
    if (isMovingSelectionRef.current) {
      isMovingSelectionRef.current = false;
      moveSelectionStartRef.current = null;
      return;
    }
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      return;
    }
    if (isSelectingRef.current && tool === "lasso" && lassoPoints.length >= 3) {
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
      return;
    }
    if (isSelectingRef.current && tool === "selectionBox") {
      const start = selectionBoxStartRef.current;
      const end = selectionBoxEndRef.current;
      if (start && end) {
        const r = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y) };
        const selectedStrokes = new Set<number>();
        strokes.forEach((stroke, i) => {
          const minX = Math.min(...stroke.points.map((p) => p.x)), maxX = Math.max(...stroke.points.map((p) => p.x));
          const minY = Math.min(...stroke.points.map((p) => p.y)), maxY = Math.max(...stroke.points.map((p) => p.y));
          if (rectsOverlap(r, { x: minX, y: minY, w: maxX - minX, h: maxY - minY })) selectedStrokes.add(i);
        });
        const selectedShapes = new Set<number>();
        shapes.forEach((s, i) => {
          const minX = Math.min(s.start.x, s.end.x), maxX = Math.max(s.start.x, s.end.x);
          const minY = Math.min(s.start.y, s.end.y), maxY = Math.max(s.start.y, s.end.y);
          if (rectsOverlap(r, { x: minX, y: minY, w: maxX - minX, h: maxY - minY })) selectedShapes.add(i);
        });
        setSelectedStrokeIndices(selectedStrokes);
        setSelectedShapeIndices(selectedShapes);
      }
      selectionBoxStartRef.current = null;
      selectionBoxEndRef.current = null;
      isSelectingRef.current = false;
      return;
    }
    if (tool === "line" || tool === "rectangle" || tool === "circle" || tool === "arrow") {
      if (previewShape) {
        setShapes((prev) => [...prev, { ...previewShape }]);
        setUndoneShapes([]);
      }
      setPreviewShape(null);
      shapeStartRef.current = null;
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    if (tool === "eraser") {
      if (currentStroke.current.length > 0) {
        const eraserRadius = penWidth * 5;
        const toRemove = getStrokesUnderEraser(currentStroke.current, eraserRadius, strokes);
        setStrokes((prev) => prev.filter((_, i) => !toRemove.has(i)));
        setUndoneStrokes([]);
      }
    } else if (currentStroke.current.length > 1) {
      const pointsToAdd = [...currentStroke.current];
      setStrokes((prev) => [
        ...prev,
        { points: pointsToAdd, color: penColor, width: penWidth, tool: tool as "pen" | "eraser" | "eraserPartial" | "highlighter" },
      ]);
      setUndoneStrokes([]);
    }
    currentStroke.current = [];
    resetIdleTimer();
  };

  const handleMouseLeave = () => {
    if (isMovingSelectionRef.current) {
      isMovingSelectionRef.current = false;
      moveSelectionStartRef.current = null;
    }
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
    }
    isSelectingRef.current = false;
    selectionBoxStartRef.current = null;
    selectionBoxEndRef.current = null;
    if (shapeStartRef.current !== null) {
      setPreviewShape(null);
      shapeStartRef.current = null;
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    if (tool === "eraser" && currentStroke.current.length > 0) {
      const eraserRadius = penWidth * 5;
      const toRemove = getStrokesUnderEraser(currentStroke.current, eraserRadius, strokes);
      setStrokes((prev) => prev.filter((_, i) => !toRemove.has(i)));
      setUndoneStrokes([]);
    } else if (currentStroke.current.length > 1) {
      setStrokes((prev) => [
        ...prev,
        { points: [...currentStroke.current], color: penColor, width: penWidth, tool: tool as "pen" | "eraser" | "eraserPartial" | "highlighter" },
      ]);
      setUndoneStrokes([]);
    }
    currentStroke.current = [];
    resetIdleTimer();
  };

  const undo = useCallback(() => {
    if (strokes.length > 0) {
      setStrokes((prev) => {
        const last = prev[prev.length - 1];
        setUndoneStrokes((u) => [...u, last]);
        return prev.slice(0, -1);
      });
    } else if (shapes.length > 0) {
      setShapes((prev) => {
        const last = prev[prev.length - 1];
        setUndoneShapes((u) => [...u, last]);
        return prev.slice(0, -1);
      });
    } else if (textItems.length > 0) {
      setTextItems((prev) => {
        const last = prev[prev.length - 1];
        setUndoneTextItems((u) => [...u, last]);
        return prev.slice(0, -1);
      });
    } else if (imageItems.length > 0) {
      setImageItems((prev) => {
        const last = prev[prev.length - 1];
        setUndoneImageItems((u) => [...u, last]);
        return prev.slice(0, -1);
      });
    }
  }, [strokes.length, shapes.length, textItems.length, imageItems.length]);

  const redo = useCallback(() => {
    if (undoneStrokes.length > 0) {
      setUndoneStrokes((prev) => {
        const last = prev[prev.length - 1];
        setStrokes((s) => [...s, last]);
        return prev.slice(0, -1);
      });
    } else if (undoneShapes.length > 0) {
      setUndoneShapes((prev) => {
        const last = prev[prev.length - 1];
        setShapes((s) => [...s, last]);
        return prev.slice(0, -1);
      });
    } else if (undoneTextItems.length > 0) {
      setUndoneTextItems((prev) => {
        const last = prev[prev.length - 1];
        setTextItems((t) => [...t, last]);
        return prev.slice(0, -1);
      });
    } else if (undoneImageItems.length > 0) {
      setUndoneImageItems((prev) => {
        const last = prev[prev.length - 1];
        setImageItems((i) => [...i, last]);
        return prev.slice(0, -1);
      });
    }
  }, [undoneStrokes.length, undoneShapes.length, undoneTextItems.length, undoneImageItems.length]);

  const clearAll = () => {
    setStrokes([]);
    setUndoneStrokes([]);
    setShapes([]);
    setUndoneShapes([]);
    setTextItems([]);
    setUndoneTextItems([]);
    setImageItems([]);
    setUndoneImageItems([]);
    imageCacheRef.current.clear();
    setSelectedImageId(null);
    setResizingImageId(null);
    setSelectedStrokeIndices(new Set());
    setSelectedShapeIndices(new Set());
    setLassoPoints([]);
    setFeedback([]);
    setShowCheckButton(false);
  };

  const handleClearClick = () => {
    const key = currentUser
      ? `${WHITEBOARD_NO_CLEAR_WARNING_PREFIX}${currentUser.id}-${params.id ?? "blank"}`
      : null;
    if (key && typeof window !== "undefined" && window.localStorage.getItem(key)) {
      clearAll();
      return;
    }
    setClearConfirmDontAskAgain(false);
    setShowClearConfirmDialog(true);
  };

  const handleClearConfirmYes = () => {
    if (clearConfirmDontAskAgain && currentUser && typeof window !== "undefined") {
      const key = `${WHITEBOARD_NO_CLEAR_WARNING_PREFIX}${currentUser.id}-${params.id ?? "blank"}`;
      window.localStorage.setItem(key, "1");
    }
    clearAll();
    setShowClearConfirmDialog(false);
  };

  const handleClearConfirmNo = () => {
    setShowClearConfirmDialog(false);
  };

  const deleteSelected = () => {
    if (selectedStrokeIndices.size === 0 && selectedShapeIndices.size === 0) return;
    setStrokes((prev) => prev.filter((_, i) => !selectedStrokeIndices.has(i)));
    setShapes((prev) => prev.filter((_, i) => !selectedShapeIndices.has(i)));
    setSelectedStrokeIndices(new Set());
    setSelectedShapeIndices(new Set());
  };

  const copySelection = useCallback(() => {
    const { strokes: si, shapes: sh } = selectionRef.current;
    if (si.size === 0 && sh.size === 0) return;
    const strokesToCopy = strokes
      .filter((_, i) => si.has(i))
      .map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) }));
    const shapesToCopy = shapes
      .filter((_, i) => sh.has(i))
      .map((s) => ({ ...s, start: { ...s.start }, end: { ...s.end } }));
    clipboardRef.current = { strokes: strokesToCopy, shapes: shapesToCopy };
  }, [strokes, shapes]);

  const cutSelection = useCallback(() => {
    copySelection();
    deleteSelected();
  }, [copySelection]);

  const pasteSelection = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || (clip.strokes.length === 0 && clip.shapes.length === 0)) return;
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
    const { width: W, height: H } = canvasSizeRef.current;
    const pasteCenter = {
      x: (W / 2 - pan.x) / scale,
      y: (H / 2 - pan.y) / scale,
    };
    const dx = pasteCenter.x - centroid.x;
    const dy = pasteCenter.y - centroid.y;
    const newStrokes: Stroke[] = clip.strokes.map((s) => ({
      ...s,
      points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    }));
    const newShapes: ShapeItem[] = clip.shapes.map((s) => ({
      ...s,
      start: { x: s.start.x + dx, y: s.start.y + dy },
      end: { x: s.end.x + dx, y: s.end.y + dy },
    }));
    const baseStroke = strokes.length;
    const baseShape = shapes.length;
    setStrokes((prev) => [...prev, ...newStrokes]);
    setShapes((prev) => [...prev, ...newShapes]);
    setUndoneStrokes([]);
    setUndoneShapes([]);
    setSelectedStrokeIndices(new Set(Array.from({ length: newStrokes.length }, (_, i) => baseStroke + i)));
    setSelectedShapeIndices(new Set(Array.from({ length: newShapes.length }, (_, i) => baseShape + i)));
  }, [pan.x, pan.y, scale, strokes.length, shapes.length]);

  // When clear-confirm dialog is open, handle Enter (Yes) and Escape (No)
  useEffect(() => {
    if (!showClearConfirmDialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClearConfirmNo();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleClearConfirmYes();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showClearConfirmDialog]);

  // Keyboard shortcuts (must be after undo/redo and copy/cut/paste are defined)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showClearConfirmDialog) return;
      const inInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "Escape") {
        setSelectedImageId(null);
        setSelectedStrokeIndices(new Set());
        setSelectedShapeIndices(new Set());
        setLassoPoints([]);
        selectionBoxStartRef.current = null;
        selectionBoxEndRef.current = null;
        isSelectingRef.current = false;
        if (isEditingTitle) cancelTitleEdit();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedImageId) {
          e.preventDefault();
          setImageItems((prev) => prev.filter((i) => i.id !== selectedImageId));
          setSelectedImageId(null);
        } else {
          const { strokes: si, shapes: sh } = selectionRef.current;
          if (si.size > 0 || sh.size > 0) {
            e.preventDefault();
            setStrokes((prev) => prev.filter((_, i) => !si.has(i)));
            setShapes((prev) => prev.filter((_, i) => !sh.has(i)));
            setSelectedStrokeIndices(new Set());
            setSelectedShapeIndices(new Set());
          }
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleCheckStepsRef.current();
      } else if (!inInput && (e.metaKey || e.ctrlKey) && e.key === "c") {
        copySelection();
      } else if (!inInput && (e.metaKey || e.ctrlKey) && e.key === "x") {
        e.preventDefault();
        cutSelection();
      } else if (!inInput && (e.metaKey || e.ctrlKey) && e.key === "v") {
        e.preventDefault();
        pasteSelection();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, cancelTitleEdit, copySelection, cutSelection, pasteSelection, selectedImageId, showClearConfirmDialog]);

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
  }, [scale, pan.x, pan.y, zoomStep]);

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
  }, [scale, pan.x, pan.y, zoomStep]);

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
  }, [handleZoomIn, handleZoomOut]);

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width: W, height: H } = canvasSizeRef.current;
    const off = document.createElement("canvas");
    off.width = W * dpr;
    off.height = H * dpr;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);
    for (const item of imageItems) {
      const img = new Image();
      img.src = item.dataUrl;
      if (img.complete && img.naturalWidth) ctx.drawImage(img, item.x, item.y, item.width, item.height);
    }
    for (const s of shapes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
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
      } else if (s.type === "rectangle") ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      else if (s.type === "circle") {
        const r = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
        ctx.beginPath();
        ctx.arc(x0, y0, r, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.tool === "eraser" || stroke.tool === "eraserPartial" ? "#ffffff" : stroke.color;
      ctx.lineWidth = stroke.tool === "eraser" ? stroke.width * 5 : stroke.tool === "eraserPartial" ? stroke.width * 2 : stroke.tool === "highlighter" ? stroke.width * 4 : stroke.width;
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
  };

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const handleInsertImage = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setImageItems((prev) => [...prev, newItem]);
        setUndoneImageItems([]);
        setTimeout(() => redrawCanvasRef.current(), 0);
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
  };

  // Simulate analysis
  const handleCheckSteps = async () => {
    const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "blank";
    
    // Immediate save before analysis (includes imageItems - explicit action)
    if (!isBlank && sessionId !== "blank" && currentUser) {
      // Cancel any pending debounce
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }

      // Abort in-flight requests
      if (saveControllerRef.current) {
        saveControllerRef.current.abort();
      }

      // Create new controller for immediate save
      const controller = new AbortController();
      saveControllerRef.current = controller;
      setIsSavingSnapshot(true);

      const { width, height } = canvasSizeRef.current;
      try {
        const result = await saveSnapshot(sessionId, {
          strokes_json: {
            strokes,
            shapes,
            textItems,
            imageItems, // Include imageItems for explicit action
          },
          width,
          height,
        });

        if (!controller.signal.aborted) {
          if (result.ok) {
            // Update saved state
            const saved = JSON.stringify({
              strokes,
              shapes,
              textItems,
              width,
              height,
            });
            lastSavedRef.current = saved;
            lastSaveTimestampRef.current = Date.now();
          } else {
            toast.error("Failed to save before analysis");
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          toast.error("Failed to save before analysis");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSavingSnapshot(false);
          saveControllerRef.current = null;
        }
      }
    }

    setShowCheckButton(false);
    setIsAnalyzing(true);
    const texts = ["Reading your steps...", "Analyzing your work...", "Reviewing step 2...", "Almost done..."];
    for (let i = 0; i < texts.length; i++) {
      setAnalyzeText(texts[i]);
      await new Promise((r) => setTimeout(r, 800));
    }
    setIsAnalyzing(false);
    setFeedback(MOCK_FEEDBACK);
    setCurrentStep(0);
  };
  useEffect(() => {
    handleCheckStepsRef.current = handleCheckSteps;
  }, [handleCheckSteps]);

  // Simulate chat
  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    // Simulate streaming response
    await new Promise((r) => setTimeout(r, 1500));
    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "That's a great question! Looking at your work, I can see you're on the right track. Remember to double-check your signs when dividing both sides of the equation. Would you like me to walk through that step in more detail?",
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, assistantMsg]);
    setIsChatLoading(false);
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const toolbarItems: { tool: Tool; icon: React.ElementType; label: string }[] = [
    { tool: "pen", icon: PenTool, label: "Pen" },
    { tool: "highlighter", icon: Highlighter, label: "Highlighter" },
    { tool: "hand", icon: Hand, label: "Pan" },
    { tool: "text", icon: Type, label: "Text" },
  ];

  const statusIcon = (status: StepFeedback["status"]) => {
    switch (status) {
      case "correct": return <Check className="size-3.5 text-green-600" />;
      case "incorrect": return <X className="size-3.5 text-red-600" />;
      case "warning": return <AlertTriangle className="size-3.5 text-yellow-600" />;
    }
  };

  const statusBorder = (status: StepFeedback["status"]) => {
    switch (status) {
      case "correct": return "border-l-green-500";
      case "incorrect": return "border-l-red-500";
      case "warning": return "border-l-yellow-500";
    }
  };

  return (
    <div className={cn("h-full w-full bg-slate-50 flex flex-col overflow-hidden", isResizing && "select-none")}>
      {/* Main container: fills space below Top Nav (nav h-14). Left column | resizer | right column. */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left column (flex-1): whiteboard header + toolbar + canvas */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Untitled Whiteboard header (inside left column only) – Google Docs–style rename */}
          <div className="h-12 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex items-center px-4 gap-4 shrink-0 z-10">
            <Link href="/app">
              <Button variant="ghost" size="icon-sm" className="rounded-full">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={whiteboardTitle}
                  onChange={(e) => setWhiteboardTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={handleTitleKeyDown}
                  className="text-sm font-medium text-foreground bg-transparent border rounded-md px-2 py-1 min-w-[180px] max-w-[400px] w-full outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300 focus:border-blue-500"
                  placeholder={DEFAULT_WHITEBOARD_TITLE}
                  aria-label="Whiteboard title"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="text-sm font-medium text-foreground truncate text-left px-2 py-1 -ml-2 rounded-md hover:bg-slate-100 transition-colors"
                >
                  {whiteboardTitle || DEFAULT_WHITEBOARD_TITLE}
                </button>
              )}
              {!isBlank && (
                <>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full shrink-0">{problem.topic}</span>
                  <span className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < problem.difficulty ? "bg-primary" : "bg-slate-200"}`} />
                    ))}
                  </span>
                </>
              )}
              {isBlank && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full shrink-0 border border-amber-200">
                  Local scratchpad; not saved to your account
                </span>
              )}
            </div>
          </div>

          {/* Toolbar + Canvas container */}
          <div className="flex-1 flex flex-col min-h-0">
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-100">
            {toolbarItems.map((item) => (
              <Button
                key={item.tool}
                variant={tool === item.tool ? "default" : "outline"}
                size="icon"
                className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)}
                onClick={() => setTool(item.tool)}
                title={item.label}
              >
                <item.icon className="size-4" />
              </Button>
            ))}
            {/* Eraser dropdown */}
            <div ref={eraserBtnRef} className="relative">
              <Button
                variant={tool === "eraser" || tool === "eraserPartial" ? "default" : "outline"}
                className={cn("rounded-full gap-0.5 pl-3 pr-2", TOOLBAR_BUTTON_HOVER)}
                onClick={() => setShowEraserDropdown((v) => !v)}
                title="Eraser"
              >
                {tool === "eraserPartial" ? (
                  <Eraser className="size-4" />
                ) : (
                  <Eraser className="size-4" />
                )}
                <ChevronDown className="size-3 opacity-60" />
              </Button>
              {showEraserDropdown && (
                <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 w-44 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                      tool === "eraser"
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setTool("eraser");
                      setShowEraserDropdown(false);
                    }}
                  >
                    <Eraser className="size-4" />
                    Eraser
                  </button>
                  <button
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                      tool === "eraserPartial"
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setTool("eraserPartial");
                      setShowEraserDropdown(false);
                    }}
                  >
                    <Eraser className="size-4" />
                    Eraser (partial)
                  </button>
                </div>
              )}
            </div>
            {/* Shapes dropdown */}
            <div ref={shapesBtnRef} className="relative">
              <Button
                variant={tool === "line" || tool === "rectangle" || tool === "circle" || tool === "arrow" ? "default" : "outline"}
                className={cn("rounded-full gap-0.5 pl-3 pr-2", TOOLBAR_BUTTON_HOVER)}
                onClick={() => setShowShapesDropdown((v) => !v)}
                title="Shapes"
              >
                {tool === "line" ? (
                  <Minus className="size-4" />
                ) : tool === "rectangle" ? (
                  <Square className="size-4" />
                ) : tool === "circle" ? (
                  <Circle className="size-4" />
                ) : tool === "arrow" ? (
                  <ArrowRight className="size-4" />
                ) : (
                  <Square className="size-4" />
                )}
                <ChevronDown className="size-3 opacity-60" />
              </Button>
              {showShapesDropdown && (
                <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 w-44 animate-in fade-in slide-in-from-top-1 duration-150">
                  {[
                    { tool: "line" as const, icon: Minus, label: "Line" },
                    { tool: "rectangle" as const, icon: Square, label: "Rectangle" },
                    { tool: "circle" as const, icon: Circle, label: "Circle" },
                    { tool: "arrow" as const, icon: ArrowRight, label: "Arrow" },
                  ].map(({ tool: t, icon: Icon, label }) => (
                    <button
                      key={t}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                        tool === t ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-slate-50"
                      }`}
                      onClick={() => {
                        setTool(t);
                        setShowShapesDropdown(false);
                      }}
                    >
                      <Icon className="size-4" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Selection tool dropdown */}
            <div ref={selectBtnRef} className="relative">
              <Button
                variant={tool === "lasso" || tool === "selectionBox" ? "default" : "outline"}
                className={cn("rounded-full gap-0.5 pl-3 pr-2", TOOLBAR_BUTTON_HOVER)}
                onClick={() => setShowSelectDropdown((v) => !v)}
                title="Selection tools"
              >
                {tool === "lasso" ? (
                  <Lasso className="size-4" />
                ) : tool === "selectionBox" ? (
                  <BoxSelect className="size-4" />
                ) : (
                  <MousePointer2 className="size-4" />
                )}
                <ChevronDown className="size-3 opacity-60" />
              </Button>
              {showSelectDropdown && (
                <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 w-44 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                      tool === "lasso"
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setTool("lasso");
                      setShowSelectDropdown(false);
                    }}
                  >
                    <Lasso className="size-4" />
                    Lasso Tool
                  </button>
                  <button
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                      tool === "selectionBox"
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setTool("selectionBox");
                      setShowSelectDropdown(false);
                    }}
                  >
                    <BoxSelect className="size-4" />
                    Selection Box
                  </button>
                </div>
              )}
            </div>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <Button variant="outline" size="icon" className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)} onClick={undo} title="Undo" aria-label="Undo (Ctrl+Z)">
              <Undo2 className="size-4" />
            </Button>
            <Button variant="outline" size="icon" className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)} onClick={redo} title="Redo" aria-label="Redo (Ctrl+Shift+Z)">
              <Redo2 className="size-4" />
            </Button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            {/* Pen width */}
            <div className="flex items-center gap-2 mx-1">
              <input
                type="range"
                min={1}
                max={8}
                value={penWidth}
                onChange={(e) => setPenWidth(Number(e.target.value))}
                className="w-16 h-1 accent-primary"
              />
              <span className="text-xs text-muted-foreground w-3">{penWidth}</span>
            </div>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            {/* Color picker */}
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={penColor}
                onChange={(e) => setPenColor(e.target.value)}
                className="w-8 h-8 rounded-full border-2 border-slate-200 cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-full"
                title="Pen color"
              />
            </div>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <Button
              variant={showGrid ? "default" : "outline"}
              size="icon"
              className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)}
              onClick={() => setShowGrid((v) => !v)}
              title="Grid"
            >
              <Grid3X3 className="size-4" />
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
              className="hidden"
              onChange={handleInsertImage}
            />
            <Button variant="outline" size="icon" className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)} title="Insert image (JPEG, PNG, WebP, GIF)" onClick={() => imageInputRef.current?.click()}>
              <ImagePlus className="size-4" />
            </Button>
            <Button variant="outline" size="icon" className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)} title="Export" onClick={handleExport}>
              <Download className="size-4" />
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="icon-sm" className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)} title="Zoom In" aria-label="Zoom in (toward cursor)" onClick={handleZoomIn}>
              <ZoomIn className="size-3.5" />
            </Button>
            <Button variant="outline" size="icon-sm" className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)} title="Zoom Out" aria-label="Zoom out (toward cursor)" onClick={handleZoomOut}>
              <ZoomOut className="size-3.5" />
            </Button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all duration-150 active:bg-red-100"
              onClick={handleClearClick}
              title="Clear entire whiteboard"
              aria-label="Clear entire whiteboard"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          {/* Clear whiteboard confirmation dialog */}
          {showClearConfirmDialog && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-dialog-title"
              aria-describedby="clear-dialog-desc"
              onClick={(e) => e.target === e.currentTarget && handleClearConfirmNo()}
            >
              <div
                className="bg-white rounded-xl shadow-xl border border-slate-200 p-5 w-full max-w-sm mx-4"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    handleClearConfirmNo();
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    handleClearConfirmYes();
                  }
                }}
              >
                <h2 id="clear-dialog-title" className="text-base font-semibold text-foreground mb-1">
                  Clear entire whiteboard?
                </h2>
                <p id="clear-dialog-desc" className="text-sm text-muted-foreground mb-4">
                  This will permanently delete all strokes, shapes, text, and images on this whiteboard.
                </p>
                <label className="flex items-center gap-2 text-sm text-foreground mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearConfirmDontAskAgain}
                    onChange={(e) => setClearConfirmDontAskAgain(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Don&apos;t ask me this again
                </label>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={handleClearConfirmNo}>
                    No
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearConfirmYes}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Yes
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Canvas */}
          <div
            className="flex-1 relative overflow-hidden bg-white"
            style={
              showGrid && constantGridSize
                ? {
                    backgroundImage: `linear-gradient(to right, ${GRID_COLOR} 1px, transparent 1px), linear-gradient(to bottom, ${GRID_COLOR} 1px, transparent 1px)`,
                    backgroundSize: `${STATIC_GRID_SIZE_PX}px ${STATIC_GRID_SIZE_PX}px`,
                    backgroundPosition: `${pan.x}px ${pan.y}px`,
                  }
                : undefined
            }
          >
            {/* Loading overlay for initial snapshot load */}
            {isLoadingSnapshot && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="size-6 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading whiteboard...</p>
                </div>
              </div>
            )}

            {/* Saving indicator (subtle, bottom-right) */}
            {isSavingSnapshot && !isLoadingSnapshot && (
              <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-2 shadow-sm z-40 flex items-center gap-2">
                <Loader2 className="size-3.5 text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">Saving...</span>
              </div>
            )}
            {/* Problem text pinned (hidden on blank whiteboards) */}
            {!isBlank && (
              <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-3 shadow-sm z-10 max-w-xs">
                <p className="text-xs text-muted-foreground mb-1">Problem</p>
                <p className="text-sm font-medium text-foreground whitespace-pre-line">{problem.statement}</p>
              </div>
            )}

            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full z-0"
              style={{ cursor: isPanning ? "grabbing" : canvasCursor }}
              aria-label="Whiteboard drawing canvas. Use pen, shapes, or text to work. Pan with hand tool or right-click drag; zoom with scroll wheel or toolbar buttons."
              onContextMenu={(e) => e.preventDefault()}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={(e) => {
                e.preventDefault();
                const t = e.touches[0];
                if (t) handleMouseDown({ clientX: t.clientX, clientY: t.clientY } as React.MouseEvent<HTMLCanvasElement>);
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                const t = e.touches[0];
                if (t) handleMouseMove({ clientX: t.clientX, clientY: t.clientY } as React.MouseEvent<HTMLCanvasElement>);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                const t = e.changedTouches[0];
                if (t) handleMouseUp({ clientX: t.clientX, clientY: t.clientY } as React.MouseEvent<HTMLCanvasElement>);
              }}
              onTouchCancel={(e) => {
                e.preventDefault();
                handleMouseLeave();
              }}
            />

            {/* Text items as DOM overlays for hover-to-drag and click-to-edit */}
            {textItems.map((t) => {
              if (textEditState?.id === t.id) return null;
              const isHovered = hoveredTextId === t.id;
              const showOutline = (isHovered && hoveredInDragZone) || draggingTextId === t.id;
              const top = pan.y + (t.y - 14) * scale - 8;
              const left = pan.x + t.x * scale - 8;
              return (
                <div
                  key={t.id}
                  ref={(el) => {
                    if (el) textItemWrapperRefs.current.set(t.id, el);
                    else textItemWrapperRefs.current.delete(t.id);
                  }}
                  className={cn(
                    "absolute z-20 p-2",
                    draggingTextId === t.id ? "cursor-grabbing" : isHovered && hoveredInDragZone ? "cursor-move" : isHovered ? "cursor-text" : "cursor-default"
                  )}
                  style={{ left, top }}
                  onMouseMove={(e) => {
                    const hit = getTextHit(e.clientX, e.clientY);
                    if (hit && hit.id === t.id) {
                      setHoveredTextId(t.id);
                      setHoveredInDragZone(hit.inDragZone);
                    }
                  }}
                  onMouseLeave={() => {
                    if (hoveredTextId === t.id) {
                      setHoveredTextId(null);
                      setHoveredInDragZone(false);
                    }
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    const hit = getTextHit(e.clientX, e.clientY);
                    if (!hit || hit.id !== t.id) return;
                    if (hit.inDragZone) {
                      e.preventDefault();
                      e.stopPropagation();
                      setDraggingTextId(t.id);
                      dragStartRef.current = {
                        pageX: e.clientX,
                        pageY: e.clientY,
                        itemX: t.x,
                        itemY: t.y,
                      };
                      setHoveredTextId(t.id);
                      setHoveredInDragZone(true);
                    } else {
                      e.preventDefault();
                      e.stopPropagation();
                      setTextEditState({
                        x: t.x,
                        y: t.y - 14,
                        id: t.id,
                        initialText: t.text,
                      });
                    }
                  }}
                >
                  <div
                    className={cn(
                      "p-1 rounded border-2 border-dashed transition-[border-color] duration-200",
                      showOutline ? "border-blue-400/50" : "border-transparent"
                    )}
                  >
                    <div
                      ref={(el) => {
                        if (el) textItemInnerRefs.current.set(t.id, el);
                        else textItemInnerRefs.current.delete(t.id);
                      }}
                      className="whitespace-pre-wrap leading-relaxed select-none pointer-events-auto"
                      style={{
                        font: `${t.fontSize}px system-ui, -apple-system, sans-serif`,
                        color: t.color,
                      }}
                    >
                      {t.text}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Image items as draggable/resizable DOM overlays; click to select (outline + delete X + resize handle) */}
            {imageItems.map((img) => {
              const isSelected = selectedImageId === img.id;
              const showOutline = isSelected || resizingImageId === img.id;
              return (
                <div
                  key={img.id}
                  className={cn(
                    "absolute z-20 transition-[box-shadow]",
                    showOutline && "ring-2 ring-dashed ring-blue-400 ring-offset-1",
                    resizingImageId === img.id
                      ? "cursor-nwse-resize"
                      : "cursor-grab active:cursor-grabbing"
                  )}
                  style={{
                    left: pan.x + img.x * scale,
                    top: pan.y + img.y * scale,
                    width: img.width * scale,
                    height: img.height * scale,
                  }}
                  role="img"
                  aria-label={isSelected ? "Image selected; press Delete to remove" : "Click to select image"}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    if (resizingImageId === img.id) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedImageId(img.id);
                    setDraggingImageId(img.id);
                    imageDragStartRef.current = {
                      pageX: e.clientX,
                      pageY: e.clientY,
                      itemX: img.x,
                      itemY: img.y,
                    };
                  }}
                >
                  <img
                    src={img.dataUrl || ""}
                    alt=""
                    className="w-full h-full object-contain pointer-events-none select-none bg-slate-100/50"
                    draggable={false}
                  />
                  {/* Delete button: top-left, only when selected */}
                  {isSelected && (
                    <button
                      type="button"
                      className="absolute -top-1 -left-1 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 active:bg-red-700 transition-colors"
                      title="Delete image"
                      aria-label="Delete image"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setImageItems((prev) => prev.filter((i) => i.id !== img.id));
                        setSelectedImageId(null);
                        setResizingImageId(null);
                      }}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                  {/* Resize handle: bottom-right, only when selected */}
                  {isSelected && (
                    <div
                      className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize border-l-2 border-t-2 border-slate-400/80 bg-white/50 rounded-tl"
                      style={{ touchAction: "none" }}
                      title="Resize (hold Shift for free-form)"
                      aria-label="Resize image; hold Shift for free-form"
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setResizingImageId(img.id);
                        setDraggingImageId(null);
                        imageDragStartRef.current = null;
                        const aspectRatio = img.width / img.height;
                        imageResizeStartRef.current = {
                          pageX: e.clientX,
                          pageY: e.clientY,
                          itemX: img.x,
                          itemY: img.y,
                          itemW: img.width,
                          itemH: img.height,
                          aspectRatio,
                        };
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* Text tool overlay: textarea at click position (after canvas so canvas receives first click), commits on blur or Enter/Ctrl+Enter */}
            {textEditState && (
              <textarea
                key={textEditState.id ?? "new"}
                ref={textAreaRef}
                defaultValue={textEditState.initialText ?? ""}
                className="absolute z-20 outline-none border-2 border-dashed border-transparent focus:border-blue-300 focus:ring-0 bg-white/90 rounded min-w-[120px] resize-none overflow-hidden py-1 px-2 text-base leading-relaxed shadow-sm"
                style={{
                  left: pan.x + textEditState.x * scale,
                  top: pan.y + textEditState.y * scale,
                  font: "16px system-ui, -apple-system, sans-serif",
                  color: penColor,
                  minHeight: "1.5em",
                }}
                rows={1}
                placeholder="Type here..."
                onBlur={commitTextOverlay}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (e.shiftKey) {
                      // Shift+Enter: new line (default behavior)
                      return;
                    }
                    e.preventDefault();
                    commitTextOverlay();
                  } else if (e.ctrlKey && e.key === "Enter") {
                    e.preventDefault();
                    commitTextOverlay();
                  }
                }}
                onInput={(e) => {
                  const ta = e.currentTarget;
                  ta.style.height = "auto";
                  ta.style.height = `${Math.max(ta.scrollHeight, 24)}px`;
                }}
              />
            )}

            {/* Check button */}
            {showCheckButton && (
              <div className="absolute bottom-6 right-6 z-10 animate-in fade-in duration-300" role="region" aria-label="Check work">
                <Button
                  onClick={handleCheckSteps}
                  className="rounded-full shadow-lg gap-2"
                  size="lg"
                  aria-label="Check my steps (shortcut: Ctrl+Enter or Command+Enter)"
                >
                  <Check className="size-4" />
                  Check my steps
                </Button>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Resizer */}
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={handleResizeStart}
          className="w-1.5 shrink-0 cursor-col-resize bg-slate-200 hover:bg-primary/30 active:bg-primary/50 transition-colors flex-shrink-0"
        />

        {/* Right: Tutor Panel (Feedback / Chat) */}
        <div
          style={{ width: `${sidebarWidth}%` }}
          className="h-full flex flex-col bg-slate-50 border-l border-slate-200 shrink-0 min-w-0"
        >
          <Tabs defaultValue="feedback" className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-3 pb-0">
              <TabsList className="w-full">
                <TabsTrigger value="feedback" className="flex-1 text-xs">Feedback</TabsTrigger>
                <TabsTrigger value="chat" className="flex-1 text-xs">Chat</TabsTrigger>
              </TabsList>
            </div>

            {/* Feedback tab */}
            <TabsContent value="feedback" className="flex-1 flex flex-col min-h-0 px-4 pb-4">
              {isAnalyzing ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="size-6 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">{analyzeText}</p>
                </div>
              ) : feedback.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground text-center px-6">
                    Write a few steps on the board, then hit &quot;Check my steps&quot; when you&apos;re ready.
                  </p>
                </div>
              ) : (
                <>
                  {/* Step navigator */}
                  <div className="flex items-center justify-between py-3">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full"
                      disabled={currentStep === 0}
                      onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Step {currentStep + 1} of {feedback.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full"
                      disabled={currentStep === feedback.length - 1}
                      onClick={() => setCurrentStep((s) => Math.min(feedback.length - 1, s + 1))}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3">
                    {feedback.map((step, i) => (
                      <Card
                        key={step.id}
                        className={`border-l-4 ${statusBorder(step.status)} p-4 cursor-pointer transition-all ${
                          i === currentStep ? "ring-1 ring-primary/20" : ""
                        }`}
                        onClick={() => {
                          setCurrentStep(i);
                          setExpandedStep(expandedStep === i ? null : i);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{statusIcon(step.status)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-foreground">Step {step.id}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                step.status === "correct" ? "bg-green-50 text-green-700" :
                                step.status === "incorrect" ? "bg-red-50 text-red-700" :
                                "bg-yellow-50 text-yellow-700"
                              }`}>
                                {step.verdict}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">{step.latex}</p>
                            {expandedStep === i && (
                              <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <p className="text-xs text-foreground">{step.explanation}</p>
                                {step.suggestion && (
                                  <p className="text-xs text-primary">{step.suggestion}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Chat tab */}
            <TabsContent value="chat" className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] px-3.5 py-2.5 text-sm rounded-2xl ${
                        msg.role === "user"
                          ? "bg-primary text-white rounded-br-md"
                          : "bg-white border border-slate-200 text-foreground rounded-bl-md"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 text-foreground rounded-2xl rounded-bl-md px-3.5 py-2.5">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.15s]" />
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.3s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              {/* Chat input */}
              <div className="border-t border-slate-200 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChat();
                      }
                    }}
                    placeholder="Ask the tutor..."
                    rows={1}
                    className="flex-1 resize-none bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  />
                  <Button
                    size="icon"
                    className="rounded-full shrink-0"
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || isChatLoading}
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
