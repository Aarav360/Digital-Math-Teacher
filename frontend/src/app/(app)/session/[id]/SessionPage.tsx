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
import type { StepFeedback } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/contexts/user-context";
import { updateSessionTitle } from "@/lib/api";

import type { Tool, Point, ShapeItem, Stroke } from "./types";
import {
  DEFAULT_PEN_COLOR,
  DEFAULT_WHITEBOARD_TITLE,
  TOOLBAR_BUTTON_HOVER,
  STATIC_GRID_SIZE_PX,
  GRID_COLOR,
  WHITEBOARD_NO_CLEAR_WARNING_PREFIX,
} from "./constants";

import { useWhiteboardContent } from "./hooks/useWhiteboardContent";
import { useWhiteboardHistory } from "./hooks/useWhiteboardHistory";
import { useRedrawSignal } from "./hooks/useRedrawSignal";
import { useViewTransform } from "./hooks/useViewTransform";
import { useSession } from "./hooks/useSession";
import { useSnapshotPersistence } from "./hooks/useSnapshotPersistence";
import { useCanvasDrawing } from "./hooks/useCanvasDrawing";
import { useTextLayer } from "./hooks/useTextLayer";
import { useImageLayer } from "./hooks/useImageLayer";
import { useSelection } from "./hooks/useSelection";
import { useFeedback } from "./hooks/useFeedback";
import { useChat } from "./hooks/useChat";

export function SessionPageInner({ sessionId }: { sessionId: string }) {
  const { currentUser } = useUser();
  const router = useRouter();

  // ── Tool state ──────────────────────────────────────────────────────────
  const [tool, setTool] = useState<Tool>("pen");
  const [penColor, setPenColor] = useState(DEFAULT_PEN_COLOR);
  const [penWidth, setPenWidth] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<Point[]>([]);
  const [showGrid, setShowGrid] = useState(false);
  const [previewShape, setPreviewShape] = useState<Omit<ShapeItem, "id"> | null>(null);
  const shapeStartRef = useRef<Point | null>(null);

  // Tool dropdowns
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const [showEraserDropdown, setShowEraserDropdown] = useState(false);
  const [showShapesDropdown, setShowShapesDropdown] = useState(false);
  const selectBtnRef = useRef<HTMLDivElement>(null);
  const eraserBtnRef = useRef<HTMLDivElement>(null);
  const shapesBtnRef = useRef<HTMLDivElement>(null);

  // Sidebar + dialog state
  const [sidebarWidth, setSidebarWidth] = useState(20);
  const [isResizing, setIsResizing] = useState(false);
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState(false);
  const [clearConfirmDontAskAgain, setClearConfirmDontAskAgain] = useState(false);

  // ── Title state (declared early so handleTitleReady is stable before useSession) ─
  const [whiteboardTitle, setWhiteboardTitle] = useState(DEFAULT_WHITEBOARD_TITLE);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleBeforeEditRef = useRef(DEFAULT_WHITEBOARD_TITLE);
  const titleLoadedRef = useRef(false);
  const titleSavedRef = useRef(DEFAULT_WHITEBOARD_TITLE);

  /**
   * Callback passed to useSession — sets the canonical title from session data
   * before `problem` state is set, preserving the R4 priority order.
   */
  const handleTitleReady = useCallback((t: string) => {
    setWhiteboardTitle(t);
    titleSavedRef.current = t;
    titleLoadedRef.current = true;
  }, []);

  // ── Core hooks ───────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const content = useWhiteboardContent();
  const redraw = useRedrawSignal();
  const history = useWhiteboardHistory(content, redraw.requestRedraw);
  const view = useViewTransform(canvasRef);
  const session = useSession(sessionId, currentUser?.id, handleTitleReady);

  const persistence = useSnapshotPersistence({
    sessionId,
    content,
    session,
    resetWithSnapshot: history.resetWithSnapshot,
    requestRedraw: redraw.requestRedraw,
    currentUserId: currentUser?.id,
  });

  const text = useTextLayer({ content, view, history, redraw, penColor });
  const images = useImageLayer({ content, view, history, redraw, canvasSizeRef: persistence.canvasSizeRef });
  const selection = useSelection({ content, view, history });
  const feedback = useFeedback({
    isBlank: session.isBlank,
    currentUser,
    persistence,
  });
  const chat = useChat();

  const canvas = useCanvasDrawing({
    canvasRef,
    content,
    view,
    redraw,
    canvasSizeRef: persistence.canvasSizeRef,
    isLoadingSession: session.isLoadingSession,
    isLoadingSnapshot: persistence.isLoadingSnapshot,
    tool,
    penColor,
    penWidth,
    currentStrokeRef,
    selectedStrokeIndices: selection.selectedStrokeIndices,
    selectedShapeIndices: selection.selectedShapeIndices,
    lassoPoints: selection.lassoPoints,
    selectionBoxStartRef: selection.selectionBoxStartRef,
    selectionBoxEndRef: selection.selectionBoxEndRef,
    previewShape,
    showGrid,
  });

  // ── Title effects ────────────────────────────────────────────────────────

  // Problem-sync effect: only runs before session title has loaded (R4)
  useEffect(() => {
    if (!titleLoadedRef.current && session.problem) {
      setWhiteboardTitle(session.problem.title);
      titleBeforeEditRef.current = session.problem.title;
    }
  }, [session.problem]);

  useEffect(() => {
    if (isEditingTitle) {
      titleBeforeEditRef.current = whiteboardTitle;
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const saveTitle = useCallback(() => {
    const trimmed = whiteboardTitle.trim() || DEFAULT_WHITEBOARD_TITLE;
    setWhiteboardTitle(trimmed);
    setIsEditingTitle(false);
    if (sessionId) {
      updateSessionTitle(sessionId, trimmed)
        .then((res) => {
          if (res.ok) {
            titleSavedRef.current = trimmed;
          }
        })
        .catch((err) => {
          console.error("Failed to save title:", err);
        });
    }
  }, [whiteboardTitle, sessionId]);

  const cancelTitleEdit = useCallback(() => {
    setWhiteboardTitle(titleBeforeEditRef.current);
    setIsEditingTitle(false);
  }, []);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
      if (e.key === "Escape") { e.preventDefault(); cancelTitleEdit(); }
    },
    [saveTitle, cancelTitleEdit],
  );

  // ── Orchestrator: multi-hook operations (Guardrail 5) ───────────────────

  const handleClearAll = useCallback(() => {
    history.clearAll();
    selection.clear();
    feedback.clear();
    images.setSelectedImageId(null);
    redraw.requestRedraw();
  }, [history, selection, feedback, images, redraw]);

  const handleClearClick = useCallback(() => {
    const key = currentUser
      ? `${WHITEBOARD_NO_CLEAR_WARNING_PREFIX}${currentUser.id}-${sessionId || "blank"}`
      : null;
    if (key && typeof window !== "undefined" && window.localStorage.getItem(key)) {
      handleClearAll();
      return;
    }
    setClearConfirmDontAskAgain(false);
    setShowClearConfirmDialog(true);
  }, [currentUser, sessionId, handleClearAll]);

  const handleClearConfirmYes = useCallback(() => {
    if (clearConfirmDontAskAgain && currentUser && typeof window !== "undefined") {
      const key = `${WHITEBOARD_NO_CLEAR_WARNING_PREFIX}${currentUser.id}-${sessionId || "blank"}`;
      window.localStorage.setItem(key, "1");
    }
    handleClearAll();
    setShowClearConfirmDialog(false);
  }, [clearConfirmDontAskAgain, currentUser, sessionId, handleClearAll]);

  const handleClearConfirmNo = useCallback(() => setShowClearConfirmDialog(false), []);

  // ── Idle timer for check button ───────────────────────────────────────

  const idleTimer = useRef<NodeJS.Timeout | null>(null);
  const { strokes } = content.state;

  const resetIdleTimer = useCallback(() => {
    feedback.setShowCheckButton(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (strokes.length > 0 || currentStrokeRef.current.length > 0) {
      idleTimer.current = setTimeout(() => feedback.setShowCheckButton(true), 3000);
    }
  }, [strokes.length, feedback]);

  useEffect(() => {
    return () => {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
    };
  }, []);

  // ── Canvas mouse handlers ─────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    images.setSelectedImageId(null);
    if (e.button === 2) {
      e.preventDefault();
      view.setIsPanning(true);
      view.panStartRef.current = { x: e.clientX, y: e.clientY, panX: view.pan.x, panY: view.pan.y };
      return;
    }
    const pos = view.getPos(e.clientX, e.clientY);
    if (tool === "hand") {
      view.setIsPanning(true);
      view.panStartRef.current = { x: e.clientX, y: e.clientY, panX: view.pan.x, panY: view.pan.y };
      return;
    }
    if (tool === "text") {
      text.setTextEditState({ x: pos.x, y: pos.y });
      return;
    }
    if (tool === "lasso") {
      selection.isSelectingRef.current = true;
      selection.setLassoPoints([pos]);
      selection.setSelectedStrokeIndices(new Set());
      selection.setSelectedShapeIndices(new Set());
      return;
    }
    if (tool === "selectionBox") {
      selection.isSelectingRef.current = true;
      selection.selectionBoxStartRef.current = pos;
      selection.selectionBoxEndRef.current = pos;
      selection.setSelectedStrokeIndices(new Set());
      selection.setSelectedShapeIndices(new Set());
      return;
    }
    if (tool === "line" || tool === "rectangle" || tool === "circle" || tool === "arrow") {
      shapeStartRef.current = pos;
      setPreviewShape({ type: tool, start: pos, end: pos, color: penColor, width: penWidth });
      return;
    }
    const bounds = selection.getSelectionBounds();
    if (bounds && (selection.selectedStrokeIndices.size > 0 || selection.selectedShapeIndices.size > 0)) {
      const pad = 4;
      if (
        pos.x >= bounds.minX - pad && pos.x <= bounds.maxX + pad &&
        pos.y >= bounds.minY - pad && pos.y <= bounds.maxY + pad
      ) {
        selection.isMovingSelectionRef.current = true;
        selection.moveSelectionStartRef.current = { pageX: e.clientX, pageY: e.clientY };
        return;
      }
    }
    setIsDrawing(true);
    currentStrokeRef.current = [pos];
    resetIdleTimer();
  }, [tool, penColor, penWidth, view, text, selection, images, resetIdleTimer]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    view.lastMouseRef.current = { clientX: e.clientX, clientY: e.clientY };
    const pos = view.getPos(e.clientX, e.clientY);
    if (selection.isMovingSelectionRef.current && selection.moveSelectionStartRef.current) {
      const dx = (e.clientX - selection.moveSelectionStartRef.current.pageX) / view.scale;
      const dy = (e.clientY - selection.moveSelectionStartRef.current.pageY) / view.scale;
      selection.moveSelectionStartRef.current = { pageX: e.clientX, pageY: e.clientY };
      selection.moveSelection(dx, dy, redraw.requestRedraw);
      return;
    }
    if (!text.draggingTextId) {
      const hit = text.getTextHit(e.clientX, e.clientY);
      if (!hit) {
        text.setHoveredTextId(null);
        text.setHoveredInDragZone(false);
      }
    }
    if (view.isPanning && view.panStartRef.current) {
      view.setPan({
        x: view.panStartRef.current.panX + (e.clientX - view.panStartRef.current.x),
        y: view.panStartRef.current.panY + (e.clientY - view.panStartRef.current.y),
      });
      return;
    }
    if (shapeStartRef.current !== null && (tool === "line" || tool === "rectangle" || tool === "circle" || tool === "arrow")) {
      setPreviewShape((prev) => (prev ? { ...prev, end: pos } : null));
      return;
    }
    if (selection.isSelectingRef.current && tool === "lasso") {
      selection.setLassoPoints((prev) => [...prev, pos]);
      return;
    }
    if (selection.isSelectingRef.current && tool === "selectionBox" && selection.selectionBoxStartRef.current) {
      selection.selectionBoxEndRef.current = pos;
      redraw.requestRedraw();
      return;
    }
    if (!isDrawing) return;
    currentStrokeRef.current.push(pos);
    redraw.requestRedraw();
  }, [tool, isDrawing, view, text, selection, redraw]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = view.getPos(e.clientX, e.clientY);
    void pos;
    if (selection.isMovingSelectionRef.current) {
      selection.isMovingSelectionRef.current = false;
      selection.moveSelectionStartRef.current = null;
      return;
    }
    if (view.isPanning) {
      view.setIsPanning(false);
      view.panStartRef.current = null;
      return;
    }
    if (selection.isSelectingRef.current && tool === "lasso" && selection.lassoPoints.length >= 3) {
      selection.finalizeLassoSelection();
      return;
    }
    if (selection.isSelectingRef.current && tool === "selectionBox") {
      selection.finalizeBoxSelection();
      return;
    }
    if (tool === "line" || tool === "rectangle" || tool === "circle" || tool === "arrow") {
      if (previewShape) {
        history.addShape({ id: history.nextId(), ...previewShape });
      }
      setPreviewShape(null);
      shapeStartRef.current = null;
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    if (tool === "eraser") {
      if (currentStrokeRef.current.length > 0) {
        const eraserRadius = penWidth * 5;
        const toRemove = getStrokesUnderEraser(currentStrokeRef.current, eraserRadius, content.state.strokes);
        const removedStrokes = content.state.strokes.filter((_, i) => toRemove.has(i));
        history.deleteItems({ strokes: removedStrokes, shapes: [], textItems: [], imageItems: [] });
      }
    } else if (currentStrokeRef.current.length > 1) {
      history.addStroke({
        id: history.nextId(),
        points: [...currentStrokeRef.current],
        color: penColor,
        width: penWidth,
        tool: tool as Stroke["tool"],
      });
    }
    currentStrokeRef.current = [];
    resetIdleTimer();
  }, [tool, isDrawing, penColor, penWidth, previewShape, view, selection, history, content.state.strokes, resetIdleTimer]);

  const handleMouseLeave = useCallback(() => {
    if (selection.isMovingSelectionRef.current) {
      selection.isMovingSelectionRef.current = false;
      selection.moveSelectionStartRef.current = null;
    }
    if (view.isPanning) {
      view.setIsPanning(false);
      view.panStartRef.current = null;
    }
    selection.isSelectingRef.current = false;
    selection.selectionBoxStartRef.current = null;
    selection.selectionBoxEndRef.current = null;
    if (shapeStartRef.current !== null) {
      setPreviewShape(null);
      shapeStartRef.current = null;
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    if (tool === "eraser" && currentStrokeRef.current.length > 0) {
      const eraserRadius = penWidth * 5;
      const toRemove = getStrokesUnderEraser(currentStrokeRef.current, eraserRadius, content.state.strokes);
      const removedStrokes = content.state.strokes.filter((_, i) => toRemove.has(i));
      history.deleteItems({ strokes: removedStrokes, shapes: [], textItems: [], imageItems: [] });
    } else if (currentStrokeRef.current.length > 1) {
      history.addStroke({
        id: history.nextId(),
        points: [...currentStrokeRef.current],
        color: penColor,
        width: penWidth,
        tool: tool as Stroke["tool"],
      });
    }
    currentStrokeRef.current = [];
    resetIdleTimer();
  }, [tool, isDrawing, penColor, penWidth, view, selection, history, content.state.strokes, resetIdleTimer]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showClearConfirmDialog) return;
      const inInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "Escape") {
        images.setSelectedImageId(null);
        selection.setSelectedStrokeIndices(new Set());
        selection.setSelectedShapeIndices(new Set());
        selection.setLassoPoints([]);
        selection.selectionBoxStartRef.current = null;
        selection.selectionBoxEndRef.current = null;
        selection.isSelectingRef.current = false;
        if (isEditingTitle) cancelTitleEdit();
      } else if (!inInput && (e.key === "Backspace" || e.key === "Delete")) {
        if (images.selectedImageId) {
          e.preventDefault();
          const removedImage = content.state.imageItems.find((i) => i.id === images.selectedImageId);
          history.deleteItems({ strokes: [], shapes: [], textItems: [], imageItems: removedImage ? [removedImage] : [] });
          images.setSelectedImageId(null);
        } else {
          const { strokes: si, shapes: sh } = selection.selectionRef.current;
          if (si.size > 0 || sh.size > 0) {
            e.preventDefault();
            selection.deleteSelected();
          }
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        feedback.handleCheckStepsRef.current();
      } else if (!inInput && (e.metaKey || e.ctrlKey) && e.key === "c") {
        selection.copySelection();
      } else if (!inInput && (e.metaKey || e.ctrlKey) && e.key === "x") {
        e.preventDefault();
        selection.cutSelection();
      } else if (!inInput && (e.metaKey || e.ctrlKey) && e.key === "v") {
        e.preventDefault();
        selection.pasteSelection(persistence.canvasSizeRef);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    history, selection, images, feedback, persistence.canvasSizeRef,
    isEditingTitle, cancelTitleEdit, showClearConfirmDialog, content.state.imageItems,
  ]);

  useEffect(() => {
    if (!showClearConfirmDialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); handleClearConfirmNo(); }
      else if (e.key === "Enter") { e.preventDefault(); handleClearConfirmYes(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showClearConfirmDialog, handleClearConfirmNo, handleClearConfirmYes]);

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

  const handleBackNavigation = useCallback(async () => {
    if (sessionId && currentUser) {
      const currentTitle = whiteboardTitle.trim() || DEFAULT_WHITEBOARD_TITLE;
      if (currentTitle !== titleSavedRef.current) {
        try { await updateSessionTitle(sessionId, currentTitle); } catch { /* best effort */ }
      }
      try {
        await persistence.saveOnExit();
      } catch (err) {
        console.error("saveOnExit failed:", err);
      }
    }
    router.push("/app");
    router.refresh();
  }, [sessionId, currentUser, whiteboardTitle, persistence, router]);

  // ── Early returns ────────────────────────────────────────────────────────

  if (session.isLoadingSession) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (session.sessionError || (!session.isBlank && !session.problem && !session.isLoadingSession)) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">{session.sessionError || "Session not found"}</p>
          <Link href="/problems">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="size-3" />
              Back to Problems
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Derived display values ───────────────────────────────────────────────

  const canvasCursor =
    text.draggingTextId
      ? "grabbing"
      : tool === "hand"
        ? "grab"
        : text.hoveredInDragZone
          ? "move"
          : tool === "lasso" || tool === "selectionBox"
            ? "crosshair"
            : tool === "text"
              ? "text"
              : "crosshair";

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

  const { textItems, imageItems } = content.state;

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className={cn("h-full w-full bg-slate-50 flex flex-col overflow-hidden", isResizing && "select-none")}>
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Header */}
          <div className="h-12 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex items-center px-4 gap-4 shrink-0 z-10">
            <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={handleBackNavigation}>
              <ArrowLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={whiteboardTitle}
                  onChange={(e) => setWhiteboardTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={handleTitleKeyDown}
                  className="text-sm font-medium text-foreground bg-transparent border rounded-md px-2 py-1 min-w-[180px] max-w-[400px] w-full outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300"
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
              {!session.isBlank && session.problem && (
                <>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full shrink-0">{session.problem.topic}</span>
                  <span className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < session.problem!.difficulty ? "bg-primary" : "bg-slate-200"}`} />
                    ))}
                  </span>
                </>
              )}
              {session.isBlank && (
                <span className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs rounded-full shrink-0 border border-border">
                  Free Whiteboard
                </span>
              )}
            </div>
          </div>

          {/* Toolbar + Canvas */}
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
                  <Eraser className="size-4" />
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
                {showEraserDropdown && (
                  <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 w-44 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${tool === "eraser" ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-slate-50"}`}
                      onClick={() => { setTool("eraser"); setShowEraserDropdown(false); }}
                    >
                      <Eraser className="size-4" />
                      Eraser
                    </button>
                    <button
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${tool === "eraserPartial" ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-slate-50"}`}
                      onClick={() => { setTool("eraserPartial"); setShowEraserDropdown(false); }}
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
                  {tool === "line" ? <Minus className="size-4" /> : tool === "rectangle" ? <Square className="size-4" /> : tool === "circle" ? <Circle className="size-4" /> : tool === "arrow" ? <ArrowRight className="size-4" /> : <Square className="size-4" />}
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
                {showShapesDropdown && (
                  <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 w-44 animate-in fade-in slide-in-from-top-1 duration-150">
                    {([
                      { tool: "line" as const, icon: Minus, label: "Line" },
                      { tool: "rectangle" as const, icon: Square, label: "Rectangle" },
                      { tool: "circle" as const, icon: Circle, label: "Circle" },
                      { tool: "arrow" as const, icon: ArrowRight, label: "Arrow" },
                    ] as const).map(({ tool: t, icon: Icon, label }) => (
                      <button
                        key={t}
                        className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${tool === t ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-slate-50"}`}
                        onClick={() => { setTool(t); setShowShapesDropdown(false); }}
                      >
                        <Icon className="size-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selection dropdown */}
              <div ref={selectBtnRef} className="relative">
                <Button
                  variant={tool === "lasso" || tool === "selectionBox" ? "default" : "outline"}
                  className={cn("rounded-full gap-0.5 pl-3 pr-2", TOOLBAR_BUTTON_HOVER)}
                  onClick={() => setShowSelectDropdown((v) => !v)}
                  title="Selection tools"
                >
                  {tool === "lasso" ? <Lasso className="size-4" /> : tool === "selectionBox" ? <BoxSelect className="size-4" /> : <MousePointer2 className="size-4" />}
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
                {showSelectDropdown && (
                  <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 w-44 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${tool === "lasso" ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-slate-50"}`}
                      onClick={() => { setTool("lasso"); setShowSelectDropdown(false); }}
                    >
                      <Lasso className="size-4" />
                      Lasso Tool
                    </button>
                    <button
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${tool === "selectionBox" ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-slate-50"}`}
                      onClick={() => { setTool("selectionBox"); setShowSelectDropdown(false); }}
                    >
                      <BoxSelect className="size-4" />
                      Selection Box
                    </button>
                  </div>
                )}
              </div>

              <div className="w-px h-6 bg-slate-200 mx-1" />
              <Button variant="outline" size="icon" className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)} onClick={history.undo} title="Undo" aria-label="Undo (Ctrl+Z)">
                <Undo2 className="size-4" />
              </Button>
              <Button variant="outline" size="icon" className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)} onClick={history.redo} title="Redo" aria-label="Redo (Ctrl+Shift+Z)">
                <Redo2 className="size-4" />
              </Button>
              <div className="w-px h-6 bg-slate-200 mx-1" />
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
                ref={images.imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                className="hidden"
                onChange={images.handleInsertImage}
              />
              <Button
                variant="outline"
                size="icon"
                className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)}
                title="Insert image (JPEG, PNG, WebP, GIF)"
                onClick={() => images.imageInputRef.current?.click()}
              >
                <ImagePlus className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)}
                title="Export"
                onClick={canvas.handleExport}
              >
                <Download className="size-4" />
              </Button>
              <div className="flex-1" />
              <Button variant="outline" size="icon-sm" className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)} title="Zoom In" aria-label="Zoom in (toward cursor)" onClick={view.handleZoomIn}>
                <ZoomIn className="size-3.5" />
              </Button>
              <Button variant="outline" size="icon-sm" className={cn("rounded-full", TOOLBAR_BUTTON_HOVER)} title="Zoom Out" aria-label="Zoom out (toward cursor)" onClick={view.handleZoomOut}>
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
                    if (e.key === "Escape") { e.preventDefault(); handleClearConfirmNo(); }
                    else if (e.key === "Enter") { e.preventDefault(); handleClearConfirmYes(); }
                  }}
                >
                  <h2 id="clear-dialog-title" className="text-base font-semibold text-foreground mb-1">Clear entire whiteboard?</h2>
                  <p id="clear-dialog-desc" className="text-sm text-muted-foreground mb-4">This will permanently delete all strokes, shapes, text, and images on this whiteboard.</p>
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
                    <Button variant="outline" size="sm" onClick={handleClearConfirmNo}>No</Button>
                    <Button variant="destructive" size="sm" onClick={handleClearConfirmYes} className="bg-red-600 hover:bg-red-700">Yes</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Canvas area */}
            <div
              className="flex-1 relative overflow-hidden bg-white"
              style={
                showGrid && view.constantGridSize
                  ? {
                      backgroundImage: `linear-gradient(to right, ${GRID_COLOR} 1px, transparent 1px), linear-gradient(to bottom, ${GRID_COLOR} 1px, transparent 1px)`,
                      backgroundSize: `${STATIC_GRID_SIZE_PX}px ${STATIC_GRID_SIZE_PX}px`,
                      backgroundPosition: `${view.pan.x}px ${view.pan.y}px`,
                    }
                  : undefined
              }
            >
              {persistence.isLoadingSnapshot && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="size-6 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading whiteboard...</p>
                  </div>
                </div>
              )}
              {persistence.isSavingSnapshot && !persistence.isLoadingSnapshot && (
                <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-2 shadow-sm z-40 flex items-center gap-2">
                  <Loader2 className="size-3.5 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">Saving...</span>
                </div>
              )}
              {!session.isBlank && session.problem && (
                <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-3 shadow-sm z-10 max-w-xs pointer-events-none select-none">
                  <p className="text-xs text-muted-foreground mb-1">Problem</p>
                  <p className="text-sm font-medium text-foreground whitespace-pre-line">{session.problem.statement}</p>
                </div>
              )}

              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full z-0"
                style={{ cursor: view.isPanning ? "grabbing" : canvasCursor }}
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

              {/* Text items as DOM overlays */}
              {textItems.map((t) => {
                if (text.textEditState?.id === t.id) return null;
                const isHovered = text.hoveredTextId === t.id;
                const showOutline = (isHovered && text.hoveredInDragZone) || text.draggingTextId === t.id;
                const top = view.pan.y + (t.y - 14) * view.scale - 8;
                const left = view.pan.x + t.x * view.scale - 8;
                return (
                  <div
                    key={t.id}
                    ref={(el) => {
                      if (el) text.textItemWrapperRefs.current.set(t.id, el);
                      else text.textItemWrapperRefs.current.delete(t.id);
                    }}
                    className={cn(
                      "absolute z-20 p-2",
                      text.draggingTextId === t.id ? "cursor-grabbing" : isHovered && text.hoveredInDragZone ? "cursor-move" : isHovered ? "cursor-text" : "cursor-default",
                    )}
                    style={{ left, top }}
                    onMouseMove={(e) => {
                      const hit = text.getTextHit(e.clientX, e.clientY);
                      if (hit && hit.id === t.id) {
                        text.setHoveredTextId(t.id);
                        text.setHoveredInDragZone(hit.inDragZone);
                      }
                    }}
                    onMouseLeave={() => {
                      if (text.hoveredTextId === t.id) {
                        text.setHoveredTextId(null);
                        text.setHoveredInDragZone(false);
                      }
                    }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      const hit = text.getTextHit(e.clientX, e.clientY);
                      if (!hit || hit.id !== t.id) return;
                      if (hit.inDragZone) {
                        text.startTextDrag(t.id, e, t);
                      } else {
                        e.preventDefault();
                        e.stopPropagation();
                        text.setTextEditState({ x: t.x, y: t.y - 14, id: t.id, initialText: t.text });
                      }
                    }}
                  >
                    <div className={cn("p-1 rounded border-2 border-dashed transition-[border-color] duration-200", showOutline ? "border-blue-400/50" : "border-transparent")}>
                      <div
                        ref={(el) => {
                          if (el) text.textItemInnerRefs.current.set(t.id, el);
                          else text.textItemInnerRefs.current.delete(t.id);
                        }}
                        className="whitespace-pre-wrap leading-relaxed select-none pointer-events-auto"
                        style={{ font: `${t.fontSize}px system-ui, -apple-system, sans-serif`, color: t.color }}
                      >
                        {t.text}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Image items as draggable/resizable DOM overlays */}
              {imageItems.map((img) => {
                const isSelected = images.selectedImageId === img.id;
                const showOutline = isSelected || images.resizingImageId === img.id;
                return (
                  <div
                    key={img.id}
                    className={cn(
                      "absolute z-20 transition-[box-shadow]",
                      showOutline && "ring-2 ring-dashed ring-blue-400 ring-offset-1",
                      images.resizingImageId === img.id ? "cursor-nwse-resize" : "cursor-grab active:cursor-grabbing",
                    )}
                    style={{
                      left: view.pan.x + img.x * view.scale,
                      top: view.pan.y + img.y * view.scale,
                      width: img.width * view.scale,
                      height: img.height * view.scale,
                    }}
                    role="img"
                    aria-label={isSelected ? "Image selected; press Delete to remove" : "Click to select image"}
                    onMouseDown={(e) => images.startImageDrag(img, e)}
                  >
                    <img
                      src={img.dataUrl || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="}
                      alt=""
                      className="w-full h-full object-contain pointer-events-none select-none bg-slate-100/50"
                      draggable={false}
                    />
                    {isSelected && (
                      <button
                        type="button"
                        className="absolute -top-1 -left-1 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 active:bg-red-700 transition-colors"
                        title="Delete image"
                        aria-label="Delete image"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const removedImage = imageItems.find((i) => i.id === img.id);
                          history.deleteItems({ strokes: [], shapes: [], textItems: [], imageItems: removedImage ? [removedImage] : [] });
                          images.setSelectedImageId(null);
                        }}
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                    {isSelected && (
                      <div
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize border-l-2 border-t-2 border-slate-400/80 bg-white/50 rounded-tl"
                        style={{ touchAction: "none" }}
                        title="Resize (hold Shift for free-form)"
                        aria-label="Resize image; hold Shift for free-form"
                        onMouseDown={(e) => images.startImageResize(img, e)}
                      />
                    )}
                  </div>
                );
              })}

              {/* Text edit overlay */}
              {text.textEditState && (
                <textarea
                  key={text.textEditState.id ?? "new"}
                  ref={text.textAreaRef}
                  defaultValue={text.textEditState.initialText ?? ""}
                  className="absolute z-20 outline-none border-2 border-dashed border-transparent focus:border-blue-300 focus:ring-0 bg-white/90 rounded min-w-[120px] resize-none overflow-hidden py-1 px-2 text-base leading-relaxed shadow-sm"
                  style={{
                    left: view.pan.x + text.textEditState.x * view.scale,
                    top: view.pan.y + text.textEditState.y * view.scale,
                    font: "16px system-ui, -apple-system, sans-serif",
                    color: penColor,
                    minHeight: "1.5em",
                  }}
                  rows={1}
                  placeholder="Type here..."
                  onBlur={text.commitTextOverlay}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (e.shiftKey) return;
                      e.preventDefault();
                      text.commitTextOverlay();
                    } else if (e.ctrlKey && e.key === "Enter") {
                      e.preventDefault();
                      text.commitTextOverlay();
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
              {feedback.showCheckButton && (
                <div className="absolute bottom-6 right-6 z-10 animate-in fade-in duration-300" role="region" aria-label="Check work">
                  <Button
                    onClick={feedback.handleCheckSteps}
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
          onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); setIsResizing(true); }}
          className="w-1.5 shrink-0 cursor-col-resize bg-slate-200 hover:bg-primary/30 active:bg-primary/50 transition-colors flex-shrink-0"
        />

        {/* Right: Tutor Panel */}
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

            <TabsContent value="feedback" className="flex-1 flex flex-col min-h-0 px-4 pb-4">
              {feedback.isAnalyzing ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="size-6 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">{feedback.analyzeText}</p>
                </div>
              ) : feedback.feedback.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground text-center px-6">
                    Write a few steps on the board, then hit &quot;Check my steps&quot; when you&apos;re ready.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between py-3">
                    <Button variant="ghost" size="icon-sm" className="rounded-full" disabled={feedback.currentStep === 0} onClick={() => feedback.setCurrentStep((s) => Math.max(0, s - 1))}>
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">Step {feedback.currentStep + 1} of {feedback.feedback.length}</span>
                    <Button variant="ghost" size="icon-sm" className="rounded-full" disabled={feedback.currentStep === feedback.feedback.length - 1} onClick={() => feedback.setCurrentStep((s) => Math.min(feedback.feedback.length - 1, s + 1))}>
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {feedback.feedback.map((step, i) => (
                      <Card
                        key={step.id}
                        className={`border-l-4 ${statusBorder(step.status)} p-4 cursor-pointer transition-all ${i === feedback.currentStep ? "ring-1 ring-primary/20" : ""}`}
                        onClick={() => {
                          feedback.setCurrentStep(i);
                          feedback.setExpandedStep(feedback.expandedStep === i ? null : i);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{statusIcon(step.status)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-foreground">Step {step.id}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${step.status === "correct" ? "bg-green-50 text-green-700" : step.status === "incorrect" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>
                                {step.verdict}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">{step.latex}</p>
                            {feedback.expandedStep === i && (
                              <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <p className="text-xs text-foreground">{step.explanation}</p>
                                {step.suggestion && <p className="text-xs text-primary">{step.suggestion}</p>}
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

            <TabsContent value="chat" className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {chat.chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-3.5 py-2.5 text-sm rounded-2xl ${msg.role === "user" ? "bg-primary text-white rounded-br-md" : "bg-white border border-slate-200 text-foreground rounded-bl-md"}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chat.isChatLoading && (
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
                <div ref={chat.chatEndRef} />
              </div>
              <div className="border-t border-slate-200 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={chat.chatInput}
                    onChange={(e) => chat.setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        chat.handleSendChat();
                      }
                    }}
                    placeholder="Ask the tutor..."
                    rows={1}
                    className="flex-1 resize-none bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  />
                  <Button
                    size="icon"
                    className="rounded-full shrink-0"
                    onClick={chat.handleSendChat}
                    disabled={!chat.chatInput.trim() || chat.isChatLoading}
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

// ── Helper ────────────────────────────────────────────────────────────────────

function getStrokesUnderEraser(
  eraserPath: Point[],
  eraserRadius: number,
  strokeList: Stroke[],
): Set<number> {
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
