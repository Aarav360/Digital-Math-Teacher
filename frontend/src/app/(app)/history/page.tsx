"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { listSessions, type SessionListEntry } from "@/lib/api";
import { normalizeSessionStatus, SESSION_STATUS_LABELS } from "@/lib/session-status";
import { Clock, BookOpen, Loader2, AlertCircle, Plus, Variable, TrendingUp, Triangle, Grid3X3, FileText } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TEMPLATES } from "@/lib/data";
import { MathLiveStatic } from "@/components/math/mathlive";
import { normalizeLatexForDisplay } from "@/lib/latex";

const ICON_MAP: Record<string, React.ElementType> = {
  plus: Plus,
  variable: Variable,
  "trending-up": TrendingUp,
  triangle: Triangle,
  "grid-3x3": Grid3X3,
  "file-text": FileText,
};

function getTemplateForTopic(topic: string | null) {
  if (!topic) return null;
  return (
    TEMPLATES.find((t) => t.topic === topic) ??
    TEMPLATES.find((t) => t.title.toLowerCase() === topic.toLowerCase())
  );
}

function HistoryTypeIcon({ session }: { session: SessionListEntry }) {
  if (session.notebook_title) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="size-4 text-primary" />
          </div>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>
          <span className="flex items-center gap-1">
            Notebook:
            <MathLiveStatic
              latex={normalizeLatexForDisplay(session.notebook_title)}
              className="text-xs"
              ariaLabel="Notebook title"
            />
          </span>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!session.problem_id) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-8 h-8 rounded-md bg-card border border-dashed border-[var(--neutral-300)] flex items-center justify-center shrink-0">
            <Plus className="size-4 text-[var(--neutral-400)]" />
          </div>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>
          Blank Whiteboard
        </TooltipContent>
      </Tooltip>
    );
  }

  const template = getTemplateForTopic(session.topic);
  if (template) {
    const Icon = ICON_MAP[template.icon] || BookOpen;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="w-8 h-8 rounded-md border border-transparent flex items-center justify-center shrink-0"
            style={{
              borderColor: template.borderColor,
              background: template.surfaceColor,
            }}
          >
            <Icon className="size-4" style={{ color: template.color }} strokeWidth={1.6} />
          </div>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>
          {template.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="w-8 h-8 rounded-md bg-[var(--neutral-100)] flex items-center justify-center shrink-0">
      <BookOpen className="size-4 text-[var(--neutral-400)]" />
    </div>
  );
}

function statusBadge(status: string) {
  const normalized = normalizeSessionStatus(status);
  switch (normalized) {
    case "completed":
      return "bg-[var(--green-50)] text-[var(--green-700)]";
    case "needs_review":
      return "bg-[var(--rose-50)] text-[var(--rose-700)]";
    case "in_progress":
      return "bg-[var(--amber-50)] text-[var(--amber-700)]";
    default:
      return "bg-[var(--neutral-100)] text-[var(--neutral-600)]";
  }
}

function statusLabel(status: string) {
  const normalized = normalizeSessionStatus(status);
  return SESSION_STATUS_LABELS[normalized] ?? SESSION_STATUS_LABELS.not_started;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listSessions("recent", 100, true)
      .then((res) => {
        if (res.ok) {
          setSessions(res.data);
        } else {
          setError(res.error);
        }
      })
      .catch(() => setError("Failed to load history"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative max-w-5xl mx-auto px-6 py-10">
      <AuroraBackground />
      <div className="relative z-10">
      <h1 className="text-2xl font-bold text-foreground mb-6">Session History</h1>

      <div className="bg-card rounded-2xl border border-[var(--neutral-200)] shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_140px_100px_120px] gap-4 px-5 py-3 border-b border-[var(--neutral-100)] text-xs font-medium text-muted-foreground">
          <span>Problem</span>
          <span>Topic</span>
          <span>Last Activity</span>
          <span>Status</span>
          <span>Progress</span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="px-5 py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading history...
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="px-5 py-12 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="size-5 text-[var(--red-400)]" />
            <p>{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && sessions.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No sessions yet. Start practicing from the{" "}
            <Link href="/problems" className="text-primary hover:underline">
              Problem Library
            </Link>.
          </div>
        )}

        {/* List */}
        {!loading && !error && sessions.map((session) => (
          <Link
            key={session.id}
            href={`/session/${session.id}`}
            className="grid grid-cols-[1fr_120px_140px_100px_120px] gap-4 px-5 py-3.5 border-b border-[var(--neutral-50)] hover:bg-[var(--neutral-50)] transition-colors items-center group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <HistoryTypeIcon session={session} />
              <span className="text-sm font-medium text-foreground truncate">
                {session.title ?? session.problem_title ?? "Untitled"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <BookOpen className="size-3" />{session.topic ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              {new Date(session.updated_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full inline-flex w-fit ${statusBadge(session.status)}`}>
              {statusLabel(session.status)}
            </span>
            <span className="text-xs text-muted-foreground">
              {session.steps_correct ?? 0}/{session.steps_total ?? 0} steps correct
            </span>
          </Link>
        ))}
      </div>
      </div>
    </div>
  );
}
