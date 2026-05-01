import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";

// ─── Types ─────────────────────────────────────────────────────────────────

type DimensionRating = "acceptable" | "degraded" | "unusable";
type OverallRating   = "good" | "fair" | "poor";
type SuitabilityLabel = "suitable" | "preprocessing" | "reject";
type Stage = "ingest" | "annotate" | "ai-verify" | "qa" | "export";

interface AudioSample {
  id: string;
  filename: string;
  duration: string;
  sampleRate: string;
  channels: string;
  bitDepth: string;
  language: string;
  domain: string;
  source: string;
  snr: string;
  recordedAt: string;
}

interface DimensionAnnotation {
  rating: DimensionRating | null;
  notes: string;
}

type DimensionKey =
  | "background_noise"
  | "signal_clarity"
  | "volume_consistency"
  | "crosstalk"
  | "distortion_clipping"
  | "echo_reverb"
  | "dropouts";

interface HumanAnnotation {
  dimensions: Record<DimensionKey, DimensionAnnotation>;
  overallRating: OverallRating | null;
  suitability: SuitabilityLabel | null;
  generalNotes: string;
}

interface AIResult {
  dimension: DimensionKey;
  prediction: DimensionRating;
  confidence: number;
  justification: string;
  agreement: boolean;
}

type QADecision = "accept_human" | "accept_ai" | "override";

interface QAEntry {
  dimension: DimensionKey;
  decision: QADecision | null;
  overrideValue: DimensionRating | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SAMPLES: AudioSample[] = [
  {
    id: "aud_qa_014",
    filename: "call_center_en_014.wav",
    duration: "0:42",
    sampleRate: "16 kHz",
    channels: "Mono",
    bitDepth: "16-bit",
    language: "English (US)",
    domain: "Call Center",
    source: "Telephony capture",
    snr: "14.2 dB",
    recordedAt: "2025-03-18",
  },
  {
    id: "aud_qa_031",
    filename: "field_interview_es_031.wav",
    duration: "1:17",
    sampleRate: "44.1 kHz",
    channels: "Stereo",
    bitDepth: "24-bit",
    language: "Spanish (MX)",
    domain: "Field Interview",
    source: "Handheld recorder",
    snr: "9.1 dB",
    recordedAt: "2025-04-02",
  },
];

const DIMENSIONS: { key: DimensionKey; label: string; icon: string; description: string }[] = [
  { key: "background_noise",     label: "Background Noise",     icon: "noise_aware",       description: "Ambient noise, hum, traffic, HVAC interference" },
  { key: "signal_clarity",       label: "Signal Clarity",       icon: "graphic_eq",        description: "Intelligibility of the primary speech signal" },
  { key: "volume_consistency",   label: "Volume Consistency",   icon: "volume_up",         description: "Level stability across the recording" },
  { key: "crosstalk",            label: "Crosstalk",            icon: "people",            description: "Interference from secondary speakers or channels" },
  { key: "distortion_clipping",  label: "Distortion / Clipping",icon: "equalizer",         description: "Clipping artefacts, saturation, or codec distortion" },
  { key: "echo_reverb",          label: "Echo / Reverb",        icon: "surround_sound",    description: "Room echo, reverb tail, or acoustic coupling" },
  { key: "dropouts",             label: "Dropouts",             icon: "signal_disconnected",description: "Packet loss, mutes, or sudden silence gaps" },
];

const DIMENSION_RATING_LABELS: Record<DimensionRating, string> = {
  acceptable: "Acceptable",
  degraded:   "Degraded",
  unusable:   "Unusable",
};

const AI_RESULTS: Record<string, AIResult[]> = {
  aud_qa_014: [
    { dimension: "background_noise",    prediction: "degraded",    confidence: 0.88, justification: "Detected broadband hum at 60 Hz consistent with power line interference.", agreement: false },
    { dimension: "signal_clarity",      prediction: "acceptable",  confidence: 0.91, justification: "Speech intelligibility score of 0.87 MOS — within acceptable range.", agreement: true  },
    { dimension: "volume_consistency",  prediction: "acceptable",  confidence: 0.85, justification: "RMS variation ±2.1 dB across segments — stable.", agreement: true  },
    { dimension: "crosstalk",           prediction: "acceptable",  confidence: 0.93, justification: "No secondary speaker energy detected on primary channel.", agreement: true  },
    { dimension: "distortion_clipping", prediction: "degraded",    confidence: 0.79, justification: "3 clipping events detected at 0 dBFS near timestamp 0:18.", agreement: false },
    { dimension: "echo_reverb",         prediction: "acceptable",  confidence: 0.82, justification: "RT60 estimated at 0.15 s — minimal reverb contribution.", agreement: true  },
    { dimension: "dropouts",            prediction: "acceptable",  confidence: 0.96, justification: "No dropout events detected above 20 ms threshold.", agreement: true  },
  ],
  aud_qa_031: [
    { dimension: "background_noise",    prediction: "unusable",    confidence: 0.92, justification: "High-amplitude wind noise detected — masks speech across 60% of recording.", agreement: true  },
    { dimension: "signal_clarity",      prediction: "degraded",    confidence: 0.84, justification: "MOS estimate of 0.61 — speech partially intelligible under wind masking.", agreement: false },
    { dimension: "volume_consistency",  prediction: "degraded",    confidence: 0.77, justification: "RMS variation ±8.4 dB — significant level swings detected.", agreement: true  },
    { dimension: "crosstalk",           prediction: "degraded",    confidence: 0.81, justification: "Stereo channel L/R bleed detected at −18 dB — possible mic proximity.", agreement: false },
    { dimension: "distortion_clipping", prediction: "acceptable",  confidence: 0.89, justification: "No clipping events. Peak level −3.2 dBFS.", agreement: true  },
    { dimension: "echo_reverb",         prediction: "acceptable",  confidence: 0.86, justification: "Outdoor recording — RT60 unmeasurable; no indoor reverb.", agreement: true  },
    { dimension: "dropouts",            prediction: "degraded",    confidence: 0.73, justification: "Two dropout events (240 ms, 110 ms) at 0:44 and 1:02.", agreement: true  },
  ],
};

const EMPTY_HUMAN: HumanAnnotation = {
  dimensions: Object.fromEntries(
    DIMENSIONS.map(d => [d.key, { rating: null, notes: "" }])
  ) as Record<DimensionKey, DimensionAnnotation>,
  overallRating: null,
  suitability: null,
  generalNotes: "",
};

const EMPTY_QA = (sampleId: string): QAEntry[] =>
  (AI_RESULTS[sampleId] ?? []).map(r => ({
    dimension: r.dimension,
    decision: null,
    overrideValue: null,
  }));

// ─── Waveform mock ──────────────────────────────────────────────────────────

const WAVEFORM_BARS = 80;

function generateBars(seed: number): number[] {
  const bars: number[] = [];
  let v = seed;
  for (let i = 0; i < WAVEFORM_BARS; i++) {
    v = (v * 1664525 + 1013904223) & 0xffffffff;
    const base = ((v >>> 17) & 0xff) / 255;
    const shaped = 0.15 + base * 0.7 * Math.sin((i / WAVEFORM_BARS) * Math.PI);
    bars.push(Math.max(0.06, shaped));
  }
  return bars;
}

const SAMPLE_BARS: Record<string, number[]> = {
  aud_qa_014: generateBars(42),
  aud_qa_031: generateBars(87),
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const STAGE_LABELS: Record<Stage, string> = {
  "ingest":    "Ingest",
  "annotate":  "Annotate",
  "ai-verify": "AI Verify",
  "qa":        "QA Adjudication",
  "export":    "Export",
};
const STAGE_ICONS: Record<Stage, string> = {
  "ingest":    "upload_file",
  "annotate":  "edit_note",
  "ai-verify": "smart_toy",
  "qa":        "rule",
  "export":    "download",
};
const STAGES: Stage[] = ["ingest", "annotate", "ai-verify", "qa", "export"];

function PipelineStepper({ current, isDark }: { current: Stage; isDark: boolean }) {
  const currentIdx = STAGES.indexOf(current);
  return (
    <div className="flex items-center gap-0 mb-10 overflow-x-auto pb-1">
      {STAGES.map((s, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        return (
          <div key={s} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  done   ? "bg-violet-600 border-violet-600"
                  : active ? "bg-violet-600/20 border-violet-500"
                  : isDark ? "bg-white/5 border-white/15"
                  : "bg-gray-100 border-gray-300"
                }`}
              >
                {done
                  ? <span className="material-symbols-outlined text-white" style={{ fontSize: 16 }}>check</span>
                  : <span className={`material-symbols-outlined ${active ? "text-violet-400" : isDark ? "text-white/30" : "text-gray-400"}`} style={{ fontSize: 16 }}>{STAGE_ICONS[s]}</span>
                }
              </div>
              <span className={`text-[10px] mt-1 font-bold uppercase tracking-wide whitespace-nowrap ${active ? "text-violet-400" : isDark ? "text-white/40" : "text-gray-400"}`}>
                {STAGE_LABELS[s]}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-[2px] w-10 md:w-16 mx-1 mb-4 rounded-full transition-all ${done ? "bg-violet-600" : isDark ? "bg-white/10" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface WaveformPlayerProps {
  sampleId: string;
  isDark: boolean;
}

function WaveformPlayer({ sampleId, isDark }: WaveformPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bars = SAMPLE_BARS[sampleId] ?? SAMPLE_BARS["aud_qa_014"];

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
  }, [sampleId]);

  const toggle = useCallback(() => {
    if (playing) {
      clearInterval(intervalRef.current!);
      setPlaying(false);
    } else {
      setPlaying(true);
      intervalRef.current = setInterval(() => {
        setProgress(p => {
          if (p >= 1) {
            clearInterval(intervalRef.current!);
            setPlaying(false);
            return 0;
          }
          return p + 1 / (WAVEFORM_BARS * 4);
        });
      }, 80);
    }
  }, [playing]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const playheadX = Math.round(progress * WAVEFORM_BARS);

  return (
    <div className={`rounded-xl p-4 border ${isDark ? "bg-white/3 border-white/10" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={toggle}
          className="w-10 h-10 rounded-full bg-violet-600 hover:bg-violet-500 flex items-center justify-center transition-colors flex-shrink-0"
        >
          <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>
            {playing ? "pause" : "play_arrow"}
          </span>
        </button>
        <div className="flex-1 overflow-hidden">
          <svg width="100%" height="48" viewBox={`0 0 ${WAVEFORM_BARS * 5} 48`} preserveAspectRatio="none">
            {bars.map((h, i) => {
              const barH = Math.max(3, h * 44);
              const y = (48 - barH) / 2;
              const isPast = i < playheadX;
              return (
                <rect
                  key={i}
                  x={i * 5}
                  y={y}
                  width={3}
                  height={barH}
                  rx={1.5}
                  fill={isPast ? "#7c3aed" : isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)"}
                />
              );
            })}
            {/* playhead line */}
            <line
              x1={playheadX * 5}
              x2={playheadX * 5}
              y1={0}
              y2={48}
              stroke="#a78bfa"
              strokeWidth={1.5}
            />
          </svg>
        </div>
      </div>
      <div className="flex justify-between text-xs font-mono">
        <span className={isDark ? "text-white/40" : "text-gray-400"}>
          {playing ? "▶ Playing…" : "● Stopped"}
        </span>
        <span className={isDark ? "text-white/40" : "text-gray-400"}>
          {Math.round(progress * 100)}%
        </span>
      </div>
    </div>
  );
}

// ─── Rating pill selectors ───────────────────────────────────────────────────

const RATING_COLORS: Record<DimensionRating, { active: string; badge: string }> = {
  acceptable: { active: "bg-emerald-600 text-white border-emerald-500",    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  degraded:   { active: "bg-amber-500 text-white border-amber-400",        badge: "bg-amber-500/15 text-amber-400 border-amber-500/30"    },
  unusable:   { active: "bg-rose-600 text-white border-rose-500",          badge: "bg-rose-500/15 text-rose-400 border-rose-500/30"       },
};
const RATING_COLORS_LIGHT: Record<DimensionRating, { active: string; badge: string }> = {
  acceptable: { active: "bg-emerald-500 text-white border-emerald-500",    badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  degraded:   { active: "bg-amber-500 text-white border-amber-400",        badge: "bg-amber-50 text-amber-700 border-amber-200"    },
  unusable:   { active: "bg-rose-500 text-white border-rose-400",          badge: "bg-rose-50 text-rose-700 border-rose-200"       },
};

function RatingPill({
  value, selected, onClick, isDark, size = "sm",
}: {
  value: DimensionRating; selected: boolean; onClick: () => void; isDark: boolean; size?: "sm" | "xs";
}) {
  const colors = isDark ? RATING_COLORS[value] : RATING_COLORS_LIGHT[value];
  const cls = selected ? colors.active : isDark
    ? "bg-transparent text-white/50 border-white/15 hover:border-white/30"
    : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400";
  return (
    <button
      onClick={onClick}
      className={`rounded-full border font-bold uppercase tracking-wider transition-all ${
        size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      } ${cls}`}
    >
      {DIMENSION_RATING_LABELS[value]}
    </button>
  );
}

function RatingBadge({ value, isDark }: { value: DimensionRating; isDark: boolean }) {
  const colors = isDark ? RATING_COLORS[value] : RATING_COLORS_LIGHT[value];
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${colors.badge}`}>
      {DIMENSION_RATING_LABELS[value]}
    </span>
  );
}

function ConfidenceBar({ value, isDark }: { value: number; isDark: boolean }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? "bg-emerald-500" : value >= 0.7 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 h-1.5 rounded-full ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono w-8 text-right ${isDark ? "text-white/50" : "text-gray-500"}`}>{pct}%</span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AudioQualityQA() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [stage, setStage]         = useState<Stage>("ingest");
  const [sampleIdx, setSampleIdx] = useState(0);

  // Per-sample annotation state
  const [annotationsMap, setAnnotationsMap] = useState<Record<string, HumanAnnotation>>({});
  const [qaMap, setQaMap]                   = useState<Record<string, QAEntry[]>>({});

  const sample     = SAMPLES[sampleIdx];
  const annotation = annotationsMap[sample.id] ?? EMPTY_HUMAN;
  const qaEntries  = qaMap[sample.id] ?? EMPTY_QA(sample.id);
  const aiResults  = AI_RESULTS[sample.id] ?? [];

  // ── Annotation helpers ──────────────────────────────────────────────────

  function setDimRating(key: DimensionKey, rating: DimensionRating) {
    setAnnotationsMap(prev => {
      const cur = prev[sample.id] ?? EMPTY_HUMAN;
      return {
        ...prev,
        [sample.id]: {
          ...cur,
          dimensions: {
            ...cur.dimensions,
            [key]: { ...cur.dimensions[key], rating },
          },
        },
      };
    });
  }

  function setDimNotes(key: DimensionKey, notes: string) {
    setAnnotationsMap(prev => {
      const cur = prev[sample.id] ?? EMPTY_HUMAN;
      return {
        ...prev,
        [sample.id]: {
          ...cur,
          dimensions: {
            ...cur.dimensions,
            [key]: { ...cur.dimensions[key], notes },
          },
        },
      };
    });
  }

  function setOverallRating(r: OverallRating) {
    setAnnotationsMap(prev => ({
      ...prev,
      [sample.id]: { ...(prev[sample.id] ?? EMPTY_HUMAN), overallRating: r },
    }));
  }

  function setSuitability(s: SuitabilityLabel) {
    setAnnotationsMap(prev => ({
      ...prev,
      [sample.id]: { ...(prev[sample.id] ?? EMPTY_HUMAN), suitability: s },
    }));
  }

  function setGeneralNotes(n: string) {
    setAnnotationsMap(prev => ({
      ...prev,
      [sample.id]: { ...(prev[sample.id] ?? EMPTY_HUMAN), generalNotes: n },
    }));
  }

  const canSubmitAnnotation =
    DIMENSIONS.every(d => annotation.dimensions[d.key].rating !== null) &&
    annotation.overallRating !== null &&
    annotation.suitability !== null;

  // ── QA helpers ──────────────────────────────────────────────────────────

  function setQaDecision(dim: DimensionKey, decision: QADecision) {
    setQaMap(prev => ({
      ...prev,
      [sample.id]: (prev[sample.id] ?? EMPTY_QA(sample.id)).map(e =>
        e.dimension === dim
          ? { ...e, decision, overrideValue: decision !== "override" ? null : e.overrideValue }
          : e
      ),
    }));
  }

  function setQaOverride(dim: DimensionKey, val: DimensionRating) {
    setQaMap(prev => ({
      ...prev,
      [sample.id]: (prev[sample.id] ?? EMPTY_QA(sample.id)).map(e =>
        e.dimension === dim ? { ...e, overrideValue: val } : e
      ),
    }));
  }

  const canSubmitQA = qaEntries.every(e =>
    e.decision !== null && (e.decision !== "override" || e.overrideValue !== null)
  );

  // ── Export packet ────────────────────────────────────────────────────────

  function buildExportPacket() {
    const finalDims: Record<string, string> = {};
    DIMENSIONS.forEach(d => {
      const qa = qaEntries.find(q => q.dimension === d.key);
      if (!qa) return;
      if (qa.decision === "accept_human") finalDims[d.key] = annotation.dimensions[d.key].rating ?? "";
      else if (qa.decision === "accept_ai") finalDims[d.key] = aiResults.find(r => r.dimension === d.key)?.prediction ?? "";
      else finalDims[d.key] = qa.overrideValue ?? "";
    });

    const passed = Object.values(finalDims).every(r => r === "acceptable");
    const hasUnusable = Object.values(finalDims).some(r => r === "unusable");
    const qaFinalStatus = annotation.suitability === "reject" || hasUnusable
      ? "rejected"
      : annotation.suitability === "preprocessing"
        ? "approved_with_preprocessing"
        : "approved";

    return {
      audio_id: sample.id,
      filename: sample.filename,
      domain: sample.domain,
      language: sample.language,
      annotated_at: new Date().toISOString(),
      dimensions: finalDims,
      human_rating: annotation.overallRating,
      ai_verification_score: +(aiResults.filter(r => r.agreement).length / Math.max(1, aiResults.length)).toFixed(2),
      qa_consensus_rate: +(qaEntries.filter(e => e.decision !== "override").length / Math.max(1, qaEntries.length)).toFixed(2),
      qa_final_status: qaFinalStatus,
      suitability: annotation.suitability,
      notes: annotation.generalNotes,
    };
  }

  // ─── Shared card wrapper ──────────────────────────────────────────────────

  const cardCls = `rounded-2xl border p-6 ${isDark ? "bg-white/3 border-white/10" : "bg-white border-gray-200 shadow-sm"}`;
  const sectionTitle = (icon: string, label: string) => (
    <div className="flex items-center gap-2 mb-4">
      <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 20 }}>{icon}</span>
      <h2 className={`text-sm font-bold uppercase tracking-widest ${isDark ? "text-white/70" : "text-gray-600"}`}>{label}</h2>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[hsl(0,0%,5%)] border-b border-border/20 w-full">
        <div className="flex justify-between items-center px-6 py-3 h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-white">arrow_back</span>
            </button>
            <div>
              <span className="text-sm font-bold text-white font-headline">
                TP.ai <span style={{ color: "#9071f0" }}>Data</span>Studio
              </span>
              <span className="ml-3 text-xs font-mono px-2 py-0.5 rounded-full border border-violet-500/30 text-violet-400 bg-violet-500/10">
                AUD-402
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {SAMPLES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setSampleIdx(i); setStage("ingest"); }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors border ${
                  sampleIdx === i
                    ? "bg-violet-600 text-white border-violet-500"
                    : "bg-transparent text-white/50 border-white/15 hover:text-white/90 hover:border-white/30"
                }`}
              >
                {s.id}
              </button>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className={`text-2xl font-bold font-headline tracking-tight mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
            Audio Quality &amp; Signal Integrity QA
          </h1>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
            7-dimension annotation → AI verification → QA adjudication → JSON export
          </p>
        </div>

        <PipelineStepper current={stage} isDark={isDark} />

        {/* ═══ STAGE 1 — INGEST ════════════════════════════════════════════ */}
        {stage === "ingest" && (
          <div className="space-y-6">
            <div className={cardCls}>
              {sectionTitle("upload_file", "Audio Sample Ingestion")}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {[
                  ["File",        sample.filename],
                  ["Sample ID",   sample.id],
                  ["Duration",    sample.duration],
                  ["Sample Rate", sample.sampleRate],
                  ["Channels",    sample.channels],
                  ["Bit Depth",   sample.bitDepth],
                  ["Language",    sample.language],
                  ["Domain",      sample.domain],
                  ["Source",      sample.source],
                  ["Est. SNR",    sample.snr],
                  ["Recorded",    sample.recordedAt],
                ].map(([label, val]) => (
                  <div key={label}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest block mb-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>{label}</span>
                    <span className={`text-sm font-mono ${isDark ? "text-white/80" : "text-gray-700"}`}>{val}</span>
                  </div>
                ))}
              </div>
              <WaveformPlayer sampleId={sample.id} isDark={isDark} />
            </div>

            {/* SNR indicator */}
            <div className={cardCls}>
              {sectionTitle("monitoring", "Signal Quality Overview")}
              <div className="space-y-3">
                {[
                  { label: "Estimated SNR",    value: parseFloat(sample.snr) / 30,       display: sample.snr,    color: parseFloat(sample.snr) > 12 ? "bg-emerald-500" : "bg-amber-500" },
                  { label: "Pre-scan Pass Rate", value: 0.85,                             display: "85%",          color: "bg-emerald-500" },
                  { label: "Silence Ratio",    value: sample.id === "aud_qa_014" ? 0.08 : 0.18, display: sample.id === "aud_qa_014" ? "8%" : "18%", color: "bg-violet-500" },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex justify-between mb-1">
                      <span className={`text-xs ${isDark ? "text-white/60" : "text-gray-600"}`}>{row.label}</span>
                      <span className={`text-xs font-mono ${isDark ? "text-white/60" : "text-gray-600"}`}>{row.display}</span>
                    </div>
                    <div className={`h-2 rounded-full ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
                      <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.min(1, row.value) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStage("annotate")}
                className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
              >
                Begin Annotation
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══ STAGE 2 — ANNOTATE ══════════════════════════════════════════ */}
        {stage === "annotate" && (
          <div className="space-y-6">
            <div className={cardCls}>
              {sectionTitle("edit_note", "7-Dimension Quality Annotation")}
              <p className={`text-xs mb-5 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                Rate each dimension then set Overall Rating and Suitability to submit.
              </p>

              <div className="space-y-5">
                {DIMENSIONS.map(dim => {
                  const dimAnn = annotation.dimensions[dim.key];
                  return (
                    <div key={dim.key} className={`rounded-xl p-4 border transition-all ${
                      dimAnn.rating === "acceptable"
                        ? isDark ? "border-emerald-500/30 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50"
                        : dimAnn.rating === "degraded"
                          ? isDark ? "border-amber-500/30 bg-amber-500/5"   : "border-amber-200 bg-amber-50"
                          : dimAnn.rating === "unusable"
                            ? isDark ? "border-rose-500/30 bg-rose-500/5"   : "border-rose-200 bg-rose-50"
                            : isDark ? "border-white/10 bg-white/2"          : "border-gray-200 bg-gray-50"
                    }`}>
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined ${isDark ? "text-white/40" : "text-gray-400"}`} style={{ fontSize: 18 }}>
                            {dim.icon}
                          </span>
                          <div>
                            <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-800"}`}>{dim.label}</p>
                            <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>{dim.description}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          {(["acceptable", "degraded", "unusable"] as DimensionRating[]).map(r => (
                            <RatingPill
                              key={r}
                              value={r}
                              selected={dimAnn.rating === r}
                              onClick={() => setDimRating(dim.key, r)}
                              isDark={isDark}
                              size="xs"
                            />
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Optional notes for this dimension…"
                        value={dimAnn.notes}
                        onChange={e => setDimNotes(dim.key, e.target.value)}
                        className={`w-full text-xs rounded-lg border px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 transition-colors ${
                          isDark
                            ? "bg-white/5 border-white/10 text-white placeholder:text-white/25"
                            : "bg-white border-gray-200 text-gray-800 placeholder:text-gray-300"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overall Rating + Suitability */}
            <div className={cardCls}>
              {sectionTitle("star", "Overall Rating & Suitability")}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>Overall Quality Rating</p>
                  <div className="flex gap-2 flex-wrap">
                    {(["good", "fair", "poor"] as OverallRating[]).map(r => (
                      <button
                        key={r}
                        onClick={() => setOverallRating(r)}
                        className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
                          annotation.overallRating === r
                            ? r === "good"  ? "bg-emerald-600 text-white border-emerald-500"
                              : r === "fair" ? "bg-amber-500 text-white border-amber-400"
                              :               "bg-rose-600 text-white border-rose-500"
                            : isDark ? "bg-transparent text-white/50 border-white/15 hover:border-white/30"
                            : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>Training Suitability</p>
                  <div className="flex gap-2 flex-wrap">
                    {([
                      { val: "suitable" as const,      label: "Suitable",       icon: "check_circle"   },
                      { val: "preprocessing" as const, label: "Needs Preproc.", icon: "build"          },
                      { val: "reject" as const,        label: "Reject",         icon: "cancel"         },
                    ]).map(({ val, label, icon }) => (
                      <button
                        key={val}
                        onClick={() => setSuitability(val)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
                          annotation.suitability === val
                            ? val === "suitable"      ? "bg-emerald-600 text-white border-emerald-500"
                              : val === "preprocessing" ? "bg-amber-500 text-white border-amber-400"
                              :                          "bg-rose-600 text-white border-rose-500"
                            : isDark ? "bg-transparent text-white/50 border-white/15 hover:border-white/30"
                            : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/40" : "text-gray-400"}`}>General Notes</p>
                <textarea
                  rows={3}
                  placeholder="Overall observations, context, or recommendations…"
                  value={annotation.generalNotes}
                  onChange={e => setGeneralNotes(e.target.value)}
                  className={`w-full text-sm rounded-lg border px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-none transition-colors ${
                    isDark
                      ? "bg-white/5 border-white/10 text-white placeholder:text-white/25"
                      : "bg-white border-gray-200 text-gray-800 placeholder:text-gray-300"
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStage("ingest")}
                className={`px-5 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors ${
                  isDark ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"
                }`}
              >
                ← Back
              </button>
              <button
                disabled={!canSubmitAnnotation}
                onClick={() => setStage("ai-verify")}
                className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
              >
                Submit to AI Verify
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>smart_toy</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══ STAGE 3 — AI VERIFY ═════════════════════════════════════════ */}
        {stage === "ai-verify" && (
          <div className="space-y-6">
            <div className={cardCls}>
              {sectionTitle("smart_toy", "AI Verification Results")}
              <p className={`text-xs mb-5 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                AI model evaluated the audio across all 7 dimensions. Review agreement and proceed to QA adjudication.
              </p>

              {/* Agreement summary */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: "Agreed",       count: aiResults.filter(r => r.agreement).length,  color: "text-emerald-400" },
                  { label: "Disagreed",    count: aiResults.filter(r => !r.agreement).length, color: "text-amber-400"   },
                  { label: "Avg Confidence", count: `${Math.round(aiResults.reduce((a, r) => a + r.confidence, 0) / Math.max(1, aiResults.length) * 100)}%`, color: "text-violet-400" },
                ].map(({ label, count, color }) => (
                  <div key={label} className={`rounded-xl p-3 text-center border ${isDark ? "border-white/10 bg-white/3" : "border-gray-200 bg-gray-50"}`}>
                    <p className={`text-2xl font-bold font-mono ${color}`}>{count}</p>
                    <p className={`text-[10px] uppercase tracking-wider mt-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>{label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                {DIMENSIONS.map(dim => {
                  const ai     = aiResults.find(r => r.dimension === dim.key);
                  const human  = annotation.dimensions[dim.key];
                  if (!ai) return null;
                  return (
                    <div key={dim.key} className={`rounded-xl border p-4 ${
                      ai.agreement
                        ? isDark ? "border-emerald-500/25 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50"
                        : isDark ? "border-amber-500/25 bg-amber-500/5"     : "border-amber-200 bg-amber-50"
                    }`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined ${isDark ? "text-white/40" : "text-gray-400"}`} style={{ fontSize: 16 }}>{dim.icon}</span>
                          <span className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-800"}`}>{dim.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            ai.agreement
                              ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                              : isDark ? "bg-amber-500/20 text-amber-400"     : "bg-amber-100 text-amber-700"
                          }`}>
                            {ai.agreement ? "✓ Agree" : "⚠ Disagree"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>Human:</span>
                          {human.rating && <RatingBadge value={human.rating} isDark={isDark} />}
                          <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>AI:</span>
                          <RatingBadge value={ai.prediction} isDark={isDark} />
                        </div>
                      </div>
                      <ConfidenceBar value={ai.confidence} isDark={isDark} />
                      <p className={`text-xs mt-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>{ai.justification}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStage("annotate")}
                className={`px-5 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors ${
                  isDark ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"
                }`}
              >
                ← Back
              </button>
              <button
                onClick={() => setStage("qa")}
                className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
              >
                Proceed to QA Adjudication
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>rule</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══ STAGE 4 — QA ADJUDICATION ═══════════════════════════════════ */}
        {stage === "qa" && (
          <div className="space-y-6">
            <div className={cardCls}>
              {sectionTitle("rule", "QA Adjudication")}
              <p className={`text-xs mb-5 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                For each dimension, accept the human label, accept AI, or override with your own decision.
              </p>

              <div className="space-y-4">
                {DIMENSIONS.map(dim => {
                  const ai    = aiResults.find(r => r.dimension === dim.key);
                  const human = annotation.dimensions[dim.key];
                  const qa    = qaEntries.find(e => e.dimension === dim.key);
                  if (!ai || !qa) return null;

                  return (
                    <div key={dim.key} className={`rounded-xl border p-4 ${isDark ? "border-white/10 bg-white/2" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined ${isDark ? "text-white/40" : "text-gray-400"}`} style={{ fontSize: 16 }}>{dim.icon}</span>
                          <span className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-800"}`}>{dim.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>H:</span>
                          {human.rating && <RatingBadge value={human.rating} isDark={isDark} />}
                          <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>AI:</span>
                          <RatingBadge value={ai.prediction} isDark={isDark} />
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {([
                          { val: "accept_human" as const, label: "Accept Human" },
                          { val: "accept_ai"    as const, label: "Accept AI"    },
                          { val: "override"     as const, label: "Override"     },
                        ]).map(({ val, label }) => (
                          <button
                            key={val}
                            onClick={() => setQaDecision(dim.key, val)}
                            className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
                              qa.decision === val
                                ? val === "override"
                                  ? "bg-rose-600 text-white border-rose-500"
                                  : "bg-violet-600 text-white border-violet-500"
                                : isDark
                                  ? "bg-transparent text-white/50 border-white/15 hover:border-white/30"
                                  : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {qa.decision === "override" && (
                        <div className="mt-3 flex gap-1.5">
                          <span className={`text-xs self-center mr-1 ${isDark ? "text-white/40" : "text-gray-400"}`}>Override value:</span>
                          {(["acceptable", "degraded", "unusable"] as DimensionRating[]).map(r => (
                            <RatingPill
                              key={r}
                              value={r}
                              selected={qa.overrideValue === r}
                              onClick={() => setQaOverride(dim.key, r)}
                              isDark={isDark}
                              size="xs"
                            />
                          ))}
                        </div>
                      )}

                      {/* Resolved value preview */}
                      {qa.decision && (qa.decision !== "override" || qa.overrideValue) && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-300"}`}>Final:</span>
                          <RatingBadge
                            value={
                              qa.decision === "accept_human" ? (human.rating ?? "acceptable")
                              : qa.decision === "accept_ai"  ? ai.prediction
                              : qa.overrideValue!
                            }
                            isDark={isDark}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStage("ai-verify")}
                className={`px-5 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors ${
                  isDark ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"
                }`}
              >
                ← Back
              </button>
              <button
                disabled={!canSubmitQA}
                onClick={() => setStage("export")}
                className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
              >
                Finalize &amp; Export
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══ STAGE 5 — EXPORT ════════════════════════════════════════════ */}
        {stage === "export" && (() => {
          const packet = buildExportPacket();
          const statusColor =
            packet.qa_final_status === "approved"                   ? "text-emerald-400"
            : packet.qa_final_status === "approved_with_preprocessing" ? "text-amber-400"
            : "text-rose-400";
          return (
            <div className="space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Final Status",        val: packet.qa_final_status.replace(/_/g, " "), color: statusColor },
                  { label: "Human Rating",         val: packet.human_rating ?? "—",               color: isDark ? "text-white" : "text-gray-900" },
                  { label: "AI Agreement",         val: `${Math.round(packet.ai_verification_score * 100)}%`, color: "text-violet-400" },
                  { label: "QA Consensus",         val: `${Math.round(packet.qa_consensus_rate * 100)}%`,     color: "text-emerald-400" },
                ].map(({ label, val, color }) => (
                  <div key={label} className={`rounded-xl border p-4 text-center ${isDark ? "border-white/10 bg-white/3" : "border-gray-200 bg-white shadow-sm"}`}>
                    <p className={`text-lg font-bold font-mono uppercase ${color}`}>{val}</p>
                    <p className={`text-[10px] uppercase tracking-widest mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Dimension summary grid */}
              <div className={cardCls}>
                {sectionTitle("table_chart", "Dimension Summary")}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {DIMENSIONS.map(dim => {
                    const val = packet.dimensions[dim.key] as DimensionRating;
                    return (
                      <div key={dim.key} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 border ${isDark ? "border-white/8 bg-white/2" : "border-gray-100 bg-gray-50"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined ${isDark ? "text-white/30" : "text-gray-400"}`} style={{ fontSize: 14 }}>{dim.icon}</span>
                          <span className={`text-xs font-bold ${isDark ? "text-white/70" : "text-gray-700"}`}>{dim.label}</span>
                        </div>
                        {val && <RatingBadge value={val} isDark={isDark} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* JSON export */}
              <div className={cardCls}>
                {sectionTitle("code", "Export Packet (JSON)")}
                <pre className={`text-xs rounded-xl p-4 overflow-auto leading-relaxed border ${isDark ? "bg-black/40 border-white/10 text-emerald-300" : "bg-gray-50 border-gray-200 text-emerald-700"}`}>
                  {JSON.stringify(packet, null, 2)}
                </pre>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
                      const url  = URL.createObjectURL(blob);
                      const a    = document.createElement("a");
                      a.href     = url;
                      a.download = `audio_qa_${sample.id}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold uppercase tracking-wider transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                    Download JSON
                  </button>
                  <button
                    onClick={() => { setSampleIdx(i => (i + 1) % SAMPLES.length); setStage("ingest"); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors ${
                      isDark ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>skip_next</span>
                    Next Sample
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
