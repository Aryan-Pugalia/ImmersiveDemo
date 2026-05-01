import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";

// ─── Types ──────────────────────────────────────────────────────────────────

type IntentUnderstanding = "correctly_understood" | "partially_understood" | "misunderstood";
type IntentCategory      = "navigation" | "vehicle_control" | "media" | "communication" | "system_settings";
type FulfillmentAccuracy = "fully_fulfilled" | "partially_fulfilled" | "not_fulfilled";
type ClarificationNeeded = "no" | "yes";
type RiskLevel           = "safe" | "ambiguous" | "unsafe";
type Stage               = "ingest" | "annotate" | "ai-verify" | "qa" | "export";
type QADecision          = "accept_human" | "accept_ai" | "override";

interface VoiceCommandSample {
  id:                      string;
  spokenCommand:           string;
  systemInterpretedIntent: string;
  systemAction:            string;
  language:                string;
  vehicleContext:          "Driving" | "Parked";
  systemInvoked:           string;
  audioSrc:                string;
  duration:                string;
  recordedAt:              string;
}

interface HumanAnnotation {
  intentUnderstanding: IntentUnderstanding | null;
  intentCategory:      IntentCategory | null;
  fulfillmentAccuracy: FulfillmentAccuracy | null;
  clarificationNeeded: ClarificationNeeded | null;
  notes:               string;
}

interface AIResult {
  intentAgreement:      boolean;
  fulfillmentAgreement: boolean;
  confidence:           number;
  justification:        string;
  suggestedIntent:      IntentUnderstanding;
  suggestedFulfillment: FulfillmentAccuracy;
}

interface QAEntry {
  intentDecision:      QADecision | null;
  fulfillmentDecision: QADecision | null;
  intentOverride:      IntentUnderstanding | null;
  fulfillmentOverride: FulfillmentAccuracy | null;
  riskLevel:           RiskLevel | null;
}

// ─── Sample data ─────────────────────────────────────────────────────────────

const SAMPLES: VoiceCommandSample[] = [
  {
    id:                      "vc_cmd_118",
    spokenCommand:           "Emmène-moi à la station de recharge la plus proche en évitant les autoroutes",
    systemInterpretedIntent: "Route to nearest EV charging station",
    systemAction:            "Navigation initiated — fastest route via highway selected. Avoid-highways preference not applied.",
    language:                "French (FR)",
    vehicleContext:          "Driving",
    systemInvoked:           "Navigation",
    audioSrc:                "/queues/French/Audio.mp3",
    duration:                "0:06",
    recordedAt:              "2025-04-11",
  },
  {
    id:                      "vc_cmd_241",
    spokenCommand:           "Pon la temperatura de la cabina a 22 grados y apaga el desempañador trasero",
    systemInterpretedIntent: "Set climate target temperature to 22°C",
    systemAction:            "Climate zone set to 22°C. Rear defogger state unchanged.",
    language:                "Spanish (ES)",
    vehicleContext:          "Parked",
    systemInvoked:           "Climate / Vehicle Control",
    audioSrc:                "/queues/Spanish/Audio.mp3",
    duration:                "0:07",
    recordedAt:              "2025-04-14",
  },
  {
    id:                      "vc_cmd_307",
    spokenCommand:           "Call home and tell them I'll be about 20 minutes late",
    systemInterpretedIntent: "Initiate call to contact labelled 'Home'",
    systemAction:            "Dialling 'Home'. Message relay not offered — free-text SMS not triggered.",
    language:                "English (US)",
    vehicleContext:          "Driving",
    systemInvoked:           "Communication",
    audioSrc:                "/queues/Hindi/Audio.mp3",
    duration:                "0:08",
    recordedAt:              "2025-04-17",
  },
];

const AI_RESULTS: Record<string, AIResult> = {
  vc_cmd_118: {
    intentAgreement:      false,
    fulfillmentAgreement: false,
    confidence:           0.84,
    justification:        "Command contains a compound instruction — destination resolved correctly, but route-preference modifier was not extracted or forwarded to the routing engine.",
    suggestedIntent:      "partially_understood",
    suggestedFulfillment: "partially_fulfilled",
  },
  vc_cmd_241: {
    intentAgreement:      true,
    fulfillmentAgreement: false,
    confidence:           0.91,
    justification:        "Temperature intent extracted correctly; secondary command (defogger off) was present in utterance but not executed — likely a command-chaining gap.",
    suggestedIntent:      "partially_understood",
    suggestedFulfillment: "partially_fulfilled",
  },
  vc_cmd_307: {
    intentAgreement:      true,
    fulfillmentAgreement: false,
    confidence:           0.77,
    justification:        "Primary call intent fulfilled; implicit message relay ('tell them') was not interpreted as an actionable sub-task — clarification prompt would reduce user friction.",
    suggestedIntent:      "partially_understood",
    suggestedFulfillment: "partially_fulfilled",
  },
};

const EMPTY_HUMAN: HumanAnnotation = {
  intentUnderstanding: null,
  intentCategory:      null,
  fulfillmentAccuracy: null,
  clarificationNeeded: null,
  notes:               "",
};

const EMPTY_QA: QAEntry = {
  intentDecision:      null,
  fulfillmentDecision: null,
  intentOverride:      null,
  fulfillmentOverride: null,
  riskLevel:           null,
};

// ─── Waveform mock ────────────────────────────────────────────────────────────

const WAVEFORM_BARS = 80;

function generateBars(seed: number): number[] {
  const bars: number[] = [];
  let v = seed;
  for (let i = 0; i < WAVEFORM_BARS; i++) {
    v = (v * 1664525 + 1013904223) & 0xffffffff;
    const base   = ((v >>> 17) & 0xff) / 255;
    const shaped = 0.12 + base * 0.72 * Math.sin((i / WAVEFORM_BARS) * Math.PI);
    bars.push(Math.max(0.05, shaped));
  }
  return bars;
}

const SAMPLE_BARS: Record<string, number[]> = {
  vc_cmd_118: generateBars(118),
  vc_cmd_241: generateBars(241),
  vc_cmd_307: generateBars(307),
};

const LANG_FLAG: Record<string, string> = {
  "French (FR)":  "🇫🇷",
  "Spanish (ES)": "🇪🇸",
  "English (US)": "🇺🇸",
};

// ─── Pipeline stages ─────────────────────────────────────────────────────────

const STAGES: Stage[] = ["ingest", "annotate", "ai-verify", "qa", "export"];

const STAGE_META: Record<Stage, { icon: string; label: string }> = {
  ingest:     { icon: "mic",       label: "Ingest"      },
  annotate:   { icon: "edit_note", label: "Annotate"    },
  "ai-verify":{ icon: "smart_toy", label: "AI Verify"   },
  qa:         { icon: "rule",      label: "QA Review"   },
  export:     { icon: "download",  label: "Export"      },
};

// ─── Intent / fulfillment display maps ───────────────────────────────────────

const INTENT_LABELS: Record<IntentUnderstanding, string> = {
  correctly_understood: "Correctly Understood",
  partially_understood: "Partially Understood",
  misunderstood:        "Misunderstood",
};

const INTENT_COLORS_DARK: Record<IntentUnderstanding, string> = {
  correctly_understood: "bg-emerald-600 text-white border-emerald-500",
  partially_understood: "bg-amber-500 text-white border-amber-400",
  misunderstood:        "bg-rose-600 text-white border-rose-500",
};
const INTENT_COLORS_LIGHT: Record<IntentUnderstanding, string> = {
  correctly_understood: "bg-emerald-500 text-white border-emerald-500",
  partially_understood: "bg-amber-500 text-white border-amber-400",
  misunderstood:        "bg-rose-500 text-white border-rose-400",
};
const INTENT_BADGE_DARK: Record<IntentUnderstanding, string> = {
  correctly_understood: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  partially_understood: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  misunderstood:        "bg-rose-500/15 text-rose-400 border-rose-500/30",
};
const INTENT_BADGE_LIGHT: Record<IntentUnderstanding, string> = {
  correctly_understood: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partially_understood: "bg-amber-50 text-amber-700 border-amber-200",
  misunderstood:        "bg-rose-50 text-rose-700 border-rose-200",
};

const FULFILLMENT_LABELS: Record<FulfillmentAccuracy, string> = {
  fully_fulfilled:     "Fully Fulfilled",
  partially_fulfilled: "Partially Fulfilled",
  not_fulfilled:       "Not Fulfilled",
};
const FULFILLMENT_BADGE_DARK: Record<FulfillmentAccuracy, string> = {
  fully_fulfilled:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  partially_fulfilled: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  not_fulfilled:       "bg-rose-500/15 text-rose-400 border-rose-500/30",
};
const FULFILLMENT_BADGE_LIGHT: Record<FulfillmentAccuracy, string> = {
  fully_fulfilled:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  partially_fulfilled: "bg-amber-50 text-amber-700 border-amber-200",
  not_fulfilled:       "bg-rose-50 text-rose-700 border-rose-200",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  safe:      "Safe",
  ambiguous: "Ambiguous",
  unsafe:    "Unsafe / Incorrect Action",
};
const RISK_BADGE_DARK: Record<RiskLevel, string> = {
  safe:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  ambiguous: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  unsafe:    "bg-rose-500/15 text-rose-400 border-rose-500/30",
};
const RISK_BADGE_LIGHT: Record<RiskLevel, string> = {
  safe:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  ambiguous: "bg-amber-50 text-amber-700 border-amber-200",
  unsafe:    "bg-rose-50 text-rose-700 border-rose-200",
};
const RISK_COLORS_DARK: Record<RiskLevel, string> = {
  safe:      "bg-emerald-600 text-white border-emerald-500",
  ambiguous: "bg-amber-500 text-white border-amber-400",
  unsafe:    "bg-rose-600 text-white border-rose-500",
};
const RISK_COLORS_LIGHT: Record<RiskLevel, string> = {
  safe:      "bg-emerald-500 text-white border-emerald-500",
  ambiguous: "bg-amber-500 text-white border-amber-400",
  unsafe:    "bg-rose-500 text-white border-rose-400",
};

const CATEGORY_LABELS: Record<IntentCategory, string> = {
  navigation:      "Navigation",
  vehicle_control: "Vehicle Control",
  media:           "Media",
  communication:   "Communication",
  system_settings: "System Settings",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function PipelineStepper({ current, isDark }: { current: Stage; isDark: boolean }) {
  const currentIdx = STAGES.indexOf(current);
  return (
    <div className="flex items-center gap-0 mb-10 overflow-x-auto pb-1">
      {STAGES.map((s, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                done   ? "bg-violet-600 border-violet-600"
                : active ? "bg-violet-600/20 border-violet-500"
                : isDark  ? "bg-white/5 border-white/15"
                :           "bg-gray-100 border-gray-300"
              }`}>
                {done
                  ? <span className="material-symbols-outlined text-white" style={{ fontSize: 16 }}>check</span>
                  : <span className={`material-symbols-outlined ${active ? "text-violet-400" : isDark ? "text-white/30" : "text-gray-400"}`} style={{ fontSize: 16 }}>{STAGE_META[s].icon}</span>
                }
              </div>
              <span className={`text-[10px] mt-1 font-bold uppercase tracking-wide whitespace-nowrap ${active ? "text-violet-400" : isDark ? "text-white/40" : "text-gray-400"}`}>
                {STAGE_META[s].label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-[2px] w-10 md:w-14 mx-1 mb-4 rounded-full transition-all ${done ? "bg-violet-600" : isDark ? "bg-white/10" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function WaveformPlayer({ sampleId, audioSrc, isDark }: { sampleId: string; audioSrc: string; isDark: boolean }) {
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef   = useRef<number | null>(null);
  const bars = SAMPLE_BARS[sampleId] ?? SAMPLE_BARS["vc_cmd_118"];

  useEffect(() => {
    audioRef.current?.pause();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    setProgress(0);
    const audio = new Audio(audioSrc);
    audio.addEventListener("ended", () => { setPlaying(false); setProgress(1); });
    audioRef.current = audio;
    return () => { audio.pause(); };
  }, [audioSrc]);

  useEffect(() => {
    if (!playing) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }
    const tick = () => {
      const a = audioRef.current;
      if (a && a.duration) setProgress(a.currentTime / a.duration);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing]);

  useEffect(() => () => { audioRef.current?.pause(); if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); } else { a.play().catch(() => {}); setPlaying(true); }
  }, [playing]);

  const playheadX = Math.round(progress * WAVEFORM_BARS);

  return (
    <div className={`rounded-xl p-4 border ${isDark ? "bg-white/3 border-white/10" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-center gap-3 mb-3">
        <button onClick={toggle}
          className="w-10 h-10 rounded-full bg-violet-600 hover:bg-violet-500 flex items-center justify-center transition-colors flex-shrink-0">
          <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>
            {playing ? "pause" : "play_arrow"}
          </span>
        </button>
        <div className="flex-1 overflow-hidden">
          <svg width="100%" height="48" viewBox={`0 0 ${WAVEFORM_BARS * 5} 48`} preserveAspectRatio="none">
            {bars.map((h, i) => {
              const barH = Math.max(3, h * 44);
              const y    = (48 - barH) / 2;
              return (
                <rect key={i} x={i * 5} y={y} width={3} height={barH} rx={1.5}
                  fill={i < playheadX ? "#7c3aed" : isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)"}/>
              );
            })}
            <line x1={playheadX * 5} x2={playheadX * 5} y1={0} y2={48} stroke="#a78bfa" strokeWidth={1.5}/>
          </svg>
        </div>
      </div>
      <div className="flex justify-between text-xs font-mono">
        <span className={isDark ? "text-white/40" : "text-gray-400"}>{playing ? "▶ Playing…" : "● Stopped"}</span>
        <span className={isDark ? "text-white/40" : "text-gray-400"}>{Math.round(progress * 100)}%</span>
      </div>
    </div>
  );
}

function ConfidenceBar({ value, isDark }: { value: number; isDark: boolean }) {
  const pct   = Math.round(value * 100);
  const color = value >= 0.85 ? "bg-emerald-500" : value >= 0.7 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 h-1.5 rounded-full ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }}/>
      </div>
      <span className={`text-[10px] font-mono w-8 text-right ${isDark ? "text-white/50" : "text-gray-500"}`}>{pct}%</span>
    </div>
  );
}

function IntentBadge({ v, isDark }: { v: IntentUnderstanding; isDark: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${isDark ? INTENT_BADGE_DARK[v] : INTENT_BADGE_LIGHT[v]}`}>
      {INTENT_LABELS[v]}
    </span>
  );
}

function FulfillBadge({ v, isDark }: { v: FulfillmentAccuracy; isDark: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${isDark ? FULFILLMENT_BADGE_DARK[v] : FULFILLMENT_BADGE_LIGHT[v]}`}>
      {FULFILLMENT_LABELS[v]}
    </span>
  );
}

function RiskBadge({ v, isDark }: { v: RiskLevel; isDark: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${isDark ? RISK_BADGE_DARK[v] : RISK_BADGE_LIGHT[v]}`}>
      {RISK_LABELS[v]}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VoiceCommandIntentQA() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [stage,      setStage]      = useState<Stage>("ingest");
  const [sampleIdx,  setSampleIdx]  = useState(0);
  const [annotations, setAnnotations] = useState<Record<string, HumanAnnotation>>({});
  const [qaMap,       setQaMap]       = useState<Record<string, QAEntry>>({});

  const sample     = SAMPLES[sampleIdx];
  const annotation = annotations[sample.id] ?? EMPTY_HUMAN;
  const qa         = qaMap[sample.id]        ?? EMPTY_QA;
  const aiResult   = AI_RESULTS[sample.id];

  // ── Annotation helpers ────────────────────────────────────────────────────

  function patchAnnotation(patch: Partial<HumanAnnotation>) {
    setAnnotations(prev => ({ ...prev, [sample.id]: { ...(prev[sample.id] ?? EMPTY_HUMAN), ...patch } }));
  }

  function patchQA(patch: Partial<QAEntry>) {
    setQaMap(prev => ({ ...prev, [sample.id]: { ...(prev[sample.id] ?? EMPTY_QA), ...patch } }));
  }

  const canSubmitAnnotation =
    annotation.intentUnderstanding !== null &&
    annotation.intentCategory      !== null &&
    annotation.fulfillmentAccuracy !== null &&
    annotation.clarificationNeeded !== null;

  const canSubmitQA =
    qa.intentDecision      !== null &&
    qa.fulfillmentDecision !== null &&
    qa.riskLevel           !== null &&
    (qa.intentDecision      !== "override" || qa.intentOverride      !== null) &&
    (qa.fulfillmentDecision !== "override" || qa.fulfillmentOverride !== null);

  // ── Final values for export ───────────────────────────────────────────────

  function resolvedIntent(): IntentUnderstanding {
    if (qa.intentDecision === "accept_human")  return annotation.intentUnderstanding ?? "partially_understood";
    if (qa.intentDecision === "accept_ai")     return aiResult.suggestedIntent;
    return qa.intentOverride ?? "partially_understood";
  }
  function resolvedFulfillment(): FulfillmentAccuracy {
    if (qa.fulfillmentDecision === "accept_human") return annotation.fulfillmentAccuracy ?? "partially_fulfilled";
    if (qa.fulfillmentDecision === "accept_ai")    return aiResult.suggestedFulfillment;
    return qa.fulfillmentOverride ?? "partially_fulfilled";
  }

  function buildExportPacket() {
    const intent      = resolvedIntent();
    const fulfillment = resolvedFulfillment();
    const risk        = qa.riskLevel ?? "ambiguous";
    const qaVerdict   =
      risk === "safe"      && fulfillment === "fully_fulfilled"    ? "approved_for_production"
      : risk === "unsafe"                                          ? "requires_retraining"
      :                                                              "approved_with_constraints";
    return {
      utterance_id:      sample.id,
      domain:            "InVehicle_Voice_Intent_QA",
      spoken_command:    sample.spokenCommand,
      intent:            annotation.intentCategory?.replace("_", "") ?? "navigation",
      human_label:       intent,
      ai_confidence:     aiResult.confidence,
      qa_final_verdict:  qaVerdict,
      risk_level:        risk,
      fulfillment:       fulfillment,
      clarification_needed: annotation.clarificationNeeded,
      vehicle_context:   sample.vehicleContext.toLowerCase(),
      system_invoked:    sample.systemInvoked.toLowerCase().replace(/\s+/g, "_"),
      annotated_at:      new Date().toISOString(),
    };
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  const cardCls = `rounded-2xl border p-6 ${isDark ? "bg-white/3 border-white/10" : "bg-white border-gray-200 shadow-sm"}`;

  function sectionTitle(icon: string, label: string, sub?: string) {
    return (
      <div className="flex items-start gap-2 mb-5">
        <span className="material-symbols-outlined text-violet-400 mt-0.5" style={{ fontSize: 20 }}>{icon}</span>
        <div>
          <h2 className={`text-sm font-bold uppercase tracking-widest ${isDark ? "text-white/70" : "text-gray-600"}`}>{label}</h2>
          {sub && <p className={`text-xs mt-0.5 ${isDark ? "text-white/35" : "text-gray-400"}`}>{sub}</p>}
        </div>
      </div>
    );
  }

  function ChoiceButton<T extends string>({
    value, current, label, colorActive, onClick,
  }: { value: T; current: T | null; label: string; colorActive: string; onClick: () => void }) {
    const isActive = current === value;
    return (
      <button onClick={onClick}
        className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
          isActive ? colorActive
          : isDark  ? "bg-transparent text-white/50 border-white/15 hover:border-white/30"
          :           "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
        }`}>
        {label}
      </button>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="dark-surface sticky top-0 z-50 bg-[hsl(0,0%,5%)] border-b border-border/20 w-full">
        <div className="flex justify-between items-center px-6 py-3 h-16">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-white/10 rounded-full transition-colors">
              <span className="material-symbols-outlined text-white">arrow_back</span>
            </button>
            <div>
              <span className="text-sm font-bold text-white font-headline">
                TP.ai <span style={{ color: "#9071f0" }}>Data</span>Studio
              </span>
              <span className="ml-3 text-xs font-mono px-2 py-0.5 rounded-full border border-violet-500/30 text-violet-400 bg-violet-500/10">
                AUD-404
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mr-1 hidden sm:block">Switch Sample:</span>
            {SAMPLES.map((s, i) => (
              <button key={s.id}
                onClick={() => { setSampleIdx(i); setStage("ingest"); }}
                title={`${s.id.replace("vc_cmd_", "VC-")} · ${s.language}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                  sampleIdx === i
                    ? "bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-500/20"
                    : "bg-transparent text-white/50 border-white/15 hover:text-white/90 hover:border-white/30 hover:bg-white/5"
                }`}>
                <span style={{ fontSize: "13px", lineHeight: 1 }}>{LANG_FLAG[s.language] ?? "🌐"}</span>
                <span className="hidden sm:inline">{s.id.replace("vc_cmd_", "VC-")}</span>
                <span className="hidden md:inline text-[10px] opacity-70">· {s.language.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient"/>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className={`text-2xl font-bold font-headline tracking-tight mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
            Voice Command Intent Understanding QA
          </h1>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
            Human-in-the-loop validation of spoken intent and system fulfillment in vehicles
          </p>
        </div>

        <PipelineStepper current={stage} isDark={isDark} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STAGE 1 — INGEST                                                  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stage === "ingest" && (
          <div className="space-y-6">
            <div className={cardCls}>
              {sectionTitle("mic", "Voice Command Ingestion", "Review the spoken command, system interpretation, and vehicle context before annotation.")}

              {/* Audio player */}
              <div className="mb-6">
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>Command Recording</p>
                <WaveformPlayer sampleId={sample.id} audioSrc={sample.audioSrc} isDark={isDark}/>
              </div>

              {/* Spoken command callout */}
              <div className={`rounded-xl p-4 border mb-6 ${isDark ? "bg-violet-500/8 border-violet-500/25" : "bg-violet-50 border-violet-200"}`}>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-violet-400 mt-0.5" style={{ fontSize: 18 }}>record_voice_over</span>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? "text-violet-400/70" : "text-violet-500"}`}>Spoken Command</p>
                    <p className={`text-base font-semibold leading-snug ${isDark ? "text-white" : "text-gray-900"}`}>
                      "{sample.spokenCommand}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Two-column: system interpretation + action */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className={`rounded-xl p-4 border ${isDark ? "bg-white/3 border-white/10" : "bg-gray-50 border-gray-200"}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>System Interpreted Intent</p>
                  <p className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>{sample.systemInterpretedIntent}</p>
                </div>
                <div className={`rounded-xl p-4 border ${isDark ? "bg-white/3 border-white/10" : "bg-gray-50 border-gray-200"}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>Resulting System Action</p>
                  <p className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>{sample.systemAction}</p>
                </div>
              </div>

              {/* Metadata grid */}
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>Recording Metadata</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "Utterance ID",    val: sample.id,             icon: "tag"             },
                    { label: "Language",        val: sample.language,       icon: "translate"       },
                    { label: "Vehicle Context", val: sample.vehicleContext, icon: "directions_car"  },
                    { label: "System Invoked",  val: sample.systemInvoked,  icon: "settings_voice"  },
                    { label: "Duration",        val: sample.duration,       icon: "timer"           },
                    { label: "Recorded",        val: sample.recordedAt,     icon: "calendar_today"  },
                  ].map(({ label, val, icon }) => (
                    <div key={label} className={`rounded-lg px-3 py-2.5 border flex items-center gap-2.5 ${isDark ? "border-white/8 bg-white/2" : "border-gray-100 bg-gray-50"}`}>
                      <span className={`material-symbols-outlined ${isDark ? "text-white/25" : "text-gray-300"}`} style={{ fontSize: 15 }}>{icon}</span>
                      <div className="min-w-0">
                        <p className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? "text-white/25" : "text-gray-400"}`}>{label}</p>
                        <p className={`text-xs font-mono truncate ${isDark ? "text-white/70" : "text-gray-700"}`}>{val}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => navigate("/use-cases")}
                className={`px-5 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors ${isDark ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"}`}>
                Back
              </button>
              <button onClick={() => setStage("annotate")}
                className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2">
                Begin Annotation
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_note</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STAGE 2 — ANNOTATE                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stage === "annotate" && (
          <div className="space-y-6">

            {/* Compact command reference */}
            <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${isDark ? "bg-violet-500/8 border-violet-500/20" : "bg-violet-50 border-violet-200"}`}>
              <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 16 }}>record_voice_over</span>
              <p className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-800"}`}>"{sample.spokenCommand}"</p>
              <span className={`ml-auto text-[10px] font-mono ${isDark ? "text-white/25" : "text-gray-400"}`}>{sample.id}</span>
            </div>

            <div className={cardCls}>
              {sectionTitle("edit_note", "Human Annotation — Intent & Fulfillment Labeling")}

              {/* Intent Understanding */}
              <div className="mb-6">
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>1 · Intent Understanding</p>
                <p className={`text-xs mb-3 ${isDark ? "text-white/35" : "text-gray-400"}`}>Was the spoken command correctly interpreted by the system?</p>
                <div className="flex flex-wrap gap-2">
                  {(["correctly_understood", "partially_understood", "misunderstood"] as IntentUnderstanding[]).map(v => (
                    <ChoiceButton key={v} value={v} current={annotation.intentUnderstanding}
                      label={INTENT_LABELS[v]}
                      colorActive={isDark ? INTENT_COLORS_DARK[v] : INTENT_COLORS_LIGHT[v]}
                      onClick={() => patchAnnotation({ intentUnderstanding: v })}/>
                  ))}
                </div>
              </div>

              {/* Intent Category */}
              <div className="mb-6">
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>2 · Intent Category</p>
                <p className={`text-xs mb-3 ${isDark ? "text-white/35" : "text-gray-400"}`}>Select the primary domain this command belongs to.</p>
                <div className="flex flex-wrap gap-2">
                  {(["navigation", "vehicle_control", "media", "communication", "system_settings"] as IntentCategory[]).map(v => (
                    <ChoiceButton key={v} value={v} current={annotation.intentCategory}
                      label={CATEGORY_LABELS[v]}
                      colorActive="bg-violet-600 text-white border-violet-500"
                      onClick={() => patchAnnotation({ intentCategory: v })}/>
                  ))}
                </div>
              </div>

              {/* Fulfillment Accuracy */}
              <div className="mb-6">
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>3 · Fulfillment Accuracy</p>
                <p className={`text-xs mb-3 ${isDark ? "text-white/35" : "text-gray-400"}`}>Did the system action match what the user requested?</p>
                <div className="flex flex-wrap gap-2">
                  {(["fully_fulfilled", "partially_fulfilled", "not_fulfilled"] as FulfillmentAccuracy[]).map(v => (
                    <ChoiceButton key={v} value={v} current={annotation.fulfillmentAccuracy}
                      label={FULFILLMENT_LABELS[v]}
                      colorActive={
                        v === "fully_fulfilled"  ? (isDark ? "bg-emerald-600 text-white border-emerald-500" : "bg-emerald-500 text-white border-emerald-500")
                        : v === "partially_fulfilled" ? "bg-amber-500 text-white border-amber-400"
                        :                               (isDark ? "bg-rose-600 text-white border-rose-500" : "bg-rose-500 text-white border-rose-400")
                      }
                      onClick={() => patchAnnotation({ fulfillmentAccuracy: v })}/>
                  ))}
                </div>
              </div>

              {/* Clarification Needed */}
              <div className="mb-6">
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>4 · Clarification Required</p>
                <p className={`text-xs mb-3 ${isDark ? "text-white/35" : "text-gray-400"}`}>Should the system have asked a follow-up question before acting?</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { val: "no"  as ClarificationNeeded, label: "No — Action was appropriate"    },
                    { val: "yes" as ClarificationNeeded, label: "Yes — Follow-up was warranted"  },
                  ]).map(({ val, label }) => (
                    <ChoiceButton key={val} value={val} current={annotation.clarificationNeeded}
                      label={label}
                      colorActive={val === "no" ? (isDark ? "bg-emerald-600 text-white border-emerald-500" : "bg-emerald-500 text-white border-emerald-500") : "bg-amber-500 text-white border-amber-400"}
                      onClick={() => patchAnnotation({ clarificationNeeded: val })}/>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/40" : "text-gray-500"}`}>5 · Annotator Note <span className={`font-normal ${isDark ? "text-white/20" : "text-gray-300"}`}>(optional)</span></p>
                <textarea rows={3}
                  placeholder="Describe what was misunderstood, what action should have been taken, or any context relevant to the judgment…"
                  value={annotation.notes}
                  onChange={e => patchAnnotation({ notes: e.target.value })}
                  className={`w-full text-sm rounded-lg border px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-none transition-colors ${
                    isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/20" : "bg-white border-gray-200 text-gray-800 placeholder:text-gray-300"
                  }`}/>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStage("ingest")}
                className={`px-5 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors ${isDark ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"}`}>
                Back
              </button>
              <button disabled={!canSubmitAnnotation} onClick={() => setStage("ai-verify")}
                className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2">
                Submit to AI Verification
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>smart_toy</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STAGE 3 — AI VERIFY                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stage === "ai-verify" && (
          <div className="space-y-6">
            <div className={cardCls}>
              {sectionTitle("smart_toy", "AI Verification Pass", "An intent-verification agent re-analyses the command and compares expected vs. actual system behaviour.")}

              {/* Agreement summary */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: "Intent Agreement",      val: aiResult.intentAgreement      ? "Agree" : "Disagree", color: aiResult.intentAgreement      ? "text-emerald-400" : "text-amber-400" },
                  { label: "Fulfillment Agreement", val: aiResult.fulfillmentAgreement ? "Agree" : "Disagree", color: aiResult.fulfillmentAgreement ? "text-emerald-400" : "text-amber-400" },
                  { label: "AI Confidence",         val: `${Math.round(aiResult.confidence * 100)}%`,          color: "text-violet-400" },
                ].map(({ label, val, color }) => (
                  <div key={label} className={`rounded-xl p-3 text-center border ${isDark ? "border-white/10 bg-white/3" : "border-gray-200 bg-gray-50"}`}>
                    <p className={`text-xl font-bold font-mono ${color}`}>{val}</p>
                    <p className={`text-[10px] uppercase tracking-wider mt-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Confidence bar */}
              <div className={`rounded-xl p-4 border mb-4 ${isDark ? "bg-white/3 border-white/10" : "bg-gray-50 border-gray-200"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>Model Confidence Score</p>
                <ConfidenceBar value={aiResult.confidence} isDark={isDark}/>
              </div>

              {/* Intent comparison */}
              <div className={`rounded-xl border p-4 mb-4 ${
                aiResult.intentAgreement
                  ? isDark ? "border-emerald-500/25 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50"
                  : isDark ? "border-amber-500/25 bg-amber-500/5"     : "border-amber-200 bg-amber-50"
              }`}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined ${isDark ? "text-white/40" : "text-gray-400"}`} style={{ fontSize: 16 }}>psychology</span>
                    <span className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Intent Understanding</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                      aiResult.intentAgreement
                        ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                        : isDark ? "bg-amber-500/20 text-amber-400"     : "bg-amber-100 text-amber-700"
                    }`}>
                      {aiResult.intentAgreement ? "AI Agrees" : "AI Disagrees"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>Human:</span>
                    {annotation.intentUnderstanding && <IntentBadge v={annotation.intentUnderstanding} isDark={isDark}/>}
                    <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>AI:</span>
                    <IntentBadge v={aiResult.suggestedIntent} isDark={isDark}/>
                  </div>
                </div>
              </div>

              {/* Fulfillment comparison */}
              <div className={`rounded-xl border p-4 mb-4 ${
                aiResult.fulfillmentAgreement
                  ? isDark ? "border-emerald-500/25 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50"
                  : isDark ? "border-amber-500/25 bg-amber-500/5"     : "border-amber-200 bg-amber-50"
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined ${isDark ? "text-white/40" : "text-gray-400"}`} style={{ fontSize: 16 }}>task_alt</span>
                    <span className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Fulfillment Accuracy</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                      aiResult.fulfillmentAgreement
                        ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                        : isDark ? "bg-amber-500/20 text-amber-400"     : "bg-amber-100 text-amber-700"
                    }`}>
                      {aiResult.fulfillmentAgreement ? "AI Agrees" : "AI Disagrees"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>Human:</span>
                    {annotation.fulfillmentAccuracy && <FulfillBadge v={annotation.fulfillmentAccuracy} isDark={isDark}/>}
                    <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>AI:</span>
                    <FulfillBadge v={aiResult.suggestedFulfillment} isDark={isDark}/>
                  </div>
                </div>
              </div>

              {/* AI justification */}
              <div className={`rounded-xl p-4 border ${isDark ? "border-white/8 bg-white/2" : "border-gray-100 bg-gray-50"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>AI Justification</p>
                <p className={`text-sm leading-relaxed ${isDark ? "text-white/60" : "text-gray-600"}`}>{aiResult.justification}</p>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStage("annotate")}
                className={`px-5 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors ${isDark ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"}`}>
                Back
              </button>
              <button onClick={() => setStage("qa")}
                className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2">
                Proceed to QA Review
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>rule</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STAGE 4 — QA ADJUDICATION                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stage === "qa" && (
          <div className="space-y-6">

            {/* Command reference */}
            <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${isDark ? "bg-violet-500/8 border-violet-500/20" : "bg-violet-50 border-violet-200"}`}>
              <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 16 }}>record_voice_over</span>
              <p className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-800"}`}>"{sample.spokenCommand}"</p>
            </div>

            {/* Three-column context */}
            <div className="grid grid-cols-3 gap-4">
              <div className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-white/3" : "border-gray-200 bg-white shadow-sm"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>Human Annotation</p>
                <div className="space-y-2">
                  {annotation.intentUnderstanding && <IntentBadge v={annotation.intentUnderstanding} isDark={isDark}/>}
                  {annotation.fulfillmentAccuracy  && <FulfillBadge v={annotation.fulfillmentAccuracy} isDark={isDark}/>}
                  {annotation.intentCategory && (
                    <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                      Category: {CATEGORY_LABELS[annotation.intentCategory]}
                    </p>
                  )}
                  {annotation.clarificationNeeded && (
                    <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                      Clarification: {annotation.clarificationNeeded === "yes" ? "Needed" : "Not needed"}
                    </p>
                  )}
                  {annotation.notes && (
                    <p className={`text-xs italic mt-1 ${isDark ? "text-white/35" : "text-gray-400"}`}>"{annotation.notes}"</p>
                  )}
                </div>
              </div>
              <div className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-white/3" : "border-gray-200 bg-white shadow-sm"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>AI Verification</p>
                <div className="space-y-2">
                  <IntentBadge v={aiResult.suggestedIntent} isDark={isDark}/>
                  <FulfillBadge v={aiResult.suggestedFulfillment} isDark={isDark}/>
                  <ConfidenceBar value={aiResult.confidence} isDark={isDark}/>
                </div>
              </div>
              <div className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-white/3" : "border-gray-200 bg-white shadow-sm"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>Discrepancies</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`material-symbols-outlined text-sm ${aiResult.intentAgreement ? "text-emerald-400" : "text-amber-400"}`} style={{ fontSize: 14 }}>
                      {aiResult.intentAgreement ? "check_circle" : "warning"}
                    </span>
                    <span className={`text-xs ${isDark ? "text-white/60" : "text-gray-600"}`}>Intent</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`material-symbols-outlined ${aiResult.fulfillmentAgreement ? "text-emerald-400" : "text-amber-400"}`} style={{ fontSize: 14 }}>
                      {aiResult.fulfillmentAgreement ? "check_circle" : "warning"}
                    </span>
                    <span className={`text-xs ${isDark ? "text-white/60" : "text-gray-600"}`}>Fulfillment</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={cardCls}>
              {sectionTitle("rule", "QA Adjudication", "Accept the human judgment, apply the AI correction, or override both with a definitive ruling.")}

              {/* Intent decision */}
              <div className={`rounded-xl border p-4 mb-4 ${isDark ? "border-white/10 bg-white/2" : "border-gray-200 bg-white"}`}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/40" : "text-gray-500"}`}>Intent Understanding — Final Call</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {([
                    { val: "accept_human" as QADecision, label: "Accept Human" },
                    { val: "accept_ai"    as QADecision, label: "Accept AI"    },
                    { val: "override"     as QADecision, label: "Override Both" },
                  ]).map(({ val, label }) => (
                    <button key={val} onClick={() => patchQA({ intentDecision: val, intentOverride: null })}
                      className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
                        qa.intentDecision === val
                          ? val === "override" ? "bg-rose-600 text-white border-rose-500" : "bg-violet-600 text-white border-violet-500"
                          : isDark ? "bg-transparent text-white/50 border-white/15 hover:border-white/30" : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                {qa.intentDecision === "override" && (
                  <div className="flex flex-wrap gap-2">
                    {(["correctly_understood", "partially_understood", "misunderstood"] as IntentUnderstanding[]).map(v => (
                      <button key={v} onClick={() => patchQA({ intentOverride: v })}
                        className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
                          qa.intentOverride === v
                            ? isDark ? INTENT_COLORS_DARK[v] : INTENT_COLORS_LIGHT[v]
                            : isDark ? "bg-transparent text-white/50 border-white/15 hover:border-white/30" : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
                        }`}>
                        {INTENT_LABELS[v]}
                      </button>
                    ))}
                  </div>
                )}
                {qa.intentDecision && (qa.intentDecision !== "override" || qa.intentOverride) && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-300"}`}>Final:</span>
                    <IntentBadge v={resolvedIntent()} isDark={isDark}/>
                  </div>
                )}
              </div>

              {/* Fulfillment decision */}
              <div className={`rounded-xl border p-4 mb-4 ${isDark ? "border-white/10 bg-white/2" : "border-gray-200 bg-white"}`}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/40" : "text-gray-500"}`}>Fulfillment Accuracy — Final Call</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {([
                    { val: "accept_human" as QADecision, label: "Accept Human" },
                    { val: "accept_ai"    as QADecision, label: "Accept AI"    },
                    { val: "override"     as QADecision, label: "Override Both" },
                  ]).map(({ val, label }) => (
                    <button key={val} onClick={() => patchQA({ fulfillmentDecision: val, fulfillmentOverride: null })}
                      className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
                        qa.fulfillmentDecision === val
                          ? val === "override" ? "bg-rose-600 text-white border-rose-500" : "bg-violet-600 text-white border-violet-500"
                          : isDark ? "bg-transparent text-white/50 border-white/15 hover:border-white/30" : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                {qa.fulfillmentDecision === "override" && (
                  <div className="flex flex-wrap gap-2">
                    {(["fully_fulfilled", "partially_fulfilled", "not_fulfilled"] as FulfillmentAccuracy[]).map(v => (
                      <button key={v} onClick={() => patchQA({ fulfillmentOverride: v })}
                        className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
                          qa.fulfillmentOverride === v
                            ? v === "fully_fulfilled" ? (isDark ? "bg-emerald-600 text-white border-emerald-500" : "bg-emerald-500 text-white border-emerald-500") : v === "partially_fulfilled" ? "bg-amber-500 text-white border-amber-400" : (isDark ? "bg-rose-600 text-white border-rose-500" : "bg-rose-500 text-white border-rose-400")
                            : isDark ? "bg-transparent text-white/50 border-white/15 hover:border-white/30" : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
                        }`}>
                        {FULFILLMENT_LABELS[v]}
                      </button>
                    ))}
                  </div>
                )}
                {qa.fulfillmentDecision && (qa.fulfillmentDecision !== "override" || qa.fulfillmentOverride) && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-300"}`}>Final:</span>
                    <FulfillBadge v={resolvedFulfillment()} isDark={isDark}/>
                  </div>
                )}
              </div>

              {/* Risk level */}
              <div className={`rounded-xl border p-4 ${isDark ? "border-white/10 bg-white/2" : "border-gray-200 bg-white"}`}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>Final Risk Assessment</p>
                <p className={`text-xs mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>What is the safety implication of this intent handling failure, if any?</p>
                <div className="flex flex-wrap gap-2">
                  {(["safe", "ambiguous", "unsafe"] as RiskLevel[]).map(v => (
                    <button key={v} onClick={() => patchQA({ riskLevel: v })}
                      className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
                        qa.riskLevel === v
                          ? isDark ? RISK_COLORS_DARK[v] : RISK_COLORS_LIGHT[v]
                          : isDark ? "bg-transparent text-white/50 border-white/15 hover:border-white/30" : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
                      }`}>
                      {RISK_LABELS[v]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStage("ai-verify")}
                className={`px-5 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors ${isDark ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"}`}>
                Back
              </button>
              <button disabled={!canSubmitQA} onClick={() => setStage("export")}
                className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2">
                Finalize &amp; Export
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STAGE 5 — EXPORT                                                  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stage === "export" && (() => {
          const packet    = buildExportPacket();
          const intent    = resolvedIntent();
          const fulfil    = resolvedFulfillment();
          const risk      = qa.riskLevel!;
          const disagreements = [!aiResult.intentAgreement, !aiResult.fulfillmentAgreement].filter(Boolean).length;

          const statusLabel =
            packet.qa_final_verdict === "approved_for_production"   ? "Approved for Production"
            : packet.qa_final_verdict === "approved_with_constraints" ? "Approved with Constraints"
            : "Requires Retraining";
          const statusColor =
            packet.qa_final_verdict === "approved_for_production"   ? "text-emerald-400"
            : packet.qa_final_verdict === "approved_with_constraints" ? "text-amber-400"
            : "text-rose-400";

          return (
            <div className="space-y-6">
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Downstream Status",    val: statusLabel,                          color: statusColor         },
                  { label: "Final Intent Verdict",  val: INTENT_LABELS[intent],               color: isDark ? "text-white" : "text-gray-900" },
                  { label: "Human–AI Disagreements",val: String(disagreements),               color: disagreements > 0 ? "text-amber-400" : "text-emerald-400" },
                  { label: "Risk Level",            val: RISK_LABELS[risk],                   color: risk === "safe" ? "text-emerald-400" : risk === "ambiguous" ? "text-amber-400" : "text-rose-400" },
                ].map(({ label, val, color }) => (
                  <div key={label} className={`rounded-xl border p-4 text-center ${isDark ? "border-white/10 bg-white/3" : "border-gray-200 bg-white shadow-sm"}`}>
                    <p className={`text-sm font-bold font-mono uppercase leading-tight ${color}`}>{val}</p>
                    <p className={`text-[10px] uppercase tracking-widest mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Final verdict summary */}
              <div className={cardCls}>
                {sectionTitle("verified", "Final QA Summary")}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className={`rounded-xl p-3 border ${isDark ? "border-white/8 bg-white/2" : "border-gray-100 bg-gray-50"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>Intent Classification</p>
                    <IntentBadge v={intent} isDark={isDark}/>
                    {annotation.intentCategory && (
                      <p className={`text-xs mt-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>{CATEGORY_LABELS[annotation.intentCategory]}</p>
                    )}
                  </div>
                  <div className={`rounded-xl p-3 border ${isDark ? "border-white/8 bg-white/2" : "border-gray-100 bg-gray-50"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>Fulfillment Verdict</p>
                    <FulfillBadge v={fulfil} isDark={isDark}/>
                    <p className={`text-xs mt-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>
                      Clarification: {annotation.clarificationNeeded === "yes" ? "Required" : "Not required"}
                    </p>
                  </div>
                  <div className={`rounded-xl p-3 border ${isDark ? "border-white/8 bg-white/2" : "border-gray-100 bg-gray-50"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>Risk Level</p>
                    <RiskBadge v={risk} isDark={isDark}/>
                    <p className={`text-xs mt-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>
                      AI confidence: {Math.round(aiResult.confidence * 100)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* JSON export */}
              <div className={cardCls}>
                {sectionTitle("code", "Decision Packet — JSON Export")}
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
                      a.download = `voice_intent_qa_${sample.id}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold uppercase tracking-wider transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                    Download JSON
                  </button>
                  <button
                    onClick={() => {
                      const header = Object.keys(packet).join(",");
                      const row    = Object.values(packet).map(v => `"${v}"`).join(",");
                      const blob   = new Blob([header + "\n" + row], { type: "text/csv" });
                      const url    = URL.createObjectURL(blob);
                      const a      = document.createElement("a");
                      a.href       = url;
                      a.download   = `voice_intent_qa_${sample.id}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors ${isDark ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>table_chart</span>
                    Export CSV
                  </button>
                  <button
                    onClick={() => { setSampleIdx(i => (i + 1) % SAMPLES.length); setStage("ingest"); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors ml-auto ${isDark ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>skip_next</span>
                    Next Command
                  </button>
                </div>
              </div>

              {/* Scale callout */}
              <div className={`rounded-2xl p-5 ${isDark ? "bg-white/3 border border-white/8" : "bg-gray-50 border border-gray-200"}`}>
                <p className={`text-sm font-bold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>How TP Operationalises This at Scale</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    { val: "500K+", sub: "Voice commands reviewed monthly" },
                    { val: "97.2%", sub: "Intent classification consistency" },
                    { val: "12+",   sub: "OEM and Tier-1 programmes active" },
                  ].map(kpi => (
                    <div key={kpi.val}>
                      <p className="text-2xl font-black text-violet-400">{kpi.val}</p>
                      <p className={`text-xs mt-0.5 ${isDark ? "text-white/35" : "text-gray-500"}`}>{kpi.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
