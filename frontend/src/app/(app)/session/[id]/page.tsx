"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  PenTool, Eraser, Undo2, Redo2, Trash2, Hand, ZoomIn, ZoomOut,
  Type, ChevronLeft, ChevronRight, Send, Check, X, AlertTriangle,
  ArrowLeft, Loader2, MousePointer2, Lasso, BoxSelect, ChevronDown,
} from "lucide-react";
import { PROBLEMS, MOCK_FEEDBACK, type Problem, type StepFeedback, type ChatMessage } from "@/lib/data";
import { useParams } from "next/navigation";
import Link from "next/link";

type Tool = "pen" | "eraser" | "hand" | "text" | "lasso" | "selectionBox";
type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; width: number; tool: "pen" | "eraser" };

const COLORS = ["#1d1d1f", "#2A7BD4", "#d63031"];

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
  const isBlank = params.id === "blank";
  const problem = isBlank
    ? BLANK_PROBLEM
    : PROBLEMS.find((p) => p.id === params.id) || PROBLEMS[0];

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [penColor, setPenColor] = useState(COLORS[0]);
  const [penWidth, setPenWidth] = useState(2);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStroke = useRef<Point[]>([]);

  // Selection tool dropdown
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const selectBtnRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectBtnRef.current && !selectBtnRef.current.contains(e.target as Node)) {
        setShowSelectDropdown(false);
      }
    };
    if (showSelectDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSelectDropdown]);

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

  // Canvas drawing
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
      ctx.lineWidth = stroke.tool === "eraser" ? stroke.width * 5 : stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    }
  }, [redrawCanvas]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "hand" || tool === "text" || tool === "lasso" || tool === "selectionBox") return;
    setIsDrawing(true);
    const pos = getPos(e);
    currentStroke.current = [pos];
    resetIdleTimer();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    currentStroke.current.push(pos);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const points = currentStroke.current;
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : penColor;
    ctx.lineWidth = tool === "eraser" ? penWidth * 5 : penWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.current.length > 1) {
      setStrokes((prev) => [
        ...prev,
        { points: [...currentStroke.current], color: penColor, width: penWidth, tool: tool as "pen" | "eraser" },
      ]);
      setUndoneStrokes([]);
    }
    currentStroke.current = [];
    resetIdleTimer();
  };

  const undo = () => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoneStrokes((u) => [...u, last]);
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    setUndoneStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setStrokes((s) => [...s, last]);
      return prev.slice(0, -1);
    });
  };

  const clearAll = () => {
    setStrokes([]);
    setUndoneStrokes([]);
    setFeedback([]);
    setShowCheckButton(false);
  };

  // Simulate analysis
  const handleCheckSteps = async () => {
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
    { tool: "eraser", icon: Eraser, label: "Eraser" },
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
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="h-12 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex items-center px-4 gap-4 shrink-0 z-50">
        <Link href="/app">
          <Button variant="ghost" size="icon-sm" className="rounded-full">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-medium text-foreground truncate">{problem.title}</h1>
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
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Whiteboard */}
        <div className="flex-1 relative h-full flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-100">
            {toolbarItems.map((item) => (
              <Button
                key={item.tool}
                variant={tool === item.tool ? "default" : "outline"}
                size="icon"
                className="rounded-full"
                onClick={() => setTool(item.tool)}
                title={item.label}
              >
                <item.icon className="size-4" />
              </Button>
            ))}
            {/* Selection tool dropdown */}
            <div ref={selectBtnRef} className="relative">
              <Button
                variant={tool === "lasso" || tool === "selectionBox" ? "default" : "outline"}
                className="rounded-full gap-0.5 pl-3 pr-2"
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
            <Button variant="outline" size="icon" className="rounded-full" onClick={undo} title="Undo">
              <Undo2 className="size-4" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full" onClick={redo} title="Redo">
              <Redo2 className="size-4" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full" onClick={clearAll} title="Clear">
              <Trash2 className="size-4" />
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
            {/* Colors */}
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setPenColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    penColor === c ? "border-primary scale-110" : "border-slate-200"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex-1" />
            <Button variant="outline" size="icon-sm" className="rounded-full" title="Zoom In">
              <ZoomIn className="size-3.5" />
            </Button>
            <Button variant="outline" size="icon-sm" className="rounded-full" title="Zoom Out">
              <ZoomOut className="size-3.5" />
            </Button>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden bg-white">
            {/* Problem text pinned (hidden on blank whiteboards) */}
            {!isBlank && (
              <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-3 shadow-sm z-10 max-w-xs">
                <p className="text-xs text-muted-foreground mb-1">Problem</p>
                <p className="text-sm font-medium text-foreground whitespace-pre-line">{problem.statement}</p>
              </div>
            )}

            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            {/* Check button */}
            {showCheckButton && (
              <div className="absolute bottom-6 right-6 z-10 animate-in fade-in duration-300">
                <Button
                  onClick={handleCheckSteps}
                  className="rounded-full shadow-lg gap-2"
                  size="lg"
                >
                  <Check className="size-4" />
                  Check my steps
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Tutor Panel */}
        <div className="w-[380px] h-full flex flex-col bg-slate-50 border-l border-slate-200 shrink-0">
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
