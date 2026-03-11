"use client";

import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TOPICS, PROBLEM_TYPES } from "@/lib/data";
import { getProblems, createSession, type ProblemListEntry } from "@/lib/api";
import { PlayCircle, Search, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { toast } from "sonner";

type FilterGroup = "topic" | "level" | "type";
type FilterState = {
  topic: string[];
  level: string[];
  type: string[];
};
type FilterAction =
  | { type: "SELECT"; group: FilterGroup; value: string; shift: boolean }
  | { type: "RESET_GROUP"; group: FilterGroup }
  | { type: "INIT_FROM_URL"; payload: FilterState };

const defaultFilterState: FilterState = {
  topic: ["ALL"],
  level: ["ALL"],
  type: ["ALL"],
};

const ALGEBRA_TOPICS = ["Algebra 1", "Algebra 2"];
const CALCULUS_TOPICS = ["Calc 1", "Calc 2", "Calc 3"];

function getInitialFilterStateFromUrl(searchParams: URLSearchParams | null): FilterState {
  if (!searchParams) return defaultFilterState;
  const topicParam = searchParams.get("topic");
  if (!topicParam || topicParam === "Any") return defaultFilterState;
  const topic = (topicParam ?? "").trim();
  if (!topic) return defaultFilterState;
  const topicList =
    topic === "Algebra 1"
      ? ALGEBRA_TOPICS
      : topic === "Calc 1"
        ? CALCULUS_TOPICS
        : [topic];
  return {
    topic: topicList,
    level: ["ALL"],
    type: ["ALL"],
  };
}

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "INIT_FROM_URL":
      return action.payload;
    case "SELECT": {
      const { group, value, shift } = action;
      const current = state[group];

      if (!shift) {
        return { ...state, [group]: [value] };
      }

      if (value === "ALL") {
        return { ...state, [group]: ["ALL"] };
      }

      if (current.includes("ALL")) {
        return { ...state, [group]: [value] };
      }

      if (current.includes(value)) {
        const next = current.filter((v) => v !== value);
        return { ...state, [group]: next.length ? next : ["ALL"] };
      }

      return { ...state, [group]: [...current, value] };
    }
    case "RESET_GROUP":
      return { ...state, [action.group]: ["ALL"] };
    default:
      return state;
  }
}

export default function ProblemsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, dispatch] = useReducer(
    filterReducer,
    getInitialFilterStateFromUrl(searchParams)
  );
  const prevParamsRef = useRef(searchParams.toString());
  useEffect(() => {
    const current = searchParams.toString();
    if (current !== prevParamsRef.current) {
      prevParamsRef.current = current;
      dispatch({
        type: "INIT_FROM_URL",
        payload: getInitialFilterStateFromUrl(searchParams),
      });
    }
  }, [searchParams]);

  const [search, setSearch] = useState("");

  const [problems, setProblems] = useState<ProblemListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingProblemIds, setStartingProblemIds] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);

  const apiSearch = search.trim() || undefined;

  const fetchProblems = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    getProblems({ search: apiSearch }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.ok) {
          setProblems(res.data);
          if (res.data.length === 0 && apiSearch) {
            console.warn("[ProblemsPage] Empty results with search:", apiSearch);
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
  }, [apiSearch]);

  useEffect(() => {
    fetchProblems();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchProblems]);

  let filtered = problems;
  if (!filters.topic.includes("ALL")) {
    filtered = filtered.filter((p) => filters.topic.includes(p.topic));
  }
  if (!filters.level.includes("ALL")) {
    filtered = filtered.filter((p) => filters.level.includes(String(p.difficulty)));
  }
  if (!filters.type.includes("ALL")) {
    filtered = filtered.filter((p) => filters.type.includes(p.type));
  }

  function handleChipClick(
    group: FilterGroup,
    value: string,
    event: React.MouseEvent
  ) {
    dispatch({ type: "SELECT", group, value, shift: event.shiftKey });
  }

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
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-[var(--neutral-200)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
        />
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-8">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground py-1.5 w-14 shrink-0">Topic</span>
          {TOPICS.map((t) => {
            const value = t === "All" ? "ALL" : t;
            const selected = filters.topic.includes(value);
            return (
              <button
                key={t}
                onClick={(e) => handleChipClick("topic", value, e)}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-[var(--neutral-200)] text-foreground hover:bg-[var(--neutral-50)]"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground py-1.5 w-14 shrink-0">Level</span>
          <button
            onClick={(e) => handleChipClick("level", "ALL", e)}
            aria-pressed={filters.level.includes("ALL")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filters.level.includes("ALL")
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-[var(--neutral-200)] text-foreground hover:bg-[var(--neutral-50)]"
            }`}
          >
            All
          </button>
          {[1, 2, 3, 4, 5].map((d) => {
            const value = String(d);
            const selected = filters.level.includes(value);
            return (
              <button
                key={d}
                onClick={(e) => handleChipClick("level", value, e)}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-[var(--neutral-200)] text-foreground hover:bg-[var(--neutral-50)]"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground py-1.5 w-14 shrink-0">Type</span>
          {PROBLEM_TYPES.map((pt) => {
            const value = pt === "All" ? "ALL" : pt;
            const selected = filters.type.includes(value);
            return (
              <button
                key={pt}
                onClick={(e) => handleChipClick("type", value, e)}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-[var(--neutral-200)] text-foreground hover:bg-[var(--neutral-50)]"
                }`}
              >
                {pt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Problem list */}
      <div className="bg-card rounded-2xl border border-[var(--neutral-200)] shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_80px_100px_80px] gap-4 px-5 py-3 border-b border-[var(--neutral-100)] text-xs font-medium text-muted-foreground">
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
            <AlertCircle className="size-5 text-[var(--red-400)]" />
            <p>{error}</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={fetchProblems}>
              <RotateCcw className="size-3" />
              Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No problems match your filters.
          </div>
        )}

        {/* List */}
        {!loading && !error && filtered.map((problem) => (
          <div
            key={problem.id}
            className="grid grid-cols-[1fr_120px_80px_100px_80px] gap-4 px-5 py-3.5 border-b border-[var(--neutral-50)] hover:bg-[var(--neutral-50)] transition-colors items-center group"
          >
            <span className="text-sm font-medium text-foreground truncate">{problem.title}</span>
            <span className="text-xs text-muted-foreground">{problem.topic}</span>
            <span className="text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${
                      i < problem.difficulty ? "bg-primary" : "bg-[var(--neutral-200)]"
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
