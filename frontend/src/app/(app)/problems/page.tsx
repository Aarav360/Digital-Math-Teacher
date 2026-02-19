"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TOPICS, PROBLEM_TYPES } from "@/lib/data";
import { getProblems, createSession, type ProblemListEntry } from "@/lib/api";
import { PlayCircle, Search, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { toast } from "sonner";

export default function ProblemsPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("All");
  const [difficulty, setDifficulty] = useState(0);
  const [type, setType] = useState("All");
  const [search, setSearch] = useState("");

  const [problems, setProblems] = useState<ProblemListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingProblemIds, setStartingProblemIds] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);

  const apiTopic = topic === "All" ? undefined : topic;
  const apiType = type === "All" ? undefined : type;
  const apiDifficulty = difficulty === 0 ? undefined : difficulty;
  const apiSearch = search.trim() || undefined;

  const fetchProblems = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    getProblems(
      { topic: apiTopic, type: apiType, difficulty: apiDifficulty, search: apiSearch },
      controller.signal
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.ok) {
          setProblems(res.data);
          if (
            res.data.length === 0 &&
            (apiTopic || apiType || apiDifficulty || apiSearch)
          ) {
            console.warn(
              "[ProblemsPage] Empty results with active filters:",
              { topic: apiTopic, type: apiType, difficulty: apiDifficulty, search: apiSearch },
              "Note: topic/type casing may not match backend seed data."
            );
          }
        } else {
          setError(res.error);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err?.message ?? "Failed to load problems");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [apiTopic, apiType, apiDifficulty, apiSearch]);

  useEffect(() => {
    fetchProblems();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchProblems]);

  const handleStart = async (problemId: string) => {
    setStartingProblemIds((prev) => new Set(prev).add(problemId));
    try {
      const res = await createSession(problemId);
      if (res.ok) {
        router.push(`/session/${res.data.id}`);
      } else {
        toast.error(res.error || "Could not start session");
        setStartingProblemIds((prev) => { const next = new Set(prev); next.delete(problemId); return next; });
      }
    } catch {
      toast.error("Could not start session");
      setStartingProblemIds((prev) => { const next = new Set(prev); next.delete(problemId); return next; });
    }
  };

  return (
    <div className="relative max-w-5xl mx-auto px-6 py-10">
      <AuroraBackground />
      <div className="relative z-10">
      <h1 className="text-2xl font-bold text-foreground mb-6">Problem Library</h1>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search problems..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
        />
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-8">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground py-1.5 w-14 shrink-0">Topic</span>
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                topic === t
                  ? "bg-primary text-white"
                  : "bg-white border border-slate-200 text-foreground hover:bg-slate-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground py-1.5 w-14 shrink-0">Level</span>
          <button
            onClick={() => setDifficulty(0)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              difficulty === 0
                ? "bg-primary text-white"
                : "bg-white border border-slate-200 text-foreground hover:bg-slate-50"
            }`}
          >
            All
          </button>
          {[1, 2, 3, 4, 5].map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                difficulty === d
                  ? "bg-primary text-white"
                  : "bg-white border border-slate-200 text-foreground hover:bg-slate-50"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground py-1.5 w-14 shrink-0">Type</span>
          {PROBLEM_TYPES.map((pt) => (
            <button
              key={pt}
              onClick={() => setType(pt)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                type === pt
                  ? "bg-primary text-white"
                  : "bg-white border border-slate-200 text-foreground hover:bg-slate-50"
              }`}
            >
              {pt}
            </button>
          ))}
        </div>
      </div>

      {/* Problem list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_80px_100px_80px] gap-4 px-5 py-3 border-b border-slate-100 text-xs font-medium text-muted-foreground">
          <span>Title</span>
          <span>Topic</span>
          <span>Level</span>
          <span>Type</span>
          <span></span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="px-5 py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading problems...
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="px-5 py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <AlertCircle className="size-5 text-red-400" />
            <p>{error}</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={fetchProblems}>
              <RotateCcw className="size-3" />
              Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && problems.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No problems match your filters.
          </div>
        )}

        {/* List */}
        {!loading && !error && problems.map((problem) => (
          <div
            key={problem.id}
            className="grid grid-cols-[1fr_120px_80px_100px_80px] gap-4 px-5 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors items-center group"
          >
            <span className="text-sm font-medium text-foreground truncate">{problem.title}</span>
            <span className="text-xs text-muted-foreground">{problem.topic}</span>
            <span className="text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${
                      i < problem.difficulty ? "bg-primary" : "bg-slate-200"
                    }`}
                  />
                ))}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">{problem.type}</span>
            <span>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity gap-1 text-xs h-7"
                disabled={startingProblemIds.has(problem.id)}
                onClick={() => handleStart(problem.id)}
              >
                {startingProblemIds.has(problem.id) ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <PlayCircle className="size-3" />
                )}
                {startingProblemIds.has(problem.id) ? "Starting..." : "Start"}
              </Button>
            </span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
