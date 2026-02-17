"use client";

import Link from "next/link";
import { SESSIONS } from "@/lib/data";
import { PlayCircle, Clock, BookOpen } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";

export default function HistoryPage() {
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
        {SESSIONS.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No sessions yet. Start practicing from the Problem Library.
          </div>
        ) : (
          SESSIONS.map((session) => (
            <Link
              key={session.id}
              href={`/session/${session.problemId}`}
              className="grid grid-cols-[1fr_120px_140px_100px_120px] gap-4 px-5 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors items-center group"
            >
              <span className="text-sm font-medium text-foreground truncate">{session.problemTitle}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <BookOpen className="size-3" />{session.topic}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" />
                {new Date(session.lastActivity).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full inline-flex w-fit ${
                session.status === "completed"
                  ? "bg-green-50 text-green-700"
                  : session.status === "in_progress"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {session.status === "in_progress" ? "In Progress" : session.status === "completed" ? "Completed" : "Not Started"}
              </span>
              <span className="text-xs text-muted-foreground">
                {session.stepsCorrect}/{session.stepsTotal} steps correct
              </span>
            </Link>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
