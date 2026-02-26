"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MathLiveField, MathLiveStatic } from "@/components/math/mathlive";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  BookOpen,
  GripVertical,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  addNotebookProblems,
  deleteNotebookProblem,
  getNotebook,
  reorderNotebookProblems,
  updateNotebook,
  updateNotebookProblem,
  type NotebookRead,
  type NotebookProblem,
} from "@/lib/api";
import { AuroraBackground } from "@/components/aurora-background";
import { applyTextbookOrdering, parseBatchProblems } from "@/lib/notebook-utils";
import { normalizeSessionStatus, SESSION_STATUS_COLORS, SESSION_STATUS_LABELS } from "@/lib/session-status";

export default function NotebookDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const notebookId = params.id;

  const [notebook, setNotebook] = useState<NotebookRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [singleTitle, setSingleTitle] = useState("");
  const [singlePrompt, setSinglePrompt] = useState("");
  const [batchText, setBatchText] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const problems = notebook?.problems ?? [];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getNotebook(notebookId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setNotebook(res.data);
        } else {
          setError(res.error);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load notebook");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  const statusCounts = useMemo(() => {
    const counts = {
      not_started: 0,
      in_progress: 0,
      completed: 0,
      needs_review: 0,
    };
    problems.forEach((p) => {
      const normalized = normalizeSessionStatus(p.session_status);
      counts[normalized] += 1;
    });
    return counts;
  }, [problems]);

  const handleTitleChange = (value: string) => {
    if (!notebook) return;
    setNotebook({ ...notebook, title: value });
  };

  const handleOverallPromptChange = (value: string) => {
    if (!notebook) return;
    setNotebook({ ...notebook, overall_prompt: value });
  };

  const saveNotebookMeta = useCallback(async () => {
    if (!notebook) return;
    setIsSaving(true);
    try {
      const res = await updateNotebook(notebook.id, {
        title: notebook.title,
        overall_prompt: notebook.overall_prompt,
      });
      if (!res.ok) {
        toast.error(res.error || "Failed to save notebook.");
      } else {
        setNotebook(res.data);
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to save notebook.");
    } finally {
      setIsSaving(false);
    }
  }, [notebook]);

  const handleAddSingle = async () => {
    if (!notebook) return;
    const trimmedTitle = singleTitle.trim();
    const trimmedPrompt = singlePrompt.trim();
    if (!trimmedTitle && !trimmedPrompt) {
      toast.error("Add a title or prompt for the problem.");
      return;
    }
    setIsAdding(true);
    try {
      const res = await addNotebookProblems(notebook.id, [
        {
          title: trimmedTitle || `Problem ${problems.length + 1}`,
          prompt: trimmedPrompt,
        },
      ]);
      if (res.ok) {
        setNotebook({ ...notebook, problems: [...notebook.problems, ...res.data] });
        setSingleTitle("");
        setSinglePrompt("");
      } else {
        toast.error(res.error || "Failed to add problem.");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to add problem.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddBatch = async () => {
    if (!notebook) return;
    const parsed = parseBatchProblems(batchText);
    if (parsed.length === 0) {
      toast.error("Add at least one problem line.");
      return;
    }
    setIsAdding(true);
    try {
      const ordered = applyTextbookOrdering(
        parsed.map((p) => ({
          ...p,
          source_ref: p.source_ref ?? null,
        }))
      );
      const res = await addNotebookProblems(
        notebook.id,
        ordered.map((p) => ({
          title: p.title,
          prompt: p.prompt,
          order_index: p.order_index,
          source_metadata: p.source_ref ? { source_ref: p.source_ref } : null,
        }))
      );
      if (res.ok) {
        const previous = notebook.problems;
        const merged = applyTextbookOrdering([
          ...notebook.problems.map((p) => ({
            ...p,
            source_ref: p.source_metadata?.source_ref as string | undefined,
          })),
          ...res.data.map((p) => ({
            ...p,
            source_ref: p.source_metadata?.source_ref as string | undefined,
          })),
        ]);
        const updated = merged.map((p) => ({
          ...p,
          order_index: p.order_index ?? 0,
        })) as NotebookProblem[];
        setNotebook({ ...notebook, problems: updated });
        const reorderRes = await reorderNotebookProblems(
          notebook.id,
          updated.map((p) => ({ id: p.id, order_index: p.order_index }))
        );
        if (!reorderRes.ok) {
          setNotebook({ ...notebook, problems: previous });
          toast.error(reorderRes.error || "Failed to reorder problems.");
        } else {
          setBatchText("");
        }
      } else {
        toast.error(res.error || "Failed to add problems.");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to add problems.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveProblem = async (problem: NotebookProblem) => {
    if (!notebook) return;
    const res = await deleteNotebookProblem(problem.id);
    if (res.ok) {
      setNotebook({
        ...notebook,
        problems: notebook.problems.filter((p) => p.id !== problem.id),
      });
    } else {
      toast.error(res.error || "Failed to remove problem.");
    }
  };

  const handleUpdateProblemTitle = async (problem: NotebookProblem, title: string) => {
    if (!notebook) return;
    const res = await updateNotebookProblem(problem.id, { title });
    if (res.ok) {
      setNotebook({
        ...notebook,
        problems: notebook.problems.map((p) => (p.id === problem.id ? res.data : p)),
      });
    }
  };

  const handleProblemTitleChange = (problemId: string, title: string) => {
    if (!notebook) return;
    setNotebook({
      ...notebook,
      problems: notebook.problems.map((p) =>
        p.id === problemId ? { ...p, title } : p,
      ),
    });
  };

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDrop = async (targetId: string) => {
    if (!notebook || !draggingId || draggingId === targetId) return;
    const current = [...notebook.problems];
    const fromIndex = current.findIndex((p) => p.id === draggingId);
    const toIndex = current.findIndex((p) => p.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    const reordered = current.map((p, index) => ({ ...p, order_index: index }));
    const previous = notebook.problems;
    setNotebook({ ...notebook, problems: reordered });
    try {
      const res = await reorderNotebookProblems(
        notebook.id,
        reordered.map((p) => ({ id: p.id, order_index: p.order_index }))
      );
      if (!res.ok) {
        setNotebook({ ...notebook, problems: previous });
        toast.error(res.error || "Failed to reorder problems.");
      }
    } catch (err) {
      setNotebook({ ...notebook, problems: previous });
      toast.error((err as Error).message || "Failed to reorder problems.");
    } finally {
      setDraggingId(null);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
        <Loader2 className="size-4 animate-spin" />
        Loading notebook...
      </div>
    );
  }

  if (error || !notebook) {
    return (
      <div className="flex flex-col items-center py-16 text-sm text-muted-foreground gap-3">
        <p>{error ?? "Notebook not found"}</p>
        <Button variant="ghost" onClick={() => router.push("/app")}>
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="relative max-w-6xl mx-auto px-6 py-8">
      <AuroraBackground />
      <div className="relative z-10 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/app">
            <Button variant="ghost" size="icon-sm" className="rounded-full">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notebook</h1>
            <p className="text-sm text-muted-foreground">
              {notebook.problems.length} problem{notebook.problems.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Notebook title</label>
              <MathLiveField
                value={notebook.title}
                onValueChange={(value) => handleTitleChange(value.latex)}
                onBlur={saveNotebookMeta}
                ariaLabel="Notebook title"
              />
            </div>
            <div className="flex items-center gap-2">
              {isSaving && <span className="text-xs text-muted-foreground">Saving...</span>}
              <Button variant="secondary" onClick={() => setShowAdd((v) => !v)}>
                <Plus className="size-4" />
                Add problems
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Overall teacher prompt</label>
            <MathLiveField
              value={notebook.overall_prompt ?? ""}
              onValueChange={(value) => handleOverallPromptChange(value.latex)}
              onBlur={saveNotebookMeta}
              multiline
              ariaLabel="Overall teacher prompt"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(statusCounts).map(([status, count]) => (
              <span key={status} className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                <span className={`h-2 w-2 rounded-full ${SESSION_STATUS_COLORS[status as keyof typeof SESSION_STATUS_COLORS]}`} />
                {SESSION_STATUS_LABELS[status as keyof typeof SESSION_STATUS_LABELS]} · {count}
              </span>
            ))}
          </div>

          {showAdd && (
            <div className="mt-4 border border-slate-200 rounded-xl p-4 bg-slate-50">
              <Tabs defaultValue="single">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="single">Single</TabsTrigger>
                  <TabsTrigger value="batch">Batch</TabsTrigger>
                </TabsList>
                <TabsContent value="single" className="space-y-3 pt-4">
                  <MathLiveField
                    value={singleTitle}
                    onValueChange={(value) => setSingleTitle(value.latex)}
                    placeholder="Problem title (optional)"
                    ariaLabel="Problem title"
                  />
                  <MathLiveField
                    value={singlePrompt}
                    onValueChange={(value) => setSinglePrompt(value.latex)}
                    placeholder="Problem statement"
                    multiline
                    ariaLabel="Problem statement"
                  />
                  <Button type="button" variant="secondary" onClick={handleAddSingle} disabled={isAdding}>
                    <Plus className="size-4" />
                    Add problem
                  </Button>
                </TabsContent>
                <TabsContent value="batch" className="space-y-3 pt-4">
                  <Textarea
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder={"Paste one problem per line, e.g.\n2.1: Solve x + 4 = 9\n2.2: Factor x^2 - 9"}
                    rows={6}
                  />
                  <Button type="button" variant="secondary" onClick={handleAddBatch} disabled={isAdding}>
                    <Plus className="size-4" />
                    Add problems
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {problems.map((problem) => {
            const normalized = normalizeSessionStatus(problem.session_status);
            return (
              <Card
                key={problem.id}
                className="p-4 flex items-start gap-3 border border-slate-200 bg-white"
                draggable
                onDragStart={() => handleDragStart(problem.id)}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(problem.id)}
              >
                <div className="mt-1 text-muted-foreground cursor-grab">
                  <GripVertical className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${SESSION_STATUS_COLORS[normalized]}`} />
                    <MathLiveField
                      value={problem.title}
                      onValueChange={(value) => handleProblemTitleChange(problem.id, value.latex)}
                      onBlur={() => handleUpdateProblemTitle(problem, problem.title)}
                      className="mathlive-field--inline w-full text-sm font-medium"
                      ariaLabel="Problem title"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {problem.prompt ? (
                      <MathLiveStatic latex={problem.prompt} ariaLabel="Problem prompt" />
                    ) : (
                      "No prompt provided."
                    )}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    {problem.session_id ? (
                      <Link
                        href={`/session/${problem.session_id}`}
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <BookOpen className="size-3" />
                        Open whiteboard
                      </Link>
                    ) : (
                      <span
                        className="text-muted-foreground inline-flex items-center gap-1 opacity-60"
                        aria-disabled="true"
                      >
                        <BookOpen className="size-3" />
                        No whiteboard
                      </span>
                    )}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      onClick={() => handleRemoveProblem(problem)}
                    >
                      <Trash2 className="size-3" />
                      Remove
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
