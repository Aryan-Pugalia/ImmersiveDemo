/**
 * DriverMonitoring.tsx — Automotive DMS Video Annotation
 * 4-stage pipeline:
 *   1. Annotate  — pick a clip, draw bounding boxes, fill form
 *   2. AI Verify — simulated AI DMS verdict with confidence breakdown
 *   3. QA Review — senior reviewer overrides / confirms the AI call
 *   4. Delivered — export packet summary
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Play, Pause, SkipBack, SkipForward,
  Check, RefreshCw, Car, Eye, Hand, Download, AlertTriangle,
  ShieldCheck, XCircle, CheckCircle, Square, Trash2, BoxSelect,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 1 | 2 | 3 | 4;
type EventValidation = "confirmed" | "false_positive" | "inconclusive" | null;
type DriverGaze      = "road" | "phone" | "mirror" | "eyes_closed";
type HandsPhone      = "both_on_wheel" | "one_hand" | "phone_in_hand" | "obscured";

interface BBox {
  id: string;
  x: number;       // normalised 0-1 relative to canvas
  y: number;
  w: number;
  h: number;
  timestamp: number; // video time when drawn
}

interface ClipAnnotation {
  clipId: string;
  eventValidation: EventValidation;
  driverGaze: DriverGaze[];
  handsPhone: HandsPhone[];
  notes: string;
}

interface Clip {
  id: string;
  title: string;
  src: string;
  flagReason: string;
  lighting: string;
  tags: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#7c3aed";
const BOX_COLOR = "#ef4444";

const CLIPS: Clip[] = [
  {
    id: "DMS-001",
    title: "Driver Phone Distraction — Daytime",
    src: "/videos/dms/driver_facing_phone_distraction_day.mp4",
    flagReason: "Phone distraction suspected",
    lighting: "Day",
    tags: ["Phone Distraction", "DMS", "Day"],
  },
  {
    id: "DMS-002",
    title: "Distracted Driving — Short Clip",
    src: "/videos/dms/driver_facing_phone_distraction_short.mp4",
    flagReason: "Distracted driving suspected",
    lighting: "Unknown",
    tags: ["Distracted Driving", "DMS", "Short Clip"],
  },
];

const AI_RESULTS: Record<string, {
  verdict: string; confidence: number;
  gazeScore: number; postureScore: number; distractionProb: number;
  flags: string[];
}> = {
  "DMS-001": {
    verdict: "DISTRACTION_CONFIRMED", confidence: 91,
    gazeScore: 87, postureScore: 73, distractionProb: 91,
    flags: ["Gaze deviation > 2s", "Phone detected in hand", "Head pose off-axis"],
  },
  "DMS-002": {
    verdict: "DISTRACTION_SUSPECTED", confidence: 74,
    gazeScore: 69, postureScore: 61, distractionProb: 74,
    flags: ["Sustained gaze deviation detected", "Driver attention off-road", "Head pose intermittently off-axis"],
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PipelineStepper({ stage, dark, steps }: { stage: Stage; dark: boolean; steps: { n: Stage; label: string }[] }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
              style={{
                background: stage >= s.n ? ACCENT : "transparent",
                borderColor: stage >= s.n ? ACCENT : dark ? "#374151" : "#d1d5db",
                color: stage >= s.n ? "#fff" : dark ? "#6b7280" : "#9ca3af",
              }}
            >
              {stage > s.n ? <Check size={14} /> : s.n}
            </div>
            <span className="text-xs mt-1 font-medium"
              style={{ color: stage >= s.n ? ACCENT : dark ? "#6b7280" : "#9ca3af" }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="h-0.5 w-16 mx-1 mb-5 transition-all"
              style={{ background: stage > s.n ? ACCENT : dark ? "#374151" : "#e5e7eb" }} />
          )}
        </div>
      ))}
    </div>
  );
}

function ClipCard({ clip, selected, onSelect, dark }: {
  clip: Clip; selected: boolean; onSelect: () => void; dark: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-xl p-4 border-2 transition-all hover:scale-[1.01]"
      style={{
        background: selected ? dark ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.06)" : dark ? "#1a1a2e" : "#f8fafc",
        borderColor: selected ? ACCENT : dark ? "#2d2d44" : "#e2e8f0",
      }}
    >
      <div className="rounded-lg overflow-hidden mb-3 aspect-video relative"
        style={{ background: dark ? "#0d0d1a" : "#1e293b" }}>
        <video src={clip.src} className="w-full h-full object-cover opacity-80" muted playsInline preload="metadata" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(124,58,237,0.75)" }}>
            <Play size={18} className="text-white ml-0.5" />
          </div>
        </div>
        <div className="absolute top-2 left-2 text-xs font-mono font-bold px-2 py-0.5 rounded"
          style={{ background: "rgba(0,0,0,0.6)", color: "#e2e8f0" }}>{clip.id}</div>
      </div>
      <div className="font-semibold text-sm mb-1" style={{ color: dark ? "#e2e8f0" : "#1e293b" }}>{clip.title}</div>
      <div className="text-xs mb-2" style={{ color: "#ef4444" }}>⚠ {clip.flagReason}</div>
      <div className="flex flex-wrap gap-1">
        {clip.tags.map(t => (
          <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: dark ? "#2d2d44" : "#e2e8f0", color: dark ? "#a78bfa" : "#7c3aed" }}>{t}</span>
        ))}
      </div>
    </button>
  );
}

// Single-select radio group (circular indicator)
function RadioGroup<T extends string>({ label, icon, options, value, onChange, dark }: {
  label: string; icon: React.ReactNode;
  options: { value: T; label: string; color?: string }[];
  value: T | null; onChange: (v: T) => void; dark: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: ACCENT }}>{icon}</span>
        <span className="text-sm font-semibold" style={{ color: dark ? "#c4b5fd" : "#6d28d9" }}>{label}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {options.map(opt => {
          const checked = value === opt.value;
          const activeColor = opt.color ?? ACCENT;
          return (
            <button key={String(opt.value)} onClick={() => onChange(opt.value)}
              className="flex items-center gap-2.5 text-sm px-3 py-2 rounded-lg border transition-all text-left"
              style={{
                background: checked ? dark ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.08)" : "transparent",
                borderColor: checked ? activeColor : dark ? "#2d2d44" : "#e2e8f0",
                color: dark ? "#e2e8f0" : "#1e293b",
              }}>
              {/* Circle */}
              <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                style={{ borderColor: checked ? activeColor : dark ? "#4b5563" : "#9ca3af" }}>
                {checked && <span className="w-2 h-2 rounded-full block" style={{ background: activeColor }} />}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Multi-select checkbox group (square indicator, allows multiple)
function MultiCheckboxGroup<T extends string>({ label, icon, options, values, onChange, dark }: {
  label: string; icon: React.ReactNode;
  options: { value: T; label: string; color?: string }[];
  values: T[]; onChange: (v: T[]) => void; dark: boolean;
}) {
  const toggle = (v: T) =>
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: ACCENT }}>{icon}</span>
        <span className="text-sm font-semibold" style={{ color: dark ? "#c4b5fd" : "#6d28d9" }}>{label}</span>
        <span className="text-xs ml-auto" style={{ color: dark ? "#4b5563" : "#9ca3af" }}>select all that apply</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {options.map(opt => {
          const checked = values.includes(opt.value);
          const activeColor = opt.color ?? ACCENT;
          return (
            <button key={String(opt.value)} onClick={() => toggle(opt.value)}
              className="flex items-center gap-2.5 text-sm px-3 py-2 rounded-lg border transition-all text-left"
              style={{
                background: checked ? dark ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.08)" : "transparent",
                borderColor: checked ? activeColor : dark ? "#2d2d44" : "#e2e8f0",
                color: dark ? "#e2e8f0" : "#1e293b",
              }}>
              {/* Square checkbox */}
              <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all"
                style={{ borderColor: checked ? activeColor : dark ? "#4b5563" : "#9ca3af", background: checked ? activeColor : "transparent" }}>
                {checked && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DriverMonitoring() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { t } = useLanguage();
  const dm = t.pages.driverMonitoring;

  // ── Translated constants (depend on t) ───────────────────────────────────
  const PIPELINE_STEPS_T = [
    { n: 1 as Stage, label: dm.stageAnnotate  },
    { n: 2 as Stage, label: dm.stageAiVerify  },
    { n: 3 as Stage, label: dm.stageQaReview  },
    { n: 4 as Stage, label: dm.stageDelivered },
  ];

  const EVENT_OPTIONS_T: { value: EventValidation; label: string; color: string }[] = [
    { value: "confirmed",      label: dm.confirmedDistraction, color: "#ef4444" },
    { value: "false_positive", label: dm.falsePositive,        color: "#22c55e" },
    { value: "inconclusive",   label: dm.inconclusive,         color: "#f59e0b" },
  ];

  const GAZE_OPTIONS_T: { value: DriverGaze; label: string }[] = [
    { value: "road",        label: dm.gazeRoad        },
    { value: "phone",       label: dm.gazePhone       },
    { value: "mirror",      label: dm.gazeMirror      },
    { value: "eyes_closed", label: dm.gazeEyesClosed  },
  ];

  const HANDS_OPTIONS_T: { value: HandsPhone; label: string }[] = [
    { value: "both_on_wheel", label: dm.handsBothOnWheel  },
    { value: "one_hand",      label: dm.handsOneHand      },
    { value: "phone_in_hand", label: dm.handsPhoneInHand  },
    { value: "obscured",      label: dm.handsObscured     },
  ];

  const [stage, setStage] = useState<Stage>(1);
  const [selectedClipIdx, setSelectedClipIdx] = useState(0);

  const [annotation, setAnnotation] = useState<ClipAnnotation>({
    clipId: CLIPS[0].id, eventValidation: null, driverGaze: [], handsPhone: [], notes: "",
  });

  // Bounding boxes — keyed per clip id so switching clips doesn't erase boxes
  const [boxesMap, setBoxesMap] = useState<Record<string, BBox[]>>({});
  const [drawMode, setDrawMode] = useState(false);

  const [aiRunning, setAiRunning] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [qaOverride, setQaOverride] = useState<"confirm" | "override" | null>(null);
  const [qaNote, setQaNote] = useState("");

  // Video
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef  = useRef<{ startX: number; startY: number } | null>(null);
  const previewBox  = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const [playing, setPlaying]         = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const clip     = CLIPS[selectedClipIdx];
  const aiResult = AI_RESULTS[clip.id];
  const boxes    = boxesMap[clip.id] ?? [];

  // Reset form when clip changes (keep boxes)
  useEffect(() => {
    setAnnotation({ clipId: clip.id, eventValidation: null, driverGaze: [], handsPhone: [], notes: "" });
    setPlaying(false);
    setCurrentTime(0);
    setAiDone(false);
    setQaOverride(null);
    setQaNote("");
    setDrawMode(false);
  }, [clip.id]);

  // ─── Canvas drawing ────────────────────────────────────────────────────────

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Saved boxes
    const currentBoxes = boxesMap[clip.id] ?? [];
    currentBoxes.forEach((box, i) => {
      const px = box.x * W, py = box.y * H, pw = box.w * W, ph = box.h * H;
      ctx.strokeStyle = BOX_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(px, py, pw, ph);
      // Corner dots
      [[px, py], [px + pw, py], [px, py + ph], [px + pw, py + ph]].forEach(([cx, cy]) => {
        ctx.fillStyle = BOX_COLOR;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      // Label badge
      const labelW = 72, labelH = 18;
      const labelY = py > labelH + 2 ? py - labelH - 2 : py + 2;
      ctx.fillStyle = "rgba(239,68,68,0.85)";
      ctx.beginPath();
      ctx.roundRect(px, labelY, labelW, labelH, 3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px monospace";
      ctx.fillText(`#${i + 1}  ${box.timestamp.toFixed(1)}s`, px + 5, labelY + 13);
    });

    // In-progress preview
    if (previewBox.current) {
      const p = previewBox.current;
      ctx.strokeStyle = "rgba(124,58,237,0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(p.x * W, p.y * H, p.w * W, p.h * H);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(124,58,237,0.08)";
      ctx.fillRect(p.x * W, p.y * H, p.w * W, p.h * H);
    }
  }, [boxesMap, clip.id]);

  // Keep canvas pixel size in sync with its CSS size
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
      redraw();
    });
    ro.observe(container);
    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;
    return () => ro.disconnect();
  }, [redraw]);

  useEffect(() => { redraw(); }, [redraw, boxes]);

  // Canvas mouse events
  const getRelative = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top)  / rect.height,
    };
  };

  const onCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    e.preventDefault();
    const { x, y } = getRelative(e);
    drawingRef.current = { startX: x, startY: y };
  };

  const onCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode || !drawingRef.current) return;
    const { x, y } = getRelative(e);
    const { startX, startY } = drawingRef.current;
    previewBox.current = {
      x: Math.min(x, startX), y: Math.min(y, startY),
      w: Math.abs(x - startX), h: Math.abs(y - startY),
    };
    redraw();
  };

  const onCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode || !drawingRef.current) return;
    const { x, y } = getRelative(e);
    const { startX, startY } = drawingRef.current;
    const bx = Math.min(x, startX), by = Math.min(y, startY);
    const bw = Math.abs(x - startX), bh = Math.abs(y - startY);
    if (bw > 0.02 && bh > 0.02) {
      const newBox: BBox = {
        id: `bbox-${Date.now()}`,
        x: bx, y: by, w: bw, h: bh,
        timestamp: videoRef.current?.currentTime ?? 0,
      };
      setBoxesMap(prev => ({
        ...prev,
        [clip.id]: [...(prev[clip.id] ?? []), newBox],
      }));
    }
    drawingRef.current = null;
    previewBox.current = null;
    redraw();
  };

  const deleteBox = (id: string) => {
    setBoxesMap(prev => ({
      ...prev,
      [clip.id]: (prev[clip.id] ?? []).filter(b => b.id !== id),
    }));
  };

  // ─── Video controls ────────────────────────────────────────────────────────

  const handleTimeUpdate   = useCallback(() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); }, []);
  const handleLoadedMeta   = useCallback(() => { if (videoRef.current) setDuration(videoRef.current.duration); }, []);
  const handleEnded        = useCallback(() => setPlaying(false), []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current; if (!v) return;
    v.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
  }, []);

  const stepFrame = useCallback((dir: 1 | -1) => {
    const v = videoRef.current; if (!v) return;
    v.pause(); setPlaying(false);
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + dir / 30));
  }, [duration]);

  const cycleRate = useCallback(() => {
    const rates = [0.5, 1, 1.5, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  }, [playbackRate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space")  { e.preventDefault(); togglePlay(); }
      if (e.code === "Comma")  stepFrame(-1);
      if (e.code === "Period") stepFrame(1);
      if (e.key  === "d")      setDrawMode(m => !m);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, stepFrame]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  const canSubmit = annotation.eventValidation !== null && annotation.driverGaze.length > 0 && annotation.handsPhone.length > 0;
  const runAI = () => { setAiRunning(true); setTimeout(() => { setAiRunning(false); setAiDone(true); }, 2200); };

  // ─── Theme colours ─────────────────────────────────────────────────────────
  const bg          = isDark ? "#0f0f1a" : "#f1f5f9";
  const card        = isDark ? "#16162a" : "#ffffff";
  const border      = isDark ? "#2d2d44" : "#e2e8f0";
  const textPrimary = isDark ? "#e2e8f0" : "#1e293b";
  const textMuted   = isDark ? "#94a3b8" : "#64748b";

  // ─── Stage 1: Annotate ────────────────────────────────────────────────────

  const renderAnnotate = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left — clip picker + video */}
      <div className="flex flex-col gap-4">
        {/* Clip queue */}
        <div className="rounded-xl p-4 border" style={{ background: card, borderColor: border }}>
          <div className="flex items-center gap-2 mb-3">
            <Car size={16} style={{ color: ACCENT }} />
            <span className="text-sm font-semibold" style={{ color: textPrimary }}>{dm.flaggedClipQueue}</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>{CLIPS.length} {dm.pendingClips}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {CLIPS.map((c, i) => (
              <ClipCard key={c.id} clip={c} selected={selectedClipIdx === i}
                onSelect={() => setSelectedClipIdx(i)} dark={isDark} />
            ))}
          </div>
        </div>

        {/* Video player */}
        <div className="rounded-xl p-4 border" style={{ background: card, borderColor: border }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: textPrimary }}>{clip.id} — {clip.title}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: isDark ? "#2d2d44" : "#f1f5f9", color: textMuted }}>{clip.lighting}</span>
          </div>

          {/* Video + canvas overlay */}
          <div ref={containerRef} className="rounded-lg overflow-hidden bg-black aspect-video mb-3 relative"
            style={{ cursor: drawMode ? "crosshair" : "default" }}>
            <video
              ref={videoRef}
              src={clip.src}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMeta}
              onEnded={handleEnded}
              playsInline
              onClick={() => { if (!drawMode) togglePlay(); }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: drawMode ? "all" : "none" }}
              onMouseDown={onCanvasMouseDown}
              onMouseMove={onCanvasMouseMove}
              onMouseUp={onCanvasMouseUp}
              onMouseLeave={() => { previewBox.current = null; redraw(); }}
            />
            {/* Draw mode badge */}
            {drawMode && (
              <div className="absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded flex items-center gap-1"
                style={{ background: "rgba(124,58,237,0.9)", color: "#fff" }}>
                <BoxSelect size={11} /> DRAW MODE
              </div>
            )}
          </div>

          {/* Scrubber */}
          <input type="range" min={0} max={duration || 1} step={0.01} value={currentTime}
            onChange={handleSeek} className="w-full mb-2" style={{ accentColor: ACCENT }} />
          <div className="flex items-center justify-between text-xs mb-3" style={{ color: textMuted }}>
            <span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 justify-center flex-wrap">
            <button onClick={() => stepFrame(-1)} className="p-2 rounded-lg border transition-colors"
              style={{ borderColor: border, color: textMuted }} title="Step back (,)">
              <SkipBack size={16} />
            </button>
            <button onClick={togglePlay} className="px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
              style={{ background: ACCENT, color: "#fff" }}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? "Pause" : "Play"}
            </button>
            <button onClick={() => stepFrame(1)} className="p-2 rounded-lg border transition-colors"
              style={{ borderColor: border, color: textMuted }} title="Step forward (.)">
              <SkipForward size={16} />
            </button>
            <button onClick={cycleRate} className="px-3 py-2 rounded-lg border text-xs font-mono font-bold"
              style={{ borderColor: border, color: ACCENT }}>{playbackRate}×</button>

            {/* Draw mode toggle */}
            <button
              onClick={() => setDrawMode(m => !m)}
              className="px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all"
              style={{
                borderColor: drawMode ? ACCENT : border,
                background: drawMode ? "rgba(124,58,237,0.12)" : "transparent",
                color: drawMode ? ACCENT : textMuted,
              }}
              title="Toggle bounding box drawing (D)"
            >
              <Square size={13} /> {drawMode ? "Drawing…" : "Draw Box"}
            </button>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: textMuted }}>
            Space · Play/Pause &nbsp;|&nbsp; , / . · Frame step &nbsp;|&nbsp; D · Toggle draw
          </p>

          {/* Bounding box list */}
          {boxes.length > 0 && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: border }}>
              <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: textMuted }}>
                <Square size={11} style={{ color: BOX_COLOR }} />
                {boxes.length} bounding box{boxes.length !== 1 ? "es" : ""} drawn
              </div>
              <div className="flex flex-col gap-1">
                {boxes.map((b, i) => (
                  <div key={b.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded"
                    style={{ background: isDark ? "#1a1a2e" : "#f8fafc" }}>
                    <span className="font-mono font-bold" style={{ color: BOX_COLOR }}>#{i + 1}</span>
                    <span style={{ color: textMuted }}>@ {b.timestamp.toFixed(2)}s</span>
                    <span style={{ color: textMuted }}>
                      {(b.w * 100).toFixed(0)}% × {(b.h * 100).toFixed(0)}%
                    </span>
                    <button onClick={() => deleteBox(b.id)} className="ml-2 hover:text-red-400 transition-colors"
                      style={{ color: textMuted }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right — annotation form */}
      <div className="rounded-xl p-5 border flex flex-col" style={{ background: card, borderColor: border }}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} style={{ color: "#f59e0b" }} />
          <span className="text-sm font-semibold" style={{ color: textPrimary }}>{dm.annotationForm}</span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded font-mono"
            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>{dm.needsReview}</span>
        </div>

        <div className="rounded-lg p-3 mb-4 text-xs"
          style={{ background: isDark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <span style={{ color: "#ef4444", fontWeight: 700 }}>AI Flag: </span>
          <span style={{ color: textMuted }}>{clip.flagReason}</span>
        </div>

        <RadioGroup label={dm.eventValidation} icon={<ShieldCheck size={14} />}
          options={EVENT_OPTIONS_T} value={annotation.eventValidation}
          onChange={(v) => setAnnotation(a => ({ ...a, eventValidation: v }))} dark={isDark} />

        <MultiCheckboxGroup label={dm.driverGaze} icon={<Eye size={14} />}
          options={GAZE_OPTIONS_T} values={annotation.driverGaze}
          onChange={(v) => setAnnotation(a => ({ ...a, driverGaze: v }))} dark={isDark} />

        <MultiCheckboxGroup label={dm.handsPhone} icon={<Hand size={14} />}
          options={HANDS_OPTIONS_T} values={annotation.handsPhone}
          onChange={(v) => setAnnotation(a => ({ ...a, handsPhone: v }))} dark={isDark} />

        <div className="mb-4">
          <label className="text-xs font-semibold mb-1 block" style={{ color: textMuted }}>Notes (optional)</label>
          <textarea value={annotation.notes}
            onChange={e => setAnnotation(a => ({ ...a, notes: e.target.value }))}
            placeholder={dm.notesPlaceholder}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm border resize-none outline-none"
            style={{ background: isDark ? "#0f0f1a" : "#f8fafc", borderColor: border, color: textPrimary }} />
        </div>

        {/* Bbox summary in form */}
        {boxes.length > 0 && (
          <div className="mb-4 text-xs px-3 py-2 rounded-lg flex items-center gap-2"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <Square size={12} style={{ color: BOX_COLOR }} />
            <span style={{ color: BOX_COLOR, fontWeight: 700 }}>{boxes.length} distraction region{boxes.length !== 1 ? "s" : ""} marked</span>
          </div>
        )}

        <div className="mt-auto">
          {!canSubmit && (
            <p className="text-xs mb-2 text-center" style={{ color: "#f59e0b" }}>
              {dm.completeRequiredFields}
            </p>
          )}
          <Button disabled={!canSubmit} onClick={() => setStage(2)} className="w-full font-semibold"
            style={{ background: canSubmit ? ACCENT : undefined, color: canSubmit ? "#fff" : undefined }}>
            {dm.submitForAi} <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );

  // ─── Stage 2: AI Verify ───────────────────────────────────────────────────

  const renderAIVerify = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-5 border" style={{ background: card, borderColor: border }}>
          <div className="flex items-center gap-2 mb-4">
            <Car size={16} style={{ color: ACCENT }} />
            <span className="text-sm font-semibold" style={{ color: textPrimary }}>{dm.clipUnderReview}</span>
          </div>
          <div className="rounded-lg overflow-hidden bg-black aspect-video mb-3">
            <video src={clip.src} className="w-full h-full object-contain" controls playsInline />
          </div>
          <div className="text-sm font-medium" style={{ color: textPrimary }}>{clip.title}</div>
          <div className="text-xs mt-1" style={{ color: "#ef4444" }}>⚠ {clip.flagReason}</div>
        </div>

        <div className="rounded-xl p-5 border" style={{ background: card, borderColor: border }}>
          <div className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>{dm.humanLabels}</div>
          <div className="flex flex-col gap-2 text-sm">
            {[
              { label: dm.eventValidation, value: EVENT_OPTIONS_T.find(o => o.value === annotation.eventValidation)?.label },
              { label: dm.driverGaze,      value: annotation.driverGaze.map(v => GAZE_OPTIONS_T.find(o => o.value === v)?.label).join(", ") || "—" },
              { label: dm.handsPhone,      value: annotation.handsPhone.map(v => HANDS_OPTIONS_T.find(o => o.value === v)?.label).join(", ") || "—" },
              { label: dm.regionsMarked,   value: boxes.length > 0 ? `${boxes.length} bounding box${boxes.length !== 1 ? "es" : ""}` : "None" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span style={{ color: textMuted }}>{row.label}</span>
                <span className="font-medium px-2 py-0.5 rounded text-xs"
                  style={{ background: isDark ? "#2d2d44" : "#f1f5f9", color: textPrimary }}>{row.value ?? "—"}</span>
              </div>
            ))}
            {annotation.notes && (
              <div className="mt-2 text-xs p-2 rounded" style={{ background: isDark ? "#1a1a2e" : "#f8fafc", color: textMuted }}>
                <span className="font-semibold">Notes:</span> {annotation.notes}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5 border flex flex-col" style={{ background: card, borderColor: border }}>
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw size={16} style={{ color: ACCENT }} />
          <span className="text-sm font-semibold" style={{ color: textPrimary }}>{dm.aiVerifyTitle}</span>
        </div>

        {!aiDone ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🚗</div>
              <div className="text-sm font-medium mb-1" style={{ color: textPrimary }}>{dm.aiModel}</div>
              <div className="text-xs" style={{ color: textMuted }}>{dm.aiCapabilities}</div>
            </div>
            {aiRunning ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 animate-spin"
                  style={{ borderColor: ACCENT, borderTopColor: "transparent" }} />
                <div className="text-sm" style={{ color: textMuted }}>{dm.analyzingClip}</div>
                <div className="flex gap-2">
                  {["Gaze", "Posture", "Phone", "Fusion"].map(label => (
                    <div key={label} className="text-xs px-2 py-1 rounded font-mono"
                      style={{ background: isDark ? "#2d2d44" : "#f1f5f9", color: ACCENT }}>{label}</div>
                  ))}
                </div>
              </div>
            ) : (
              <Button onClick={runAI} className="font-semibold" style={{ background: ACCENT, color: "#fff" }}>
                <RefreshCw size={15} className="mr-2" /> {dm.runAiVerification}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg p-4 flex items-center gap-3" style={{
              background: aiResult.verdict === "DISTRACTION_CONFIRMED" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
              border: `1px solid ${aiResult.verdict === "DISTRACTION_CONFIRMED" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
            }}>
              {aiResult.verdict === "DISTRACTION_CONFIRMED"
                ? <XCircle size={22} style={{ color: "#ef4444" }} />
                : <AlertTriangle size={22} style={{ color: "#f59e0b" }} />}
              <div>
                <div className="font-bold text-sm"
                  style={{ color: aiResult.verdict === "DISTRACTION_CONFIRMED" ? "#ef4444" : "#f59e0b" }}>
                  {aiResult.verdict.replace(/_/g, " ")}
                </div>
                <div className="text-xs" style={{ color: textMuted }}>AI Confidence: {aiResult.confidence}%</div>

              </div>
            </div>

            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: textMuted }}>Score Breakdown</div>
              {[
                { label: dm.gazeDeviationScore,       value: aiResult.gazeScore },
                { label: dm.postureScore,             value: aiResult.postureScore },
                { label: dm.distractionProbability,   value: aiResult.distractionProb },
              ].map(({ label, value }) => (
                <div key={label} className="mb-2">
                  <div className="flex justify-between text-xs mb-1" style={{ color: textMuted }}>
                    <span>{label}</span>
                    <span className="font-mono font-bold"
                      style={{ color: value >= 80 ? "#ef4444" : value >= 60 ? "#f59e0b" : "#22c55e" }}>{value}%</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: isDark ? "#2d2d44" : "#e2e8f0" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${value}%`, background: value >= 80 ? "#ef4444" : value >= 60 ? "#f59e0b" : "#22c55e" }} />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: textMuted }}>{dm.detectionFlags}</div>
              <div className="flex flex-col gap-1.5">
                {aiResult.flags.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs" style={{ color: textPrimary }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#ef4444" }} />{f}
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={() => setStage(3)} className="w-full font-semibold mt-auto"
              style={{ background: ACCENT, color: "#fff" }}>
              {dm.routeToQa} <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Stage 3: QA Review ───────────────────────────────────────────────────

  const renderQAReview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-5 border" style={{ background: card, borderColor: border }}>
          <div className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
            <Eye size={15} style={{ color: ACCENT }} /> {dm.annotationSummary}
          </div>
          <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: textMuted }}>{dm.humanLabels}</div>
          <div className="flex flex-col gap-2 text-sm mb-4">
            {[
              { label: dm.eventValidation, value: EVENT_OPTIONS_T.find(o => o.value === annotation.eventValidation)?.label },
              { label: dm.driverGaze,      value: annotation.driverGaze.map(v => GAZE_OPTIONS_T.find(o => o.value === v)?.label).join(", ") || "—" },
              { label: dm.handsPhone,      value: annotation.handsPhone.map(v => HANDS_OPTIONS_T.find(o => o.value === v)?.label).join(", ") || "—" },
              { label: dm.regionsMarked,   value: boxes.length > 0 ? `${boxes.length} bounding box${boxes.length !== 1 ? "es" : ""}` : "None" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span style={{ color: textMuted }}>{row.label}</span>
                <span className="font-medium px-2 py-0.5 rounded text-xs"
                  style={{ background: isDark ? "#2d2d44" : "#f1f5f9", color: textPrimary }}>{row.value ?? "—"}</span>
              </div>
            ))}
          </div>
          <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: textMuted }}>{dm.aiVerdict}</div>
          <div className="rounded-lg p-3 text-xs font-bold flex items-center gap-2" style={{
            background: aiResult.verdict === "DISTRACTION_CONFIRMED" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
            color: aiResult.verdict === "DISTRACTION_CONFIRMED" ? "#ef4444" : "#f59e0b",
          }}>
            <AlertTriangle size={14} />
            {aiResult.verdict.replace(/_/g, " ")} — {aiResult.confidence}% confidence
          </div>
        </div>

        <div className="rounded-xl p-4 border" style={{ background: card, borderColor: border }}>
          <div className="text-xs font-semibold mb-2" style={{ color: textMuted }}>Reference Clip</div>
          <div className="rounded-lg overflow-hidden bg-black aspect-video">
            <video src={clip.src} className="w-full h-full object-contain" controls playsInline />
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5 border flex flex-col" style={{ background: card, borderColor: border }}>
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={16} style={{ color: ACCENT }} />
          <span className="text-sm font-semibold" style={{ color: textPrimary }}>{dm.seniorQaReview}</span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded font-bold"
            style={{ background: "rgba(124,58,237,0.12)", color: ACCENT }}>QA-{clip.id}</span>
        </div>
        <p className="text-sm mb-5" style={{ color: textMuted }}>
          {dm.qaHint}
        </p>
        <div className="flex flex-col gap-3 mb-5">
          {([
            { value: "confirm"  as const, label: dm.confirmAiVerdict,  color: "#22c55e", desc: dm.confirmAiVerdictSub },
            { value: "override" as const, label: dm.overrideAiVerdict, color: "#f59e0b", desc: dm.overrideAiVerdictSub },
          ]).map(opt => (
            <button key={opt.value} onClick={() => setQaOverride(opt.value)}
              className="rounded-xl p-4 border-2 text-left transition-all"
              style={{
                background: qaOverride === opt.value ? isDark ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.06)" : "transparent",
                borderColor: qaOverride === opt.value ? opt.color : border,
              }}>
              <div className="font-semibold text-sm mb-0.5" style={{ color: opt.color }}>{opt.label}</div>
              <div className="text-xs" style={{ color: textMuted }}>{opt.desc}</div>
            </button>
          ))}
        </div>
        <div className="mb-5">
          <label className="text-xs font-semibold mb-1 block" style={{ color: textMuted }}>{dm.qaReviewerNote}</label>
          <textarea value={qaNote} onChange={e => setQaNote(e.target.value)}
            placeholder={dm.qaReviewerNotePlaceholder} rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm border resize-none outline-none"
            style={{ background: isDark ? "#0f0f1a" : "#f8fafc", borderColor: border, color: textPrimary }} />
        </div>
        <Button disabled={!qaOverride} onClick={() => setStage(4)} className="w-full font-semibold mt-auto"
          style={{ background: qaOverride ? ACCENT : undefined, color: qaOverride ? "#fff" : undefined }}>
          <CheckCircle size={16} className="mr-2" /> {dm.approveDeliver}
        </Button>
      </div>
    </div>
  );

  // ─── Stage 4: Delivered ───────────────────────────────────────────────────

  const finalVerdict =
    qaOverride === "override"
      ? annotation.eventValidation?.toUpperCase().replace(/_/g, " ") ?? "MANUAL OVERRIDE"
      : aiResult.verdict.replace(/_/g, " ");

  const exportPacket = {
    clipId: clip.id, title: clip.title, flagReason: clip.flagReason,
    humanAnnotation: {
      eventValidation: annotation.eventValidation,
      driverGaze: annotation.driverGaze,   // array — multiple may apply
      handsPhone: annotation.handsPhone,   // array — multiple may apply
      notes: annotation.notes || null,
      boundingBoxes: boxes.map((b, i) => ({
        index: i + 1,
        timestamp_s: parseFloat(b.timestamp.toFixed(3)),
        x: parseFloat(b.x.toFixed(4)), y: parseFloat(b.y.toFixed(4)),
        w: parseFloat(b.w.toFixed(4)), h: parseFloat(b.h.toFixed(4)),
      })),
    },
    aiVerdict: { verdict: aiResult.verdict, confidence: aiResult.confidence, flags: aiResult.flags },
    qaDecision: { action: qaOverride, note: qaNote || null, finalVerdict },
    deliveredAt: new Date().toISOString(),
    annotator: "annotator@tp.ai",
    qaReviewer: "qa-senior@tp.ai",
  };

  const renderDelivered = () => (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-xl p-6 border flex flex-col items-center gap-4 text-center mb-6"
        style={{ background: card, borderColor: border }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "rgba(34,197,94,0.15)" }}>
          <CheckCircle size={36} style={{ color: "#22c55e" }} />
        </div>
        <div>
          <div className="text-xl font-bold mb-1" style={{ color: textPrimary }}>{dm.packetDelivered}</div>
          <div className="text-sm" style={{ color: textMuted }}>
            {clip.id} {dm.packetDeliveredHint}
          </div>
        </div>
        <div className="flex gap-6 pt-2">
          {[
            { label: dm.clipReviewed,  value: "1" },
            { label: dm.regionsMarked, value: String(boxes.length) },
            { label: dm.finalVerdict,  value: finalVerdict },
            { label: dm.qaAction,      value: qaOverride === "confirm" ? dm.confirmed : dm.overridden },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-lg font-bold" style={{ color: ACCENT }}>{value}</div>
              <div className="text-xs" style={{ color: textMuted }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-5 border" style={{ background: card, borderColor: border }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Download size={15} style={{ color: ACCENT }} />
            <span className="text-sm font-semibold" style={{ color: textPrimary }}>{dm.annotationExport}</span>
          </div>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(exportPacket, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `${clip.id}_annotation.json`; a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5"
            style={{ background: ACCENT, color: "#fff" }}>
            <Download size={12} /> {t.tools.export}
          </button>
        </div>
        <pre className="text-xs rounded-lg p-4 overflow-auto max-h-72 font-mono"
          style={{ background: isDark ? "#0a0a14" : "#f8fafc", color: textPrimary, lineHeight: 1.6 }}>
          {JSON.stringify(exportPacket, null, 2)}
        </pre>
      </div>

      <div className="flex gap-3 mt-6 justify-center">
        <Button variant="outline" onClick={() => {
          setStage(1); setSelectedClipIdx(0);
          setAnnotation({ clipId: CLIPS[0].id, eventValidation: null, driverGaze: [], handsPhone: [], notes: "" });
          setBoxesMap({}); setAiDone(false); setQaOverride(null); setQaNote("");
        }} style={{ borderColor: border, color: textPrimary }}>
          <RefreshCw size={15} className="mr-2" /> {dm.newBatch}
        </Button>
      </div>
    </div>
  );

  // ─── Layout ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: bg }}>
      <header className="sticky top-0 z-50 border-b px-6 py-4 flex items-center justify-between"
        style={{ background: card, borderColor: border }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/use-cases")}
            className="flex items-center gap-1.5 text-sm font-medium" style={{ color: textMuted }}>
            <ArrowLeft size={16} /> {t.nav.back}
          </button>
          <span style={{ color: isDark ? "#374151" : "#cbd5e1" }}>|</span>
          <div className="flex items-center gap-2">
            <Car size={18} style={{ color: ACCENT }} />
            <span className="font-semibold text-sm" style={{ color: textPrimary }}>{dm.pageTitle}</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono"
              style={{ background: isDark ? "#2d2d44" : "#f1f5f9", color: ACCENT }}>DMS-001</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: textMuted }}>{dm.pageSubtitle}</span>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <PipelineStepper stage={stage} dark={isDark} steps={PIPELINE_STEPS_T} />
        {stage === 1 && renderAnnotate()}
        {stage === 2 && renderAIVerify()}
        {stage === 3 && renderQAReview()}
        {stage === 4 && renderDelivered()}
      </div>
    </div>
  );
}
