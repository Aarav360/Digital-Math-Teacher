"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MathLiveField } from "@/components/math/mathlive";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, BookOpen, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { createNotebook } from "@/lib/api";
import { AuroraBackground } from "@/components/aurora-background";
import { applyTextbookOrdering, parseBatchProblems, type DraftNotebookProblem } from "@/lib/notebook-utils";

export default function NewNotebookPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [overallPrompt, setOverallPrompt] = useState("");
  const [singleTitle, setSingleTitle] = useState("");
  const [singlePrompt, setSinglePrompt] = useState("");
  const [batchText, setBatchText] = useState("");
  const [problems, setProblems] = useState<DraftNotebookProblem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [problemsError, setProblemsError] = useState<string | null>(null);

  const handleAddSingle = () => {
    const trimmedTitle = singleTitle.trim();
    const trimmedPrompt = singlePrompt.trim();
    if (!trimmedTitle && !trimmedPrompt) {
      toast.error("Add a title or prompt for the problem.");
      return;
    }
    setProblems((prev) => [
      ...prev,
      {
        title: trimmedTitle || `Problem ${prev.length + 1}`,
        prompt: trimmedPrompt,
      },
    ]);
    setProblemsError(null);
    setSingleTitle("");
    setSinglePrompt("");
  };

  const handleAddBatch = () => {
    const parsed = parseBatchProblems(batchText);
    if (parsed.length === 0) {
      toast.error("Add at least one problem line.");
      return;
    }
    setProblems((prev) => {
      const merged = [...prev, ...parsed];
      return applyTextbookOrdering(merged);
    });
    setProblemsError(null);
    setBatchText("");
  };

  const handleRemoveProblem = (index: number) => {
    setProblems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    const hasProblems = problems.length > 0;
    if (!trimmedTitle || !hasProblems) {
      setTitleError(!trimmedTitle ? "Please enter a notebook title." : null);
      setProblemsError(!hasProblems ? "Add at least one problem before creating the notebook." : null);
      return;
    }
    setIsSaving(true);
    const payloadProblems = problems.map((p, index) => ({
      title: p.title,
      prompt: p.prompt,
      order_index: index,
      source_metadata: p.source_ref ? { source_ref: p.source_ref } : null,
    }));
    try {
      const res = await createNotebook({
        title: trimmedTitle,
        overall_prompt: overallPrompt.trim() || null,
        problems: payloadProblems,
      });
      if (res.ok) {
        router.push(`/notebooks/${res.data.id}`);
      } else {
        toast.error(res.error || "Failed to create notebook.");
      }
    } catch {
      toast.error("Failed to create notebook.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative max-w-5xl mx-auto px-6 py-10">
      <AuroraBackground />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/app">
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Back to notebooks">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Create Notebook</h1>
            <p className="text-sm text-muted-foreground">
              Organize a homework set into clean, per-problem whiteboards.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <Card className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Notebook title</label>
              <MathLiveField
                value={title}
                onValueChange={(value) => {
                  setTitle(value.latex);
                  if (value.text.trim()) setTitleError(null);
                }}
                placeholder="Algebra Homework 2"
                className={titleError ? "border-[var(--red-500)] focus-visible:ring-[var(--red-500-40)]" : undefined}
                ariaLabel="Notebook title"
              />
              {titleError && (
                <p className="text-xs text-[var(--red-600)]">{titleError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Overall teacher prompt</label>
              <MathLiveField
                value={overallPrompt}
                onValueChange={(value) => setOverallPrompt(value.latex)}
                placeholder="Remind students to show all steps and simplify final answers."
                multiline
                ariaLabel="Overall teacher prompt"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BookOpen className="size-4" />
                Add problems
              </div>
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
                  <Button type="button" variant="secondary" onClick={handleAddSingle}>
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
                  <Button type="button" variant="secondary" onClick={handleAddBatch}>
                    <Plus className="size-4" />
                    Add problems
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Problems</p>
                <p className="text-xs text-muted-foreground">
                  {problems.length} added
                </p>
              </div>
              <Button onClick={handleCreate} disabled={isSaving} className="rounded-full">
                {isSaving ? "Creating..." : "Create notebook"}
              </Button>
            </div>
            {problemsError && (
              <p className="text-xs text-[var(--red-600)]">{problemsError}</p>
            )}

            <div
              className={`space-y-2 max-h-[420px] overflow-y-auto pr-1 ${
                problemsError ? "border border-[var(--red-500)] rounded-lg p-2" : ""
              }`}
            >
              {problems.length === 0 && (
                <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
                  No problems yet. Add a single problem or paste a batch.
                </div>
              )}
              {problems.map((problem, index) => (
                <div
                  key={`${problem.title}-${index}`}
                  className="border border-border rounded-lg p-3 bg-card flex items-start gap-3"
                >
                  <span className="text-xs text-muted-foreground mt-1">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{problem.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{problem.prompt}</p>
                  </div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => handleRemoveProblem(index)}
                    aria-label="Remove problem"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
