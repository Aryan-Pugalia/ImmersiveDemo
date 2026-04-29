/**
 * VideoObjectTracking.tsx  — Tracking Through Obstacles (Gaming AI)
 * 4-stage pipeline: AI Output → Human Annotation → QA Review → Delivered
 * Video has AI tracking overlay baked in. Canvas is used only for human annotations.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Play, Pause, SkipBack, SkipForward,
  Check, RefreshCw, Target, Layers, Activity, ZapOff, RotateCcw,
  Crosshair, ShieldAlert, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/context/ThemeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 1 | 2 | 3 | 4;

type EventType =
  | "partial_occlusion"
  | "full_occlusion"
  | "reappearance"
  | "re_identification"
  | "tracking_failure"
  | "tracking_recovery";

interface Annotation {
  id:        string;
  bbox:      [number, number, number, number]; // normalised [x,y,w,h]
  eventType: EventType;
  frame:     number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VIDEO_SRC = "/videos/cs-game-tracking.mp4";

const ACCENT = "#7c3aed";

const EVENT_TYPES: { id: EventType; label: string; color: string }[] = [
  { id: "partial_occlusion",  label: "Partial Occlusion",  color: "#f59e0b" },
  { id: "full_occlusion",     label: "Full Occlusion",     color: "#f97316" },
  { id: "reappearance",       label: "Reappearance",       color: "#22c55e" },
  { id: "re_identification",  label: "Re-Identification",  color: "#3b82f6" },
  { id: "tracking_failure",   label: "Tracking Failure",   color: "#ef4444" },
  { id: "tracking_recovery",  label: "Tracking Recovery",  color: "#a855f7" },
];

const STEPS = [
  { n: 1 as Stage, label: "AI Output"  },
  { n: 2 as Stage, label: "Annotate"   },
  { n: 3 as Stage, label: "QA Review"  },
  { n: 4 as Stage, label: "Delivered"  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

// ─── Progress Stepper ─────────────────────────────────────────────────────────

function ProgressStepper({ stage }: { stage: Stage }) {
  return (
    <div className="flex items-center justify-center py-4">
      {STEPS.map((step, i) => {
        const done = stage > step.n, current = stage === step.n;
        return (
          <div key={step.n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                done    ? "bg-violet-600 border-violet-600 text-white" :
                current ? "border-violet-500 text-violet-400 ring-4 ring-violet-900/40" :
                          "border-white/10 text-white/30"
              }`} style={{ background: done ? ACCENT : current ? "rgba(124,58,237,0.15)" : "var(--s4)" }}>
                {done ? <Check size={16} /> : step.n}
              </div>
              <span className={`mt-1 text-sm font-semibold whitespace-nowrap ${
                current ? "text-violet-400" : done ? "text-foreground/60" : "text-foreground/30"
              }`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mx-1 mb-6 ${stage > step.n ? "bg-violet-600" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared video controls bar ────────────────────────────────────────────────

function VideoControls({
  videoRef, currentTime, duration, isPlaying,
  onPlayPause, onStep,
}: {
  videoRef:    React.RefObject<HTMLVideoElement>;
  currentTime: number;
  duration:    number;
  isPlaying:   boolean;
  onPlayPause: () => void;
  onStep:      (dir: 1 | -1) => void;
}) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (videoRef.current) videoRef.current.currentTime = ratio * duration;
  };

  return (
    <div className="flex flex-col gap-2 px-1">
      {/* Scrubber */}
      <div className="relative h-2 rounded-full cursor-pointer" style={{ background: "var(--s6)" }} onClick={seek}>
        <div className="absolute top-0 left-0 h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT }} />
        <div className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg"
          style={{ left: `${pct}%`, transform: "translate(-50%,-50%)", background: ACCENT }} />
      </div>
      {/* Buttons */}
      <div className="flex items-center gap-2">
        <button onClick={() => onStep(-1)} className="p-2 rounded-lg border border-border hover:border-violet-500 text-foreground/70 transition">
          <SkipBack size={14} />
        </button>
        <button onClick={onPlayPause}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition"
          style={{ background: ACCENT }}>
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button onClick={() => onStep(1)} className="p-2 rounded-lg border border-border hover:border-violet-500 text-foreground/70 transition">
          <SkipForward size={14} />
        </button>
        <span className="text-sm font-mono text-foreground/50 ml-2">{fmt(currentTime)} / {fmt(duration)}</span>
      </div>
    </div>
  );
}

// ─── Stage 1: AI Output ───────────────────────────────────────────────────────

function Stage1({
  videoRef, currentTime, duration, isPlaying, onPlayPause, onStep, onNext,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  currentTime: number; duration: number; isPlaying: boolean;
  onPlayPause: () => void; onStep: (d: 1 | -1) => void; onNext: () => void;
}) {
  return (
    <div className="flex gap-5 items-start">
      {/* Video */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="relative rounded-xl overflow-hidden border border-border bg-black" style={{ aspectRatio: "16/9" }}>
          <video ref={videoRef} src={VIDEO_SRC} className="w-full h-full object-contain" preload="auto" muted playsInline />
          <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
            <span className="px-2 py-0.5 rounded text-xs font-bold tracking-widest"
              style={{ background: "rgba(0,0,0,0.75)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)" }}>
              AI OUTPUT
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: "rgba(0,0,0,0.75)", color: "#a855f7" }}>
              AI TRACKER LIVE
            </span>
          </div>
        </div>
        <VideoControls videoRef={videoRef} currentTime={currentTime} duration={duration}
          isPlaying={isPlaying} onPlayPause={onPlayPause} onStep={onStep} />
      </div>

      {/* Right panel */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-blue-600/30"
          style={{ background: "rgba(37,99,235,0.12)" }}>
          <Crosshair size={22} className="text-blue-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-blue-300">AI Tracker — Model Output</div>
            <div className="text-xs text-blue-400/70">Tracking overlay baked into video</div>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-800/40 p-4" style={{ background: "rgba(37,99,235,0.08)" }}>
          <p className="text-xs font-bold text-blue-400/60 uppercase tracking-wider mb-2">What you're seeing</p>
          <p className="text-sm text-foreground/60 leading-relaxed">
            The <strong className="text-foreground/80">green bounding box</strong> is the AI model's live
            tracking output. Watch for moments where it drifts, freezes, or loses the target through obstacles.
          </p>
        </div>

        <div className="rounded-2xl border border-border p-4 space-y-2" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider">What to look for</p>
          {[
            { icon: "◑", color: "#f59e0b", label: "Box clips through obstacles" },
            { icon: "✕", color: "#ef4444", label: "Tracker loses the target" },
            { icon: "⚠", color: "#ef4444", label: "Wrong ID on reappearance" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="text-base w-5 text-center flex-shrink-0" style={{ color: item.color }}>{item.icon}</span>
              <span className="text-sm text-foreground/60">{item.label}</span>
            </div>
          ))}
        </div>

        <Button onClick={onNext} className="w-full h-11 font-semibold" style={{ background: ACCENT }}>
          Send to Human Annotator →
        </Button>
      </div>
    </div>
  );
}

// ─── Stage 2: Human Annotation ────────────────────────────────────────────────

function Stage2({
  videoRef, canvasRef, currentTime, duration, isPlaying,
  onPlayPause, onStep, annotations, setAnnotations, onNext,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  currentTime: number; duration: number; isPlaying: boolean;
  onPlayPause: () => void; onStep: (d: 1 | -1) => void;
  annotations: Annotation[]; setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  onNext: () => void;
}) {
  const [drawing, setDrawing] = useState(false);
  const [startPt, setStartPt] = useState({ x: 0, y: 0 });
  const [liveRect, setLiveRect] = useState<[number,number,number,number] | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventType>("re_identification");

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setDrawing(true); setStartPt(getPos(e)); setLiveRect(null);
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const p = getPos(e);
    setLiveRect([Math.min(startPt.x, p.x), Math.min(startPt.y, p.y),
      Math.abs(p.x - startPt.x), Math.abs(p.y - startPt.y)]);
  };
  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    setDrawing(false);
    const p = getPos(e);
    const x = Math.min(startPt.x, p.x), y = Math.min(startPt.y, p.y);
    const w = Math.abs(p.x - startPt.x), h = Math.abs(p.y - startPt.y);
    if (w < 0.02 || h < 0.02) { setLiveRect(null); return; }
    setAnnotations(prev => [...prev, {
      id: `ann-${Date.now()}`, bbox: [x, y, w, h],
      eventType: selectedEvent, frame: Math.round(currentTime * 30),
    }]);
    setLiveRect(null);
  };

  // Sync canvas size & draw annotation boxes
  const syncAndDraw = useCallback(() => {
    const cvs = canvasRef.current;
    const vid = videoRef.current;
    if (!cvs || !vid) return;
    const rect = vid.getBoundingClientRect();
    cvs.width = rect.width; cvs.height = rect.height;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    annotations.forEach(ann => {
      const [nx, ny, nw, nh] = ann.bbox;
      const x = nx * cvs.width, y = ny * cvs.height;
      const w = nw * cvs.width, h = nh * cvs.height;
      const col = EVENT_TYPES.find(e => e.id === ann.eventType)?.color ?? "#22c55e";
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = `${col}18`; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col; ctx.font = "bold 10px monospace";
      ctx.fillText(EVENT_TYPES.find(e => e.id === ann.eventType)?.label ?? "", x + 4, y + 14);
    });
  }, [annotations, canvasRef, videoRef]);

  useEffect(() => { syncAndDraw(); }, [syncAndDraw]);

  const evColor = EVENT_TYPES.find(e => e.id === selectedEvent)?.color ?? "#22c55e";

  return (
    <div className="flex gap-5 items-start">
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="relative rounded-xl overflow-hidden border border-violet-600/40 bg-black"
          style={{ aspectRatio: "16/9", cursor: "crosshair" }}>
          <video ref={videoRef} src={VIDEO_SRC} className="w-full h-full object-contain" preload="auto" muted playsInline />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} />
          {liveRect && (
            <div className="absolute pointer-events-none border-2 border-dashed rounded"
              style={{
                left: `${liveRect[0]*100}%`, top: `${liveRect[1]*100}%`,
                width: `${liveRect[2]*100}%`, height: `${liveRect[3]*100}%`,
                borderColor: evColor, background: `${evColor}15`,
              }} />
          )}
          <div className="absolute top-3 left-3 pointer-events-none">
            <span className="px-2 py-1 rounded text-xs font-bold text-violet-300"
              style={{ background: "rgba(109,40,217,0.80)", border: "1px solid rgba(139,92,246,0.5)" }}>
              ✏ ANNOTATION MODE — Click &amp; drag to mark problem frames
            </span>
          </div>
        </div>
        <VideoControls videoRef={videoRef} currentTime={currentTime} duration={duration}
          isPlaying={isPlaying} onPlayPause={onPlayPause} onStep={onStep} />
      </div>

      {/* Right panel */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-violet-600/30"
          style={{ background: "rgba(109,40,217,0.12)" }}>
          <Target size={22} className="text-violet-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-violet-300">Human Annotation</div>
            <div className="text-xs text-violet-400/70">Draw boxes · label failure events</div>
          </div>
        </div>

        {/* Event type selector */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-2">Event Type</p>
          <div className="grid grid-cols-1 gap-1">
            {EVENT_TYPES.map(ev => (
              <button key={ev.id} onClick={() => setSelectedEvent(ev.id)}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold text-left transition"
                style={{
                  borderColor: selectedEvent === ev.id ? ev.color : `${ev.color}30`,
                  color: selectedEvent === ev.id ? ev.color : "var(--foreground)",
                  background: selectedEvent === ev.id ? `${ev.color}20` : "transparent",
                  opacity: selectedEvent === ev.id ? 1 : 0.6,
                }}>
                {ev.label}
              </button>
            ))}
          </div>
        </div>

        {/* Annotation list */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider">
              Annotations ({annotations.length})
            </p>
            {annotations.length > 0 && (
              <button onClick={() => setAnnotations([])} className="text-xs text-red-400/70 hover:text-red-400">
                Clear all
              </button>
            )}
          </div>
          {annotations.length === 0 ? (
            <p className="text-xs text-foreground/30 italic">Draw boxes on the video to annotate.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {annotations.map(a => {
                const ev = EVENT_TYPES.find(e => e.id === a.eventType);
                return (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg border"
                    style={{ borderColor: `${ev?.color}30`, background: `${ev?.color}08` }}>
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: ev?.color }} />
                    <span className="text-xs text-foreground/60 flex-1 truncate">{ev?.label}</span>
                    <span className="text-xs text-foreground/35">f{a.frame}</span>
                    <button onClick={() => setAnnotations(p => p.filter(x => x.id !== a.id))}
                      className="text-foreground/30 hover:text-red-400 text-xs">✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Button disabled={annotations.length === 0} onClick={onNext}
          className="w-full h-11 font-semibold disabled:opacity-40"
          style={{ background: annotations.length > 0 ? ACCENT : undefined }}>
          Submit for QA ({annotations.length}) →
        </Button>
        {annotations.length === 0 && (
          <p className="text-xs text-center text-foreground/35">Annotate at least one frame to continue</p>
        )}
      </div>
    </div>
  );
}

// ─── Stage 3: QA Review ───────────────────────────────────────────────────────

function Stage3({
  videoRef, canvasRef, currentTime, duration, isPlaying,
  onPlayPause, onStep, annotations, onNext,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  currentTime: number; duration: number; isPlaying: boolean;
  onPlayPause: () => void; onStep: (d: 1 | -1) => void;
  annotations: Annotation[]; onNext: () => void;
}) {
  const [showOverlay, setShowOverlay] = useState(true);
  const improvePct = Math.min(99, 60 + annotations.length * 8);

  // Draw annotation overlay
  const draw = useCallback(() => {
    const cvs = canvasRef.current;
    const vid = videoRef.current;
    if (!cvs || !vid) return;
    const rect = vid.getBoundingClientRect();
    cvs.width = rect.width; cvs.height = rect.height;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    if (!showOverlay) return;
    annotations.forEach(ann => {
      const [nx, ny, nw, nh] = ann.bbox;
      const x = nx * cvs.width, y = ny * cvs.height;
      const w = nw * cvs.width, h = nh * cvs.height;
      const col = EVENT_TYPES.find(e => e.id === ann.eventType)?.color ?? "#22c55e";
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = `${col}20`; ctx.fillRect(x, y, w, h);
      // checkmark badge
      ctx.fillStyle = col; ctx.font = "bold 11px monospace";
      ctx.fillText(`✓ ${EVENT_TYPES.find(e => e.id === ann.eventType)?.label ?? ""}`, x + 4, y + 15);
    });
  }, [annotations, showOverlay, canvasRef, videoRef]);

  useEffect(() => { draw(); }, [draw]);

  const eventCounts = annotations.reduce((acc, a) => {
    acc[a.eventType] = (acc[a.eventType] ?? 0) + 1; return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex gap-5 items-start">
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {/* Before / After toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/50">View:</span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setShowOverlay(false)}
              className={`px-3 py-1.5 text-sm font-semibold transition ${!showOverlay ? "bg-red-600/80 text-white" : "text-foreground/60 hover:bg-muted/40"}`}>
              Before (AI)
            </button>
            <button onClick={() => setShowOverlay(true)}
              className={`px-3 py-1.5 text-sm font-semibold transition ${showOverlay ? "text-white" : "text-foreground/60 hover:bg-muted/40"}`}
              style={{ background: showOverlay ? ACCENT : undefined }}>
              After (Human)
            </button>
          </div>
          <span className="text-xs text-foreground/35">
            {showOverlay ? "Human annotation overlay" : "Raw AI output only"}
          </span>
        </div>

        <div className="relative rounded-xl overflow-hidden border border-border bg-black" style={{ aspectRatio: "16/9" }}>
          <video ref={videoRef} src={VIDEO_SRC} className="w-full h-full object-contain" preload="auto" muted playsInline />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <div className="absolute top-3 left-3 pointer-events-none">
            <span className="px-2 py-0.5 rounded text-xs font-bold tracking-widest"
              style={{ background: "rgba(0,0,0,0.75)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)" }}>
              QA REVIEW
            </span>
          </div>
        </div>
        <VideoControls videoRef={videoRef} currentTime={currentTime} duration={duration}
          isPlaying={isPlaying} onPlayPause={onPlayPause} onStep={onStep} />
      </div>

      {/* Right panel */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-indigo-600/30"
          style={{ background: "rgba(79,70,229,0.12)" }}>
          <ShieldAlert size={22} className="text-indigo-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-indigo-300">QA Review</div>
            <div className="text-xs text-indigo-400/70">Compare AI vs human corrections</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-red-800/40 p-3 text-center" style={{ background: "rgba(220,38,38,0.10)" }}>
            <div className="text-2xl font-black text-red-400">AI</div>
            <div className="text-xs text-foreground/50 mt-0.5">Unassisted</div>
          </div>
          <div className="rounded-xl border border-emerald-700/40 p-3 text-center" style={{ background: "rgba(5,150,105,0.10)" }}>
            <div className="text-2xl font-black text-emerald-400">{annotations.length}</div>
            <div className="text-xs text-foreground/50 mt-0.5">Human Fixes</div>
          </div>
        </div>

        {/* Improvement bar */}
        <div className="rounded-2xl border border-violet-700/40 p-4" style={{ background: "rgba(109,40,217,0.12)" }}>
          <p className="text-xs font-bold text-violet-400/60 uppercase tracking-wider mb-3">Tracking Improvement</p>
          <div className="text-3xl font-black text-violet-300 mb-2">+{improvePct - 60}%</div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--s6)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${improvePct}%`, background: "linear-gradient(90deg,#7c3aed,#22d3ee)" }} />
          </div>
        </div>

        {/* Event summary */}
        {Object.keys(eventCounts).length > 0 && (
          <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
            <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-3">Annotated Events</p>
            <div className="space-y-1.5">
              {Object.entries(eventCounts).map(([evId, count]) => {
                const ev = EVENT_TYPES.find(e => e.id === evId);
                return (
                  <div key={evId} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: ev?.color }}>{ev?.label}</span>
                    <span className="text-sm font-bold text-foreground/60">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button onClick={onNext} className="w-full h-11 font-semibold" style={{ background: ACCENT }}>
          Approve &amp; Mark Delivered →
        </Button>
      </div>
    </div>
  );
}

// ─── Stage 4: Delivered ───────────────────────────────────────────────────────

function Stage4({ annotations, onReset }: { annotations: Annotation[]; onReset: () => void }) {
  const navigate = useNavigate();
  const kpis = [
    { icon: <Target size={18} className="text-cyan-400" />,     label: "Players Re-Identified",     value: "3",  sub: "Correct IDs restored",         bg: "rgba(6,182,212,0.18)" },
    { icon: <Layers size={18} className="text-violet-400" />,   label: "Occlusion Events Labelled", value: `${annotations.length}`, sub: "Across all frames", bg: "rgba(109,40,217,0.18)" },
    { icon: <Activity size={18} className="text-emerald-400" />, label: "ID Switch Corrections",    value: "1",  sub: "Fixed on reappearance",         bg: "rgba(5,150,105,0.18)" },
    { icon: <ZapOff size={18} className="text-amber-400" />,    label: "Ghost Boxes Cleared",       value: `${Math.max(2, annotations.length)}`, sub: "Drift & phantom tracks removed", bg: "rgba(217,119,6,0.18)" },
  ];

  return (
    <div className="flex flex-col gap-5 items-center max-w-2xl mx-auto w-full">
      <div className="inline-flex items-center gap-2 text-white text-sm font-bold px-4 py-1.5 rounded-full"
        style={{ background: "var(--s8)" }}>
        📦 Step 4: Annotation Dataset Delivered
      </div>

      <div className="w-full rounded-2xl border-2 border-emerald-700/50 p-6 text-center"
        style={{ background: "rgba(5,150,105,0.10)" }}>
        <div className="text-5xl mb-3">✅</div>
        <div className="text-2xl font-black text-emerald-400 mb-2">Tracking Dataset Delivered</div>
        <p className="text-base text-foreground/60">
          Human-corrected tracking annotations exported.<br />
          AI model retrained with <strong className="text-foreground/80">{annotations.length} labelled events</strong>.
        </p>
      </div>

      <div className="w-full grid grid-cols-2 gap-3">
        {kpis.map((kpi, i) => (
          <div key={i} className="rounded-xl border border-border p-4" style={{ background: "var(--s4)" }}>
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-2" style={{ background: kpi.bg }}>
              {kpi.icon}
            </div>
            <div className="text-2xl font-black text-foreground">{kpi.value}</div>
            <div className="text-sm font-semibold text-foreground/75">{kpi.label}</div>
            <div className="text-xs text-foreground/40 mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="w-full rounded-2xl border border-violet-700/40 p-5" style={{ background: "rgba(109,40,217,0.10)" }}>
        <p className="text-sm font-bold text-violet-300 mb-2 uppercase tracking-wider">Why Human-in-the-Loop Matters</p>
        <p className="text-sm text-foreground/60 leading-relaxed">
          The AI lost track of the suspect player through smoke and assigned it the wrong ID on reappearance.
          Human annotators caught the drift and corrected the ID switch —
          data the model can now learn from for future occlusion scenarios.
        </p>
      </div>

      <div className="flex gap-3 w-full">
        <Button variant="outline" onClick={onReset} className="flex-1 h-11 gap-2 border-white/15 text-foreground/80 hover:bg-white/5">
          <RotateCcw size={15} /> Try Again
        </Button>
        <Button onClick={() => navigate("/use-cases")} className="flex-1 h-11 gap-2"
          style={{ background: ACCENT }}>
          <ArrowLeft size={15} /> Back to DataStudio
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VideoObjectTracking() {
  const navigate   = useNavigate();
  const { theme }  = useTheme();
  const isLight    = theme === "light";
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);

  const [stage,       setStage]       = useState<Stage>(1);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onMeta  = () => setDuration(vid.duration);
    const onTime  = () => setCurrentTime(vid.currentTime);
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    vid.addEventListener("loadedmetadata", onMeta);
    vid.addEventListener("timeupdate",     onTime);
    vid.addEventListener("play",           onPlay);
    vid.addEventListener("pause",          onPause);
    vid.addEventListener("ended",          onEnded);
    if (vid.readyState >= 1) setDuration(vid.duration);
    return () => {
      vid.removeEventListener("loadedmetadata", onMeta);
      vid.removeEventListener("timeupdate",     onTime);
      vid.removeEventListener("play",           onPlay);
      vid.removeEventListener("pause",          onPause);
      vid.removeEventListener("ended",          onEnded);
    };
  }, []);

  const handlePlayPause = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.paused ? vid.play() : vid.pause();
  };

  const handleStep = (dir: 1 | -1) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = Math.max(0, Math.min(vid.currentTime + dir / 30, vid.duration));
  };

  const reset = () => {
    setStage(1); setAnnotations([]);
    const vid = videoRef.current;
    if (vid) { vid.pause(); vid.currentTime = 0; }
  };

  const sharedProps = { videoRef, canvasRef, currentTime, duration, isPlaying, onPlayPause: handlePlayPause, onStep: handleStep };

  return (
    <div className="min-h-screen" style={{ background: "var(--s0)" }}>
      {/* Header */}
      <header className={`sticky top-0 z-50 w-full border-b ${isLight ? "bg-white border-black/10" : "bg-[hsl(0,0%,5%)] border-white/10"}`}>
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/use-cases")}
              className={`flex items-center justify-center p-2 rounded-full transition shrink-0 ${isLight ? "hover:bg-black/8" : "hover:bg-white/10"}`}>
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </button>
            <span onClick={() => navigate("/use-cases")}
              className="text-sm font-bold text-foreground cursor-pointer hover:text-foreground/80 transition shrink-0">
              TP.ai <span style={{ color: "#9071f0" }}>Data</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
            <span className="text-sm text-foreground/70 truncate">Tracking Through Obstacles</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button onClick={reset}
              className={`flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground/80 px-3 py-1.5 rounded-full border transition ${isLight ? "border-black/15 hover:border-black/30" : "border-white/10 hover:border-white/25"}`}>
              <RefreshCw size={13} /> Reset
            </button>
            <span className="text-sm bg-cyan-600/20 text-cyan-600 border border-cyan-600/30 px-3 py-1 rounded-full font-semibold">
              Video Annotation · Live Demo
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-black text-white">
            Tracking Through Obstacles <span className="text-cyan-400">— Gaming AI</span>
          </h1>
          <p className="text-sm text-foreground/50 mt-1 max-w-xl mx-auto">
            AI tracking fails on occlusion. Humans correct. Models improve.
          </p>
        </div>

        <ProgressStepper stage={stage} />

        <div className="mt-4">
          {stage === 1 && <Stage1 {...sharedProps} onNext={() => setStage(2)} />}
          {stage === 2 && <Stage2 {...sharedProps} annotations={annotations} setAnnotations={setAnnotations} onNext={() => setStage(3)} />}
          {stage === 3 && <Stage3 {...sharedProps} annotations={annotations} onNext={() => setStage(4)} />}
          {stage === 4 && <Stage4 annotations={annotations} onReset={reset} />}
        </div>
      </div>
    </div>
  );
}
