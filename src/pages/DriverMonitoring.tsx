/**
 * DriverMonitoring.tsx — Automotive DMS Video Annotation
 * 4-stage pipeline:
 *   1. Annotate  — pick a clip, watch, fill annotation form
 *   2. AI Verify — simulated AI DMS verdict with confidence breakdown
 *   3. QA Review — senior reviewer overrides / confirms the AI call
 *   4. Delivered — export packet summary
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Play, Pause, SkipBack, SkipForward,
  Check, RefreshCw, Car, Eye, Hand, Download, AlertTriangle,
  ShieldCheck, XCircle, CheckCircle, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/context/ThemeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 1 | 2 | 3 | 4;

type EventValidation = "confirmed" | "false_positive" | "inconclusive" | null;
type DriverGaze = "road" | "phone" | "mirror" | "eyes_closed" | null;
type HandsPhone = "both_on_wheel" | "one_hand" | "phone_in_hand" | "obscured" | null;

interface ClipAnnotation {
  clipId: string;
  eventValidation: EventValidation;
  driverGaze: DriverGaze;
  handsPhone: HandsPhone;
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
    title: "Driver Phone Distraction — Short Clip",
    src: "/videos/dms/driver_facing_phone_distraction_short.mp4",
    flagReason: "Phone distraction suspected",
    lighting: "Unknown",
    tags: ["Phone Distraction", "DMS", "Short Clip"],
  },
];

const PIPELINE_STEPS = [
  { n: 1 as Stage, label: "Annotate"   },
  { n: 2 as Stage, label: "AI Verify"  },
  { n: 3 as Stage, label: "QA Review"  },
  { n: 4 as Stage, label: "Delivered"  },
] as const;

const EVENT_OPTIONS: { value: EventValidation; label: string; color: string }[] = [
  { value: "confirmed",      label: "✓ Confirmed Distraction", color: "#ef4444" },
  { value: "false_positive", label: "✗ False Positive",        color: "#22c55e" },
  { value: "inconclusive",   label: "? Inconclusive",          color: "#f59e0b" },
];

const GAZE_OPTIONS: { value: DriverGaze; label: string }[] = [
  { value: "road",        label: "Road" },
  { value: "phone",       label: "Phone / Lap" },
  { value: "mirror",      label: "Mirror / Blind Spot" },
  { value: "eyes_closed", label: "Eyes Closed" },
];

const HANDS_OPTIONS: { value: HandsPhone; label: string }[] = [
  { value: "both_on_wheel", label: "Both Hands on Wheel" },
  { value: "one_hand",      label: "One Hand on Wheel" },
  { value: "phone_in_hand", label: "Phone in Hand" },
  { value: "obscured",      label: "Obscured / Unclear" },
];

// ─── AI Mock Results ──────────────────────────────────────────────────────────

const AI_RESULTS: Record<string, {
  verdict: string;
  confidence: number;
  gazeScore: number;
  postureScore: number;
  distractionProb: number;
  flags: string[];
}> = {
  "DMS-001": {
    verdict: "DISTRACTION_CONFIRMED",
    confidence: 91,
    gazeScore: 87,
    postureScore: 73,
    distractionProb: 91,
    flags: ["Gaze deviation > 2s", "Phone detected in hand", "Head pose off-axis"],
  },
  "DMS-002": {
    verdict: "DISTRACTION_SUSPECTED",
    confidence: 74,
    gazeScore: 69,
    postureScore: 80,
    distractionProb: 74,
    flags: ["Gaze deviation detected", "Head pose intermittently off-axis"],
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PipelineStepper({ stage, dark }: { stage: Stage; dark: boolean }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {PIPELINE_STEPS.map((s, i) => (
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
            <span
              className="text-xs mt-1 font-medium"
              style={{ color: stage >= s.n ? ACCENT : dark ? "#6b7280" : "#9ca3af" }}
            >
              {s.label}
            </span>
          </div>
          {i < PIPELINE_STEPS.length - 1 && (
            <div
              className="h-0.5 w-16 mx-1 mb-5 transition-all"
              style={{ background: stage > s.n ? ACCENT : dark ? "#374151" : "#e5e7eb" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ClipCard({
  clip, selected, onSelect, dark,
}: {
  clip: Clip;
  selected: boolean;
  onSelect: () => void;
  dark: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-xl p-4 border-2 transition-all hover:scale-[1.01]"
      style={{
        background: selected
          ? dark ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.06)"
          : dark ? "#1a1a2e" : "#f8fafc",
        borderColor: selected ? ACCENT : dark ? "#2d2d44" : "#e2e8f0",
      }}
    >
      {/* Video thumbnail */}
      <div
        className="rounded-lg overflow-hidden mb-3 aspect-video relative"
        style={{ background: "#0d0d1a" }}
      >
        <video
          src={clip.src}
          className="w-full h-full object-cover opacity-80"
          muted
          playsInline
          preload="metadata"
        />
        {/* Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(124,58,237,0.75)" }}
          >
            <Play size={18} className="text-white ml-0.5" />
          </div>
        </div>
        {/* ID badge */}
        <div className="absolute top-2 left-2 text-xs font-mono font-bold px-2 py-0.5 rounded"
          style={{ background: "rgba(0,0,0,0.6)", color: "#e2e8f0" }}>
          {clip.id}
        </div>
      </div>
      <div className="font-semibold text-sm mb-1" style={{ color: dark ? "#e2e8f0" : "#1e293b" }}>
        {clip.title}
      </div>
      <div className="text-xs mb-2" style={{ color: "#ef4444" }}>
        ⚠ {clip.flagReason}
      </div>
      <div className="flex flex-wrap gap-1">
        {clip.tags.map(t => (
          <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: dark ? "#2d2d44" : "#e2e8f0", color: dark ? "#a78bfa" : "#7c3aed" }}>
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}

function RadioGroup<T extends string>({
  label, icon, options, value, onChange, dark,
}: {
  label: string;
  icon: React.ReactNode;
  options: { value: T; label: string; color?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  dark: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: ACCENT }}>{icon}</span>
        <span className="text-sm font-semibold" style={{ color: dark ? "#c4b5fd" : "#6d28d9" }}>
          {label}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {options.map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className="flex items-center gap-2.5 text-sm px-3 py-2 rounded-lg border transition-all text-left"
            style={{
              background: value === opt.value
                ? dark ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.08)"
                : "transparent",
              borderColor: value === opt.value ? opt.color ?? ACCENT : dark ? "#2d2d44" : "#e2e8f0",
              color: dark ? "#e2e8f0" : "#1e293b",
            }}
          >
            <span
              className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
              style={{ borderColor: value === opt.value ? opt.color ?? ACCENT : dark ? "#4b5563" : "#9ca3af" }}
            >
              {value === opt.value && (
                <span className="w-2 h-2 rounded-full block"
                  style={{ background: opt.color ?? ACCENT }} />
              )}
            </span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DriverMonitoring() {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [stage, setStage] = useState<Stage>(1);
  const [selectedClipIdx, setSelectedClipIdx] = useState(0);

  // annotation form state
  const [annotation, setAnnotation] = useState<ClipAnnotation>({
    clipId: CLIPS[0].id,
    eventValidation: null,
    driverGaze: null,
    handsPhone: null,
    notes: "",
  });

  // AI state
  const [aiRunning, setAiRunning] = useState(false);
  const [aiDone, setAiDone] = useState(false);

  // QA state
  const [qaOverride, setQaOverride] = useState<"confirm" | "override" | null>(null);
  const [qaNote, setQaNote] = useState("");

  // Video player
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const clip = CLIPS[selectedClipIdx];
  const aiResult = AI_RESULTS[clip.id];

  // Reset annotation when clip changes
  useEffect(() => {
    setAnnotation({ clipId: clip.id, eventValidation: null, driverGaze: null, handsPhone: null, notes: "" });
    setPlaying(false);
    setCurrentTime(0);
    setAiDone(false);
    setQaOverride(null);
    setQaNote("");
  }, [clip.id]);

  // Video events
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }, []);
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  }, []);
  const handleEnded = useCallback(() => setPlaying(false), []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
  }, []);

  const stepFrame = useCallback((dir: 1 | -1) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setPlaying(false);
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + dir / 30));
  }, [duration]);

  const cycleRate = useCallback(() => {
    const rates = [0.5, 1, 1.5, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  }, [playbackRate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "Comma")  stepFrame(-1);
      if (e.code === "Period") stepFrame(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, stepFrame]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const canSubmit =
    annotation.eventValidation !== null &&
    annotation.driverGaze !== null &&
    annotation.handsPhone !== null;

  const runAI = () => {
    setAiRunning(true);
    setTimeout(() => { setAiRunning(false); setAiDone(true); }, 2200);
  };

  // ─── Colours ────────────────────────────────────────────────────────────────
  const bg    = isDark ? "#0f0f1a" : "#f1f5f9";
  const card  = isDark ? "#16162a" : "#ffffff";
  const border = isDark ? "#2d2d44" : "#e2e8f0";
  const textPrimary = isDark ? "#e2e8f0" : "#1e293b";
  const textMuted   = isDark ? "#94a3b8" : "#64748b";

  // ─── Stage 1: Annotate ────────────────────────────────────────────────────

  const renderAnnotate = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left — clip selector + video player */}
      <div className="flex flex-col gap-4">
        {/* Clip grid */}
        <div
          className="rounded-xl p-4 border"
          style={{ background: card, borderColor: border }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Car size={16} style={{ color: ACCENT }} />
            <span className="text-sm font-semibold" style={{ color: textPrimary }}>Flagged Clip Queue</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
              {CLIPS.length} pending
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {CLIPS.map((c, i) => (
              <ClipCard
                key={c.id}
                clip={c}
                selected={selectedClipIdx === i}
                onSelect={() => setSelectedClipIdx(i)}
                dark={isDark}
              />
            ))}
          </div>
        </div>

        {/* Video player */}
        <div
          className="rounded-xl p-4 border"
          style={{ background: card, borderColor: border }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: textPrimary }}>
              {clip.id} — {clip.title}
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: isDark ? "#2d2d44" : "#f1f5f9", color: textMuted }}>
              {clip.lighting}
            </span>
          </div>

          {/* Video */}
          <div className="rounded-lg overflow-hidden bg-black aspect-video mb-3">
            <video
              ref={videoRef}
              src={clip.src}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              playsInline
            />
          </div>

          {/* Progress bar */}
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            className="w-full mb-2"
            style={{ accentColor: ACCENT }}
          />
          <div className="flex items-center justify-between text-xs mb-3" style={{ color: textMuted }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 justify-center">
            <button
              onClick={() => stepFrame(-1)}
              className="p-2 rounded-lg border transition-colors"
              style={{ borderColor: border, color: textMuted }}
              title="Step back (,)"
            >
              <SkipBack size={16} />
            </button>
            <button
              onClick={togglePlay}
              className="px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors"
              style={{ background: ACCENT, color: "#fff" }}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? "Pause" : "Play"}
            </button>
            <button
              onClick={() => stepFrame(1)}
              className="p-2 rounded-lg border transition-colors"
              style={{ borderColor: border, color: textMuted }}
              title="Step forward (.)"
            >
              <SkipForward size={16} />
            </button>
            <button
              onClick={cycleRate}
              className="px-3 py-2 rounded-lg border text-xs font-mono font-bold transition-colors"
              style={{ borderColor: border, color: ACCENT }}
            >
              {playbackRate}×
            </button>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: textMuted }}>
            Space · Play/Pause &nbsp;|&nbsp; , / . · Frame step
          </p>
        </div>
      </div>

      {/* Right — annotation form */}
      <div
        className="rounded-xl p-5 border flex flex-col"
        style={{ background: card, borderColor: border }}
      >
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} style={{ color: "#f59e0b" }} />
          <span className="text-sm font-semibold" style={{ color: textPrimary }}>
            Annotation Form
          </span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded"
            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", fontFamily: "monospace" }}>
            NEEDS REVIEW
          </span>
        </div>

        {/* Flag context */}
        <div
          className="rounded-lg p-3 mb-4 text-xs"
          style={{ background: isDark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <span style={{ color: "#ef4444", fontWeight: 700 }}>AI Flag: </span>
          <span style={{ color: textMuted }}>{clip.flagReason}</span>
        </div>

        <RadioGroup
          label="Event Validation"
          icon={<ShieldCheck size={14} />}
          options={EVENT_OPTIONS}
          value={annotation.eventValidation}
          onChange={(v) => setAnnotation(a => ({ ...a, eventValidation: v }))}
          dark={isDark}
        />

        <RadioGroup
          label="Driver Gaze"
          icon={<Eye size={14} />}
          options={GAZE_OPTIONS}
          value={annotation.driverGaze}
          onChange={(v) => setAnnotation(a => ({ ...a, driverGaze: v }))}
          dark={isDark}
        />

        <RadioGroup
          label="Hands / Phone"
          icon={<Hand size={14} />}
          options={HANDS_OPTIONS}
          value={annotation.handsPhone}
          onChange={(v) => setAnnotation(a => ({ ...a, handsPhone: v }))}
          dark={isDark}
        />

        {/* Notes */}
        <div className="mb-4">
          <label className="text-xs font-semibold mb-1 block" style={{ color: textMuted }}>
            Notes (optional)
          </label>
          <textarea
            value={annotation.notes}
            onChange={e => setAnnotation(a => ({ ...a, notes: e.target.value }))}
            placeholder="Describe any unusual observations, edge cases, or video quality issues…"
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm border resize-none outline-none focus:ring-2"
            style={{
              background: isDark ? "#0f0f1a" : "#f8fafc",
              borderColor: border,
              color: textPrimary,
            }}
          />
        </div>

        <div className="mt-auto">
          {!canSubmit && (
            <p className="text-xs mb-2 text-center" style={{ color: "#f59e0b" }}>
              ⚠ Complete all three required fields to submit
            </p>
          )}
          <Button
            disabled={!canSubmit}
            onClick={() => setStage(2)}
            className="w-full font-semibold"
            style={{ background: canSubmit ? ACCENT : undefined, color: canSubmit ? "#fff" : undefined }}
          >
            Submit for AI Verification
            <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );

  // ─── Stage 2: AI Verify ───────────────────────────────────────────────────

  const renderAIVerify = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left — clip info + annotation summary */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-5 border" style={{ background: card, borderColor: border }}>
          <div className="flex items-center gap-2 mb-4">
            <Car size={16} style={{ color: ACCENT }} />
            <span className="text-sm font-semibold" style={{ color: textPrimary }}>Clip Under Review</span>
          </div>
          <div className="rounded-lg overflow-hidden bg-black aspect-video mb-3">
            <video
              src={clip.src}
              className="w-full h-full object-contain"
              controls
              playsInline
            />
          </div>
          <div className="text-sm font-medium" style={{ color: textPrimary }}>{clip.title}</div>
          <div className="text-xs mt-1" style={{ color: "#ef4444" }}>⚠ {clip.flagReason}</div>
        </div>

        {/* Human annotation summary */}
        <div className="rounded-xl p-5 border" style={{ background: card, borderColor: border }}>
          <div className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>Human Annotation</div>
          <div className="flex flex-col gap-2 text-sm">
            {[
              { label: "Event Validation", value: EVENT_OPTIONS.find(o => o.value === annotation.eventValidation)?.label },
              { label: "Driver Gaze",      value: GAZE_OPTIONS.find(o => o.value === annotation.driverGaze)?.label },
              { label: "Hands / Phone",    value: HANDS_OPTIONS.find(o => o.value === annotation.handsPhone)?.label },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span style={{ color: textMuted }}>{row.label}</span>
                <span className="font-medium px-2 py-0.5 rounded text-xs"
                  style={{ background: isDark ? "#2d2d44" : "#f1f5f9", color: textPrimary }}>
                  {row.value ?? "—"}
                </span>
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

      {/* Right — AI verification */}
      <div className="rounded-xl p-5 border flex flex-col" style={{ background: card, borderColor: border }}>
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw size={16} style={{ color: ACCENT }} />
          <span className="text-sm font-semibold" style={{ color: textPrimary }}>AI DMS Verification</span>
        </div>

        {!aiDone ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🚗</div>
              <div className="text-sm font-medium mb-1" style={{ color: textPrimary }}>
                DMS Model v3.2 — Multi-Modal Analysis
              </div>
              <div className="text-xs" style={{ color: textMuted }}>
                Gaze tracking · Head pose estimation · Phone detection · Posture analysis
              </div>
            </div>
            {aiRunning ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: ACCENT, borderTopColor: "transparent" }} />
                <div className="text-sm" style={{ color: textMuted }}>Analyzing clip…</div>
                <div className="flex gap-2">
                  {["Gaze", "Posture", "Phone", "Fusion"].map((label, i) => (
                    <div key={label} className="text-xs px-2 py-1 rounded font-mono"
                      style={{ background: isDark ? "#2d2d44" : "#f1f5f9", color: ACCENT, animationDelay: `${i * 0.3}s` }}>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Button
                onClick={runAI}
                className="font-semibold"
                style={{ background: ACCENT, color: "#fff" }}
              >
                <RefreshCw size={15} className="mr-2" />
                Run AI Verification
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Verdict banner */}
            <div
              className="rounded-lg p-4 flex items-center gap-3"
              style={{
                background: aiResult.verdict === "DISTRACTION_CONFIRMED"
                  ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                border: `1px solid ${aiResult.verdict === "DISTRACTION_CONFIRMED" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
              }}
            >
              {aiResult.verdict === "DISTRACTION_CONFIRMED"
                ? <XCircle size={22} style={{ color: "#ef4444" }} />
                : <AlertTriangle size={22} style={{ color: "#f59e0b" }} />
              }
              <div>
                <div className="font-bold text-sm"
                  style={{ color: aiResult.verdict === "DISTRACTION_CONFIRMED" ? "#ef4444" : "#f59e0b" }}>
                  {aiResult.verdict.replace(/_/g, " ")}
                </div>
                <div className="text-xs" style={{ color: textMuted }}>
                  AI Confidence: {aiResult.confidence}%
                </div>
              </div>
            </div>

            {/* Score breakdown */}
            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: textMuted }}>Score Breakdown</div>
              {[
                { label: "Gaze Deviation Score", value: aiResult.gazeScore },
                { label: "Posture Analysis Score", value: aiResult.postureScore },
                { label: "Distraction Probability", value: aiResult.distractionProb },
              ].map(({ label, value }) => (
                <div key={label} className="mb-2">
                  <div className="flex justify-between text-xs mb-1" style={{ color: textMuted }}>
                    <span>{label}</span>
                    <span className="font-mono font-bold" style={{ color: value >= 80 ? "#ef4444" : value >= 60 ? "#f59e0b" : "#22c55e" }}>
                      {value}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: isDark ? "#2d2d44" : "#e2e8f0" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${value}%`,
                        background: value >= 80 ? "#ef4444" : value >= 60 ? "#f59e0b" : "#22c55e",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Flags */}
            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: textMuted }}>Detection Flags</div>
              <div className="flex flex-col gap-1.5">
                {aiResult.flags.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs"
                    style={{ color: textPrimary }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#ef4444" }} />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setStage(3)}
              className="w-full font-semibold mt-auto"
              style={{ background: ACCENT, color: "#fff" }}
            >
              Route to QA Review
              <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Stage 3: QA Review ───────────────────────────────────────────────────

  const renderQAReview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left — combined human + AI summary */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-5 border" style={{ background: card, borderColor: border }}>
          <div className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
            <Eye size={15} style={{ color: ACCENT }} /> Annotation Summary
          </div>
          <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: textMuted }}>Human Labels</div>
          <div className="flex flex-col gap-2 text-sm mb-4">
            {[
              { label: "Event Validation", value: EVENT_OPTIONS.find(o => o.value === annotation.eventValidation)?.label },
              { label: "Driver Gaze",      value: GAZE_OPTIONS.find(o => o.value === annotation.driverGaze)?.label },
              { label: "Hands / Phone",    value: HANDS_OPTIONS.find(o => o.value === annotation.handsPhone)?.label },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span style={{ color: textMuted }}>{row.label}</span>
                <span className="font-medium px-2 py-0.5 rounded text-xs"
                  style={{ background: isDark ? "#2d2d44" : "#f1f5f9", color: textPrimary }}>
                  {row.value ?? "—"}
                </span>
              </div>
            ))}
          </div>

          <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: textMuted }}>AI Verdict</div>
          <div
            className="rounded-lg p-3 text-xs font-bold flex items-center gap-2"
            style={{
              background: aiResult.verdict === "DISTRACTION_CONFIRMED"
                ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
              color: aiResult.verdict === "DISTRACTION_CONFIRMED" ? "#ef4444" : "#f59e0b",
            }}
          >
            <AlertTriangle size={14} />
            {aiResult.verdict.replace(/_/g, " ")} — {aiResult.confidence}% confidence
          </div>
        </div>

        {/* Video for reference */}
        <div className="rounded-xl p-4 border" style={{ background: card, borderColor: border }}>
          <div className="text-xs font-semibold mb-2" style={{ color: textMuted }}>Reference Clip</div>
          <div className="rounded-lg overflow-hidden bg-black aspect-video">
            <video src={clip.src} className="w-full h-full object-contain" controls playsInline />
          </div>
        </div>
      </div>

      {/* Right — QA decision panel */}
      <div className="rounded-xl p-5 border flex flex-col" style={{ background: card, borderColor: border }}>
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={16} style={{ color: ACCENT }} />
          <span className="text-sm font-semibold" style={{ color: textPrimary }}>Senior QA Review</span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded font-bold"
            style={{ background: "rgba(124,58,237,0.12)", color: ACCENT }}>
            QA-{clip.id}
          </span>
        </div>

        <p className="text-sm mb-5" style={{ color: textMuted }}>
          Review the human annotation and AI verdict above. Confirm or override the final classification for this clip.
        </p>

        <div className="flex flex-col gap-3 mb-5">
          {([
            { value: "confirm" as const, label: "✓ Confirm AI Verdict", color: "#22c55e", desc: "Human and AI agree — mark as final." },
            { value: "override" as const, label: "↺ Override AI Verdict", color: "#f59e0b", desc: "Human judgement differs — apply manual classification." },
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setQaOverride(opt.value)}
              className="rounded-xl p-4 border-2 text-left transition-all"
              style={{
                background: qaOverride === opt.value
                  ? isDark ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.06)"
                  : "transparent",
                borderColor: qaOverride === opt.value ? opt.color : border,
              }}
            >
              <div className="font-semibold text-sm mb-0.5" style={{ color: opt.color }}>
                {opt.label}
              </div>
              <div className="text-xs" style={{ color: textMuted }}>{opt.desc}</div>
            </button>
          ))}
        </div>

        <div className="mb-5">
          <label className="text-xs font-semibold mb-1 block" style={{ color: textMuted }}>
            QA Reviewer Note
          </label>
          <textarea
            value={qaNote}
            onChange={e => setQaNote(e.target.value)}
            placeholder="Add a review note for audit trail…"
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm border resize-none outline-none"
            style={{
              background: isDark ? "#0f0f1a" : "#f8fafc",
              borderColor: border,
              color: textPrimary,
            }}
          />
        </div>

        <Button
          disabled={!qaOverride}
          onClick={() => setStage(4)}
          className="w-full font-semibold mt-auto"
          style={{ background: qaOverride ? ACCENT : undefined, color: qaOverride ? "#fff" : undefined }}
        >
          <CheckCircle size={16} className="mr-2" />
          Approve & Deliver
        </Button>
      </div>
    </div>
  );

  // ─── Stage 4: Delivered ───────────────────────────────────────────────────

  const finalVerdict =
    qaOverride === "override" ? annotation.eventValidation?.toUpperCase().replace("_", " ") ?? "MANUAL OVERRIDE"
    : aiResult.verdict.replace(/_/g, " ");

  const exportPacket = {
    clipId: clip.id,
    title: clip.title,
    flagReason: clip.flagReason,
    humanAnnotation: {
      eventValidation: annotation.eventValidation,
      driverGaze: annotation.driverGaze,
      handsPhone: annotation.handsPhone,
      notes: annotation.notes || null,
    },
    aiVerdict: {
      verdict: aiResult.verdict,
      confidence: aiResult.confidence,
      flags: aiResult.flags,
    },
    qaDecision: {
      action: qaOverride,
      note: qaNote || null,
      finalVerdict,
    },
    deliveredAt: new Date().toISOString(),
    annotator: "annotator@tp.ai",
    qaReviewer: "qa-senior@tp.ai",
  };

  const renderDelivered = () => (
    <div className="max-w-2xl mx-auto">
      <div
        className="rounded-xl p-6 border flex flex-col items-center gap-4 text-center mb-6"
        style={{ background: card, borderColor: border }}
      >
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "rgba(34,197,94,0.15)" }}>
          <CheckCircle size={36} style={{ color: "#22c55e" }} />
        </div>
        <div>
          <div className="text-xl font-bold mb-1" style={{ color: textPrimary }}>
            Annotation Packet Delivered
          </div>
          <div className="text-sm" style={{ color: textMuted }}>
            {clip.id} has been reviewed, QA-signed, and exported to the dataset pipeline.
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-6 pt-2">
          {[
            { label: "Clip Reviewed", value: "1" },
            { label: "Final Verdict", value: finalVerdict },
            { label: "QA Action", value: qaOverride === "confirm" ? "Confirmed" : "Overridden" },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-lg font-bold" style={{ color: ACCENT }}>{value}</div>
              <div className="text-xs" style={{ color: textMuted }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Export JSON */}
      <div className="rounded-xl p-5 border" style={{ background: card, borderColor: border }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Download size={15} style={{ color: ACCENT }} />
            <span className="text-sm font-semibold" style={{ color: textPrimary }}>Annotation Export</span>
          </div>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(exportPacket, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${clip.id}_annotation.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5"
            style={{ background: ACCENT, color: "#fff" }}
          >
            <Download size={12} /> Download JSON
          </button>
        </div>
        <pre
          className="text-xs rounded-lg p-4 overflow-auto max-h-72 font-mono"
          style={{ background: isDark ? "#0a0a14" : "#f8fafc", color: textPrimary, lineHeight: 1.6 }}
        >
          {JSON.stringify(exportPacket, null, 2)}
        </pre>
      </div>

      <div className="flex gap-3 mt-6 justify-center">
        <Button
          variant="outline"
          onClick={() => {
            setStage(1);
            setSelectedClipIdx(0);
            setAnnotation({ clipId: CLIPS[0].id, eventValidation: null, driverGaze: null, handsPhone: null, notes: "" });
            setAiDone(false);
            setQaOverride(null);
            setQaNote("");
          }}
          style={{ borderColor: border, color: textPrimary }}
        >
          <RefreshCw size={15} className="mr-2" /> New Batch
        </Button>
      </div>
    </div>
  );

  // ─── Layout ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: bg }}>
      {/* Header */}
      <div
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ background: card, borderColor: border }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/use-cases")}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: textMuted }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <span style={{ color: isDark ? "#374151" : "#d1d5db" }}>|</span>
          <div className="flex items-center gap-2">
            <Car size={18} style={{ color: ACCENT }} />
            <span className="font-semibold text-sm" style={{ color: textPrimary }}>
              Automotive DMS Video Annotation
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-mono"
              style={{ background: isDark ? "#2d2d44" : "#f1f5f9", color: ACCENT }}>
              DMS-001
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: textMuted }}>
            Automotive / ADAS · Video · DMS
          </span>
          <ThemeToggle />
        </div>
      </div>

      {/* Main */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <PipelineStepper stage={stage} dark={isDark} />

        {stage === 1 && renderAnnotate()}
        {stage === 2 && renderAIVerify()}
        {stage === 3 && renderQAReview()}
        {stage === 4 && renderDelivered()}
      </div>
    </div>
  );
}
