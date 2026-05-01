import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";

// ─── Types ───────────────────────────────────────────────────────────────────

type PrimaryEmotion =
  | "neutral"
  | "frustration"
  | "anger"
  | "sadness"
  | "happiness"
  | "anxiety"
  | "other";

type ToneAttribute =
  | "calm"
  | "urgent"
  | "sarcastic"
  | "hesitant"
  | "assertive"
  | "apologetic";

type Intensity = "low" | "medium" | "high";

type EscalationFlag = "none" | "monitor" | "escalate";

type Stage = "annotate" | "ai-verify" | "qa" | "export";

interface AudioSample {
  id: string;
  filename: string;
  audioSrc: string;
  duration: string;
  language: string;
  interactionType: string;
  environment: string;
  recordedAt: string;
  speaker: string;
}

interface HumanAnnotation {
  emotion: PrimaryEmotion | null;
  tones: ToneAttribute[];
  intensity: Intensity | null;
  escalation: EscalationFlag | null;
  notes: string;
}

interface AILabel {
  emotion: PrimaryEmotion;
  emotionConf: number;
  emotionJustification: string;
  emotionAgreement: boolean;
  tones: ToneAttribute[];
  tonesConf: number;
  tonesJustification: string;
  tonesAgreement: boolean;
  intensity: Intensity;
  intensityConf: number;
  intensityJustification: string;
  intensityAgreement: boolean;
  escalation: EscalationFlag;
  escalationConf: number;
  escalationJustification: string;
  escalationAgreement: boolean;
}

interface QADecisions {
  emotion:    "human" | "ai" | "override";
  emotionOverride: PrimaryEmotion | null;
  tones:      "human" | "ai" | "override";
  tonesOverride: ToneAttribute[];
  intensity:  "human" | "ai" | "override";
  intensityOverride: Intensity | null;
  escalation: "human" | "ai" | "override";
  escalationOverride: EscalationFlag | null;
  reviewerNote: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SAMPLES: AudioSample[] = [
  {
    id: "aud_emotion_023",
    filename: "cx_call_en_023.wav",
    audioSrc: "/queues/French/Audio.mp3",
    duration: "0:38",
    language: "English (US)",
    interactionType: "Customer Support",
    environment: "Call Center (telephony)",
    recordedAt: "2025-03-21",
    speaker: "Customer — unscripted",
  },
  {
    id: "aud_emotion_041",
    filename: "cx_call_es_041.wav",
    audioSrc: "/queues/Spanish/Audio.mp3",
    duration: "0:52",
    language: "Spanish (MX)",
    interactionType: "Assistant Query",
    environment: "Mobile (handset mic)",
    recordedAt: "2025-04-07",
    speaker: "User — natural speech",
  },
];

const AI_RESULTS: Record<string, AILabel> = {
  aud_emotion_023: {
    emotion: "frustration",
    emotionConf: 0.87,
    emotionJustification:
      "Elevated pitch variance and lengthened vowels in stressed syllables are consistent with frustration in call-center corpora.",
    emotionAgreement: true,
    tones: ["urgent", "hesitant"],
    tonesConf: 0.79,
    tonesJustification:
      "Speech rate exceeds baseline by 18% (urgent); mid-sentence pauses and filler tokens detected (hesitant).",
    tonesAgreement: false,
    intensity: "medium",
    intensityConf: 0.83,
    intensityJustification:
      "Mean energy envelope and prosodic deviation fall within the medium-intensity band for this speaker cohort.",
    intensityAgreement: true,
    escalation: "monitor",
    escalationConf: 0.81,
    escalationJustification:
      "Frustration with hesitancy warrants monitoring; no explicit threat or breakdown language detected.",
    escalationAgreement: false,
  },
  aud_emotion_041: {
    emotion: "anxiety",
    emotionConf: 0.74,
    emotionJustification:
      "Jitter and shimmer values exceed neutral baseline; irregular breathing intervals detected between utterances.",
    emotionAgreement: false,
    tones: ["hesitant", "apologetic"],
    tonesConf: 0.82,
    tonesJustification:
      "High hedging word frequency and falling intonation on statements are consistent with apologetic and hesitant tone.",
    tonesAgreement: true,
    intensity: "low",
    intensityConf: 0.77,
    intensityJustification:
      "RMS energy is below speaker baseline; slow speech rate indicates low emotional activation.",
    intensityAgreement: true,
    escalation: "none",
    escalationConf: 0.85,
    escalationJustification:
      "No escalation markers detected; low intensity and apologetic tone suggest de-escalating trajectory.",
    escalationAgreement: false,
  },
};

const EMPTY_HUMAN: HumanAnnotation = {
  emotion: null,
  tones: [],
  intensity: null,
  escalation: null,
  notes: "",
};

const EMPTY_QA: QADecisions = {
  emotion: "human",
  emotionOverride: null,
  tones: "human",
  tonesOverride: [],
  intensity: "human",
  intensityOverride: null,
  escalation: "human",
  escalationOverride: null,
  reviewerNote: "",
};

// ─── Waveform mock ───────────────────────────────────────────────────────────

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
  aud_emotion_023: generateBars(53),
  aud_emotion_041: generateBars(91),
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const STAGE_ICONS: Record<Stage, string> = {
  annotate:   "edit_note",
  "ai-verify": "smart_toy",
  qa:         "rule",
  export:     "download",
};
const STAGES: Stage[] = ["annotate", "ai-verify", "qa", "export"];

function PipelineStepper({
  current,
  isDark,
  stageLabels,
}: {
  current: Stage;
  isDark: boolean;
  stageLabels: Record<Stage, string>;
}) {
  const currentIdx = STAGES.indexOf(current);
  return (
    <div className="flex items-center gap-0 mb-10 overflow-x-auto pb-1">
      {STAGES.map((s, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  done    ? "bg-indigo-600 border-indigo-600"
                  : active ? "bg-indigo-600/20 border-indigo-500"
                  : isDark  ? "bg-white/5 border-white/15"
                  : "bg-gray-100 border-gray-300"
                }`}
              >
                {done ? (
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 16 }}>check</span>
                ) : (
                  <span
                    className={`material-symbols-outlined ${
                      active ? "text-indigo-400" : isDark ? "text-white/30" : "text-gray-400"
                    }`}
                    style={{ fontSize: 16 }}
                  >
                    {STAGE_ICONS[s]}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 font-bold uppercase tracking-wide whitespace-nowrap ${
                  active ? "text-indigo-400" : isDark ? "text-white/40" : "text-gray-400"
                }`}
              >
                {stageLabels[s]}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={`h-[2px] w-10 md:w-16 mx-1 mb-4 rounded-full transition-all ${
                  done ? "bg-indigo-600" : isDark ? "bg-white/10" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function WaveformPlayer({
  sampleId,
  audioSrc,
  isDark,
}: {
  sampleId: string;
  audioSrc: string;
  isDark: boolean;
}) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef   = useRef<number | null>(null);
  const bars = SAMPLE_BARS[sampleId] ?? SAMPLE_BARS["aud_emotion_023"];

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
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  }, [playing]);

  const playheadX = Math.round(progress * WAVEFORM_BARS);

  return (
    <div className={`rounded-xl p-4 border ${isDark ? "bg-white/3 border-white/10" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={toggle}
          className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors flex-shrink-0"
        >
          <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>
            {playing ? "pause" : "play_arrow"}
          </span>
        </button>
        <div className="flex-1 overflow-hidden">
          <svg width="100%" height="48" viewBox={`0 0 ${WAVEFORM_BARS * 5} 48`} preserveAspectRatio="none">
            {bars.map((h, i) => {
              const barH = Math.max(3, h * 44);
              const y    = (48 - barH) / 2;
              const isPast = i < playheadX;
              return (
                <rect
                  key={i}
                  x={i * 5} y={y} width={3} height={barH} rx={1.5}
                  fill={isPast ? "#4f46e5" : isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)"}
                />
              );
            })}
            <line x1={playheadX * 5} x2={playheadX * 5} y1={0} y2={48} stroke="#818cf8" strokeWidth={1.5} />
          </svg>
        </div>
      </div>
      <div className="flex justify-between text-xs font-mono">
        <span className={isDark ? "text-white/40" : "text-gray-400"}>
          {playing ? "▶ Playing…" : "● Stopped"}
        </span>
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
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono w-8 text-right ${isDark ? "text-white/50" : "text-gray-500"}`}>{pct}%</span>
    </div>
  );
}

// Escalation visual configs (shape + label — not color alone)
const ESCALATION_ICON: Record<EscalationFlag, string> = {
  none:     "check_circle",
  monitor:  "warning",
  escalate: "emergency",
};
const ESCALATION_COLOR_DARK: Record<EscalationFlag, string> = {
  none:     "text-emerald-400",
  monitor:  "text-amber-400",
  escalate: "text-rose-400",
};
const ESCALATION_COLOR_LIGHT: Record<EscalationFlag, string> = {
  none:     "text-emerald-600",
  monitor:  "text-amber-600",
  escalate: "text-rose-600",
};
const ESCALATION_BG_DARK: Record<EscalationFlag, string> = {
  none:     "bg-emerald-500/10 border-emerald-500/20",
  monitor:  "bg-amber-500/10 border-amber-500/20",
  escalate: "bg-rose-500/10 border-rose-500/20",
};
const ESCALATION_BG_LIGHT: Record<EscalationFlag, string> = {
  none:     "bg-emerald-50 border-emerald-200",
  monitor:  "bg-amber-50 border-amber-200",
  escalate: "bg-rose-50 border-rose-200",
};

// Emotion color tokens
const EMOTION_COLOR_DARK: Record<PrimaryEmotion, string> = {
  neutral:     "bg-slate-500/15 text-slate-300 border-slate-500/25",
  frustration: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  anger:       "bg-rose-500/15 text-rose-300 border-rose-500/25",
  sadness:     "bg-blue-500/15 text-blue-300 border-blue-500/25",
  happiness:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  anxiety:     "bg-purple-500/15 text-purple-300 border-purple-500/25",
  other:       "bg-gray-500/15 text-gray-300 border-gray-500/25",
};
const EMOTION_COLOR_LIGHT: Record<PrimaryEmotion, string> = {
  neutral:     "bg-slate-100 text-slate-700 border-slate-300",
  frustration: "bg-orange-50 text-orange-700 border-orange-300",
  anger:       "bg-rose-50 text-rose-700 border-rose-300",
  sadness:     "bg-blue-50 text-blue-700 border-blue-300",
  happiness:   "bg-emerald-50 text-emerald-700 border-emerald-300",
  anxiety:     "bg-purple-50 text-purple-700 border-purple-300",
  other:       "bg-gray-100 text-gray-600 border-gray-300",
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function SpeechEmotionQA() {
  const navigate      = useNavigate();
  const { theme }     = useTheme();
  const isDark        = theme === "dark";
  const { t }         = useLanguage();
  const eq            = t.pages.speechEmotionQa;

  // Translated stage labels
  const STAGE_LABELS: Record<Stage, string> = {
    annotate:   eq.stageAnnotate,
    "ai-verify": eq.stageAiVerify,
    qa:         eq.stageQa,
    export:     eq.stageExport,
  };

  const [stage, setStage]         = useState<Stage>("annotate");
  const [sampleIdx, setSampleIdx] = useState(0);
  const [annotationsMap, setAnnotationsMap] = useState<Record<string, HumanAnnotation>>({});
  const [qaMap, setQaMap]                   = useState<Record<string, QADecisions>>({});

  const sample     = SAMPLES[sampleIdx];
  const annotation = annotationsMap[sample.id] ?? EMPTY_HUMAN;
  const qaState    = qaMap[sample.id] ?? EMPTY_QA;
  const aiResult   = AI_RESULTS[sample.id];

  // ── Annotation helpers ────────────────────────────────────────────────────

  function setAnnotation(patch: Partial<HumanAnnotation>) {
    setAnnotationsMap(prev => ({
      ...prev,
      [sample.id]: { ...(prev[sample.id] ?? EMPTY_HUMAN), ...patch },
    }));
  }

  function toggleTone(tone: ToneAttribute) {
    const cur = (annotationsMap[sample.id] ?? EMPTY_HUMAN).tones;
    const next = cur.includes(tone) ? cur.filter(t => t !== tone) : [...cur, tone];
    setAnnotation({ tones: next });
  }

  function setQa(patch: Partial<QADecisions>) {
    setQaMap(prev => ({
      ...prev,
      [sample.id]: { ...(prev[sample.id] ?? EMPTY_QA), ...patch },
    }));
  }

  // ── Readiness guards ──────────────────────────────────────────────────────

  const annotationComplete =
    annotation.emotion !== null &&
    annotation.tones.length > 0 &&
    annotation.intensity !== null &&
    annotation.escalation !== null;

  // ── Resolve final values from QA ─────────────────────────────────────────

  function resolveEmotion(): PrimaryEmotion {
    if (qaState.emotion === "ai") return aiResult.emotion;
    if (qaState.emotion === "override" && qaState.emotionOverride) return qaState.emotionOverride;
    return annotation.emotion ?? aiResult.emotion;
  }
  function resolveTones(): ToneAttribute[] {
    if (qaState.tones === "ai") return aiResult.tones;
    if (qaState.tones === "override" && qaState.tonesOverride.length) return qaState.tonesOverride;
    return annotation.tones.length ? annotation.tones : aiResult.tones;
  }
  function resolveIntensity(): Intensity {
    if (qaState.intensity === "ai") return aiResult.intensity;
    if (qaState.intensity === "override" && qaState.intensityOverride) return qaState.intensityOverride;
    return annotation.intensity ?? aiResult.intensity;
  }
  function resolveEscalation(): EscalationFlag {
    if (qaState.escalation === "ai") return aiResult.escalation;
    if (qaState.escalation === "override" && qaState.escalationOverride) return qaState.escalationOverride;
    return annotation.escalation ?? aiResult.escalation;
  }

  // ── Card helpers ──────────────────────────────────────────────────────────

  const card = `rounded-2xl border p-6 ${isDark ? "bg-white/3 border-white/8" : "bg-white border-gray-200 shadow-sm"}`;
  const sectionHead = `text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`;
  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer select-none ${
      active
        ? "bg-indigo-600 text-white border-indigo-500"
        : isDark
        ? "bg-transparent text-white/50 border-white/15 hover:border-white/30"
        : "bg-transparent text-gray-500 border-gray-300 hover:border-gray-400"
    }`;

  const metaRow = (label: string, value: string) => (
    <div className="flex justify-between items-baseline gap-2 py-1.5 border-b border-dashed last:border-0"
         style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
      <span className={`text-[11px] font-medium shrink-0 ${isDark ? "text-white/40" : "text-gray-400"}`}>{label}</span>
      <span className={`text-[11px] font-mono text-right truncate ${isDark ? "text-white/70" : "text-gray-700"}`}>{value}</span>
    </div>
  );

  // ── Audio player panel ────────────────────────────────────────────────────

  const playerPanel = (
    <div className={card}>
      {/* Sample selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {SAMPLES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => { setSampleIdx(i); setStage("annotate"); }}
            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
              i === sampleIdx
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-white/10 border-white/20 text-white/70 hover:bg-white/15"
            }`}
          >
            {s.id}
          </button>
        ))}
      </div>

      {/* Waveform */}
      <WaveformPlayer sampleId={sample.id} audioSrc={sample.audioSrc} isDark={isDark} />

      {/* Metadata */}
      <div className="mt-4">
        <p className={sectionHead}>{eq.sampleInfo}</p>
        {metaRow(eq.metaLanguage,        sample.language)}
        {metaRow(eq.metaInteractionType, sample.interactionType)}
        {metaRow(eq.metaEnvironment,     sample.environment)}
        {metaRow(eq.metaSpeaker,         sample.speaker)}
        {metaRow(eq.metaDuration,        sample.duration)}
        {metaRow(eq.metaRecordedAt,      sample.recordedAt)}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 1 — Annotate
  // ═══════════════════════════════════════════════════════════════════════════

  const primaryEmotions: { key: PrimaryEmotion; icon: string }[] = [
    { key: "neutral",     icon: "sentiment_neutral"       },
    { key: "frustration", icon: "sentiment_dissatisfied"  },
    { key: "anger",       icon: "mood_bad"                },
    { key: "sadness",     icon: "sentiment_sad"           },
    { key: "happiness",   icon: "sentiment_satisfied"     },
    { key: "anxiety",     icon: "psychology_alt"          },
    { key: "other",       icon: "help_outline"            },
  ];

  const emotionLabel: Record<PrimaryEmotion, string> = {
    neutral:     eq.emotionNeutral,
    frustration: eq.emotionFrustration,
    anger:       eq.emotionAnger,
    sadness:     eq.emotionSadness,
    happiness:   eq.emotionHappiness,
    anxiety:     eq.emotionAnxiety,
    other:       eq.emotionOther,
  };

  const toneOptions: { key: ToneAttribute; icon: string }[] = [
    { key: "calm",       icon: "self_improvement" },
    { key: "urgent",     icon: "priority_high"    },
    { key: "sarcastic",  icon: "theater_comedy"   },
    { key: "hesitant",   icon: "pause_circle"     },
    { key: "assertive",  icon: "record_voice_over"},
    { key: "apologetic", icon: "volunteer_activism"},
  ];

  const toneLabel: Record<ToneAttribute, string> = {
    calm:       eq.toneCalm,
    urgent:     eq.toneUrgent,
    sarcastic:  eq.toneSarcastic,
    hesitant:   eq.toneHesitant,
    assertive:  eq.toneAssertive,
    apologetic: eq.toneApologetic,
  };

  const intensityLabel: Record<Intensity, string> = {
    low:    eq.intensityLow,
    medium: eq.intensityMedium,
    high:   eq.intensityHigh,
  };

  const escalationOpts: { key: EscalationFlag; label: string; icon: string }[] = [
    { key: "none",     label: eq.escalationNone,     icon: "check_circle"  },
    { key: "monitor",  label: eq.escalationMonitor,  icon: "warning"       },
    { key: "escalate", label: eq.escalationEscalate, icon: "emergency"     },
  ];

  const annotateScreen = (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
      {/* Left: audio player */}
      <div className="space-y-4">
        {playerPanel}
      </div>

      {/* Right: annotation form */}
      <div className="space-y-5">
        {/* Hint banner */}
        <div className={`rounded-xl px-4 py-3 text-sm ${isDark ? "bg-indigo-600/10 border border-indigo-500/20 text-indigo-300" : "bg-indigo-50 border border-indigo-200 text-indigo-700"}`}>
          <span className="material-symbols-outlined align-middle mr-1" style={{ fontSize: 16 }}>headphones</span>
          {eq.annotateHint}
        </div>

        {/* 1 · Primary emotion */}
        <div className={card}>
          <p className={sectionHead}>1 · {eq.primaryEmotionLabel}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {primaryEmotions.map(({ key, icon }) => {
              const active = annotation.emotion === key;
              const colors = isDark ? EMOTION_COLOR_DARK[key] : EMOTION_COLOR_LIGHT[key];
              return (
                <button
                  key={key}
                  onClick={() => setAnnotation({ emotion: key })}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    active ? colors : isDark
                      ? "bg-transparent text-white/50 border-white/12 hover:border-white/25"
                      : "bg-transparent text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
                  {emotionLabel[key]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2 · Tone attributes */}
        <div className={card}>
          <p className={sectionHead}>2 · {eq.toneAttributesLabel} <span className={`normal-case font-normal ${isDark ? "text-white/30" : "text-gray-400"}`}>({eq.selectAllApply})</span></p>
          <div className="flex flex-wrap gap-2">
            {toneOptions.map(({ key, icon }) => (
              <button
                key={key}
                onClick={() => toggleTone(key)}
                className={pill(annotation.tones.includes(key))}
              >
                <span className="material-symbols-outlined align-middle mr-1" style={{ fontSize: 14 }}>{icon}</span>
                {toneLabel[key]}
              </button>
            ))}
          </div>
        </div>

        {/* 3 · Intensity */}
        <div className={card}>
          <p className={sectionHead}>3 · {eq.intensityLabel}</p>
          <div className="flex gap-2">
            {(["low", "medium", "high"] as Intensity[]).map(level => (
              <button
                key={level}
                onClick={() => setAnnotation({ intensity: level })}
                className={`flex-1 py-2 rounded-xl border text-xs font-bold uppercase tracking-wide transition-all ${
                  annotation.intensity === level
                    ? level === "low"    ? "bg-emerald-600 border-emerald-500 text-white"
                    : level === "medium" ? "bg-amber-500 border-amber-400 text-white"
                    :                     "bg-rose-600 border-rose-500 text-white"
                    : isDark
                    ? "bg-transparent text-white/50 border-white/15 hover:border-white/30"
                    : "bg-transparent text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                {intensityLabel[level]}
              </button>
            ))}
          </div>
        </div>

        {/* 4 · Escalation risk */}
        <div className={card}>
          <p className={sectionHead}>4 · {eq.escalationRiskLabel}</p>
          <div className="space-y-2">
            {escalationOpts.map(({ key, label, icon }) => {
              const active   = annotation.escalation === key;
              const iconCol  = isDark ? ESCALATION_COLOR_DARK[key] : ESCALATION_COLOR_LIGHT[key];
              const bg       = active ? (isDark ? ESCALATION_BG_DARK[key] : ESCALATION_BG_LIGHT[key]) : "";
              return (
                <button
                  key={key}
                  onClick={() => setAnnotation({ escalation: key })}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all ${
                    active
                      ? `${bg} ${isDark ? "border-current" : "border-current"}`
                      : isDark
                      ? "bg-transparent text-white/60 border-white/12 hover:border-white/25"
                      : "bg-transparent text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className={`material-symbols-outlined ${active ? iconCol : isDark ? "text-white/30" : "text-gray-400"}`} style={{ fontSize: 20 }}>{icon}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5 · Notes */}
        <div className={card}>
          <p className={sectionHead}>5 · {eq.annotatorNotesLabel}</p>
          <textarea
            rows={2}
            placeholder={eq.annotatorNotesPlaceholder}
            value={annotation.notes}
            onChange={e => setAnnotation({ notes: e.target.value })}
            className={`w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
              isDark
                ? "bg-white/5 border-white/15 text-white placeholder-white/30"
                : "bg-white border-gray-200 text-gray-800 placeholder-gray-400"
            }`}
          />
        </div>

        {/* Submit */}
        <button
          disabled={!annotationComplete}
          onClick={() => setStage("ai-verify")}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
            annotationComplete
              ? "bg-indigo-600 hover:bg-indigo-500 text-white"
              : isDark
              ? "bg-white/5 text-white/25 border border-white/10 cursor-not-allowed"
              : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
          }`}
        >
          {annotationComplete ? eq.submitToAiVerify : eq.completeAllFields}
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 2 — AI Verification
  // ═══════════════════════════════════════════════════════════════════════════

  const AgreementChip = ({ agree }: { agree: boolean }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${
      agree
        ? isDark ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200"
        : isDark ? "bg-amber-500/15 text-amber-400 border-amber-500/30"       : "bg-amber-50 text-amber-700 border-amber-200"
    }`}>
      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{agree ? "check" : "warning"}</span>
      {agree ? eq.agreed : eq.disagreed}
    </span>
  );

  const aiVerifyRow = (
    dimensionLabel: string,
    icon: string,
    humanVal: string,
    aiVal: string,
    conf: number,
    justification: string,
    agreement: boolean,
  ) => (
    <div className={`rounded-xl border p-4 space-y-3 ${isDark ? "bg-white/3 border-white/8" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`material-symbols-outlined ${isDark ? "text-indigo-400" : "text-indigo-600"}`} style={{ fontSize: 18 }}>{icon}</span>
        <span className={`text-sm font-bold ${isDark ? "text-white/80" : "text-gray-800"}`}>{dimensionLabel}</span>
        <div className="ml-auto"><AgreementChip agree={agreement} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-lg p-2.5 border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>
            <span className="material-symbols-outlined align-middle" style={{ fontSize: 11 }}>person</span> {eq.humanLabel}
          </p>
          <p className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-gray-800"}`}>{humanVal}</p>
        </div>
        <div className={`rounded-lg p-2.5 border ${isDark ? "bg-indigo-600/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-200"}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${isDark ? "text-indigo-400/60" : "text-indigo-500"}`}>
            <span className="material-symbols-outlined align-middle" style={{ fontSize: 11 }}>smart_toy</span> {eq.aiLabel}
          </p>
          <p className={`text-sm font-semibold ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>{aiVal}</p>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? "text-white/30" : "text-gray-400"}`}>{eq.confidence}</span>
          <span/>
        </div>
        <ConfidenceBar value={conf} isDark={isDark} />
      </div>
      <p className={`text-xs leading-relaxed italic ${isDark ? "text-white/40" : "text-gray-500"}`}>
        {justification}
      </p>
    </div>
  );

  const aiVerifyScreen = (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
      <div className="space-y-4">{playerPanel}</div>

      <div className="space-y-4">
        {/* AI model banner */}
        <div className={`rounded-xl px-4 py-3 border ${isDark ? "bg-indigo-600/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-200"}`}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="material-symbols-outlined text-indigo-400" style={{ fontSize: 18 }}>smart_toy</span>
            <span className={`font-bold text-sm ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>{eq.aiVerifyTitle}</span>
          </div>
          <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>{eq.aiVerifyHint}</p>
        </div>

        {/* 4 verification rows */}
        {aiVerifyRow(
          eq.primaryEmotionLabel,
          "sentiment_dissatisfied",
          emotionLabel[annotation.emotion ?? "neutral"],
          emotionLabel[aiResult.emotion],
          aiResult.emotionConf,
          aiResult.emotionJustification,
          aiResult.emotionAgreement,
        )}
        {aiVerifyRow(
          eq.toneAttributesLabel,
          "record_voice_over",
          annotation.tones.map(t => toneLabel[t]).join(", ") || "—",
          aiResult.tones.map(t => toneLabel[t]).join(", "),
          aiResult.tonesConf,
          aiResult.tonesJustification,
          aiResult.tonesAgreement,
        )}
        {aiVerifyRow(
          eq.intensityLabel,
          "speed",
          intensityLabel[annotation.intensity ?? "low"],
          intensityLabel[aiResult.intensity],
          aiResult.intensityConf,
          aiResult.intensityJustification,
          aiResult.intensityAgreement,
        )}
        {aiVerifyRow(
          eq.escalationRiskLabel,
          "emergency",
          escalationOpts.find(o => o.key === annotation.escalation)?.label ?? "—",
          escalationOpts.find(o => o.key === aiResult.escalation)?.label ?? "—",
          aiResult.escalationConf,
          aiResult.escalationJustification,
          aiResult.escalationAgreement,
        )}

        <button
          onClick={() => setStage("qa")}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all"
        >
          {eq.proceedToQa}
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 3 — QA Adjudication
  // ═══════════════════════════════════════════════════════════════════════════

  type QAField = "emotion" | "tones" | "intensity" | "escalation";

  const QADecisionRow = ({
    field,
    icon,
    label,
    humanDisplay,
    aiDisplay,
    overrideSlot,
  }: {
    field: QAField;
    icon: string;
    label: string;
    humanDisplay: string;
    aiDisplay: string;
    overrideSlot: React.ReactNode;
  }) => {
    const decision = qaState[field] as "human" | "ai" | "override";
    const setDecision = (d: "human" | "ai" | "override") =>
      setQa({ [field]: d } as Partial<QADecisions>);

    const optBtn = (d: "human" | "ai" | "override", lbl: string) => (
      <button
        onClick={() => setDecision(d)}
        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
          decision === d
            ? "bg-indigo-600 border-indigo-500 text-white"
            : isDark
            ? "bg-transparent text-white/50 border-white/15 hover:border-white/30"
            : "bg-transparent text-gray-500 border-gray-200 hover:border-gray-300"
        }`}
      >
        {lbl}
      </button>
    );

    return (
      <div className={`rounded-xl border p-4 space-y-3 ${isDark ? "bg-white/3 border-white/8" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined ${isDark ? "text-indigo-400" : "text-indigo-600"}`} style={{ fontSize: 18 }}>{icon}</span>
          <span className={`text-sm font-bold ${isDark ? "text-white/80" : "text-gray-800"}`}>{label}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className={`rounded-lg p-2 border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
            <span className={`font-bold ${isDark ? "text-white/30" : "text-gray-400"}`}>{eq.humanLabel}: </span>
            <span className={isDark ? "text-white/70" : "text-gray-700"}>{humanDisplay}</span>
          </div>
          <div className={`rounded-lg p-2 border ${isDark ? "bg-indigo-600/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-200"}`}>
            <span className={`font-bold ${isDark ? "text-indigo-400/60" : "text-indigo-500"}`}>{eq.aiLabel}: </span>
            <span className={isDark ? "text-indigo-300" : "text-indigo-700"}>{aiDisplay}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {optBtn("human",    eq.acceptHuman)}
          {optBtn("ai",       eq.acceptAi)}
          {optBtn("override", eq.override)}
        </div>
        {decision === "override" && (
          <div className={`rounded-lg border p-3 ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>{eq.overrideValue}</p>
            {overrideSlot}
          </div>
        )}
      </div>
    );
  };

  const qaScreen = (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
      <div className="space-y-4">{playerPanel}</div>

      <div className="space-y-4">
        <div className={`rounded-xl px-4 py-3 border ${isDark ? "bg-white/3 border-white/8" : "bg-gray-50 border-gray-200"}`}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`material-symbols-outlined ${isDark ? "text-white/60" : "text-gray-600"}`} style={{ fontSize: 18 }}>rule</span>
            <span className={`font-bold text-sm ${isDark ? "text-white/80" : "text-gray-700"}`}>{eq.qaTitle}</span>
          </div>
          <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>{eq.qaHint}</p>
        </div>

        {/* QA: Primary emotion */}
        <QADecisionRow
          field="emotion"
          icon="sentiment_dissatisfied"
          label={eq.primaryEmotionLabel}
          humanDisplay={emotionLabel[annotation.emotion ?? "neutral"]}
          aiDisplay={emotionLabel[aiResult.emotion]}
          overrideSlot={
            <div className="grid grid-cols-2 gap-1.5">
              {primaryEmotions.map(({ key }) => (
                <button
                  key={key}
                  onClick={() => setQa({ emotionOverride: key })}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    qaState.emotionOverride === key
                      ? (isDark ? EMOTION_COLOR_DARK[key] : EMOTION_COLOR_LIGHT[key])
                      : isDark ? "bg-white/3 border-white/10 text-white/50" : "bg-gray-50 border-gray-200 text-gray-500"
                  }`}
                >
                  {emotionLabel[key]}
                </button>
              ))}
            </div>
          }
        />

        {/* QA: Tone */}
        <QADecisionRow
          field="tones"
          icon="record_voice_over"
          label={eq.toneAttributesLabel}
          humanDisplay={annotation.tones.map(t => toneLabel[t]).join(", ") || "—"}
          aiDisplay={aiResult.tones.map(t => toneLabel[t]).join(", ")}
          overrideSlot={
            <div className="flex flex-wrap gap-1.5">
              {toneOptions.map(({ key }) => {
                const sel = (qaState.tonesOverride ?? []).includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => {
                      const cur = qaState.tonesOverride ?? [];
                      setQa({ tonesOverride: sel ? cur.filter(t => t !== key) : [...cur, key] });
                    }}
                    className={pill(sel)}
                  >
                    {toneLabel[key]}
                  </button>
                );
              })}
            </div>
          }
        />

        {/* QA: Intensity */}
        <QADecisionRow
          field="intensity"
          icon="speed"
          label={eq.intensityLabel}
          humanDisplay={intensityLabel[annotation.intensity ?? "low"]}
          aiDisplay={intensityLabel[aiResult.intensity]}
          overrideSlot={
            <div className="flex gap-2">
              {(["low", "medium", "high"] as Intensity[]).map(level => (
                <button
                  key={level}
                  onClick={() => setQa({ intensityOverride: level })}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-bold uppercase transition-all ${
                    qaState.intensityOverride === level
                      ? level === "low"    ? "bg-emerald-600 border-emerald-500 text-white"
                      : level === "medium" ? "bg-amber-500 border-amber-400 text-white"
                      :                     "bg-rose-600 border-rose-500 text-white"
                      : isDark ? "bg-white/3 border-white/10 text-white/50" : "bg-gray-50 border-gray-200 text-gray-500"
                  }`}
                >
                  {intensityLabel[level]}
                </button>
              ))}
            </div>
          }
        />

        {/* QA: Escalation */}
        <QADecisionRow
          field="escalation"
          icon="emergency"
          label={eq.escalationRiskLabel}
          humanDisplay={escalationOpts.find(o => o.key === annotation.escalation)?.label ?? "—"}
          aiDisplay={escalationOpts.find(o => o.key === aiResult.escalation)?.label ?? "—"}
          overrideSlot={
            <div className="space-y-1.5">
              {escalationOpts.map(({ key, label, icon }) => {
                const sel = qaState.escalationOverride === key;
                const iconCol = isDark ? ESCALATION_COLOR_DARK[key] : ESCALATION_COLOR_LIGHT[key];
                return (
                  <button
                    key={key}
                    onClick={() => setQa({ escalationOverride: key })}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                      sel
                        ? (isDark ? ESCALATION_BG_DARK[key] : ESCALATION_BG_LIGHT[key]) + " " + iconCol
                        : isDark ? "bg-white/3 border-white/10 text-white/50" : "bg-gray-50 border-gray-200 text-gray-500"
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>
          }
        />

        {/* QA reviewer note */}
        <div className={card}>
          <p className={sectionHead}>{eq.qaReviewerNote}</p>
          <textarea
            rows={2}
            placeholder={eq.qaReviewerNotePlaceholder}
            value={qaState.reviewerNote}
            onChange={e => setQa({ reviewerNote: e.target.value })}
            className={`w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
              isDark
                ? "bg-white/5 border-white/15 text-white placeholder-white/30"
                : "bg-white border-gray-200 text-gray-800 placeholder-gray-400"
            }`}
          />
        </div>

        <button
          onClick={() => setStage("export")}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all"
        >
          {eq.finalizeAndExport}
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 4 — Export
  // ═══════════════════════════════════════════════════════════════════════════

  const finalEmotion    = resolveEmotion();
  const finalTones      = resolveTones();
  const finalIntensity  = resolveIntensity();
  const finalEscalation = resolveEscalation();

  const disagreements = [
    !aiResult.emotionAgreement,
    !aiResult.tonesAgreement,
    !aiResult.intensityAgreement,
    !aiResult.escalationAgreement,
  ].filter(Boolean).length;

  const avgConf = (
    (aiResult.emotionConf + aiResult.tonesConf + aiResult.intensityConf + aiResult.escalationConf) / 4
  ).toFixed(2);

  const suitability =
    finalEscalation === "escalate" ? eq.suitabilitySafetyRequired
    : finalEscalation === "monitor" ? eq.suitabilityMonitorRequired
    : eq.suitabilityCxReady;

  const exportJson = {
    audio_id:         sample.id,
    domain:           "Speech_Emotion_Analysis",
    emotion:          finalEmotion,
    tone:             finalTones,
    intensity:        finalIntensity,
    escalation_flag:  finalEscalation,
    ai_confidence:    parseFloat(avgConf),
    qa_final_status:  finalEscalation === "escalate" ? "safety_review_required" : "approved_for_training",
    annotator_notes:  annotation.notes || null,
    qa_reviewer_note: qaState.reviewerNote || null,
  };

  const escalEmoColors = isDark ? EMOTION_COLOR_DARK[finalEmotion] : EMOTION_COLOR_LIGHT[finalEmotion];
  const escalIconCol   = isDark ? ESCALATION_COLOR_DARK[finalEscalation] : ESCALATION_COLOR_LIGHT[finalEscalation];
  const escalBg        = isDark ? ESCALATION_BG_DARK[finalEscalation] : ESCALATION_BG_LIGHT[finalEscalation];

  const exportScreen = (
    <div className="space-y-5">
      {/* Final emotional profile */}
      <div className={card}>
        <p className={sectionHead}>{eq.finalEmotionalProfile}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Emotion */}
          <div className={`rounded-xl p-3 border text-center ${escalEmoColors}`}>
            <span className="material-symbols-outlined block mb-1" style={{ fontSize: 24 }}>
              {primaryEmotions.find(e => e.key === finalEmotion)?.icon}
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{eq.primaryEmotionLabel}</p>
            <p className="text-sm font-bold mt-0.5">{emotionLabel[finalEmotion]}</p>
          </div>
          {/* Intensity */}
          <div className={`rounded-xl p-3 border text-center ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}>
            <span className="material-symbols-outlined block mb-1" style={{ fontSize: 24 }}>{finalIntensity === "high" ? "bolt" : finalIntensity === "medium" ? "speed" : "expand_less"}</span>
            <p className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? "text-white/40" : "text-gray-400"}`}>{eq.intensityLabel}</p>
            <p className={`text-sm font-bold mt-0.5 ${isDark ? "text-white/80" : "text-gray-800"}`}>{intensityLabel[finalIntensity]}</p>
          </div>
          {/* Tone */}
          <div className={`rounded-xl p-3 border ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}>
            <span className="material-symbols-outlined block mb-1" style={{ fontSize: 24 }}>record_voice_over</span>
            <p className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? "text-white/40" : "text-gray-400"}`}>{eq.toneAttributesLabel}</p>
            <p className={`text-xs font-semibold mt-0.5 ${isDark ? "text-white/70" : "text-gray-700"}`}>{finalTones.map(t => toneLabel[t]).join(", ")}</p>
          </div>
          {/* Escalation */}
          <div className={`rounded-xl p-3 border ${escalBg}`}>
            <span className={`material-symbols-outlined block mb-1 ${escalIconCol}`} style={{ fontSize: 24 }}>{ESCALATION_ICON[finalEscalation]}</span>
            <p className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? "text-white/40" : "text-gray-400"}`}>{eq.escalationRiskLabel}</p>
            <p className={`text-sm font-bold mt-0.5 ${escalIconCol}`}>
              {escalationOpts.find(o => o.key === finalEscalation)?.label}
            </p>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: "compare_arrows",   label: eq.kpiDisagreements,  value: `${disagreements} / 4` },
          { icon: "query_stats",      label: eq.kpiAvgConfidence,  value: `${Math.round(parseFloat(avgConf) * 100)}%` },
          { icon: "dataset",          label: eq.kpiSuitability,    value: suitability },
        ].map(({ icon, label, value }) => (
          <div key={label} className={`${card} text-center`}>
            <span className={`material-symbols-outlined mb-1 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} style={{ fontSize: 22 }}>{icon}</span>
            <p className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? "text-white/40" : "text-gray-400"}`}>{label}</p>
            <p className={`text-sm font-bold mt-1 ${isDark ? "text-white/90" : "text-gray-800"}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* JSON Export */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <p className={sectionHead + " mb-0"}>{eq.exportTitle}</p>
          <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
            isDark
              ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30"
              : "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100"
          }`}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
            {eq.downloadJson}
          </button>
        </div>
        <pre className={`rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed border ${
          isDark ? "bg-black/40 border-white/8 text-emerald-400" : "bg-gray-900 border-gray-700 text-emerald-400"
        }`}>
          {JSON.stringify(exportJson, null, 2)}
        </pre>
      </div>

      {/* Next sample */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            const next = (sampleIdx + 1) % SAMPLES.length;
            setSampleIdx(next);
            setStage("annotate");
          }}
          className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${
            isDark
              ? "bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
              : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {eq.nextSample}
        </button>
        <button
          onClick={() => navigate("/use-cases")}
          className={`px-6 py-3 rounded-xl font-bold text-sm border transition-all ${
            isDark
              ? "bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
              : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {eq.backToUseCases}
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ROOT RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="dark-surface sticky top-0 z-20 border-b border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate("/use-cases")}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>arrow_back</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-indigo-400 flex-shrink-0" style={{ fontSize: 20 }}>psychology</span>
            <span className="text-white font-bold text-sm truncate">{eq.pageTitle}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border border-white/20 text-white/70 bg-white/5 hidden sm:block`}>
              AUD-403
            </span>
            {SAMPLES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setSampleIdx(i); setStage("annotate"); }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                  i === sampleIdx
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "border-white/20 text-white/60 hover:bg-white/10"
                }`}
              >
                {s.id}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Title block */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>
              {eq.domainBadge}
            </span>
            <span className={isDark ? "text-white/20" : "text-gray-300"}>·</span>
            <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/30" : "text-gray-400"}`}>
              AUD-403
            </span>
          </div>
          <h1 className={`text-2xl md:text-3xl font-black mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
            {eq.pageTitle}
          </h1>
          <p className={`text-sm ${isDark ? "text-white/45" : "text-gray-500"}`}>{eq.pageSubtitle}</p>
        </div>

        {/* Pipeline stepper */}
        <PipelineStepper current={stage} isDark={isDark} stageLabels={STAGE_LABELS} />

        {/* Stage content */}
        {stage === "annotate"  && annotateScreen}
        {stage === "ai-verify" && aiVerifyScreen}
        {stage === "qa"        && qaScreen}
        {stage === "export"    && exportScreen}
      </main>
    </div>
  );
}
