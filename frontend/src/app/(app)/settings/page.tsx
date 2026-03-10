"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TUTOR_PERSONAS } from "@/lib/data";
import { Check } from "lucide-react";
import { getSettings, updateSettings } from "@/lib/api";

const ZOOM_SPEED_STORAGE_KEY = "whiteboard-zoom-speed";
const CONSTANT_GRID_STORAGE_KEY = "whiteboard-constant-grid-size";
const ZOOM_STEP_MIN = 1.05;
const ZOOM_STEP_MAX = 1.4;
const ZOOM_STEP_DEFAULT = 1.1;

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
  const [zoomSpeed, setZoomSpeed] = useState(ZOOM_STEP_DEFAULT);
  const [constantGridSize, setConstantGridSize] = useState(true);
  const [saveHistory, setSaveHistory] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const z = window.localStorage.getItem(ZOOM_SPEED_STORAGE_KEY);
    if (z != null) {
      const n = parseFloat(z);
      if (Number.isFinite(n) && n >= ZOOM_STEP_MIN && n <= ZOOM_STEP_MAX) setZoomSpeed(n);
    }
    const g = window.localStorage.getItem(CONSTANT_GRID_STORAGE_KEY);
    if (g != null) setConstantGridSize(g === "1" || g === "true");
  }, []);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [saved, setSaved] = useState(false);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getSettings();
      if (cancelled) return;
      if (res.ok) {
        const s = res.data;
        if (s.persona) setPersona(s.persona);
        if (typeof s.help_level === "number") setHelpLevel(s.help_level);
        if (s.theme === "light" || s.theme === "dark" || s.theme === "system") setTheme(s.theme);
        if (s.pen_thickness === "fine" || s.pen_thickness === "medium" || s.pen_thickness === "thick") {
          setPenThickness(s.pen_thickness);
        }
        if (typeof s.smooth_strokes === "boolean") setSmoothStrokes(s.smooth_strokes);
        if (typeof s.show_grid === "boolean") setShowGrid(s.show_grid);
        if (typeof s.zoom_speed === "number") setZoomSpeed(s.zoom_speed);
        if (typeof s.constant_grid_size === "boolean") setConstantGridSize(s.constant_grid_size);
        if (typeof s.save_history === "boolean") setSaveHistory(s.save_history);
        if (typeof s.name === "string") setName(s.name);
        if (typeof s.grade_level === "string") setGrade(s.grade_level);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ZOOM_SPEED_STORAGE_KEY, String(zoomSpeed));
      window.localStorage.setItem(CONSTANT_GRID_STORAGE_KEY, constantGridSize ? "1" : "0");
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      await updateSettings({
        name,
        grade_level: grade,
        persona,
        help_level: helpLevel,
        theme,
        pen_thickness: penThickness,
        smooth_strokes: smoothStrokes,
        show_grid: showGrid,
        zoom_speed: zoomSpeed,
        constant_grid_size: constantGridSize,
        save_history: saveHistory,
      });
    }, 500);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [
    loaded,
    name,
    grade,
    persona,
    helpLevel,
    theme,
    penThickness,
    smoothStrokes,
    showGrid,
    zoomSpeed,
    constantGridSize,
    saveHistory,
  ]);

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
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Zoom speed (whiteboard)</p>
              <p className="text-xs text-muted-foreground mb-2">
                How fast zoom in/out (buttons and scroll) changes the view. Slower = finer control.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground shrink-0">Slower</span>
                <input
                  type="range"
                  min={Math.round(ZOOM_STEP_MIN * 100)}
                  max={Math.round(ZOOM_STEP_MAX * 100)}
                  step={1}
                  value={Math.round(zoomSpeed * 100)}
                  onChange={(e) => {
                    const v = Math.round(Number(e.target.value)) / 100;
                    setZoomSpeed(v);
                    if (typeof window !== "undefined") window.localStorage.setItem(ZOOM_SPEED_STORAGE_KEY, String(v));
                    showSaved();
                  }}
                  className="flex-1 h-2 accent-primary"
                  aria-label="Zoom speed"
                />
                <span className="text-xs text-muted-foreground shrink-0">Faster</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Current: <strong>{zoomSpeed.toFixed(2)}×</strong> per step
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Constant grid size</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When on, the grid stays the same visual size when you zoom; when off, the grid zooms with the board.
                </p>
              </div>
              <Switch
                checked={constantGridSize}
                onCheckedChange={(v) => {
                  setConstantGridSize(v);
                  if (typeof window !== "undefined") window.localStorage.setItem(CONSTANT_GRID_STORAGE_KEY, v ? "1" : "0");
                  showSaved();
                }}
              />
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
