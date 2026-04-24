/**
 * CheatingOrSkill.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * "Is This Cheating or Skill?" – Gaming Trust & Safety Demo
 *
 * 4-stage interactive pipeline:
 *   Stage 1 › Manual Annotation  – attendee labels a gameplay clip
 *   Stage 2 › AI Review          – deterministic AI-assisted analysis
 *   Stage 3 › Human QA Review    – override / validate / escalate
 *   Stage 4 › Delivery           – final decision + impact metrics
 *
 * All data is pre-scripted mock data. No real ML, no external APIs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Brain, Shield, AlertTriangle,
  CheckCircle2, XCircle, Zap, TrendingUp, Users, RotateCcw,
  Check, Play, Pause, Target, Activity, Gamepad2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage        = 1 | 2 | 3 | 4;
type ClassLabel   = "skill" | "cheat" | "unsure";
type CheatType    = "aim_assist" | "wall_awareness" | "macro_input" | "movement" | "network_artifact";
type EvidenceFlag = "aim_snap" | "obstacle_tracking" | "recoil_pattern" | "reaction_outlier" | "no_evidence";
type QAAction     = "approve_skill" | "confirm_cheat" | "needs_followup";
type FinalStatus  = "skill" | "cheat" | "followup";
type GroundTruth  = "skill" | "cheat" | "borderline";

interface Annotation {
  label:      ClassLabel | null;
  cheatType:  CheatType | null;
  evidence:   EvidenceFlag[];
  confidence: number;
  note:       string;
}

interface FinalDecision {
  status:  FinalStatus;
  correct: boolean;
  heading: string;
  body:    string;
}

interface KillEvent { x: number; y: number; t: number; label: string; }
interface SuspiciousZone { x: number; y: number; w: number; h: number; label: string; }
interface TrajectoryPath { d: string; color: string; }

interface Clip {
  id:          string;
  title:       string;
  subtitle:    string;
  scenario:    string;
  duration:    number; // seconds
  groundTruth: GroundTruth;
  trajectoryPaths: TrajectoryPath[];
  killEvents:  KillEvent[];
  suspiciousZones: SuspiciousZone[];
  stats: { avgReactionMs: number; aimSmoothness: number; inputAPM: number; suspiciousEvents: number; };
  aiResult: {
    riskScore:           number;
    recommendation:      "Likely Skill" | "Likely Cheating" | "Uncertain: Escalate";
    aimAnomalyScore:     number;
    occlusionScore:      number;
    inputPatternScore:   number;
    networkArtifactScore: number;
    explanationBullets:  string[];
  };
  finalDecision: Record<QAAction, FinalDecision>;
}

// ─── Clip Data ────────────────────────────────────────────────────────────────

const CLIPS: Clip[] = [
  // ── Clip A: "The Clutch" — Legit Skill ──────────────────────────────────
  {
    id: "clip_a",
    title: "Clip A — The Clutch",
    subtitle: "Tournament qualifier · 4K in 11s",
    scenario: "Player eliminates 4 opponents in rapid succession during a clutch round. Fast reflexes, but aim movement follows natural human acceleration curves.",
    duration: 11,
    groundTruth: "skill",
    trajectoryPaths: [
      { d: "M 195 148 C 245 128 268 108 282 96",   color: "#8b5cf6" },
      { d: "M 282 96  C 248 120 200 158 145 196",   color: "#8b5cf6" },
      { d: "M 145 196 C 200 188 268 212 316 224",   color: "#a78bfa" },
      { d: "M 316 224 C 278 208 190 165 98 132",    color: "#a78bfa" },
    ],
    killEvents: [
      { x: 282, y: 96,  t: 0.25, label: "K1 · 180ms" },
      { x: 145, y: 196, t: 0.45, label: "K2 · 210ms" },
      { x: 316, y: 224, t: 0.63, label: "K3 · 195ms" },
      { x: 98,  y: 132, t: 0.80, label: "K4 · 228ms" },
    ],
    suspiciousZones: [],
    stats: { avgReactionMs: 203, aimSmoothness: 82, inputAPM: 318, suspiciousEvents: 0 },
    aiResult: {
      riskScore: 24,
      recommendation: "Likely Skill",
      aimAnomalyScore: 18, occlusionScore: 8, inputPatternScore: 22, networkArtifactScore: 6,
      explanationBullets: [
        "Aim arcs show natural sigmoid acceleration — consistent with high-skill human play",
        "Reaction times average 203ms, within documented top-percentile human range",
        "No crosshair movement detected toward targets before line-of-sight opened",
        "Input timing variance consistent with human motor control (±18ms jitter)",
      ],
    },
    finalDecision: {
      approve_skill:  { status:"skill",    correct:true,  heading:"Approved — No Action",              body:"Both AI and QA agree: high-skill play, no enforcement warranted. Zero false positives generated, player trust preserved." },
      confirm_cheat:  { status:"cheat",    correct:false, heading:"False Positive Generated",           body:"This was legitimate skill. Enforcing here wrongfully bans a real player, erodes platform trust, and generates an appeal that overturns the decision." },
      needs_followup: { status:"followup", correct:true,  heading:"Escalated for Additional Evidence", body:"Cautious escalation is defensible for high-speed clips. Senior reviewer can access full peripheral telemetry to confirm." },
    },
  },

  // ── Clip B: "Silent Tracker" — Clear Cheat ──────────────────────────────
  {
    id: "clip_b",
    title: "Clip B — Silent Tracker",
    subtitle: "Ranked match · Pre-aim anomaly detected",
    scenario: "Player's crosshair tracks opponents before they become visible and continues moving through solid obstacles. Reaction intervals are physiologically impossible.",
    duration: 8,
    groundTruth: "cheat",
    trajectoryPaths: [
      { d: "M 195 148 L 290 83",  color: "#ef4444" },
      { d: "M 290 83  L 108 198", color: "#ef4444" },
      { d: "M 108 198 L 320 180", color: "#f97316" },
      { d: "M 320 180 L 168 90",  color: "#f97316" },
    ],
    killEvents: [
      { x: 290, y: 83,  t: 0.20, label: "K1 · <5ms" },
      { x: 108, y: 198, t: 0.38, label: "K2 · wall" },
      { x: 320, y: 180, t: 0.56, label: "K3 · pre-aim" },
      { x: 168, y: 90,  t: 0.74, label: "K4 · <5ms" },
    ],
    suspiciousZones: [
      { x: 240, y: 58,  w: 122, h: 82,  label: "Tracking through cover B" },
      { x: 138, y: 158, w: 122, h: 82,  label: "Pre-aim zone (no LoS)" },
    ],
    stats: { avgReactionMs: 4, aimSmoothness: 99, inputAPM: 412, suspiciousEvents: 4 },
    aiResult: {
      riskScore: 95,
      recommendation: "Likely Cheating",
      aimAnomalyScore: 98, occlusionScore: 96, inputPatternScore: 92, networkArtifactScore: 12,
      explanationBullets: [
        "Aim acceleration pattern shows instantaneous 0-frame snapping — physiologically impossible for human input",
        "Target tracking continues 340ms during complete occlusion — no line-of-sight available to the player",
        "Input intervals show automation-like regularity: <1ms variance across 24 sampled inputs",
        "Pre-aim behaviour detected an average 340ms before target visibility window opened",
      ],
    },
    finalDecision: {
      approve_skill:  { status:"skill",    correct:false, heading:"False Negative Generated",           body:"A confirmed cheater cleared. They remain active on the platform, continue degrading match integrity, and generate ongoing player reports." },
      confirm_cheat:  { status:"cheat",    correct:true,  heading:"Enforcement Action Queued",          body:"High-confidence cheat confirmed and actioned. Both human and AI agree — a fast, defensible decision with clear audit trail." },
      needs_followup: { status:"followup", correct:true,  heading:"Escalated to Fraud Investigation",  body:"At 95/100 confidence, escalation is cautious but defensible. Senior reviewer has full peripheral telemetry for additional corroboration." },
    },
  },

  // ── Clip C: "Frame Perfect" — Borderline ────────────────────────────────
  {
    id: "clip_c",
    title: "Clip C — Frame Perfect",
    subtitle: "Casual match · Ambiguous input pattern",
    scenario: "Player's inputs are near-pixel-perfect with suspiciously low timing variance. Could be elite skill or macro assistance — AI is uncertain.",
    duration: 14,
    groundTruth: "borderline",
    trajectoryPaths: [
      { d: "M 200 150 C 232 136 258 120 272 112", color: "#f59e0b" },
      { d: "M 272 112 C 248 128 220 148 195 165", color: "#f59e0b" },
      { d: "M 195 165 C 168 178 148 188 128 192", color: "#f59e0b" },
      { d: "M 128 192 C 168 175 218 156 265 148", color: "#d97706" },
    ],
    killEvents: [
      { x: 272, y: 112, t: 0.28, label: "K1 · 94ms" },
      { x: 128, y: 192, t: 0.55, label: "K2 · 96ms" },
      { x: 265, y: 148, t: 0.78, label: "K3 · 98ms" },
    ],
    suspiciousZones: [
      { x: 168, y: 104, w: 128, h: 92,  label: "Suspiciously uniform aim path" },
    ],
    stats: { avgReactionMs: 96, aimSmoothness: 96, inputAPM: 398, suspiciousEvents: 2 },
    aiResult: {
      riskScore: 58,
      recommendation: "Uncertain: Escalate",
      aimAnomalyScore: 62, occlusionScore: 18, inputPatternScore: 74, networkArtifactScore: 48,
      explanationBullets: [
        "Input timing intervals at 97th-percentile consistency — possible macro assistance, but explainable by elite training",
        "Reaction times average 96ms — below typical human threshold but within documented outlier range",
        "No wall-awareness or occlusion tracking detected — meaningfully reduces cheat likelihood",
        "Network latency spikes (48%) lower overall model confidence — timing anomalies may have an environmental cause",
      ],
    },
    finalDecision: {
      approve_skill:  { status:"skill",    correct:true,  heading:"Approved — Account Monitored",      body:"Borderline flag cleared with 30-day passive monitoring. Proportionate response for ambiguous evidence. Defensible if appealed." },
      confirm_cheat:  { status:"cheat",    correct:false, heading:"Risk: Possible False Positive",      body:"Enforcing on borderline evidence risks a wrongful ban. Without stronger corroborating signals, this decision is difficult to defend on appeal." },
      needs_followup: { status:"followup", correct:true,  heading:"Escalated — Telemetry Requested",   body:"Correct escalation. Senior reviewer requests 30 days of match history and peripheral telemetry before any enforcement action." },
    },
  },

  // ── Clip D: "Through the Wall" — Wallhack / ESP ──────────────────────────
  {
    id: "clip_d",
    title: "Clip D — Through the Wall",
    subtitle: "Competitive ladder · Pre-fire anomaly",
    scenario: "Player consistently pre-fires at exact corner positions before opponents peek. Crosshair tracks moving targets through solid cover with no visual information available.",
    duration: 9,
    groundTruth: "cheat",
    trajectoryPaths: [
      { d: "M 195 148 L 82 88",   color: "#ef4444" },
      { d: "M 82 88  L 312 192",  color: "#ef4444" },
      { d: "M 312 192 L 200 212", color: "#f97316" },
      { d: "M 200 212 L 295 82",  color: "#f97316" },
    ],
    killEvents: [
      { x: 82,  y: 88,  t: 0.22, label: "K1 · pre-fire" },
      { x: 312, y: 192, t: 0.42, label: "K2 · wall-track" },
      { x: 200, y: 212, t: 0.60, label: "K3 · no LoS" },
      { x: 295, y: 82,  t: 0.78, label: "K4 · pre-fire" },
    ],
    suspiciousZones: [
      { x: 28,  y: 38,  w: 132, h: 124, label: "Pre-fire through cover A" },
      { x: 308, y: 158, w: 72,  h: 82,  label: "Wall-track cover B" },
    ],
    stats: { avgReactionMs: 6, aimSmoothness: 98, inputAPM: 388, suspiciousEvents: 4 },
    aiResult: {
      riskScore: 91,
      recommendation: "Likely Cheating",
      aimAnomalyScore: 88, occlusionScore: 97, inputPatternScore: 84, networkArtifactScore: 9,
      explanationBullets: [
        "Crosshair positioned at target locations 280–420ms before any visual indicator was available to the player",
        "Occlusion tracking score 97/100 — target positions tracked continuously through solid map geometry",
        "Pre-fire pattern consistent across 4 independent engagements, ruling out coincidence (p < 0.001)",
        "No network artifacts detected — lag-based false positives eliminated as explanation",
      ],
    },
    finalDecision: {
      approve_skill:  { status:"skill",    correct:false, heading:"False Negative Generated",           body:"A wallhack user cleared. They retain full access, continue gaining unfair advantage, and player reports will keep escalating." },
      confirm_cheat:  { status:"cheat",    correct:true,  heading:"Enforcement Action Queued",          body:"Wallhack detection confirmed. Pre-fire patterns across 4 engagements constitute strong multi-signal evidence. Fast, appeal-ready decision." },
      needs_followup: { status:"followup", correct:true,  heading:"Escalated for Cross-Match Analysis", body:"Escalation triggers a cross-match review to confirm the pre-fire pattern is consistent across additional sessions." },
    },
  },

  // ── Clip E: "The Reload God" — Skill misread as cheat ────────────────────
  {
    id: "clip_e",
    title: "Clip E — The Reload God",
    subtitle: "Pro scrimmage · Technique vs. macro flag",
    scenario: "Elite player executes a documented 'reload cancel + flick' technique at peak speed. AI flags input regularity — but this is a known high-skill pattern, not macro automation.",
    duration: 13,
    groundTruth: "skill",
    trajectoryPaths: [
      { d: "M 195 148 C 218 138 242 126 258 118", color: "#10b981" },
      { d: "M 258 118 C 238 130 212 146 188 160", color: "#10b981" },
      { d: "M 188 160 C 205 155 226 148 248 142", color: "#34d399" },
      { d: "M 248 142 C 228 152 205 164 182 174", color: "#34d399" },
      { d: "M 182 174 C 202 165 228 154 252 146", color: "#6ee7b7" },
      { d: "M 252 146 C 232 157 208 168 185 178", color: "#6ee7b7" },
    ],
    killEvents: [
      { x: 258, y: 118, t: 0.18, label: "K1 · 162ms" },
      { x: 188, y: 160, t: 0.33, label: "K2 · 178ms" },
      { x: 248, y: 142, t: 0.48, label: "K3 · 155ms" },
      { x: 182, y: 174, t: 0.62, label: "K4 · 169ms" },
      { x: 252, y: 146, t: 0.76, label: "K5 · 172ms" },
      { x: 185, y: 178, t: 0.90, label: "K6 · 180ms" },
    ],
    suspiciousZones: [],
    stats: { avgReactionMs: 169, aimSmoothness: 91, inputAPM: 445, suspiciousEvents: 1 },
    aiResult: {
      riskScore: 36,
      recommendation: "Likely Skill",
      aimAnomalyScore: 28, occlusionScore: 5, inputPatternScore: 68, networkArtifactScore: 14,
      explanationBullets: [
        "Input APM (445) is high but consistent with documented 'reload cancel' technique used by verified pro players",
        "Aim arcs show natural overshoot and micro-correction — absent in macro-generated inputs",
        "Reaction times range 155–180ms with ±18ms natural jitter — inconsistent with scripted timing",
        "No occlusion tracking or pre-aim detected — risk isolated to input cadence, not spatial awareness",
      ],
    },
    finalDecision: {
      approve_skill:  { status:"skill",    correct:true,  heading:"Approved — Technique Verified",     body:"The 'reload cancel + flick' technique is documented in this game's competitive community. High APM alone is not a cheat signal. Correct call." },
      confirm_cheat:  { status:"cheat",    correct:false, heading:"False Positive — Pro Player Banned", body:"A legitimate elite player was wrongfully banned. Appeals will overturn this, but the damage to trust and competitive integrity is already done." },
      needs_followup: { status:"followup", correct:true,  heading:"Escalated — Technique Library Check", body:"Escalation triggers a check against the known-technique library. Senior reviewer confirms reload cancel pattern and closes with approval." },
    },
  },

  // ── Clip F: "Perfect Vision" — Suspicious map awareness ─────────────────
  {
    id: "clip_f",
    title: "Clip F — Perfect Vision",
    subtitle: "Battle royale · Map awareness anomaly",
    scenario: "Player rotates to exact ambush positions seconds before opponents arrive — repeatedly. Could reflect outstanding game sense or a third-party ESP overlay providing real-time enemy positions.",
    duration: 16,
    groundTruth: "borderline",
    trajectoryPaths: [
      { d: "M 195 148 C 225 140 252 130 268 122", color: "#f59e0b" },
      { d: "M 268 122 C 245 132 215 148 188 160", color: "#f59e0b" },
      { d: "M 188 160 C 165 172 145 182 130 188", color: "#d97706" },
      { d: "M 130 188 C 158 178 198 160 228 148", color: "#d97706" },
    ],
    killEvents: [
      { x: 268, y: 122, t: 0.25, label: "K1 · rotation+" },
      { x: 130, y: 188, t: 0.58, label: "K2 · rotation+" },
    ],
    suspiciousZones: [
      { x: 155, y: 100, w: 145, h: 108, label: "Predictive rotation zone" },
    ],
    stats: { avgReactionMs: 142, aimSmoothness: 88, inputAPM: 312, suspiciousEvents: 3 },
    aiResult: {
      riskScore: 53,
      recommendation: "Uncertain: Escalate",
      aimAnomalyScore: 22, occlusionScore: 62, inputPatternScore: 38, networkArtifactScore: 28,
      explanationBullets: [
        "Positional rotations pre-empt opponent movements by 600–900ms in 3 of 4 observed engagements",
        "Occlusion score 62 — player routes toward areas with hidden enemies, but no through-wall crosshair tracking detected",
        "Aim and input patterns are consistent with human play — risk is purely positional / game-sense based",
        "Insufficient signal strength for automated action; match history context required to differentiate ESP from elite game sense",
      ],
    },
    finalDecision: {
      approve_skill:  { status:"skill",    correct:true,  heading:"Approved — Pattern Monitoring Active", body:"Positional game sense alone is insufficient for enforcement. Account placed on passive monitoring. If ESP pattern persists across matches, signals will compound." },
      confirm_cheat:  { status:"cheat",    correct:false, heading:"Risk: Weak Evidence Base",            body:"Enforcing on positional intuition alone is extremely difficult to defend on appeal. No through-wall crosshair data or input anomalies corroborate this decision." },
      needs_followup: { status:"followup", correct:true,  heading:"Escalated — Match History Review",   body:"15-match positional heatmap analysis requested. If pre-emptive rotations persist at statistical significance, a stronger case can be built." },
    },
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const CHEAT_TYPES: { id: CheatType; label: string }[] = [
  { id: "aim_assist",       label: "Aim assistance anomaly" },
  { id: "wall_awareness",   label: "Wall awareness anomaly" },
  { id: "macro_input",      label: "Macro / input automation" },
  { id: "movement",         label: "Movement anomaly" },
  { id: "network_artifact", label: "Network / lag artifact" },
];

const EVIDENCE_FLAGS: { id: EvidenceFlag; label: string }[] = [
  { id: "aim_snap",          label: "Unnatural aim snap" },
  { id: "obstacle_tracking", label: "Tracking through obstacles" },
  { id: "recoil_pattern",    label: "Impossible recoil pattern" },
  { id: "reaction_outlier",  label: "Reaction time outlier" },
  { id: "no_evidence",       label: "No evidence / looks normal" },
];

const STEPS = [
  { n: 1, label: "Annotate" },
  { n: 2, label: "AI Review" },
  { n: 3, label: "Human QA" },
  { n: 4, label: "Delivered" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskHue(n: number) {
  return n >= 80 ? "#ef4444" : n >= 60 ? "#f97316" : n >= 40 ? "#f59e0b" : "#10b981";
}
function riskBg(n: number) {
  return n >= 80 ? "rgba(220,38,38,0.18)" : n >= 60 ? "rgba(234,88,12,0.18)" : n >= 40 ? "rgba(217,119,6,0.18)" : "rgba(5,150,105,0.18)";
}
function confLabel(n: number) {
  return n >= 70 ? "High" : n >= 40 ? "Medium" : "Low";
}
function confColor(n: number) {
  return n >= 70 ? "#10b981" : n >= 40 ? "#f59e0b" : "#ef4444";
}

// ─── Position interpolator ────────────────────────────────────────────────────

function getPosition(progress: number, clip: Clip): { x: number; y: number } {
  const pts = [
    { t: 0,   x: 195, y: 148 },
    ...clip.killEvents.map(k => ({ t: k.t, x: k.x, y: k.y })),
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    if (progress >= pts[i].t && progress <= pts[i + 1].t) {
      const a = pts[i], b = pts[i + 1];
      const local = (progress - a.t) / (b.t - a.t);
      return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
    }
  }
  return pts[pts.length - 1];
}

// ─── Replay Viewer ────────────────────────────────────────────────────────────

function ReplayViewer({ clip }: { clip: Clip }) {
  const [progress, setProgress] = useState(0);
  const [playing,  setPlaying]  = useState(false);
  const rafRef      = useRef<number | null>(null);
  const startRef    = useRef<number>(0);
  const pausedRef   = useRef<number>(0);
  const DURATION_MS = clip.duration * 1000;

  // reset when clip changes
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setProgress(0);
    setPlaying(false);
    pausedRef.current = 0;
  }, [clip.id]);

  useEffect(() => {
    if (!playing) return;
    startRef.current = performance.now() - pausedRef.current * DURATION_MS;
    const tick = (now: number) => {
      const p = Math.min((now - startRef.current) / DURATION_MS, 1);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
        pausedRef.current = 0;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing]);

  const toggle = () => {
    if (playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      pausedRef.current = progress;
      setPlaying(false);
    } else {
      if (progress >= 1) { pausedRef.current = 0; setProgress(0); }
      setPlaying(true);
    }
  };

  const visibleKills = clip.killEvents.filter(k => k.t <= progress);
  const pos = getPosition(progress, clip);
  const elapsed = Math.floor(progress * clip.duration);
  const timeStr = `0:${elapsed.toString().padStart(2, "0")} / 0:${clip.duration.toString().padStart(2, "0")}`;

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden flex flex-col" style={{ background: "var(--s3)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
        <div>
          <div className="text-sm font-bold text-foreground font-headline">{clip.title}</div>
          <div className="text-xs text-foreground/40 font-body">{clip.subtitle}</div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
          playing
            ? "bg-red-600/20 text-red-300 border-red-600/30"
            : "bg-white/5 text-foreground/40 border-white/10"
        }`}>
          {playing ? "● REC" : "⏸ PAUSED"}
        </span>
      </div>

      {/* SVG Map */}
      <div className="relative">
        <svg viewBox="0 0 400 300" className="w-full" style={{ background: "#070d16" }}>
          <defs>
            <pattern id="cgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="400" height="300" fill="url(#cgrid)" />

          {/* Map obstacles */}
          {[
            { x:78,  y:38,  w:82, h:122 },
            { x:238, y:58,  w:124,h:82  },
            { x:138, y:158, w:124,h:82  },
            { x:28,  y:218, w:62, h:62  },
            { x:308, y:198, w:72, h:82  },
          ].map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="4"
              fill="rgba(80,110,160,0.10)" stroke="rgba(80,110,160,0.22)" strokeWidth="1"/>
          ))}
          <text x="119" y="101" textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="7" fontFamily="monospace">COVER A</text>
          <text x="300" y="101" textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="7" fontFamily="monospace">COVER B</text>
          <text x="200" y="201" textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="7" fontFamily="monospace">CENTER</text>

          {/* Suspicious zones */}
          {clip.suspiciousZones.map((z, i) => (
            <g key={i}>
              <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="4"
                fill="rgba(239,68,68,0.07)" stroke="rgba(239,68,68,0.35)" strokeWidth="1" strokeDasharray="4,3"/>
              <text x={z.x + z.w / 2} y={z.y + z.h + 10} textAnchor="middle"
                fill="rgba(239,68,68,0.6)" fontSize="6.5" fontFamily="monospace">{z.label}</text>
            </g>
          ))}

          {/* Trajectory paths */}
          {clip.trajectoryPaths.map((p, i) => (
            <path key={i} d={p.d} fill="none" stroke={p.color} strokeWidth="2"
              opacity="0.55" strokeLinecap="round" strokeLinejoin="round"/>
          ))}

          {/* Kill events — appear as progress passes their t */}
          {visibleKills.map((k, i) => (
            <g key={i}>
              <circle cx={k.x} cy={k.y} r="12" fill="none" stroke="#ef4444" strokeWidth="1.2" opacity="0.3">
                <animate attributeName="r" values="12;20;12" dur="2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite"/>
              </circle>
              <circle cx={k.x} cy={k.y} r="4" fill="#ef4444"/>
              <text x={k.x + 8} y={k.y - 6} fill="#f87171" fontSize="7" fontFamily="monospace">{k.label}</text>
            </g>
          ))}

          {/* Moving crosshair */}
          {progress > 0 && (
            <g>
              <line x1={pos.x - 9} y1={pos.y} x2={pos.x + 9} y2={pos.y} stroke="white" strokeWidth="1.5" opacity="0.9"/>
              <line x1={pos.x} y1={pos.y - 9} x2={pos.x} y2={pos.y + 9} stroke="white" strokeWidth="1.5" opacity="0.9"/>
              <circle cx={pos.x} cy={pos.y} r="6" fill="none" stroke="white" strokeWidth="1" opacity="0.7"/>
            </g>
          )}

          {/* Start dot */}
          <circle cx="195" cy="148" r="6" fill="#8b5cf6" opacity="0.7"/>
          <circle cx="195" cy="148" r="3" fill="white"/>
          <text x="204" y="145" fill="rgba(255,255,255,0.45)" fontSize="7" fontFamily="monospace">START</text>

          {/* Corner labels */}
          <text x="6"   y="11" fill="rgba(255,255,255,0.18)" fontSize="6.5" fontFamily="monospace">MAP: ALPHA</text>
          <text x="394" y="11" fill="rgba(255,255,255,0.18)" fontSize="6.5" fontFamily="monospace" textAnchor="end">{timeStr}</text>
        </svg>

        {/* Play overlay */}
        {!playing && progress === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer" onClick={toggle}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center border border-violet-400/30 backdrop-blur-sm"
              style={{ background: "rgba(109,40,217,0.75)" }}>
              <Play size={24} className="text-white ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="px-4 py-2.5 border-t border-white/8">
        <div className="flex items-center gap-3">
          <button onClick={toggle}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0">
            {playing
              ? <Pause size={13} className="text-foreground/70"/>
              : <Play  size={13} className="text-foreground/70 ml-0.5"/>}
          </button>
          <div className="flex-1 h-1 rounded-full overflow-hidden cursor-pointer" style={{ background: "rgba(255,255,255,0.1)" }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const p = (e.clientX - rect.left) / rect.width;
              pausedRef.current = p;
              setProgress(p);
              setPlaying(false);
            }}>
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }}/>
          </div>
          <span className="text-xs text-foreground/35 tabular-nums font-mono flex-shrink-0">{timeStr}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 border-t border-white/8">
        {[
          { label: "Avg React", value: `${clip.stats.avgReactionMs}ms`, warn: clip.stats.avgReactionMs < 50 },
          { label: "Aim Smooth", value: `${clip.stats.aimSmoothness}%`, warn: clip.stats.aimSmoothness > 95 },
          { label: "Input APM",  value: `${clip.stats.inputAPM}`, warn: clip.stats.inputAPM > 380 },
          { label: "⚠ Flags",  value: `${clip.stats.suspiciousEvents}`, warn: clip.stats.suspiciousEvents > 0 },
        ].map((s, i) => (
          <div key={i} className="px-2 py-2 text-center border-r border-white/8 last:border-0">
            <div className={`text-xs font-bold tabular-nums ${s.warn ? "text-red-400" : "text-foreground"}`}>{s.value}</div>
            <div className="text-[10px] text-foreground/35 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Scenario */}
      <div className="px-4 py-3 border-t border-white/8" style={{ background: "hsl(0,0%,5.5%)" }}>
        <p className="text-xs text-foreground/55 leading-relaxed font-body">{clip.scenario}</p>
      </div>
    </div>
  );
}

// ─── Progress Stepper ─────────────────────────────────────────────────────────

function ProgressStepper({ stage }: { stage: Stage }) {
  return (
    <div className="flex items-center justify-center py-4">
      {STEPS.map((step, i) => {
        const done    = stage > step.n;
        const current = stage === step.n;
        return (
          <div key={step.n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                done    ? "bg-violet-600 border-violet-600 text-white" :
                current ? "bg-[var(--s6)] border-violet-500 text-violet-400 ring-4 ring-violet-900/40" :
                          "bg-[var(--s4)] border-white/10 text-white/30"
              }`}>
                {done ? <Check size={15} /> : step.n}
              </div>
              <span className={`mt-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                current ? "text-violet-400" : done ? "text-foreground/60" : "text-foreground/30"
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-14 h-0.5 mx-1 mb-5 transition-all duration-500 ${
                stage > step.n ? "bg-violet-600" : "bg-white/10"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Stage 1 · Manual Annotation ─────────────────────────────────────────────

function Stage1({
  clip, clipIdx, onSubmit,
}: {
  clip: Clip; clipIdx: number; onSubmit: (a: Annotation) => void;
}) {
  const [label,      setLabel]      = useState<ClassLabel | null>(null);
  const [cheatType,  setCheatType]  = useState<CheatType | null>(null);
  const [evidence,   setEvidence]   = useState<EvidenceFlag[]>([]);
  const [confidence, setConfidence] = useState(50);
  const [note,       setNote]       = useState("");

  // Reset when clip changes
  useEffect(() => {
    setLabel(null); setCheatType(null); setEvidence([]); setConfidence(50); setNote("");
  }, [clip.id]);

  const toggleEvidence = (id: EvidenceFlag) => {
    if (id === "no_evidence") { setEvidence(["no_evidence"]); return; }
    setEvidence(prev => {
      const without = prev.filter(e => e !== "no_evidence");
      return without.includes(id) ? without.filter(e => e !== id) : [...without, id];
    });
  };

  const canSubmit = label !== null && evidence.length > 0;

  return (
    <div className="flex gap-5 items-start">
      <div className="flex-1 min-w-0">
        <ReplayViewer clip={clip} />
      </div>

      <div className="w-[370px] flex-shrink-0 space-y-3">
        {/* Role badge */}
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-violet-600/30" style={{ background: "rgba(109,40,217,0.12)" }}>
          <span className="text-xl">🎮</span>
          <div>
            <div className="text-sm font-bold text-violet-300 font-headline">You are the Human Annotator</div>
            <div className="text-xs text-violet-400/75 font-body">Review the clip and submit your assessment</div>
          </div>
        </div>

        {/* Q1 · Classification */}
        <div className="rounded-2xl border border-white/10 p-4" style={{ background: "var(--s4)" }}>
          <p className="text-sm font-semibold text-foreground mb-3 font-headline">1 · Is this skill, cheating, or unsure?</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: "skill"  as ClassLabel, label: "Skill",   active: "bg-emerald-500 border-emerald-500 text-white",     idle: "bg-emerald-950/40 border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/50" },
              { val: "cheat"  as ClassLabel, label: "Cheat",   active: "bg-red-500 border-red-500 text-white",             idle: "bg-red-950/40 border-red-700/50 text-red-400 hover:bg-red-900/50" },
              { val: "unsure" as ClassLabel, label: "Unsure",  active: "bg-amber-500 border-amber-500 text-white",         idle: "bg-amber-950/40 border-amber-700/50 text-amber-400 hover:bg-amber-900/50" },
            ].map(opt => (
              <button key={opt.val} onClick={() => setLabel(opt.val)}
                className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${label === opt.val ? opt.active : opt.idle}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Q2 · Cheat type (conditional) */}
        {(label === "cheat" || label === "unsure") && (
          <div className="rounded-2xl border border-white/10 p-4" style={{ background: "var(--s4)" }}>
            <p className="text-sm font-semibold text-foreground mb-3 font-headline">2 · Suspected cheat type</p>
            <div className="space-y-1.5">
              {CHEAT_TYPES.map(ct => (
                <button key={ct.id} onClick={() => setCheatType(ct.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm text-left transition-all ${
                    cheatType === ct.id
                      ? "border-violet-500/60 text-violet-300"
                      : "border-white/8 text-foreground/65 hover:bg-white/5"
                  }`}
                  style={cheatType === ct.id ? { background: "rgba(109,40,217,0.18)" } : {}}>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all ${
                    cheatType === ct.id ? "bg-violet-500 border-violet-500" : "border-white/20"
                  }`}/>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Q3 · Evidence flags */}
        <div className="rounded-2xl border border-white/10 p-4" style={{ background: "var(--s4)" }}>
          <p className="text-sm font-semibold text-foreground mb-3 font-headline">
            {(label === "cheat" || label === "unsure") ? "3" : "2"} · Evidence flags
          </p>
          <div className="space-y-1.5">
            {EVIDENCE_FLAGS.map(ef => (
              <button key={ef.id} onClick={() => toggleEvidence(ef.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm text-left transition-all ${
                  evidence.includes(ef.id)
                    ? "border-violet-500/60 text-violet-300"
                    : "border-white/8 text-foreground/65 hover:bg-white/5"
                }`}
                style={evidence.includes(ef.id) ? { background: "rgba(109,40,217,0.18)" } : {}}>
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  evidence.includes(ef.id) ? "bg-violet-600 border-violet-600" : "border-white/20"
                }`}>
                  {evidence.includes(ef.id) && <Check size={10} className="text-white"/>}
                </div>
                {ef.label}
              </button>
            ))}
          </div>
        </div>

        {/* Q4 · Confidence slider */}
        <div className="rounded-2xl border border-white/10 p-4" style={{ background: "var(--s4)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground font-headline">
              {(label === "cheat" || label === "unsure") ? "4" : "3"} · Confidence
            </p>
            <span className="text-sm font-bold tabular-nums" style={{ color: confColor(confidence) }}>
              {confidence}% — {confLabel(confidence)}
            </span>
          </div>
          <input type="range" min={0} max={100} value={confidence}
            onChange={e => setConfidence(parseInt(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{ accentColor: confColor(confidence) }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-foreground/30">Low</span>
            <span className="text-[10px] text-foreground/30">Medium</span>
            <span className="text-[10px] text-foreground/30">High</span>
          </div>
        </div>

        {/* Q5 · Note (optional) */}
        <div className="rounded-2xl border border-white/10 p-4" style={{ background: "var(--s4)" }}>
          <p className="text-sm font-semibold text-foreground mb-2 font-headline">
            {(label === "cheat" || label === "unsure") ? "5" : "4"} · Annotator note <span className="text-foreground/30 font-normal">(optional)</span>
          </p>
          <textarea
            value={note}
            onChange={e => { if (e.target.value.length <= 140) setNote(e.target.value); }}
            placeholder="Brief observation…"
            rows={2}
            className="w-full rounded-xl px-3 py-2 text-sm text-foreground/80 placeholder:text-foreground/25 border border-white/10 resize-none focus:outline-none focus:border-violet-500/50 transition-colors font-body"
            style={{ background: "var(--s2)" }}
          />
          <div className="text-right text-[10px] text-foreground/30 mt-1">{note.length}/140</div>
        </div>

        <Button disabled={!canSubmit} onClick={() => canSubmit && onSubmit({ label, cheatType, evidence, confidence, note })}
          className="w-full h-11 text-sm font-semibold bg-violet-600 hover:bg-violet-700">
          Submit Annotation →
        </Button>
        {!canSubmit && <p className="text-xs text-foreground/35 text-center font-body">Select classification and at least one evidence flag</p>}
      </div>
    </div>
  );
}

// ─── Stage 2 · AI Review ──────────────────────────────────────────────────────

function Stage2({
  clip, annotation, onComplete, onBack,
}: {
  clip: Clip; annotation: Annotation; onComplete: () => void; onBack: () => void;
}) {
  const [scores, setScores] = useState({ aim: 0, occlusion: 0, input: 0, network: 0, overall: 0 });
  const [phase,  setPhase]  = useState(0);

  useEffect(() => {
    setScores({ aim: 0, occlusion: 0, input: 0, network: 0, overall: 0 });
    setPhase(0);
    const ai = clip.aiResult;
    const t = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => { setScores(s => ({ ...s, aim:      ai.aimAnomalyScore     })); setPhase(2); }, 800),
      setTimeout(() => { setScores(s => ({ ...s, occlusion:ai.occlusionScore      })); setPhase(3); }, 2000),
      setTimeout(() => { setScores(s => ({ ...s, input:    ai.inputPatternScore   })); setPhase(4); }, 3200),
      setTimeout(() => { setScores(s => ({ ...s, network:  ai.networkArtifactScore})); setPhase(5); }, 4400),
      setTimeout(() => { setScores(s => ({ ...s, overall:  ai.riskScore           })); }, 5600),
    ];
    return () => t.forEach(clearTimeout);
  }, [clip.id]);

  const ai = clip.aiResult;
  const humanLbl   = annotation.label === "skill" ? "✓ Skill" : annotation.label === "cheat" ? "✗ Cheat" : "? Unsure";
  const humanColor = annotation.label === "skill" ? "#10b981" : annotation.label === "cheat" ? "#ef4444" : "#f59e0b";
  const ScoreBar = ({ label, score, active, idx }: { label: string; score: number; active: boolean; idx: number }) => (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-foreground/70">{label}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color: active ? riskHue(score) : "rgba(255,255,255,0.2)" }}>
          {active ? `${score}/100` : "—"}
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: active ? `${score}%` : "0%", background: riskHue(score) }}/>
      </div>
    </div>
  );

  const done = phase >= 5 && scores.overall > 0;

  return (
    <div className="flex gap-5 items-start">
      {/* Left: compact clip card */}
      <div className="flex-1 min-w-0">
        <ReplayViewer clip={clip} />
        {/* Human annotation pill */}
        {done && (
          <div className="mt-3 rounded-xl border border-white/10 px-4 py-3 flex items-center gap-3" style={{ background: "var(--s4)" }}>
            <span className="text-xs font-bold text-foreground/40 uppercase tracking-wider">Your annotation:</span>
            <span className="text-sm font-bold" style={{ color: humanColor }}>{humanLbl}</span>
            <span className="text-xs text-foreground/40">·</span>
            <span className="text-xs text-foreground/50">{confLabel(annotation.confidence)} confidence ({annotation.confidence}%)</span>
          </div>
        )}
      </div>

      <div className="w-[370px] flex-shrink-0 space-y-3">
        {/* Role badge */}
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-blue-600/30" style={{ background: "rgba(37,99,235,0.12)" }}>
          <Brain size={20} className="text-blue-400 flex-shrink-0"/>
          <div className="flex-1">
            <div className="text-sm font-bold text-blue-300 font-headline">AI Detection Model</div>
            <div className="text-xs text-blue-400/75 font-body">AI-assisted · not a final decision</div>
          </div>
          {done && <span className="text-xs px-2 py-0.5 rounded-full font-semibold border border-blue-600/40 text-blue-300" style={{ background: "rgba(37,99,235,0.25)" }}>Complete</span>}
        </div>

        {/* Score bars */}
        <div className="rounded-2xl border border-white/10 p-4 space-y-3.5" style={{ background: "var(--s4)" }}>
          <ScoreBar label="Aim Anomaly Score"        score={scores.aim}       active={phase >= 2} idx={0}/>
          <ScoreBar label="Occlusion Awareness Score" score={scores.occlusion} active={phase >= 3} idx={1}/>
          <ScoreBar label="Input Pattern Score"      score={scores.input}     active={phase >= 4} idx={2}/>
          <ScoreBar label="Network Artifact Likelihood" score={scores.network} active={phase >= 5} idx={3}/>

          {done && (
            <div className="border-t border-white/8 pt-3.5">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/30 mb-2.5">Overall AI Risk Score</p>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: riskBg(scores.overall) }}>
                  <span className="text-2xl font-black" style={{ color: riskHue(scores.overall) }}>{scores.overall}</span>
                </div>
                <div>
                  <div className="text-sm font-bold font-headline" style={{ color: riskHue(scores.overall) }}>{ai.recommendation}</div>
                  <div className="text-xs text-foreground/35 mt-0.5">AI model confidence</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Explanation */}
        {done && (
          <div className="rounded-2xl border border-white/10 p-4" style={{ background: "var(--s4)" }}>
            <p className="text-sm font-semibold text-foreground mb-2.5 font-headline">Signals detected:</p>
            <div className="space-y-2">
              {ai.explanationBullets.map((b, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0"/>
                  <span className="text-xs text-foreground/60 leading-relaxed font-body">{b}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {done && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}
              className="flex-1 h-10 text-xs border-white/15 text-foreground/70 hover:bg-white/5">
              ← Back
            </Button>
            <Button onClick={onComplete} className="flex-[2] h-10 text-sm font-semibold bg-violet-600 hover:bg-violet-700">
              Send to Human QA →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stage 3 · Human QA Review ────────────────────────────────────────────────

function Stage3({
  clip, annotation, onSubmit,
}: {
  clip: Clip; annotation: Annotation; onSubmit: (a: QAAction) => void;
}) {
  const [selected,        setSelected]        = useState<QAAction | null>(null);
  const [overrideReason,  setOverrideReason]  = useState<string | null>(null);
  const ai = clip.aiResult;

  const humanColor = annotation.label === "skill" ? "#10b981" : annotation.label === "cheat" ? "#ef4444" : "#f59e0b";
  const humanLbl   = annotation.label === "skill" ? "✓ Skill" : annotation.label === "cheat" ? "✗ Cheat" : "? Unsure";

  const conflict =
    (annotation.label === "skill"  && ai.riskScore >= 60) ||
    (annotation.label === "cheat"  && ai.riskScore < 40)  ||
    annotation.label === "unsure"  ||
    ai.recommendation === "Uncertain: Escalate";

  const isOverride = selected === "approve_skill" && annotation.label !== "skill" ||
    selected === "confirm_cheat" && annotation.label !== "cheat";

  const OVERRIDE_REASONS = [
    "Clip context not captured by AI metrics",
    "Lag / network artifact explains anomaly",
    "Similar legitimate play seen from same player",
    "AI model known to misclassify this pattern",
  ];

  return (
    <div className="space-y-4">
      {/* Role badge */}
      <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-indigo-600/30" style={{ background: "rgba(79,70,229,0.12)" }}>
        <Shield size={20} className="text-indigo-400 flex-shrink-0"/>
        <div>
          <div className="text-sm font-bold text-indigo-300 font-headline">Human QA Review — TP</div>
          <div className="text-xs text-indigo-400/75 font-body">You are a senior QA reviewer. Review both assessments and make the final call.</div>
        </div>
      </div>

      {/* Conflict banner */}
      {conflict && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3 border border-amber-600/40" style={{ background: "rgba(217,119,6,0.12)" }}>
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0"/>
          <div>
            <div className="text-sm font-bold text-amber-300">Human–AI Conflict / Uncertainty</div>
            <div className="text-xs text-amber-400/75 mt-0.5 font-body">Annotation and AI disagree, or AI is uncertain. Human QA must make the final call.</div>
          </div>
        </div>
      )}

      {/* Three-column compare */}
      <div className="grid grid-cols-3 gap-4">
        {/* Human annotation */}
        <div className="rounded-2xl border-2 border-white/10 p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/30 uppercase tracking-wider mb-3">👤 Human Annotation</p>
          <div className="text-xl font-black mb-2" style={{ color: humanColor }}>{humanLbl}</div>
          <div className="text-xs text-foreground/50 space-y-1.5 font-body">
            <div><span className="font-semibold text-foreground/60">Confidence:</span> {annotation.confidence}% ({confLabel(annotation.confidence)})</div>
            {annotation.cheatType && (
              <div><span className="font-semibold text-foreground/60">Type:</span> {CHEAT_TYPES.find(c => c.id === annotation.cheatType)?.label}</div>
            )}
            <div className="font-semibold text-foreground/60 mt-2">Evidence flags:</div>
            {annotation.evidence.map(e => {
              const ef = EVIDENCE_FLAGS.find(f => f.id === e);
              return ef ? <div key={e}>· {ef.label}</div> : null;
            })}
            {annotation.note && <div className="mt-1.5 italic opacity-60">"{annotation.note}"</div>}
          </div>
        </div>

        {/* Centre — clip stats + TP Insight */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 p-3" style={{ background: "var(--s4)" }}>
            <p className="text-xs font-bold text-foreground/30 uppercase tracking-wider mb-2">📊 Clip Stats</p>
            {[
              { label: "React time",  value: `${clip.stats.avgReactionMs}ms` },
              { label: "Aim smooth",  value: `${clip.stats.aimSmoothness}%` },
              { label: "Input APM",   value: `${clip.stats.inputAPM}` },
              { label: "Risk flags",  value: `${clip.stats.suspiciousEvents}` },
            ].map(s => (
              <div key={s.label} className="flex justify-between text-xs py-0.5">
                <span className="text-foreground/45">{s.label}</span>
                <span className="text-foreground/80 font-mono font-bold">{s.value}</span>
              </div>
            ))}
          </div>
          {/* Quality metrics */}
          <div className="rounded-xl p-3 border border-white/8" style={{ background: "var(--s3)" }}>
            <p className="text-xs font-bold text-foreground/30 uppercase tracking-wider mb-2">📋 Quality Indicators</p>
            {[
              { label: "False positive risk", value: ai.riskScore < 50 ? "Low" : ai.riskScore < 75 ? "Medium" : "High", color: ai.riskScore < 50 ? "#10b981" : ai.riskScore < 75 ? "#f59e0b" : "#ef4444" },
              { label: "False negative risk", value: ai.riskScore > 50 ? "Low" : ai.riskScore > 25 ? "Medium" : "High", color: ai.riskScore > 50 ? "#10b981" : ai.riskScore > 25 ? "#f59e0b" : "#ef4444" },
              { label: "Appeal readiness",    value: ai.riskScore > 80 ? "Strong" : ai.riskScore > 50 ? "Moderate" : "Weak", color: ai.riskScore > 80 ? "#10b981" : ai.riskScore > 50 ? "#f59e0b" : "#ef4444" },
            ].map(q => (
              <div key={q.label} className="flex justify-between text-xs py-0.5">
                <span className="text-foreground/45">{q.label}</span>
                <span className="font-bold" style={{ color: q.color }}>{q.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI result */}
        <div className="rounded-2xl border-2 border-white/10 p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/30 uppercase tracking-wider mb-3">🤖 AI Model Decision</p>
          <div className="text-xl font-black mb-1" style={{ color: riskHue(ai.riskScore) }}>{ai.riskScore}/100</div>
          <div className="text-xs font-bold mb-3 font-headline" style={{ color: riskHue(ai.riskScore) }}>{ai.recommendation}</div>
          <div className="text-xs text-foreground/45 space-y-1 font-body">
            {ai.explanationBullets.slice(0, 3).map((b, i) => <div key={i}>· {b.split("—")[0].trim()}</div>)}
          </div>
        </div>
      </div>

      {/* QA action card */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: "var(--s4)" }}>
        <p className="text-sm font-bold text-foreground mb-4 font-headline">QA Decision — Select your action:</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { action: "approve_skill"  as QAAction, icon: "✓", label: "Approve as Skill",        sub: "No enforcement",        idleBg: "rgba(5,150,105,0.12)",    border: "border-emerald-700/50 text-emerald-400", active: "border-emerald-500 bg-emerald-500 text-white" },
            { action: "confirm_cheat"  as QAAction, icon: "✗", label: "Confirm Cheating",         sub: "Queue enforcement",     idleBg: "rgba(220,38,38,0.12)",    border: "border-red-700/50 text-red-400",          active: "border-red-500 bg-red-500 text-white" },
            { action: "needs_followup" as QAAction, icon: "🔍",label: "Needs Follow-up",          sub: "Escalate for review",   idleBg: "rgba(217,119,6,0.12)",    border: "border-amber-700/50 text-amber-400",      active: "border-amber-500 bg-amber-500 text-white" },
          ].map(opt => (
            <button key={opt.action}
              onClick={() => setSelected(opt.action)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${selected === opt.action ? opt.active : opt.border}`}
              style={selected !== opt.action ? { background: opt.idleBg } : {}}>
              <div className="text-xl mb-1">{opt.icon}</div>
              <div className="text-sm font-bold font-headline">{opt.label}</div>
              <div className={`text-xs mt-0.5 font-body ${selected === opt.action ? "opacity-80" : "opacity-60"}`}>{opt.sub}</div>
            </button>
          ))}
        </div>

        {/* Override rationale */}
        {isOverride && selected && (
          <div className="rounded-xl p-4 mb-4 border border-violet-600/25" style={{ background: "rgba(109,40,217,0.12)" }}>
            <p className="text-sm font-bold text-violet-200 mb-3 font-headline">⚠️ You are overriding — select a rationale:</p>
            <div className="grid grid-cols-2 gap-2">
              {OVERRIDE_REASONS.map(r => (
                <button key={r} onClick={() => setOverrideReason(r)}
                  className={`px-3 py-2 rounded-xl border text-xs text-left transition-all ${
                    overrideReason === r
                      ? "border-violet-400/60 text-violet-200"
                      : "border-white/10 text-foreground/55 hover:bg-white/5"
                  }`}
                  style={overrideReason === r ? { background: "rgba(109,40,217,0.25)" } : {}}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          disabled={!selected || (isOverride && !overrideReason)}
          onClick={() => selected && onSubmit(selected)}
          className="w-full h-11 text-sm font-semibold bg-violet-600 hover:bg-violet-700">
          Finalize QA Decision →
        </Button>
      </div>
    </div>
  );
}

// ─── Stage 4 · Delivery ───────────────────────────────────────────────────────

function Stage4({
  clip, annotation, qaAction, clipIdx, onNext,
}: {
  clip: Clip; annotation: Annotation; qaAction: QAAction; clipIdx: number; onNext: () => void;
}) {
  const navigate = useNavigate();
  const decision = clip.finalDecision[qaAction];

  const statusCfg = {
    skill:    { icon: "✅", label: "Approved — Skill",      ring: "border-emerald-700/40", bg: "rgba(5,150,105,0.10)", heading: "text-emerald-400" },
    cheat:    { icon: "🚫", label: "Enforcement Queued",    ring: "border-red-700/40",     bg: "rgba(220,38,38,0.10)",  heading: "text-red-400" },
    followup: { icon: "⚠️", label: "Escalated",            ring: "border-amber-700/40",   bg: "rgba(217,119,6,0.10)",  heading: "text-amber-400" },
  }[decision.status];

  const correctBanner = decision.correct
    ? { border: "border-emerald-700/40", bg: "rgba(5,150,105,0.12)", icon: <CheckCircle2 size={15} className="text-emerald-500"/>, text: "text-emerald-300", msg: "Correct decision — this matches the ground truth for this clip." }
    : { border: "border-red-700/40",     bg: "rgba(220,38,38,0.12)", icon: <XCircle      size={15} className="text-red-500"/>,     text: "text-red-300",     msg: "Suboptimal decision — see the insight below for the preferred outcome." };

  const recommendedAction = decision.status === "cheat"
    ? "BAN_ACCOUNT" : decision.status === "followup"
    ? "ESCALATE_SENIOR_REVIEW" : "NO_ACTION";

  const jsonPacket = `{
  "clip_id": "${clip.id}",
  "final_label": "${decision.status}",
  "confidence": ${Math.round((annotation.confidence + clip.aiResult.riskScore) / 2)},
  "signals": [${annotation.evidence.map(e => `"${e}"`).join(", ")}],
  "human_notes": "${annotation.note || "none"}",
  "recommended_action": "${recommendedAction}",
  "pipeline": "human_annotate → ai_review → human_qa",
  "decision_latency_ms": ${Math.round(Math.random() * 60000 + 120000)}
}`;

  const metrics = [
    { Icon: Shield,     label: "False Positives Avoided", value: decision.status !== "cheat" ? "0" : "N/A",       sub: "per 1,000 similar clips",                    color: "text-violet-400", iconBg: "rgba(109,40,217,0.20)" },
    { Icon: TrendingUp, label: "Review Time",             value: "<3 min",                                         sub: "annotation → AI → QA → delivery",            color: "text-emerald-400", iconBg: "rgba(5,150,105,0.20)" },
    { Icon: Zap,        label: "AI Assist Rate",          value: "73%",                                            sub: "of clips closed without QA override",         color: "text-blue-400",    iconBg: "rgba(37,99,235,0.20)" },
    { Icon: Users,      label: "TP Specialists",          value: "2",                                              sub: "annotator + QA reviewer in loop",             color: "text-indigo-400",  iconBg: "rgba(79,70,229,0.20)" },
  ];

  const hasMore = clipIdx < CLIPS.length - 1;

  return (
    <div className="flex flex-col gap-5 items-center max-w-2xl mx-auto w-full">
      {/* Delivery badge */}
      <div className="inline-flex items-center gap-2 text-white text-xs font-bold px-4 py-1.5 rounded-full" style={{ background: "var(--s7)" }}>
        <span>📦</span> Step 4: Decision Packet Delivered to Client Platform
      </div>

      {/* Status card */}
      <div className={`w-full rounded-2xl border-2 p-6 text-center ${statusCfg.ring}`} style={{ background: statusCfg.bg }}>
        <div className="text-5xl mb-3">{statusCfg.icon}</div>
        <div className={`text-2xl font-black mb-2 font-headline ${statusCfg.heading}`}>{decision.heading}</div>
        <p className="text-sm text-foreground/60 leading-relaxed max-w-sm mx-auto font-body">{decision.body}</p>
      </div>

      {/* Correct/incorrect banner */}
      <div className={`w-full rounded-xl border px-4 py-2.5 flex items-center gap-3 ${correctBanner.border}`} style={{ background: correctBanner.bg }}>
        {correctBanner.icon}
        <p className={`text-xs font-semibold ${correctBanner.text} font-body`}>{correctBanner.msg}</p>
      </div>

      {/* Decision Packet */}
      <div className="w-full rounded-2xl border border-white/10 overflow-hidden" style={{ background: "var(--s3)" }}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8" style={{ background: "var(--s5)" }}>
          <span className="text-xs font-bold text-foreground/40 uppercase tracking-wider">📄 Decision Packet</span>
          <span className="text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-700/30 px-2 py-0.5 rounded font-mono ml-auto">JSON</span>
        </div>
        <pre className="px-4 py-3 text-xs text-emerald-300/80 font-mono leading-relaxed overflow-x-auto whitespace-pre">{jsonPacket}</pre>
      </div>

      {/* Impact metrics */}
      <div className="w-full">
        <p className="text-xs font-bold text-foreground/30 uppercase tracking-wider mb-3 text-center">Simulated Impact Metrics</p>
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m, i) => (
            <div key={i} className="rounded-xl border border-white/10 p-4" style={{ background: "var(--s4)" }}>
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2" style={{ background: m.iconBg }}>
                <m.Icon size={17} className={m.color}/>
              </div>
              <div className={`text-xl font-black ${m.color}`}>{m.value}</div>
              <div className="text-xs font-semibold text-foreground/70 font-body">{m.label}</div>
              <div className="text-xs text-foreground/35 mt-0.5 font-body">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TP at Scale */}
      <div className="w-full rounded-2xl p-5" style={{ background: "var(--s6)" }}>
        <p className="text-sm font-bold text-foreground mb-4 font-headline">How TP Operationalises This at Scale</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { val: "1M+",  sub: "Gaming clips reviewed monthly" },
            { val: "98.6%",sub: "QA decision consistency" },
            { val: "50+",  sub: "Game titles covered" },
          ].map(kpi => (
            <div key={kpi.val}>
              <div className="text-2xl font-black text-violet-400">{kpi.val}</div>
              <div className="text-xs text-foreground/35 mt-0.5 font-body">{kpi.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div className="flex gap-3 w-full">
        <Button variant="outline" onClick={() => navigate("/use-cases")}
          className="flex-1 gap-2 h-11 border-white/15 text-foreground/70 hover:bg-white/5">
          <ArrowLeft size={13}/> Use Cases
        </Button>
        {hasMore ? (
          <Button onClick={onNext} className="flex-[2] bg-violet-600 hover:bg-violet-700 gap-2 h-11">
            <RotateCcw size={13}/> Next: {CLIPS[clipIdx + 1].title.split("—")[0].trim()} →
          </Button>
        ) : (
          <Button onClick={onNext} className="flex-[2] bg-violet-600 hover:bg-violet-700 gap-2 h-11">
            <RotateCcw size={13}/> Restart from Clip A
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CheatingOrSkill() {
  const navigate = useNavigate();

  const [clipIdx,     setClipIdx]     = useState(0);
  const [stage,       setStage]       = useState<Stage>(1);
  const [annotation,  setAnnotation]  = useState<Annotation | null>(null);
  const [qaAction,    setQaAction]    = useState<QAAction | null>(null);

  const clip = CLIPS[clipIdx];

  const reset = (newIdx?: number) => {
    const idx = newIdx !== undefined ? newIdx : 0;
    setClipIdx(idx);
    setStage(1);
    setAnnotation(null);
    setQaAction(null);
  };

  const handleNext = () => {
    const next = (clipIdx + 1) % CLIPS.length;
    reset(next);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--s0)" }}>
      {/* ── Header ── */}
      <header className="dark-surface sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-border/20">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-white/10 rounded-full transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4 text-white"/>
            </button>
            <span onClick={() => navigate("/use-cases")}
              className="text-sm font-bold tracking-wide text-white cursor-pointer hover:text-white/80 transition-colors font-headline shrink-0">
              TP.ai <span style={{ color: "#9071f0" }}>Data</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-white/40 shrink-0"/>
            <span className="text-sm text-white/70 whitespace-nowrap font-body">Gaming Trust &amp; Safety</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Gamepad2 size={14} className="text-violet-400"/>
            <span className="text-xs bg-violet-600/20 text-violet-300 border border-violet-600/30 px-3 py-1 rounded-full font-semibold">
              Anti‑Cheat · Live Demo
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient"/>
      </header>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Hero */}
        <div className="text-center mb-3">
          <h1 className="text-2xl font-black text-white font-headline">
            Is This Cheating or Skill? <span className="text-violet-400">Anti‑Cheat Review</span>
          </h1>
          <p className="text-sm text-foreground/45 mt-1 max-w-xl mx-auto font-body">
            Review gameplay clips, label anomalies, watch AI flag detection signals, then QA-override and deliver the final enforcement decision.
          </p>
        </div>

        {/* Clip selector — Stage 1 only */}
        {stage === 1 && (
          <div className="grid grid-cols-3 gap-2 mb-3 max-w-2xl mx-auto">
            {CLIPS.map((c, i) => {
              const gtColor = c.groundTruth === "skill" ? "text-emerald-400" : c.groundTruth === "cheat" ? "text-red-400" : "text-amber-400";
              const gtDot   = c.groundTruth === "skill" ? "bg-emerald-500"   : c.groundTruth === "cheat" ? "bg-red-500"   : "bg-amber-500";
              const gtLabel = c.groundTruth === "skill" ? "Skill"            : c.groundTruth === "cheat" ? "Cheat"        : "Tricky";
              const active  = clipIdx === i;
              return (
                <button key={c.id} onClick={() => reset(i)}
                  className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                    active
                      ? "border-violet-500 bg-violet-600 text-white"
                      : "border-white/10 text-foreground/65 hover:border-violet-500/40 hover:bg-violet-900/20"
                  }`}
                  style={!active ? { background: "var(--s4)" } : {}}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? "bg-violet-200" : gtDot}`}/>
                    <span className="text-xs font-bold truncate">{c.title.split("—")[0].trim()}</span>
                  </div>
                  <div className={`text-[10px] truncate font-body ${active ? "text-violet-200" : gtColor}`}>
                    {gtLabel} · {c.subtitle.split("·")[0].trim()}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Progress stepper */}
        <ProgressStepper stage={stage}/>

        {/* Stage content */}
        <div className="mt-2">
          {stage === 1 && (
            <Stage1 clip={clip} clipIdx={clipIdx} onSubmit={a => { setAnnotation(a); setStage(2); }}/>
          )}
          {stage === 2 && annotation && (
            <Stage2 clip={clip} annotation={annotation} onComplete={() => setStage(3)} onBack={() => setStage(1)}/>
          )}
          {stage === 3 && annotation && (
            <Stage3 clip={clip} annotation={annotation} onSubmit={a => { setQaAction(a); setStage(4); }}/>
          )}
          {stage === 4 && annotation && qaAction && (
            <Stage4 clip={clip} annotation={annotation} qaAction={qaAction} clipIdx={clipIdx} onNext={handleNext}/>
          )}
        </div>
      </div>
    </div>
  );
}
