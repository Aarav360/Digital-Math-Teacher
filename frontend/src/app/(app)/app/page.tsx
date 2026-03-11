"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  AlertTriangle,
  ChevronDown,
  Loader2,
  BookOpen,
  PencilLine,
  Download,
  Trash2,
} from "lucide-react";
import { TEMPLATES, type Template } from "@/lib/data";
import { normalizeSessionStatus, SESSION_STATUS_COLORS, SESSION_STATUS_LABELS } from "@/lib/session-status";
import {
  listSessions,
  createBlankSession,
  listNotebooks,
  updateSessionTitle,
  deleteSession,
  loadSnapshot,
  type SessionListEntry,
  type NotebookListEntry,
} from "@/lib/api";
import { AuroraBackground } from "@/components/aurora-background";
import { MathLiveStatic } from "@/components/math/mathlive";
import { normalizeLatexForDisplay } from "@/lib/latex";
import { downloadSnapshotAsPng } from "@/lib/whiteboard-export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

function getTopicPalette(topic: string | null) {
  const map: Record<string, { color: string; soft: string; softest: string }> = {
    "Algebra 1": { color: "var(--topic-algebra)", soft: "var(--topic-algebra-soft)", softest: "var(--topic-algebra-softest)" },
    "Algebra 2": { color: "var(--topic-algebra)", soft: "var(--topic-algebra-soft)", softest: "var(--topic-algebra-softest)" },
    "Calc 1": { color: "var(--topic-calc)", soft: "var(--topic-calc-soft)", softest: "var(--topic-calc-softest)" },
    "Calc 2": { color: "var(--topic-calc)", soft: "var(--topic-calc-soft)", softest: "var(--topic-calc-softest)" },
    Trig: { color: "var(--topic-trig)", soft: "var(--topic-trig-soft)", softest: "var(--topic-trig-softest)" },
    "Pre-Calc": { color: "var(--topic-trig)", soft: "var(--topic-trig-soft)", softest: "var(--topic-trig-softest)" },
    "Linear Algebra": { color: "var(--topic-linear)", soft: "var(--topic-linear-soft)", softest: "var(--topic-linear-softest)" },
  };
  return map[topic ?? ""] ?? { color: "var(--muted-foreground)", soft: "var(--neutral-100)", softest: "var(--neutral-100)" };
}

/** Deterministic SVG thumbnail path + color based on session id */
function getThumbnailStyle(id: string) {
  const seed = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
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
    "M 18 58 Q 45 18 72 55 T 126 52 M 34 78 L 118 78",
    "M 20 35 Q 55 70 90 35 Q 120 10 140 35",
    "M 24 68 L 52 38 L 80 68 M 95 68 Q 118 40 140 62",
    "M 20 52 Q 48 18 76 52 T 132 52 M 36 82 L 124 82",
    "M 25 40 Q 55 10 85 40 Q 115 70 140 40",
    "M 20 70 L 60 30 L 100 70 L 140 30",
    "M 22 58 C 42 28 58 78 78 48 S 118 28 138 52",
    "M 30 75 Q 70 25 110 75 M 30 35 L 110 35",
    "M 18 62 Q 38 28 58 62 Q 78 96 98 62 Q 118 28 138 62",
  ];
  const colors = [
    "var(--palette-1)",
    "var(--palette-2)",
    "var(--palette-3)",
    "var(--palette-4)",
    "var(--palette-5)",
    "var(--palette-6)",
    "var(--palette-7)",
    "var(--palette-8)",
    "var(--palette-9)",
    "var(--palette-10)",
    "var(--palette-11)",
    "var(--palette-12)",
  ];
  return {
    path: paths[seed % paths.length],
    color: colors[seed % colors.length],
  };
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
          borderColor: template.borderColor,
          background: `linear-gradient(135deg, ${template.surfaceColor}, ${template.surfaceColorSoft})`,
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

function NotebookTemplateCard() {
  return (
    <Link href="/notebooks/new" className="group shrink-0 flex flex-col items-center">
      <div className="w-[132px] h-[96px] rounded-md border border-border bg-card flex items-center justify-center transition-all group-hover:shadow-md overflow-hidden">
        <div className="w-12 h-12 rounded-full border-2 border-border bg-card flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/5 transition-colors">
          <BookOpen className="size-6 text-muted-foreground group-hover:text-primary/70 transition-colors" />
        </div>
      </div>
      <p className="text-xs text-foreground mt-2 text-center w-[132px] truncate">
        New Notebook
      </p>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Whiteboard Thumbnail Card                                          */
/* ------------------------------------------------------------------ */

function WhiteboardCard({
  session,
  onRename,
  onDownload,
  onDelete,
}: {
  session: SessionListEntry;
  onRename: (session: SessionListEntry) => void;
  onDownload: (session: SessionListEntry) => void;
  onDelete: (session: SessionListEntry) => void;
}) {
  const { path, color: thumbColor } = getThumbnailStyle(session.id);
  const { color, soft } = getTopicPalette(session.topic);
  const displayTitle = session.title ?? session.problem_title ?? "Untitled Whiteboard";
  const normalizedStatus = normalizeSessionStatus(session.status);

  return (
    <div className="group flex flex-col">
      <Link
        href={`/session/${session.id}`}
        className="block"
      >
        {/* Thumbnail preview */}
        <div className="aspect-[4/3] rounded-t-md border border-border bg-card overflow-hidden relative transition-all group-hover:border-primary/30 group-hover:shadow-md">
          <div className="absolute top-2 left-2 z-10">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${SESSION_STATUS_COLORS[normalizedStatus]} ring-1 ring-[var(--surface-glass-80)]`} />
          </div>
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
              stroke={thumbColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
            {/* "Text" lines underneath */}
            <line x1="20" y1="88" x2="75" y2="88" stroke="var(--color-muted-foreground)" strokeWidth="1" strokeLinecap="round" opacity="0.18" />
            <line x1="20" y1="96" x2="55" y2="96" stroke="var(--color-muted-foreground)" strokeWidth="1" strokeLinecap="round" opacity="0.12" />
          </svg>

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
              style={{ backgroundColor: soft }}
            >
              <span
                className="block w-2 h-2 rounded-[2px]"
                style={{ backgroundColor: color }}
              />
            </span>
            <span className="text-[11px] text-muted-foreground">
              {normalizedStatus === "completed" ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="size-3 inline" />
                  {formatRelativeDate(session.updated_at)}
                </span>
              ) : normalizedStatus === "needs_review" ? (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="size-3 inline" />
                  {formatRelativeDate(session.updated_at)}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="size-3 inline" />
                  {formatRelativeDate(session.updated_at)}
                </span>
              )}
            </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent transition-all shrink-0 data-[state=open]:opacity-100"
              aria-label="More options"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-44 rounded-xl border-[var(--neutral-200)] bg-[var(--surface-glass-90)] backdrop-blur-md shadow-lg p-1"
          >
            <DropdownMenuItem onClick={() => onRename(session)}>
              <PencilLine className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(session)}>
              <Download className="size-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[var(--neutral-200)]" />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(session)}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notebook Card                                                      */
/* ------------------------------------------------------------------ */

function NotebookCard({ notebook }: { notebook: NotebookListEntry }) {
  const displayTitle = normalizeLatexForDisplay(notebook.title);
  return (
    <div className="group flex flex-col">
      <Link href={`/notebooks/${notebook.id}`} className="block">
        <div className="aspect-[4/3] rounded-t-md border border-border bg-card overflow-hidden relative transition-all group-hover:border-primary/30 group-hover:shadow-md">
          <div className="absolute inset-0 bg-gradient-to-br from-card via-card to-muted/40" />
          <div className="absolute top-3 left-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-2 w-2 rounded-full bg-muted-foreground/60" />
            Notebook
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <MathLiveStatic
                  latex={displayTitle}
                  className="text-sm font-medium text-foreground truncate block"
                  ariaLabel="Notebook title"
                  block
                />
                <p className="text-[11px] text-muted-foreground">
                  {notebook.problem_count} problem{notebook.problem_count === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-2 px-3 py-3 border border-t-0 border-border rounded-b-md bg-card group-hover:border-primary/30 transition-colors min-h-[58px]">
        <span className="text-[11px] text-muted-foreground flex-1">
          Updated {formatRelativeDate(notebook.updated_at)}
        </span>
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
  const [notebooks, setNotebooks] = useState<NotebookListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<SessionListEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SessionListEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameDialogRef = useRef<HTMLDivElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const lastRenameFocusRef = useRef<HTMLElement | null>(null);

  const getSessionTitle = useCallback(
    (session: SessionListEntry) => session.title ?? session.problem_title ?? "Untitled Whiteboard",
    [],
  );

  const renamePlaceholder = useMemo(
    () => (renameTarget ? getSessionTitle(renameTarget) : ""),
    [renameTarget, getSessionTitle],
  );

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([listSessions(sort, 50, false), listNotebooks()])
      .then(([sessionsRes, notebooksRes]) => {
        if (sessionsRes.ok) {
          setSessions(sessionsRes.data);
        } else {
          setError(sessionsRes.error);
        }
        if (notebooksRes.ok) {
          setNotebooks(notebooksRes.data);
        } else {
          setNotebooks([]);
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
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!renameTarget) return;
    setRenameValue(getSessionTitle(renameTarget));
    const id = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [renameTarget, getSessionTitle]);

  // Refetch when the user switches back to this tab after being in a session
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchDashboard();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchDashboard]);

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

  const handleRename = useCallback((session: SessionListEntry) => {
    lastRenameFocusRef.current = document.activeElement as HTMLElement | null;
    setRenameTarget(session);
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (!renameTarget || isRenaming) return;
    const trimmed = renameValue.trim() || "Untitled Whiteboard";
    setIsRenaming(true);
    try {
      const res = await updateSessionTitle(renameTarget.id, trimmed);
      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) => (s.id === renameTarget.id ? { ...s, title: trimmed } : s)),
        );
        setRenameTarget(null);
        lastRenameFocusRef.current?.focus?.();
      } else {
        toast.error(res.error || "Failed to rename whiteboard");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to rename whiteboard";
      toast.error(message);
    } finally {
      setIsRenaming(false);
    }
  }, [renameTarget, renameValue, isRenaming]);

  const handleRenameCancel = useCallback(() => {
    if (isRenaming) return;
    setRenameTarget(null);
    lastRenameFocusRef.current?.focus?.();
  }, [isRenaming]);

  const handleDelete = useCallback((session: SessionListEntry) => {
    setDeleteTarget(session);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await deleteSession(deleteTarget.id);
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
        setDeleteTarget(null);
        toast.success("Whiteboard deleted");
      } else {
        toast.error(res.error || "Failed to delete whiteboard");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete whiteboard";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, isDeleting]);

  const handleDeleteCancel = useCallback(() => {
    if (isDeleting) return;
    setDeleteTarget(null);
  }, [isDeleting]);

  const handleDownload = useCallback(
    async (session: SessionListEntry) => {
      const result = await loadSnapshot(session.id);
      if (!result.ok) {
        if (result.status === 404) {
          toast.error("No snapshot to download yet");
        } else {
          toast.error(result.error || "Failed to download snapshot");
        }
        return;
      }
      const title = getSessionTitle(session);
      const safeName = title
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase();
      const filename = safeName ? `${safeName}.png` : "whiteboard.png";
      try {
        await downloadSnapshotAsPng(result.data, filename);
      } catch {
        toast.error("Failed to download snapshot");
      }
    },
    [getSessionTitle],
  );

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
            <NotebookTemplateCard />
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
              onClick={fetchDashboard}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && sessions.length === 0 && notebooks.length === 0 && (
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
        {!loading && !error && (sessions.length > 0 || notebooks.length > 0) && view === "grid" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {notebooks.map((notebook) => (
              <NotebookCard key={notebook.id} notebook={notebook} />
            ))}
            {sessions.map((session) => (
              <WhiteboardCard
                key={session.id}
                session={session}
                onRename={handleRename}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* List view */}
        {!loading && !error && (sessions.length > 0 || notebooks.length > 0) && view === "list" && (
          <div className="border border-border rounded-md bg-card divide-y divide-border">
            {notebooks.map((notebook) => (
              <Link
                key={notebook.id}
                href={`/notebooks/${notebook.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-md shrink-0 bg-primary/10">
                  <BookOpen className="size-4 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <MathLiveStatic
                    latex={normalizeLatexForDisplay(notebook.title)}
                    className="text-sm font-medium text-foreground truncate block"
                    ariaLabel="Notebook title"
                    block
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Notebook • {notebook.problem_count} problem{notebook.problem_count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-muted-foreground w-20 text-right">
                    {formatRelativeDate(notebook.updated_at)}
                  </span>
                </div>
              </Link>
            ))}
            {sessions.map((session) => {
              const { color, softest } = getTopicPalette(session.topic);
              const normalizedStatus = normalizeSessionStatus(session.status);
              return (
                <Link
                  key={session.id}
                  href={`/session/${session.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md shrink-0"
                    style={{ backgroundColor: softest }}
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
                    <span className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${SESSION_STATUS_COLORS[normalizedStatus]}`} />
                      {SESSION_STATUS_LABELS[normalizedStatus]}
                    </span>
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

      {renameTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-40)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-dialog-title"
          aria-describedby="rename-dialog-desc"
          onClick={(e) => e.target === e.currentTarget && handleRenameCancel()}
        >
          <div
            className="bg-card rounded-2xl shadow-xl border border-[var(--neutral-200)] p-5 w-full max-w-md mx-4"
            ref={renameDialogRef}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); handleRenameCancel(); }
              else if (e.key === "Enter") { e.preventDefault(); handleRenameConfirm(); }
              else if (e.key === "Tab") {
                const container = renameDialogRef.current;
                if (!container) return;
                const focusables = Array.from(
                  container.querySelectorAll<HTMLElement>(
                    "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
                  ),
                ).filter((el) => !el.hasAttribute("disabled"));
                if (focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <h2 id="rename-dialog-title" className="text-base font-semibold text-foreground mb-1">Rename</h2>
            <p id="rename-dialog-desc" className="text-sm text-muted-foreground mb-4">
              Please enter a new name for the item:
            </p>
            <Input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={renamePlaceholder}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={handleRenameCancel} disabled={isRenaming}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleRenameConfirm} disabled={isRenaming}>
                {isRenaming ? "Saving..." : "OK"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-40)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onClick={(e) => e.target === e.currentTarget && handleDeleteCancel()}
        >
          <div
            className="bg-card rounded-2xl shadow-xl border border-[var(--neutral-200)] p-5 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); handleDeleteCancel(); }
              else if (e.key === "Enter" && document.activeElement === deleteButtonRef.current) {
                e.preventDefault();
                handleDeleteConfirm();
              }
            }}
          >
            <h2 id="delete-dialog-title" className="text-base font-semibold text-foreground mb-1">Delete whiteboard?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete &quot;{getSessionTitle(deleteTarget)}&quot; and its history.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleDeleteCancel} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                ref={deleteButtonRef}
                variant="destructive"
                size="sm"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
