"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TUTOR_PERSONAS } from "@/lib/data";
import { Check } from "lucide-react";

const helpLevels = [
  "Just point out mistakes",
  "Give hints and nudges",
  "Explain fully, but only give full solutions on request",
];

export default function SettingsPage() {
  const [persona, setPersona] = useState("calm");
  const [helpLevel, setHelpLevel] = useState(2);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [penThickness, setPenThickness] = useState<"fine" | "medium" | "thick">("medium");
  const [smoothStrokes, setSmoothStrokes] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [saveHistory, setSaveHistory] = useState(true);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [saved, setSaved] = useState(false);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        {saved && (
          <span className="text-xs text-green-600 flex items-center gap-1 animate-in fade-in">
            <Check className="size-3" /> Changes saved
          </span>
        )}
      </div>

      <div className="space-y-6">
        {/* Tutor behavior */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Tutor behavior</CardTitle>
            <CardDescription>Choose how the AI tutor communicates with you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Persona</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {TUTOR_PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setPersona(p.id); showSaved(); }}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      persona === p.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Level of help</p>
              <div className="space-y-2">
                {helpLevels.map((level, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      helpLevel === i
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="helpLevel"
                      checked={helpLevel === i}
                      onChange={() => { setHelpLevel(i); showSaved(); }}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      helpLevel === i ? "border-primary" : "border-slate-300"
                    }`}>
                      {helpLevel === i && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <span className="text-sm text-foreground">{level}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Appearance & whiteboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Theme</p>
              <div className="flex gap-2">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTheme(t); showSaved(); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                      theme === t
                        ? "bg-primary text-white"
                        : "bg-white border border-slate-200 text-foreground hover:bg-slate-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Default pen thickness</p>
              <div className="flex gap-2">
                {(["fine", "medium", "thick"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setPenThickness(t); showSaved(); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                      penThickness === t
                        ? "bg-primary text-white"
                        : "bg-white border border-slate-200 text-foreground hover:bg-slate-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Smooth strokes</span>
              <Switch checked={smoothStrokes} onCheckedChange={(v) => { setSmoothStrokes(v); showSaved(); }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Subtle grid background</span>
              <Switch checked={showGrid} onCheckedChange={(v) => { setShowGrid(v); showSaved(); }} />
            </div>
          </CardContent>
        </Card>

        {/* Profile */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={showSaved}
                placeholder="Your name"
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Grade level</label>
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                onBlur={showSaved}
                placeholder="e.g., 10th grade, College freshman"
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Save history</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {saveHistory ? "Your sessions will be saved." : "Sessions may not appear in history."}
                </p>
              </div>
              <Switch checked={saveHistory} onCheckedChange={(v) => { setSaveHistory(v); showSaved(); }} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your work and chat history may be used to improve your learning experience. Data is not shared publicly. This is an educational tool, not a grading system.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
