"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Variable,
  TrendingUp,
  Triangle,
  Grid3X3,
  FileText,
  LayoutGrid,
  List,
  MoreVertical,
  Clock,
  CheckCircle2,
  Pencil,
  ChevronDown,
  Loader2,
  BookOpen,
} from "lucide-react";
import { TEMPLATES, type Template } from "@/lib/data";
import { listSessions, createBlankSession, type SessionListEntry } from "@/lib/api";
import { AuroraBackground } from "@/components/aurora-background";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<string, React.ElementType> = {
  plus: Plus,
  variable: Variable,
  "trending-up": TrendingUp,
  triangle: Triangle,
  "grid-3x3": Grid3X3,
  "file-text": FileText,
};

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTopicColor(topic: string | null) {
  const map: Record<string, string> = {
    "Algebra 1": "#2A7BD4",
    "Algebra 2": "#2A7BD4",
    "Calc 1": "#34c759",
    "Calc 2": "#34c759",
    Trig: "#ff9500",
    "Pre-Calc": "#ff9500",
    "Linear Algebra": "#af52de",
  };
  return (topic && map[topic]) || "#6e6e73";
}

/** Deterministic SVG thumbnail path based on session id */
function getThumbnailPath(id: string) {
  const seed = id.charCodeAt(id.length - 1);
  const paths = [
    "M 20 60 Q 40 20 60 50 T 100 40 T 140 55",
    "M 15 70 L 45 30 L 75 70 M 85 35 Q 105 70 125 35",
    "M 20 50 C 30 20 50 80 70 45 S 110 30 130 55",
    "M 25 65 L 55 25 M 55 25 L 85 65 M 95 25 L 95 65 L 130 25",
    "M 20 55 Q 50 15 80 55 Q 110 95 140 55",
    "M 25 40 L 45 40 L 35 65 M 60 35 Q 75 65 90 35 M 100 40 L 120 55 L 140 40",
    "M 15 50 C 35 20 55 80 75 50 M 85 30 L 85 70 M 95 50 L 135 50",
    "M 20 60 Q 35 30 50 60 Q 65 90 80 60 M 90 35 L 110 65 L 130 35",
    "M 25 55 L 60 25 L 95 55 L 130 25",
    "M 20 45 Q 45 15 70 45 T 120 45 M 30 65 L 110 65",
  ];
  return paths[seed % paths.length];
}

/* ------------------------------------------------------------------ */
/*  Template Card                                                      */
/* ------------------------------------------------------------------ */

function TemplateCard({
  template,
  onCreateBlank,
  isCreatingBlank,
}: {
  template: Template;
  onCreateBlank: () => void;
  isCreatingBlank: boolean;
}) {
  const Icon = ICON_MAP[template.icon] || Plus;
  const isBlank = template.id === "t1";
  const href = `/problems?topic=${encodeURIComponent(template.topic)}`;

  if (isBlank) {
    return (
      <button
        type="button"
        onClick={onCreateBlank}
        disabled={isCreatingBlank}
        className="group shrink-0 flex flex-col items-center disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <div className="w-[132px] h-[96px] rounded-md border border-border bg-card flex items-center justify-center transition-all group-hover:shadow-md overflow-hidden">
          {isCreatingBlank ? (
            <Loader2 className="size-6 text-muted-foreground/50 animate-spin" />
          ) : (
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center group-hover:border-primary/50 transition-colors">
              <Plus className="size-6 text-muted-foreground/50 group-hover:text-primary/60 transition-colors" />
            </div>
          )}
        </div>
        <p className="text-xs text-foreground mt-2 text-center w-[132px] truncate">
          {template.title}
        </p>
      </button>
    );
  }

  return (
    <Link href={href} className="group shrink-0 flex flex-col items-center">
      <div
        className="w-[132px] h-[96px] rounded-md border border-border bg-card flex items-center justify-center transition-all group-hover:shadow-md overflow-hidden"
        style={{
          borderColor: `${template.color}40`,
          background: `linear-gradient(135deg, ${template.color}08, ${template.color}04)`,
        }}
      >
        <Icon
          className="size-7 transition-transform group-hover:scale-110"
          style={{ color: template.color }}
          strokeWidth={1.5}
        />
      </div>
      <p className="text-xs text-foreground mt-2 text-center w-[132px] truncate">
        {template.title}
      </p>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Whiteboard Thumbnail Card                                          */
/* ------------------------------------------------------------------ */

function WhiteboardCard({ session }: { session: SessionListEntry }) {
  const path = getThumbnailPath(session.id);
  const color = getTopicColor(session.topic);
  const displayTitle = session.title ?? session.problem_title ?? "Untitled Whiteboard";
  const isInProgress = session.status === "in_progress" || session.status === "not_started";

  return (
    <div className="group flex flex-col">
      <Link
        href={`/session/${session.id}`}
        className="block"
      >
        {/* Thumbnail preview */}
        <div className="aspect-[4/3] rounded-t-md border border-border bg-card overflow-hidden relative transition-all group-hover:border-primary/30 group-hover:shadow-md">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 160 120"
            preserveAspectRatio="none"
          >
            {/* Faint grid dots */}
            {Array.from({ length: 6 }).map((_, row) =>
              Array.from({ length: 8 }).map((_, col) => (
                <circle
                  key={`${row}-${col}`}
                  cx={10 + col * 20}
                  cy={10 + row * 20}
                  r="0.6"
                  fill="var(--color-border)"
                />
              ))
            )}
            {/* Math strokes */}
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
            {/* "Text" lines underneath */}
            <line x1="20" y1="88" x2="75" y2="88" stroke="var(--color-muted-foreground)" strokeWidth="1" strokeLinecap="round" opacity="0.18" />
            <line x1="20" y1="96" x2="55" y2="96" stroke="var(--color-muted-foreground)" strokeWidth="1" strokeLinecap="round" opacity="0.12" />
          </svg>

          {isInProgress && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-medium px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              <Pencil className="size-2.5" />
              Editing
            </div>
          )}

          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>

      {/* Bottom info bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border border-t-0 border-border rounded-b-md bg-card group-hover:border-primary/30 transition-colors">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground truncate leading-tight">
            {displayTitle}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="inline-block w-4 h-4 rounded-sm flex items-center justify-center"
              style={{ backgroundColor: `${color}18` }}
            >
              <span
                className="block w-2 h-2 rounded-[2px]"
                style={{ backgroundColor: color }}
              />
            </span>
            <span className="text-[11px] text-muted-foreground">
              {isInProgress ? (
                <span className="flex items-center gap-1">
                  <Clock className="size-3 inline" />
                  {formatRelativeDate(session.updated_at)}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="size-3 inline" />
                  {formatRelativeDate(session.updated_at)}
                </span>
              )}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent transition-all shrink-0"
          aria-label="More options"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <MoreVertical className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sort options                                                       */
/* ------------------------------------------------------------------ */

type SortOption = "recent" | "name" | "topic";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<SortOption>("recent");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isCreatingBlank, setIsCreatingBlank] = useState(false);

  const [sessions, setSessions] = useState<SessionListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(() => {
    setLoading(true);
    setError(null);
    listSessions(sort)
      .then((res) => {
        if (res.ok) {
          setSessions(res.data);
        } else {
          setError(res.error);
        }
      })
      .catch(() => {
        setError("Failed to load sessions");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sort]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Refetch when the user switches back to this tab after being in a session
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchSessions();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchSessions]);

  const handleCreateBlank = useCallback(async () => {
    if (isCreatingBlank) return;
    setIsCreatingBlank(true);
    try {
      const res = await createBlankSession();
      if (res.ok) {
        router.push(`/session/${res.data.id}`);
        // Don't reset isCreatingBlank on success — navigation unmounts this component
      } else {
        toast.error("Failed to create whiteboard");
        setIsCreatingBlank(false);
      }
    } catch {
      toast.error("Failed to create whiteboard");
      setIsCreatingBlank(false);
    }
  }, [isCreatingBlank, router]);

  const sortLabels: Record<SortOption, string> = {
    recent: "Last opened",
    name: "Name",
    topic: "Topic",
  };

  return (
    <div className="relative flex flex-col min-h-0">
      <AuroraBackground />
      {/* ── Templates section ── */}
      <section className="relative z-10 bg-secondary/50 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">
            Start a new whiteboard
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
            {TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onCreateBlank={handleCreateBlank}
                isCreatingBlank={isCreatingBlank}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Recent whiteboards ── */}
      <section className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 flex-1">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-medium text-foreground">
            Recent whiteboards
          </h2>

          <div className="flex items-center gap-3">
            {/* Sort dropdown */}
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowSortMenu((v) => !v)}
              >
                {sortLabels[sort]}
                <ChevronDown className="size-3" />
              </button>
              {showSortMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSortMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg z-20 py-1 min-w-[120px]">
                    {(["recent", "name", "topic"] as SortOption[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          sort === opt
                            ? "text-primary font-medium bg-primary/5"
                            : "text-foreground hover:bg-accent"
                        }`}
                        onClick={() => {
                          setSort(opt);
                          setShowSortMenu(false);
                        }}
                      >
                        {sortLabels[opt]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-0.5 bg-secondary rounded-md p-0.5">
              <button
                type="button"
                className={`p-1.5 rounded transition-colors ${
                  view === "grid"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Grid view"
                onClick={() => setView("grid")}
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                type="button"
                className={`p-1.5 rounded transition-colors ${
                  view === "list"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="List view"
                onClick={() => setView("list")}
              >
                <List className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
            <Loader2 className="size-4 animate-spin" />
            Loading whiteboards...
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center py-16 text-sm text-muted-foreground gap-3">
            <p>{error}</p>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={fetchSessions}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && sessions.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <BookOpen className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No whiteboards yet</p>
            <p className="text-xs text-muted-foreground/70 mb-4">
              Start one from the templates above or the{" "}
              <Link href="/problems" className="text-primary hover:underline">
                Problem Library
              </Link>
            </p>
          </div>
        )}

        {/* Grid view */}
        {!loading && !error && sessions.length > 0 && view === "grid" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sessions.map((session) => (
              <WhiteboardCard key={session.id} session={session} />
            ))}
          </div>
        )}

        {/* List view */}
        {!loading && !error && sessions.length > 0 && view === "list" && (
          <div className="border border-border rounded-md bg-card divide-y divide-border">
            {sessions.map((session) => {
              const color = getTopicColor(session.topic);
              const isInProgress = session.status === "in_progress" || session.status === "not_started";
              return (
                <Link
                  key={session.id}
                  href={`/session/${session.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md shrink-0"
                    style={{ backgroundColor: `${color}14` }}
                  >
                    <span
                      className="block w-3 h-3 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {session.title ?? session.problem_title ?? "Untitled Whiteboard"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {session.topic ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {isInProgress ? (
                      <span className="text-[11px] text-primary font-medium flex items-center gap-1">
                        <Pencil className="size-3" />
                        In progress
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        Done
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground w-16 text-right">
                      {formatRelativeDate(session.updated_at)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
