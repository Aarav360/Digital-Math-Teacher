"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { listSessions, type SessionListEntry } from "@/lib/api";
import { Clock, BookOpen, Loader2, AlertCircle } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-50 text-green-700";
    case "in_progress":
    case "evaluating":
    case "feedback_ready":
      return "bg-blue-50 text-blue-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "in_progress": return "In Progress";
    case "completed": return "Completed";
    case "evaluating": return "Evaluating";
    case "feedback_ready": return "Feedback Ready";
    default: return "Not Started";
  }
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listSessions("recent", 100)
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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_140px_100px_120px] gap-4 px-5 py-3 border-b border-slate-100 text-xs font-medium text-muted-foreground">
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
            <AlertCircle className="size-5 text-red-400" />
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
            className="grid grid-cols-[1fr_120px_140px_100px_120px] gap-4 px-5 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors items-center group"
          >
            <span className="text-sm font-medium text-foreground truncate">
              {session.problem_title ?? "Untitled"}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <BookOpen className="size-3" />{session.topic ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              {new Date(session.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
