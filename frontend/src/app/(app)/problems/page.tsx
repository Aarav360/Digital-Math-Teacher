"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PROBLEMS, TOPICS, PROBLEM_TYPES } from "@/lib/data";
import { PlayCircle, Search } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";

export default function ProblemsPage() {
  const [topic, setTopic] = useState("All");
  const [difficulty, setDifficulty] = useState(0);
  const [type, setType] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = PROBLEMS.filter((p) => {
    if (topic !== "All" && p.topic !== topic) return false;
    if (difficulty > 0 && p.difficulty !== difficulty) return false;
    if (type !== "All" && p.type !== type) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No problems match your filters.
          </div>
        ) : (
          filtered.map((problem) => (
            <Link
              key={problem.id}
              href={`/session/${problem.id}`}
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
                <Button size="sm" variant="ghost" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity gap-1 text-xs h-7">
                  <PlayCircle className="size-3" />
                  Start
                </Button>
              </span>
            </Link>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
