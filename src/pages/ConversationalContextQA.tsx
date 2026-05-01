import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContextRetention      = "fully_retained" | "partially_retained" | "context_lost";
type ContextFailureType    = "lost_previous_constraint" | "incorrect_entity_reference" | "reset_conversation_state" | "misapplied_followup";
type TurnContinuity        = "correctly_interpreted" | "ambiguous" | "incorrectly_interpreted";
type UserFrictionRisk      = "low" | "medium" | "high";
type ProductionSuitability = "ready" | "needs_retraining" | "unsafe";
type Stage                 = "annotate" | "ai-verify" | "qa" | "export";
type QADecision            = "accept_human" | "accept_ai" | "override";

interface ConversationTurn {
  id:             string;
  turnNumber:     number;
  utterance:      string;
  systemResponse: string;
}

interface ConversationSession {
  id:             string;
  language:       string;
  drivingContext: "Moving" | "Stationary";
  sessionType:    string;
  audioSrc:       string;
  recordedAt:     string;
  turns:          ConversationTurn[];
}

interface HumanAnnotation {
  contextRetention: ContextRetention | null;
  failureType:      ContextFailureType | null;
  turnContinuity:   Record<string, TurnContinuity | null>;
  userFrictionRisk: UserFrictionRisk | null;
  notes:            string;
}

interface AIResult {
  contextAgreement:   boolean;
  confidence:         number;
  justification:      string;
  suggestedRetention: ContextRetention;
  flaggedTurns:       string[];
}

interface QAEntry {
  retentionDecision:     QADecision | null;
  retentionOverride:     ContextRetention | null;
  reliabilityScore:      number | null;
  productionSuitability: ProductionSuitability | null;
}

// ─── Session data ─────────────────────────────────────────────────────────────

const SESSIONS: ConversationSession[] = [
  {
    id: "voice_session_087", language: "French (FR)", drivingContext: "Moving",
    sessionType: "Navigation Refinement", audioSrc: "/queues/conversations/voice_session_087.m4a", recordedAt: "2025-04-11",
    turns: [
      { id: "t1", turnNumber: 1, utterance: "Emmène-moi à la station de recharge la plus proche.", systemResponse: "Navigation initiated — routing to nearest charging station, 3.2 km away." },
      { id: "t2", turnNumber: 2, utterance: "Assure-toi que c'est une charge rapide.", systemResponse: "Filter applied — re-routing to nearest fast charger, 5.1 km away." },
      { id: "t3", turnNumber: 3, utterance: "En fait, évite les autoroutes.", systemResponse: "Route updated via secondary roads. ETA now 22 minutes." },
      { id: "t4", turnNumber: 4, utterance: "C'est quoi l'heure d'arrivée prévue ?", systemResponse: "Re-routing to fastest available route — highway included. ETA 11 min. Avoid-highway preference not retained." },
    ],
  },
  {
    id: "voice_session_142", language: "Spanish (ES)", drivingContext: "Stationary",
    sessionType: "Climate & Media Control", audioSrc: "/queues/conversations/voice_session_142.m4a", recordedAt: "2025-04-14",
    turns: [
      { id: "t1", turnNumber: 1, utterance: "Pon la música de jazz en la zona trasera.", systemResponse: "Jazz playlist started on rear zone speakers." },
      { id: "t2", turnNumber: 2, utterance: "Baja un poco el volumen.", systemResponse: "Volume reduced on all zones — front and rear." },
      { id: "t3", turnNumber: 3, utterance: "Ahora pon la calefacción a 21 grados en la zona trasera.", systemResponse: "Cabin temperature set to 21°C system-wide. Rear-zone scoping not applied." },
      { id: "t4", turnNumber: 4, utterance: "¿Está la zona trasera a 21 grados?", systemResponse: "System confirmed 21°C. Rear-zone differential not tracked." },
    ],
  },
  {
    id: "voice_session_203", language: "English (US)", drivingContext: "Moving",
    sessionType: "Communication & Navigation", audioSrc: "/queues/conversations/voice_session_203.m4a", recordedAt: "2025-04-17",
    turns: [
      { id: "t1", turnNumber: 1, utterance: "Call the office and let them know I'm running 15 minutes late.", systemResponse: "Calling 'Office'. Message relay not offered — free-text SMS not triggered." },
      { id: "t2", turnNumber: 2, utterance: "Actually, send them a message instead.", systemResponse: "Call cancelled. Message composer opened — awaiting dictation." },
      { id: "t3", turnNumber: 3, utterance: "Tell them I'll be there by 10:30.", systemResponse: "Message sent: 'I'll be there by 10:30.' Recipient context retained." },
      { id: "t4", turnNumber: 4, utterance: "Now navigate to the office.", systemResponse: "Searching for 'office' — no saved location found. Prior recipient context not applied to navigation." },
      { id: "t5", turnNumber: 5, utterance: "It's the same address I always go to on Monday mornings.", systemResponse: "No pattern recognition available. User prompted to provide address manually." },
    ],
  },
];

const AI_RESULTS: Record<string, AIResult> = {
  voice_session_087: {
    contextAgreement: false, confidence: 0.79,
    justification: "Avoid-highway constraint set in Turn 3 was discarded during ETA recalculation in Turn 4 — route optimizer did not persist soft constraints across re-queries.",
    suggestedRetention: "partially_retained",
    flaggedTurns: ["t4"],
  },
  voice_session_142: {
    contextAgreement: true, confidence: 0.83,
    justification: "Zone scoping established in Turn 1 was not propagated to the climate command in Turn 3 — partial context with zone-binding gap.",
    suggestedRetention: "partially_retained",
    flaggedTurns: ["t3", "t4"],
  },
  voice_session_203: {
    contextAgreement: false, confidence: 0.71,
    justification: "Recipient context bridged correctly through Turn 3 but failed to transfer to the navigation intent in Turn 4 — cross-domain context handoff not implemented.",
    suggestedRetention: "context_lost",
    flaggedTurns: ["t4", "t5"],
  },
};

const EMPTY_HUMAN: HumanAnnotation = {
  contextRetention: null, failureType: null,
  turnContinuity: {}, userFrictionRisk: null, notes: "",
};

const EMPTY_QA: QAEntry = {
  retentionDecision: null, retentionOverride: null,
  reliabilityScore: null, productionSuitability: null,
};

// ─── Label & colour maps ──────────────────────────────────────────────────────

const RETENTION_LABELS: Record<ContextRetention, string> = {
  fully_retained:    "Fully Retained",
  partially_retained:"Partially Retained",
  context_lost:      "Context Lost",
};
const RETENTION_COLORS_DARK: Record<ContextRetention, string> = {
  fully_retained:    "bg-emerald-600 text-white border-emerald-500",
  partially_retained:"bg-amber-500 text-white border-amber-400",
  context_lost:      "bg-rose-600 text-white border-rose-500",
};
const RETENTION_COLORS_LIGHT: Record<ContextRetention, string> = {
  fully_retained:    "bg-emerald-500 text-white border-emerald-500",
  partially_retained:"bg-amber-500 text-white border-amber-400",
  context_lost:      "bg-rose-500 text-white border-rose-400",
};
const RETENTION_BADGE_DARK: Record<ContextRetention, string> = {
  fully_retained:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  partially_retained:"bg-amber-500/15 text-amber-400 border-amber-500/30",
  context_lost:      "bg-rose-500/15 text-rose-400 border-rose-500/30",
};
const RETENTION_BADGE_LIGHT: Record<ContextRetention, string> = {
  fully_retained:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  partially_retained:"bg-amber-50 text-amber-700 border-amber-200",
  context_lost:      "bg-rose-50 text-rose-700 border-rose-200",
};

const FAILURE_LABELS: Record<ContextFailureType, string> = {
  lost_previous_constraint:  "Lost Previous Constraint",
  incorrect_entity_reference:"Incorrect Entity Reference",
  reset_conversation_state:  "Reset Conversation State",
  misapplied_followup:       "Misapplied Follow-Up",
};

const CONTINUITY_LABELS: Record<TurnContinuity, string> = {
  correctly_interpreted:   "Correct",
  ambiguous:               "Ambiguous",
  incorrectly_interpreted: "Incorrect",
};
const CONTINUITY_COLORS_DARK: Record<TurnContinuity, string> = {
  correctly_interpreted:   "bg-emerald-600 text-white border-emerald-500",
  ambiguous:               "bg-amber-500 text-white border-amber-400",
  incorrectly_interpreted: "bg-rose-600 text-white border-rose-500",
};
const CONTINUITY_COLORS_LIGHT: Record<TurnContinuity, string> = {
  correctly_interpreted:   "bg-emerald-500 text-white border-emerald-500",
  ambiguous:               "bg-amber-500 text-white border-amber-400",
  incorrectly_interpreted: "bg-rose-500 text-white border-rose-400",
};
const CONTINUITY_BADGE_DARK: Record<TurnContinuity, string> = {
  correctly_interpreted:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  ambiguous:               "bg-amber-500/15 text-amber-400 border-amber-500/30",
  incorrectly_interpreted: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};
const CONTINUITY_BADGE_LIGHT: Record<TurnContinuity, string> = {
  correctly_interpreted:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  ambiguous:               "bg-amber-50 text-amber-700 border-amber-200",
  incorrectly_interpreted: "bg-rose-50 text-rose-700 border-rose-200",
};

const FRICTION_COLORS_DARK: Record<UserFrictionRisk, string> = {
  low:    "bg-emerald-600 text-white border-emerald-500",
  medium: "bg-amber-500 text-white border-amber-400",
  high:   "bg-rose-600 text-white border-rose-500",
};
const FRICTION_COLORS_LIGHT: Record<UserFrictionRisk, string> = {
  low:    "bg-emerald-500 text-white border-emerald-500",
  medium: "bg-amber-500 text-white border-amber-400",
  high:   "bg-rose-500 text-white border-rose-400",
};

const SUITABILITY_LABELS: Record<ProductionSuitability, string> = {
  ready:             "Ready for Production",
  needs_retraining:  "Needs Retraining",
  unsafe:            "Unsafe for Deployment",
};
const SUITABILITY_COLORS_DARK: Record<ProductionSuitability, string> = {
  ready:            "bg-emerald-600 text-white border-emerald-500",
  needs_retraining: "bg-amber-500 text-white border-amber-400",
  unsafe:           "bg-rose-600 text-white border-rose-500",
};
const SUITABILITY_COLORS_LIGHT: Record<ProductionSuitability, string> = {
  ready:            "bg-emerald-500 text-white border-emerald-500",
  needs_retraining: "bg-amber-500 text-white border-amber-400",
  unsafe:           "bg-rose-500 text-white border-rose-400",
};
const SUITABILITY_BADGE_DARK: Record<ProductionSuitability, string> = {
  ready:            "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  needs_retraining: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  unsafe:           "bg-rose-500/15 text-rose-400 border-rose-500/30",
};
const SUITABILITY_BADGE_LIGHT: Record<ProductionSuitability, string> = {
  ready:            "bg-emerald-50 text-emerald-700 border-emerald-200",
  needs_retraining: "bg-amber-50 text-amber-700 border-amber-200",
  unsafe:           "bg-rose-50 text-rose-700 border-rose-200",
};

const LANG_FLAG: Record<string, string> = {
  "French (FR)":  "🇫🇷",
  "Spanish (ES)": "🇪🇸",
  "English (US)": "🇺🇸",
};

// ─── Waveform ─────────────────────────────────────────────────────────────────

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

const SESSION_BARS: Record<string, number[]> = {
  voice_session_087: generateBars(87),
  voice_session_142: generateBars(142),
  voice_session_203: generateBars(203),
};

// ─── Pipeline stages ──────────────────────────────────────────────────────────

const STAGES: Stage[] = ["annotate", "ai-verify", "qa", "export"];
const STAGE_META: Record<Stage, { icon: string; label: string }> = {
  annotate:    { icon: "edit_note",  label: "Annotate"  },
  "ai-verify": { icon: "smart_toy", label: "AI Verify" },
  qa:          { icon: "rule",       label: "QA Review" },
  export:      { icon: "download",   label: "Export"    },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function WaveformPlayer({ sessionId, audioSrc, isDark }: { sessionId: string; audioSrc: string; isDark: boolean }) {
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef   = useRef<number | null>(null);
  const bars = SESSION_BARS[sessionId] ?? SESSION_BARS["voice_session_087"];

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
        <span className={isDark ? "text-white/40" : "text-gray-400"}>{playing ? "▶ Playing…" : "● Session Recording"}</span>
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

function RetentionBadge({ v, isDark }: { v: ContextRetention; isDark: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${isDark ? RETENTION_BADGE_DARK[v] : RETENTION_BADGE_LIGHT[v]}`}>
      {RETENTION_LABELS[v]}
    </span>
  );
}

function ContinuityBadge({ v, isDark }: { v: TurnContinuity; isDark: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${isDark ? CONTINUITY_BADGE_DARK[v] : CONTINUITY_BADGE_LIGHT[v]}`}>
      {CONTINUITY_LABELS[v]}
    </span>
  );
}

function SuitabilityBadge({ v, isDark }: { v: ProductionSuitability; isDark: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${isDark ? SUITABILITY_BADGE_DARK[v] : SUITABILITY_BADGE_LIGHT[v]}`}>
      {SUITABILITY_LABELS[v]}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ConversationalContextQA() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [stage,       setStage]       = useState<Stage>("annotate");
  const [sessionIdx,  setSessionIdx]  = useState(0);
  const [annotations, setAnnotations] = useState<Record<string, HumanAnnotation>>({});
  const [qaMap,       setQaMap]       = useState<Record<string, QAEntry>>({});

  const session    = SESSIONS[sessionIdx];
  const annotation = annotations[session.id] ?? EMPTY_HUMAN;
  const qa         = qaMap[session.id]        ?? EMPTY_QA;
  const aiResult   = AI_RESULTS[session.id];

  function patchAnnotation(patch: Partial<HumanAnnotation>) {
    setAnnotations(prev => ({ ...prev, [session.id]: { ...(prev[session.id] ?? EMPTY_HUMAN), ...patch } }));
  }

  function patchTurnContinuity(turnId: string, val: TurnContinuity) {
    setAnnotations(prev => {
      const existing = prev[session.id] ?? EMPTY_HUMAN;
      return { ...prev, [session.id]: { ...existing, turnContinuity: { ...existing.turnContinuity, [turnId]: val } } };
    });
  }

  function patchQA(patch: Partial<QAEntry>) {
    setQaMap(prev => ({ ...prev, [session.id]: { ...(prev[session.id] ?? EMPTY_QA), ...patch } }));
  }

  const allTurnsCovered = session.turns.every(t => (annotation.turnContinuity[t.id] ?? null) !== null);

  const canSubmitAnnotation =
    annotation.contextRetention !== null &&
    (annotation.contextRetention === "fully_retained" || annotation.failureType !== null) &&
    allTurnsCovered &&
    annotation.userFrictionRisk !== null;

  const canSubmitQA =
    qa.retentionDecision !== null &&
    (qa.retentionDecision !== "override" || qa.retentionOverride !== null) &&
    qa.reliabilityScore !== null &&
    qa.productionSuitability !== null;

  function resolvedRetention(): ContextRetention {
    if (qa.retentionDecision === "accept_human") return annotation.contextRetention ?? "partially_retained";
    if (qa.retentionDecision === "accept_ai")    return aiResult.suggestedRetention;
    return qa.retentionOverride ?? "partially_retained";
  }

  function buildExportPacket() {
    const retention    = resolvedRetention();
    const suitability  = qa.productionSuitability ?? "needs_retraining";
    const qaVerdict    =
      suitability === "ready"            ? "approved_for_production"
      : suitability === "unsafe"         ? "unsafe_for_deployment"
      :                                    "needs_retraining";
    const flaggedCount = aiResult.flaggedTurns.length;
    return {
      session_id:          session.id,
      domain:              "Conversational_Context_QA",
      language:            session.language,
      session_type:        session.sessionType.toLowerCase().replace(/\s+/g, "_"),
      turn_count:          session.turns.length,
      context_retention:   retention.replace("_retained", "").replace("context_", ""),
      failure_type:        annotation.failureType ?? null,
      human_label:         annotation.contextRetention?.replace("_retained", "").replace("context_", "") ?? null,
      ai_confidence:       aiResult.confidence,
      human_ai_agreement:  aiResult.contextAgreement,
      flagged_turns:       flaggedCount,
      qa_final_verdict:    qaVerdict,
      reliability_score:   qa.reliabilityScore,
      user_friction_risk:  annotation.userFrictionRisk,
      driving_context:     session.drivingContext.toLowerCase(),
      annotated_at:        new Date().toISOString(),
    };
  }

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

  function ChoiceBtn<T extends string>({
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

      {/* Header */}
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
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mr-1 hidden sm:block">Switch Session:</span>
            {SESSIONS.map((s, i) => (
              <button key={s.id}
                onClick={() => { setSessionIdx(i); setStage("annotate"); }}
                title={`${s.id} · ${s.language}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                  sessionIdx === i
                    ? "bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-500/20"
                    : "bg-transparent text-white/50 border-white/15 hover:text-white/90 hover:border-white/30 hover:bg-white/5"
                }`}>
                <span style={{ fontSize: "13px", lineHeight: 1 }}>{LANG_FLAG[s.language] ?? "🌐"}</span>
                <span className="hidden sm:inline">{s.language.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient"/>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className={`text-2xl font-bold font-headline tracking-tight mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
            Conversational Context Retention QA
          </h1>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
            Human-in-the-loop validation of multi-turn voice interactions in vehicles
          </p>
        </div>

        <PipelineStepper current={stage} isDark={isDark} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STAGE 1 — ANNOTATE (with conversation inline)                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stage === "annotate" && (
          <div className="space-y-6">

            {/* Conversation + audio side-by-side with annotation */}
            <div className="grid md:grid-cols-2 gap-6 items-start">

              {/* LEFT — session view */}
              <div className="space-y-4">
                <div className={cardCls}>
                  {sectionTitle("forum", "Session Recording", `${session.sessionType} · ${session.turns.length} turns · ${session.language}`)}
                  <WaveformPlayer sessionId={session.id} audioSrc={session.audioSrc} isDark={isDark}/>
                </div>

                <div className={cardCls}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    Conversation Transcript
                  </p>
                  <div className="space-y-2">
                    {session.turns.map((turn) => (
                      <div key={turn.id} className={`rounded-xl border overflow-hidden ${isDark ? "border-white/8" : "border-gray-200"}`}>
                        <div className={`flex items-start gap-3 px-3 py-2.5 ${isDark ? "bg-violet-500/8" : "bg-violet-50"}`}>
                          <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5 ${isDark ? "bg-violet-500/30 text-violet-300" : "bg-violet-100 text-violet-700"}`}>
                            {turn.turnNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${isDark ? "text-violet-400/60" : "text-violet-500"}`}>User</p>
                            <p className={`text-sm font-medium leading-snug ${isDark ? "text-white/90" : "text-gray-900"}`}>"{turn.utterance}"</p>
                          </div>
                        </div>
                        <div className={`flex items-start gap-3 px-3 py-2 ${isDark ? "bg-white/2" : "bg-gray-50"}`}>
                          <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${isDark ? "bg-white/8" : "bg-gray-200"}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.4)" : "#9ca3af" }}>smart_toy</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${isDark ? "text-white/25" : "text-gray-400"}`}>System</p>
                            <p className={`text-xs leading-snug ${isDark ? "text-white/55" : "text-gray-600"}`}>{turn.systemResponse}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT — annotation form */}
              <div className={cardCls}>
              {sectionTitle("edit_note", "Human Annotation — Context Retention Labeling")}

              {/* 1 - Context Retention Quality */}
              <div className="mb-6">
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>1 · Context Retention Quality</p>
                <p className={`text-xs mb-3 ${isDark ? "text-white/35" : "text-gray-400"}`}>How well did the system preserve conversational context across all turns?</p>
                <div className="flex flex-wrap gap-2">
                  {(["fully_retained", "partially_retained", "context_lost"] as ContextRetention[]).map(v => (
                    <ChoiceBtn key={v} value={v} current={annotation.contextRetention}
                      label={RETENTION_LABELS[v]}
                      colorActive={isDark ? RETENTION_COLORS_DARK[v] : RETENTION_COLORS_LIGHT[v]}
                      onClick={() => patchAnnotation({ contextRetention: v, failureType: v === "fully_retained" ? null : annotation.failureType })}/>
                  ))}
                </div>
              </div>

              {/* 2 - Context Failure Type (conditional) */}
              {annotation.contextRetention && annotation.contextRetention !== "fully_retained" && (
                <div className="mb-6">
                  <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>2 · Context Failure Type</p>
                  <p className={`text-xs mb-3 ${isDark ? "text-white/35" : "text-gray-400"}`}>Select the primary type of context failure observed.</p>
                  <div className="flex flex-wrap gap-2">
                    {(["lost_previous_constraint", "incorrect_entity_reference", "reset_conversation_state", "misapplied_followup"] as ContextFailureType[]).map(v => (
                      <ChoiceBtn key={v} value={v} current={annotation.failureType}
                        label={FAILURE_LABELS[v]}
                        colorActive="bg-rose-600 text-white border-rose-500"
                        onClick={() => patchAnnotation({ failureType: v })}/>
                    ))}
                  </div>
                </div>
              )}

              {/* 3 - Turn-level continuity */}
              <div className="mb-6">
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                  {annotation.contextRetention && annotation.contextRetention !== "fully_retained" ? "3" : "2"} · Turn-Level Continuity
                </p>
                <p className={`text-xs mb-3 ${isDark ? "text-white/35" : "text-gray-400"}`}>Label how each turn was handled by the system.</p>
                <div className="space-y-2">
                  {session.turns.map((turn) => {
                    const tc = annotation.turnContinuity[turn.id] ?? null;
                    return (
                      <div key={turn.id} className={`rounded-xl border p-3 ${isDark ? "border-white/8 bg-white/2" : "border-gray-200 bg-gray-50"}`}>
                        <div className="flex items-start gap-2 mb-2">
                          <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5 ${isDark ? "bg-violet-500/25 text-violet-300" : "bg-violet-100 text-violet-700"}`}>
                            {turn.turnNumber}
                          </span>
                          <p className={`text-xs leading-snug flex-1 ${isDark ? "text-white/60" : "text-gray-600"}`}>"{turn.utterance}"</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(["correctly_interpreted", "ambiguous", "incorrectly_interpreted"] as TurnContinuity[]).map(v => (
                            <button key={v} onClick={() => patchTurnContinuity(turn.id, v)}
                              className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all ${
                                tc === v
                                  ? isDark ? CONTINUITY_COLORS_DARK[v] : CONTINUITY_COLORS_LIGHT[v]
                                  : isDark ? "bg-transparent text-white/40 border-white/12 hover:border-white/25" : "bg-transparent text-gray-400 border-gray-200 hover:border-gray-300"
                              }`}>
                              {CONTINUITY_LABELS[v]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4 - User Friction Risk */}
              <div className="mb-6">
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                  {annotation.contextRetention && annotation.contextRetention !== "fully_retained" ? "4" : "3"} · User Friction Risk
                </p>
                <p className={`text-xs mb-3 ${isDark ? "text-white/35" : "text-gray-400"}`}>How much extra effort did context failures impose on the user?</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { val: "low"    as UserFrictionRisk, label: "Low — Minor inconvenience"     },
                    { val: "medium" as UserFrictionRisk, label: "Medium — Requires re-prompting" },
                    { val: "high"   as UserFrictionRisk, label: "High — Task abandoned or unsafe"},
                  ]).map(({ val, label }) => (
                    <ChoiceBtn key={val} value={val} current={annotation.userFrictionRisk}
                      label={label}
                      colorActive={isDark ? FRICTION_COLORS_DARK[val] : FRICTION_COLORS_LIGHT[val]}
                      onClick={() => patchAnnotation({ userFrictionRisk: val })}/>
                  ))}
                </div>
              </div>

              {/* 5 - Notes */}
              <div>
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                  {annotation.contextRetention && annotation.contextRetention !== "fully_retained" ? "5" : "4"} · Annotator Note{" "}
                  <span className={`font-normal ${isDark ? "text-white/20" : "text-gray-300"}`}>(optional)</span>
                </p>
                <textarea rows={3}
                  placeholder="Describe where context was lost, what should have been preserved, or any ambiguity in the interaction…"
                  value={annotation.notes}
                  onChange={e => patchAnnotation({ notes: e.target.value })}
                  className={`w-full text-sm rounded-lg border px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-none transition-colors ${
                    isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/20" : "bg-white border-gray-200 text-gray-800 placeholder:text-gray-300"
                  }`}/>
              </div>
              </div>{/* end right column */}
            </div>{/* end grid */}

            <div className="flex justify-between">
              <button onClick={() => navigate("/use-cases")}
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
              {sectionTitle("smart_toy", "AI Verification Pass", "A context-verification agent re-analyses the full session and checks whether the system preserved conversational state.")}

              {/* 3-col summary */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: "Context Agreement", val: aiResult.contextAgreement ? "Agree" : "Disagree", color: aiResult.contextAgreement ? "text-emerald-400" : "text-amber-400" },
                  { label: "Flagged Turns",      val: String(aiResult.flaggedTurns.length),             color: aiResult.flaggedTurns.length > 0 ? "text-rose-400" : "text-emerald-400" },
                  { label: "AI Confidence",      val: `${Math.round(aiResult.confidence * 100)}%`,      color: "text-violet-400" },
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

              {/* Context retention comparison */}
              <div className={`rounded-xl border p-4 mb-4 ${
                aiResult.contextAgreement
                  ? isDark ? "border-emerald-500/25 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50"
                  : isDark ? "border-amber-500/25 bg-amber-500/5"     : "border-amber-200 bg-amber-50"
              }`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined ${isDark ? "text-white/40" : "text-gray-400"}`} style={{ fontSize: 16 }}>psychology</span>
                    <span className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Context Retention</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                      aiResult.contextAgreement
                        ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                        : isDark ? "bg-amber-500/20 text-amber-400"     : "bg-amber-100 text-amber-700"
                    }`}>
                      {aiResult.contextAgreement ? "AI Agrees" : "AI Disagrees"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>Human:</span>
                    {annotation.contextRetention && <RetentionBadge v={annotation.contextRetention} isDark={isDark}/>}
                    <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>AI:</span>
                    <RetentionBadge v={aiResult.suggestedRetention} isDark={isDark}/>
                  </div>
                </div>
              </div>

              {/* Flagged turns */}
              {aiResult.flaggedTurns.length > 0 && (
                <div className={`rounded-xl border p-4 mb-4 ${isDark ? "border-rose-500/20 bg-rose-500/5" : "border-rose-200 bg-rose-50"}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>Turns Flagged by AI</p>
                  <div className="space-y-2">
                    {session.turns
                      .filter(t => aiResult.flaggedTurns.includes(t.id))
                      .map(t => (
                        <div key={t.id} className="flex items-start gap-2">
                          <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5 ${isDark ? "bg-rose-500/25 text-rose-300" : "bg-rose-100 text-rose-700"}`}>
                            {t.turnNumber}
                          </span>
                          <p className={`text-xs ${isDark ? "text-white/55" : "text-gray-600"}`}>"{t.utterance}"</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

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

            {/* Session reference */}
            <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${isDark ? "bg-violet-500/8 border-violet-500/20" : "bg-violet-50 border-violet-200"}`}>
              <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 16 }}>forum</span>
              <p className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-800"}`}>{session.sessionType} · {session.turns.length} turns · {session.language}</p>
            </div>

            {/* 3-col context */}
            <div className="grid grid-cols-3 gap-4">
              <div className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-white/3" : "border-gray-200 bg-white shadow-sm"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>Human Annotation</p>
                <div className="space-y-2">
                  {annotation.contextRetention && <RetentionBadge v={annotation.contextRetention} isDark={isDark}/>}
                  {annotation.failureType && (
                    <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>{FAILURE_LABELS[annotation.failureType]}</p>
                  )}
                  {annotation.userFrictionRisk && (
                    <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                      Friction: <span className="font-semibold capitalize">{annotation.userFrictionRisk}</span>
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
                  <RetentionBadge v={aiResult.suggestedRetention} isDark={isDark}/>
                  <ConfidenceBar value={aiResult.confidence} isDark={isDark}/>
                  <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                    {aiResult.flaggedTurns.length} turn{aiResult.flaggedTurns.length !== 1 ? "s" : ""} flagged
                  </p>
                </div>
              </div>
              <div className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-white/3" : "border-gray-200 bg-white shadow-sm"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>Discrepancies</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`material-symbols-outlined ${aiResult.contextAgreement ? "text-emerald-400" : "text-amber-400"}`} style={{ fontSize: 14 }}>
                      {aiResult.contextAgreement ? "check_circle" : "warning"}
                    </span>
                    <span className={`text-xs ${isDark ? "text-white/60" : "text-gray-600"}`}>Context retention</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`material-symbols-outlined ${aiResult.flaggedTurns.length === 0 ? "text-emerald-400" : "text-rose-400"}`} style={{ fontSize: 14 }}>
                      {aiResult.flaggedTurns.length === 0 ? "check_circle" : "error"}
                    </span>
                    <span className={`text-xs ${isDark ? "text-white/60" : "text-gray-600"}`}>Turn continuity</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={cardCls}>
              {sectionTitle("rule", "QA Adjudication", "Accept human judgment, apply the AI correction, or override both with a definitive ruling.")}

              {/* Context retention decision */}
              <div className={`rounded-xl border p-4 mb-4 ${isDark ? "border-white/10 bg-white/2" : "border-gray-200 bg-white"}`}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/40" : "text-gray-500"}`}>Context Retention — Final Call</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {([
                    { val: "accept_human" as QADecision, label: "Accept Human" },
                    { val: "accept_ai"    as QADecision, label: "Accept AI"    },
                    { val: "override"     as QADecision, label: "Override Both" },
                  ]).map(({ val, label }) => (
                    <button key={val} onClick={() => patchQA({ retentionDecision: val, retentionOverride: null })}
                      className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
                        qa.retentionDecision === val
                          ? val === "override" ? "bg-rose-600 text-white border-rose-500" : "bg-violet-600 text-white border-violet-500"
                          : isDark ? "bg-transparent text-white/50 border-white/15 hover:border-white/30" : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                {qa.retentionDecision === "override" && (
                  <div className="flex flex-wrap gap-2">
                    {(["fully_retained", "partially_retained", "context_lost"] as ContextRetention[]).map(v => (
                      <button key={v} onClick={() => patchQA({ retentionOverride: v })}
                        className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
                          qa.retentionOverride === v
                            ? isDark ? RETENTION_COLORS_DARK[v] : RETENTION_COLORS_LIGHT[v]
                            : isDark ? "bg-transparent text-white/50 border-white/15 hover:border-white/30" : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
                        }`}>
                        {RETENTION_LABELS[v]}
                      </button>
                    ))}
                  </div>
                )}
                {qa.retentionDecision && (qa.retentionDecision !== "override" || qa.retentionOverride) && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-300"}`}>Final:</span>
                    <RetentionBadge v={resolvedRetention()} isDark={isDark}/>
                  </div>
                )}
              </div>

              {/* Reliability score */}
              <div className={`rounded-xl border p-4 mb-4 ${isDark ? "border-white/10 bg-white/2" : "border-gray-200 bg-white"}`}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>Conversational Reliability Score</p>
                <p className={`text-xs mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>Rate the overall reliability of this session's dialogue behavior (1 = unreliable, 5 = fully reliable).</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button key={score} onClick={() => patchQA({ reliabilityScore: score })}
                      className={`w-10 h-10 rounded-xl border text-sm font-black transition-all ${
                        qa.reliabilityScore === score
                          ? score <= 2 ? "bg-rose-600 text-white border-rose-500"
                          : score === 3 ? "bg-amber-500 text-white border-amber-400"
                          :               "bg-emerald-600 text-white border-emerald-500"
                          : isDark ? "bg-transparent text-white/50 border-white/15 hover:border-white/30" : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
                      }`}>
                      {score}
                    </button>
                  ))}
                  {qa.reliabilityScore && (
                    <span className={`ml-2 self-center text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
                      {qa.reliabilityScore <= 2 ? "Unreliable" : qa.reliabilityScore === 3 ? "Moderate" : qa.reliabilityScore === 4 ? "Reliable" : "Fully Reliable"}
                    </span>
                  )}
                </div>
              </div>

              {/* Production suitability */}
              <div className={`rounded-xl border p-4 ${isDark ? "border-white/10 bg-white/2" : "border-gray-200 bg-white"}`}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>Production Suitability</p>
                <p className={`text-xs mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>What is this session's disposition for downstream training or deployment use?</p>
                <div className="flex flex-wrap gap-2">
                  {(["ready", "needs_retraining", "unsafe"] as ProductionSuitability[]).map(v => (
                    <button key={v} onClick={() => patchQA({ productionSuitability: v })}
                      className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all ${
                        qa.productionSuitability === v
                          ? isDark ? SUITABILITY_COLORS_DARK[v] : SUITABILITY_COLORS_LIGHT[v]
                          : isDark ? "bg-transparent text-white/50 border-white/15 hover:border-white/30" : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
                      }`}>
                      {SUITABILITY_LABELS[v]}
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
          const packet      = buildExportPacket();
          const retention   = resolvedRetention();
          const suitability = qa.productionSuitability!;
          const disagreements = !aiResult.contextAgreement ? 1 : 0;

          const statusLabel =
            suitability === "ready"           ? "Approved for Production"
            : suitability === "needs_retraining" ? "Needs Retraining"
            : "Unsafe for Deployment";
          const statusColor =
            suitability === "ready"           ? "text-emerald-400"
            : suitability === "needs_retraining" ? "text-amber-400"
            : "text-rose-400";

          const downstreamImpacts = [
            { label: "Navigation Systems",       risk: retention !== "fully_retained" && session.sessionType.includes("Navigation") },
            { label: "Voice UX",                 risk: (annotation.userFrictionRisk === "high" || annotation.userFrictionRisk === "medium") },
            { label: "Safety & Distraction Risk", risk: annotation.userFrictionRisk === "high" || suitability === "unsafe" },
          ];

          return (
            <div className="space-y-6">
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Production Status",       val: statusLabel,                                   color: statusColor },
                  { label: "Context Retention",        val: RETENTION_LABELS[retention],                  color: isDark ? "text-white" : "text-gray-900" },
                  { label: "Human–AI Disagreements",   val: String(disagreements),                        color: disagreements > 0 ? "text-amber-400" : "text-emerald-400" },
                  { label: "Reliability Score",        val: qa.reliabilityScore ? `${qa.reliabilityScore} / 5` : "—", color: (qa.reliabilityScore ?? 0) >= 4 ? "text-emerald-400" : (qa.reliabilityScore ?? 0) >= 3 ? "text-amber-400" : "text-rose-400" },
                ].map(({ label, val, color }) => (
                  <div key={label} className={`rounded-xl border p-4 text-center ${isDark ? "border-white/10 bg-white/3" : "border-gray-200 bg-white shadow-sm"}`}>
                    <p className={`text-sm font-bold font-mono uppercase leading-tight ${color}`}>{val}</p>
                    <p className={`text-[10px] uppercase tracking-widest mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Final summary */}
              <div className={cardCls}>
                {sectionTitle("verified", "Final QA Summary")}
                <div className="grid md:grid-cols-3 gap-4 mb-5">
                  <div className={`rounded-xl p-3 border ${isDark ? "border-white/8 bg-white/2" : "border-gray-100 bg-gray-50"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>Context Retention</p>
                    <RetentionBadge v={retention} isDark={isDark}/>
                    {annotation.failureType && (
                      <p className={`text-xs mt-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>{FAILURE_LABELS[annotation.failureType]}</p>
                    )}
                  </div>
                  <div className={`rounded-xl p-3 border ${isDark ? "border-white/8 bg-white/2" : "border-gray-100 bg-gray-50"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>Production Suitability</p>
                    <SuitabilityBadge v={suitability} isDark={isDark}/>
                    <p className={`text-xs mt-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>
                      Reliability: {qa.reliabilityScore}/5
                    </p>
                  </div>
                  <div className={`rounded-xl p-3 border ${isDark ? "border-white/8 bg-white/2" : "border-gray-100 bg-gray-50"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>Turn Continuity</p>
                    <div className="flex flex-wrap gap-1">
                      {session.turns.map(t => {
                        const tc = annotation.turnContinuity[t.id];
                        return tc ? (
                          <span key={t.id} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${isDark ? CONTINUITY_BADGE_DARK[tc] : CONTINUITY_BADGE_LIGHT[tc]}`}>
                            T{t.turnNumber}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <p className={`text-xs mt-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>
                      {aiResult.flaggedTurns.length} turn{aiResult.flaggedTurns.length !== 1 ? "s" : ""} flagged by AI
                    </p>
                  </div>
                </div>

                {/* Downstream impact */}
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>Downstream Impact Classification</p>
                  <div className="grid grid-cols-3 gap-3">
                    {downstreamImpacts.map(({ label, risk }) => (
                      <div key={label} className={`rounded-lg px-3 py-2.5 border flex items-center gap-2 ${
                        risk
                          ? isDark ? "border-amber-500/25 bg-amber-500/8" : "border-amber-200 bg-amber-50"
                          : isDark ? "border-emerald-500/20 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50"
                      }`}>
                        <span className={`material-symbols-outlined ${risk ? "text-amber-400" : "text-emerald-400"}`} style={{ fontSize: 14 }}>
                          {risk ? "warning" : "check_circle"}
                        </span>
                        <p className={`text-xs font-medium ${isDark ? "text-white/70" : "text-gray-700"}`}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* JSON export */}
              <div className={cardCls}>
                {sectionTitle("code", "Decision Packet — JSON Export")}
                <pre className={`text-xs rounded-xl p-4 overflow-auto leading-relaxed border ${isDark ? "bg-black/40 border-white/10 text-emerald-300" : "bg-gray-50 border-gray-200 text-emerald-700"}`}>
                  {JSON.stringify(packet, null, 2)}
                </pre>
                <div className="flex gap-3 mt-4 flex-wrap">
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
                      const url  = URL.createObjectURL(blob);
                      const a    = document.createElement("a");
                      a.href     = url;
                      a.download = `context_qa_${session.id}.json`;
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
                      a.download   = `context_qa_${session.id}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors ${isDark ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>table_chart</span>
                    Export CSV
                  </button>
                  <button
                    onClick={() => { setSessionIdx(i => (i + 1) % SESSIONS.length); setStage("ingest"); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors ml-auto ${isDark ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>skip_next</span>
                    Next Session
                  </button>
                </div>
              </div>

              {/* Scale callout */}
              <div className={`rounded-2xl p-5 ${isDark ? "bg-white/3 border border-white/8" : "bg-gray-50 border border-gray-200"}`}>
                <p className={`text-sm font-bold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>How TP Operationalises This at Scale</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    { val: "2M+",   sub: "Multi-turn sessions annotated annually" },
                    { val: "94.8%", sub: "Cross-turn context consistency rate"    },
                    { val: "18+",   sub: "IVI and navigation programme clients"   },
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
