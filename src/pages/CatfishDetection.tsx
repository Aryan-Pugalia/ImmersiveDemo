/**
 * CatfishDetection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * "Real or Fake?" – Dating Trust & Safety Demo
 *
 * Interactive 4-stage pipeline demo:
 *   Stage 1 › Human Annotation   – attendee labels a profile
 *   Stage 2 › AI Review          – animated AI scoring simulation
 *   Stage 3 › Human QA Review    – override / validate / escalate
 *   Stage 4 › Final Delivery     – outcome + impact metrics
 *
 * All data is pre-scripted mock data. No real ML, no external APIs,
 * no user data stored. Pure client-side React/TypeScript.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Brain, Shield, AlertTriangle,
  CheckCircle2, XCircle, Zap, TrendingUp, Users, RotateCcw,
  Check, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage      = 1 | 2 | 3 | 4;
type Verdict    = "real" | "fake" | "unsure";
type Confidence = "low" | "medium" | "high";
type QAAction   = "validate" | "override" | "escalate";
type FinalStatus = "approved" | "rejected" | "escalated";
type GroundTruth = "REAL" | "FAKE" | "BORDERLINE";

interface Annotation {
  verdict:    Verdict | null;
  signals:    string[];
  confidence: Confidence | null;
}

interface FinalDecision {
  status:  FinalStatus;
  correct: boolean;
  heading: string;
  body:    string;
}

interface Profile {
  id:          string;
  name:        string;
  age:         number;
  location:    string;
  occupation:  string;
  bio:         string;
  prompts:     { q: string; a: string }[];
  tags:        { label: string; warn?: boolean }[];
  photo:       string;
  aiResult: {
    imageScore:    number;
    textScore:     number;
    behaviorScore: number;
    overallRisk:   number;
    verdictLabel:  string;
    reasons:       string[];
  };
  groundTruth: GroundTruth;
  insight:     string;
  finalDecision: Record<QAAction, FinalDecision>;
}

// ─── Risk signal options ──────────────────────────────────────────────────────

const RISK_SIGNALS = [
  { id: "stolen_image",     label: "Stolen / AI-generated image" },
  { id: "inconsistent_bio", label: "Inconsistent bio details" },
  { id: "too_good",         label: "Too-good-to-be-true language" },
  { id: "external_contact", label: "External contact request" },
  { id: "none",             label: "No risk signals detected" },
];

// ─── Profile Data ─────────────────────────────────────────────────────────────

const PROFILES: Profile[] = [
  // ── Profile 1: Sarah Chen (REAL — AI produces a false positive) ──────────
  {
    id: "sarah",
    name: "Sarah Chen",
    age: 28,
    location: "Austin, TX",
    occupation: "UX Designer",
    photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=720&fit=crop&crop=faces",
    bio: "Coffee addict ☕ hiking enthusiast. Looking for someone to explore farmers markets and local trails with. I'm a bit nerdy about fonts and design but I promise I'm fun at parties. Dog mom to a golden named Pretzel 🐾",
    prompts: [
      { q: "My ideal Sunday",  a: "Farmers market in the morning, a long hike, then cooking something new for dinner — wine included 🍷" },
      { q: "I'm looking for",  a: "Someone who doesn't take themselves too seriously but has real depth. Big bonus if you have a dog." },
    ],
    tags: [
      { label: "Verified Email" },
      { label: "Austin Local" },
      { label: "14 mutual friends" },
    ],
    aiResult: {
      imageScore:    72,
      textScore:     88,
      behaviorScore: 65,
      overallRisk:   68,
      verdictLabel:  "High Risk — Potentially Inauthentic",
      reasons: [
        "Image texture matches stock photography database patterns (72% similarity score)",
        "Account created 4 days ago with unusually high engagement velocity",
        "Location metadata inconsistency between photo EXIF data and stated city",
      ],
    },
    groundTruth: "REAL",
    insight: "This is a classic AI false positive. The model over-flags a genuine profile based on photo quality patterns. Human QA is the safety net that prevents wrongful removal — protecting innocent users and maintaining platform trust.",
    finalDecision: {
      validate: { status:"escalated", correct:false,  heading:"Account Suspended Pending Review", body:"The AI verdict was accepted — but this was a real user. Without human override, an innocent person loses access to the platform. This is precisely the false-positive risk that makes human QA essential." },
      override: { status:"approved",  correct:true,   heading:"Profile Approved",                 body:"QA correctly identified a genuine user and overrode the AI false positive. The real user stays on the platform — no harm done, trust maintained." },
      escalate: { status:"escalated", correct:true,   heading:"Flagged for Senior Review",        body:"Profile temporarily restricted while a senior reviewer gathers additional verification. A cautious, defensible path for borderline AI decisions." },
    },
  },

  // ── Profile 2: Marcus King (FAKE — romance scam, high confidence) ────────
  {
    id: "marcus",
    name: "Marcus King",
    age: 34,
    location: "Lagos, Nigeria · 'offshore'",
    occupation: "Petroleum Engineer (offshore)",
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=720&fit=crop&crop=faces",
    bio: "Successful engineer currently working offshore but dreaming of settling down with the right woman. God-fearing, honest, faithful. Looking for my forever person 💍  WhatsApp: +1-234-555-0198",
    prompts: [
      { q: "My love language",   a: "Gift-giving and quality time. I love spoiling the people I care about. I'll show you how a real man loves his queen." },
      { q: "I can't live without", a: "My late mother's ring, my faith, and a real connection. Come find me off this app — I'm barely on here." },
    ],
    tags: [
      { label: "No Mutual Friends", warn: true },
      { label: "Joined Today",      warn: true },
      { label: "Location Mismatch", warn: true },
    ],
    aiResult: {
      imageScore:    97,
      textScore:     96,
      behaviorScore: 99,
      overallRisk:   97,
      verdictLabel:  "Confirmed Fake — Romance Scam",
      reasons: [
        "Reverse image match: photo sourced from stock model portfolio (GQ México, 2021)",
        "Bio language shows 94% similarity to documented romance scam script templates",
        "External phone number embedded in profile — active financial fraud signal",
      ],
    },
    groundTruth: "FAKE",
    insight: "A textbook romance scam. Both human annotation and AI agree with high confidence. This 'easy' case validates the pipeline — demonstrating that high-confidence fraud is caught fast, protecting users from financial harm.",
    finalDecision: {
      validate: { status:"rejected",  correct:true,  heading:"Profile Permanently Removed",    body:"Romance scam confirmed. The fraudulent account is removed before any user is financially harmed. TP annotation pipeline caught this in under 4 minutes." },
      override: { status:"escalated", correct:false, heading:"Override Flagged — Supervisor Required", body:"Overriding a 97/100 confirmed fraud profile puts real users at serious financial risk. A QA supervisor review is automatically triggered before this override takes effect." },
      escalate: { status:"escalated", correct:true,  heading:"Escalated to Fraud Investigation Team", body:"Profile flagged for cross-platform fraud investigation and potential law enforcement referral. Strong action for a high-confidence scam." },
    },
  },

  // ── Profile 3: Priya Sharma (BORDERLINE — ambiguous, most educational) ──
  {
    id: "priya",
    name: "Priya Sharma",
    age: 31,
    location: "London, UK",
    occupation: "Marketing Consultant",
    photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=720&fit=crop&crop=faces",
    bio: "Londoner by choice, Mumbai by heart 🌍 I love cooking for friends, impromptu weekend trips, and finding hole-in-the-wall restaurants before they get Instagrammed. Probably too competitive at board games.",
    prompts: [
      { q: "Typical Tuesday",    a: "Client calls, strong tea, and a long walk along the Southbank if the weather is kind." },
      { q: "What I'm looking for", a: "An equal. Someone who challenges me. No games — unless they're actual board games." },
    ],
    tags: [
      { label: "Verified Phone" },
      { label: "London Network" },
      { label: "Joined 3 Weeks Ago" },
    ],
    aiResult: {
      imageScore:    61,
      textScore:     48,
      behaviorScore: 74,
      overallRisk:   61,
      verdictLabel:  "Suspicious — Inconclusive",
      reasons: [
        "Low-confidence GAN artifact indicators detected (42% — below action threshold)",
        "Account shows engagement spikes at 3AM local time (may indicate scripted activity)",
        "Phone number verified but registered to a VoIP provider",
      ],
    },
    groundTruth: "BORDERLINE",
    insight: "The hardest case — AI is uncertain, human annotators often disagree. There's no clean answer. This scenario demonstrates why nuanced Human QA with escalation paths is critical: rigid AI thresholds would either wrongfully remove a real user or miss a sophisticated fake.",
    finalDecision: {
      validate: { status:"approved",  correct:true,  heading:"Profile Approved With Monitoring",      body:"Low-confidence AI flag accepted and approved. Account approved but passively monitored for 30 days. A measured, proportionate response for an inconclusive case." },
      override: { status:"rejected",  correct:true,  heading:"Profile Suspended — Identity Verification Required", body:"Suspicious signals deemed sufficient for temporary suspension. User notified to re-verify identity via government ID. Account reinstated upon successful verification." },
      escalate: { status:"escalated", correct:true,  heading:"Needs Follow-up — Verification Requested",  body:"Inconclusive case routed for additional evidence. Account restricted until documentation is provided. All three QA actions are defensible for this profile." },
    },
  },
];

// ─── Progress Stepper ─────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Annotate" },
  { n: 2, label: "AI Review" },
  { n: 3, label: "Human QA" },
  { n: 4, label: "Delivered" },
] as const;

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
                current ? "bg-[hsl(0,0%,10%)] border-violet-500 text-violet-400 ring-4 ring-violet-900/40" :
                          "bg-[hsl(0,0%,8%)] border-white/10 text-white/30"
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

// ─── Profile Card ─────────────────────────────────────────────────────────────

function ProfileCard({ profile, compact = false }: { profile: Profile; compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "hsl(0,0%,8%)" }}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
            <img src={profile.photo} alt={profile.name} className="w-full h-full object-cover object-center" />
          </div>
          <div>
            <div className="font-bold text-foreground text-sm">{profile.name}, {profile.age}</div>
            <div className="text-xs text-foreground/50">{profile.location}</div>
            <div className="text-xs text-foreground/40">{profile.occupation}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden flex-1" style={{ background: "hsl(0,0%,8%)" }}>
      {/* Photo — full bleed, face-forward */}
      <div className="relative w-full overflow-hidden" style={{ height: 320 }}>
        <img
          src={profile.photo}
          alt={profile.name}
          className="w-full h-full object-cover object-center"
        />
        {/* gradient scrim so tags are readable */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
        {/* Tags */}
        <div className="absolute bottom-3 left-3 flex gap-1.5 flex-wrap">
          {profile.tags.map(tag => (
            <span key={tag.label} className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
              tag.warn
                ? "bg-red-950/70 text-red-300 border-red-600/50"
                : "bg-black/60 text-white/90 border-white/25"
            }`}>
              {tag.label}
            </span>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="p-5">
        <div className="flex items-baseline gap-2 mb-0.5">
          <h2 className="text-xl font-bold text-foreground">{profile.name}</h2>
          <span className="text-foreground/40 text-lg">{profile.age}</span>
        </div>
        <p className="text-xs text-foreground/50 mb-3">📍 {profile.location} · {profile.occupation}</p>
        <p className="text-sm text-foreground/80 leading-relaxed mb-4">{profile.bio}</p>

        <div className="space-y-3">
          {profile.prompts.map((p, i) => (
            <div key={i} className="rounded-xl p-3 border border-white/8" style={{ background: "hsl(0,0%,6%)" }}>
              <div className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-1">{p.q}</div>
              <div className="text-sm text-foreground/75">{p.a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Stage 1 · Human Annotation ───────────────────────────────────────────────

function Stage1({ profile, onSubmit }: { profile: Profile; onSubmit: (a: Annotation) => void }) {
  const [verdict,    setVerdict]    = useState<Verdict | null>(null);
  const [signals,    setSignals]    = useState<string[]>([]);
  const [confidence, setConfidence] = useState<Confidence | null>(null);

  const toggleSignal = (id: string) => {
    if (id === "none") { setSignals(["none"]); return; }
    setSignals(prev => {
      const without = prev.filter(s => s !== "none");
      return without.includes(id) ? without.filter(s => s !== id) : [...without, id];
    });
  };

  const confLevel  = confidence === "high" ? 3 : confidence === "medium" ? 2 : confidence === "low" ? 1 : 0;
  const canSubmit  = verdict !== null && signals.length > 0 && confidence !== null;

  return (
    <div className="flex gap-5 items-start">
      <ProfileCard profile={profile} />

      <div className="w-[380px] flex-shrink-0 space-y-4">
        {/* Role badge */}
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-violet-600/30" style={{ background: "rgba(109,40,217,0.12)" }}>
          <span className="text-2xl">✏️</span>
          <div>
            <div className="text-sm font-bold text-violet-300">You are the Human Annotator</div>
            <div className="text-xs text-violet-400/80">Review this profile and submit your assessment</div>
          </div>
        </div>

        {/* Q1 · Verdict */}
        <div className="rounded-2xl border border-white/10 p-4" style={{ background: "hsl(0,0%,8%)" }}>
          <p className="text-sm font-semibold text-foreground mb-3">1 · Is this profile real, fake, or unsure?</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: "real"   as Verdict, label: "Real",  activeClass: "bg-emerald-500 border-emerald-500 text-white", idleClass: "bg-emerald-950/40 border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/50" },
              { val: "fake"   as Verdict, label: "Fake",  activeClass: "bg-red-500 border-red-500 text-white",         idleClass: "bg-red-950/40 border-red-700/50 text-red-400 hover:bg-red-900/50" },
              { val: "unsure" as Verdict, label: "Unsure",activeClass: "bg-amber-500 border-amber-500 text-white",     idleClass: "bg-amber-950/40 border-amber-700/50 text-amber-400 hover:bg-amber-900/50" },
            ].map(opt => (
              <button key={opt.val} onClick={() => setVerdict(opt.val)}
                className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${verdict === opt.val ? opt.activeClass : opt.idleClass}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Q2 · Risk signals */}
        <div className="rounded-2xl border border-white/10 p-4" style={{ background: "hsl(0,0%,8%)" }}>
          <p className="text-sm font-semibold text-foreground mb-3">2 · Flag any risk signals (select all that apply)</p>
          <div className="space-y-2">
            {RISK_SIGNALS.map(sig => (
              <button key={sig.id} onClick={() => toggleSignal(sig.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${
                  signals.includes(sig.id)
                    ? "border-violet-500/60 text-violet-300 font-medium"
                    : "border-white/10 text-foreground/70 hover:bg-white/5"
                }`}
                style={signals.includes(sig.id) ? { background: "rgba(109,40,217,0.18)" } : {}}>
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  signals.includes(sig.id) ? "bg-violet-600 border-violet-600" : "border-white/20"
                }`}>
                  {signals.includes(sig.id) && <Check size={10} className="text-white" />}
                </div>
                {sig.label}
              </button>
            ))}
          </div>
        </div>

        {/* Q3 · Confidence */}
        <div className="rounded-2xl border border-white/10 p-4" style={{ background: "hsl(0,0%,8%)" }}>
          <p className="text-sm font-semibold text-foreground mb-3">3 · Your confidence level</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(["low","medium","high"] as Confidence[]).map(c => (
              <button key={c} onClick={() => setConfidence(c)}
                className={`py-2 rounded-xl border-2 text-sm font-bold capitalize transition-all ${
                  confidence === c ? "bg-violet-600 border-violet-600 text-white" : "border-white/10 text-foreground/60 hover:bg-white/5"
                }`}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground/50">Human confidence:</span>
            <div className="flex gap-1">
              {[1,2,3].map(i => (
                <div key={i} className={`h-2 w-8 rounded-full transition-all duration-300 ${i <= confLevel ? "bg-violet-500" : "bg-white/10"}`} />
              ))}
            </div>
            {confidence && <span className="text-xs font-semibold text-violet-400 capitalize ml-1">{confidence}</span>}
          </div>
        </div>

        <Button disabled={!canSubmit} onClick={() => onSubmit({ verdict, signals, confidence })}
          className="w-full h-12 text-base font-semibold bg-violet-600 hover:bg-violet-700">
          Submit Annotation →
        </Button>
        {!canSubmit && <p className="text-xs text-foreground/40 text-center">Complete all three fields to continue</p>}
      </div>
    </div>
  );
}

// ─── Stage 2 · AI Review ──────────────────────────────────────────────────────

function Stage2({ profile, annotation, onComplete }: {
  profile:    Profile;
  annotation: Annotation;
  onComplete: () => void;
}) {
  const [scores, setScores] = useState({ image: 0, text: 0, behavior: 0, overall: 0 });
  const [phase,  setPhase]  = useState(0);

  // Staggered animation: each bar fills on a delay
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => { setScores(s => ({ ...s, image:    profile.aiResult.imageScore    })); setPhase(2); }, 900),
      setTimeout(() => { setScores(s => ({ ...s, text:     profile.aiResult.textScore     })); setPhase(3); }, 2200),
      setTimeout(() => { setScores(s => ({ ...s, behavior: profile.aiResult.behaviorScore })); setPhase(4); }, 3500),
      setTimeout(() => { setScores(s => ({ ...s, overall:  profile.aiResult.overallRisk   }));              }, 4800),
    ];
    return () => t.forEach(clearTimeout);
  }, [profile]);

  const riskHue = (n: number) => n >= 90 ? "#ef4444" : n >= 70 ? "#f97316" : n >= 50 ? "#f59e0b" : "#10b981";
  const riskBg  = (n: number) => n >= 90 ? "rgba(220,38,38,0.18)" : n >= 70 ? "rgba(234,88,12,0.18)" : n >= 50 ? "rgba(217,119,6,0.18)" : "rgba(5,150,105,0.18)";

  const humanLbl = annotation.verdict === "real" ? "✓ Real" : annotation.verdict === "fake" ? "✗ Fake" : "? Unsure";
  const humanCls = annotation.verdict === "real"
    ? "bg-emerald-950/40 border-emerald-700/50 text-emerald-400"
    : annotation.verdict === "fake"
    ? "bg-red-950/40 border-red-700/50 text-red-400"
    : "bg-amber-950/40 border-amber-700/50 text-amber-400";

  const ScoreBar = ({ label, score, active }: { label: string; score: number; active: boolean }) => (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-foreground/80">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: active ? riskHue(score) : "rgba(255,255,255,0.25)" }}>
          {active ? `${score}/100` : "—"}
        </span>
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: active ? `${score}%` : "0%", background: riskHue(score) }} />
      </div>
    </div>
  );

  return (
    <div className="flex gap-5 items-start">
      <ProfileCard profile={profile} />

      <div className="w-[380px] flex-shrink-0 space-y-4">
        {/* Role badge */}
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-blue-600/30" style={{ background: "rgba(37,99,235,0.12)" }}>
          <Brain size={22} className="text-blue-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-bold text-blue-300">AI Detection Model Review</div>
            <div className="text-xs text-blue-400/80">AI-assisted · not a final decision</div>
          </div>
          {phase >= 4 && scores.overall > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold border border-blue-600/40 text-blue-300" style={{ background: "rgba(37,99,235,0.25)" }}>Complete</span>
          )}
        </div>

        {/* Animated score bars */}
        <div className="rounded-2xl border border-white/10 p-5 space-y-4" style={{ background: "hsl(0,0%,8%)" }}>
          <ScoreBar label="Image Authenticity"  score={scores.image}    active={phase >= 2} />
          <ScoreBar label="Text Consistency"    score={scores.text}     active={phase >= 3} />
          <ScoreBar label="Behavioral Risk"     score={scores.behavior} active={phase >= 4} />

          {phase >= 4 && scores.overall > 0 && (
            <div className="border-t border-white/8 pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/35 mb-3">Overall AI Risk Score</p>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: riskBg(scores.overall) }}>
                  <span className="text-2xl font-black" style={{ color: riskHue(scores.overall) }}>
                    {scores.overall}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: riskHue(scores.overall) }}>
                    {profile.aiResult.verdictLabel}
                  </div>
                  <div className="text-xs text-foreground/40 mt-0.5">AI confidence: High</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI reasoning */}
        {phase >= 4 && scores.overall > 0 && (
          <div className="rounded-2xl border border-white/10 p-4" style={{ background: "hsl(0,0%,8%)" }}>
            <p className="text-sm font-semibold text-foreground mb-3">Why the AI flagged this profile:</p>
            <div className="space-y-2.5">
              {profile.aiResult.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-foreground/65 leading-relaxed">{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Human vs AI comparison chip */}
        {phase >= 4 && scores.overall > 0 && (
          <div className="rounded-xl border border-white/10 p-3" style={{ background: "hsl(0,0%,6%)" }}>
            <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-2">Your annotation vs AI</p>
            <div className="flex gap-2">
              <div className={`flex-1 text-center py-2 rounded-xl border text-sm font-bold ${humanCls}`}>
                You: {humanLbl}
              </div>
              <div className="flex-1 text-center py-2 rounded-xl border text-sm font-bold"
                style={{ background: riskBg(scores.overall), borderColor: riskHue(scores.overall) + "55", color: riskHue(scores.overall) }}>
                AI: {scores.overall}/100
              </div>
            </div>
          </div>
        )}

        {phase >= 4 && scores.overall > 0 && (
          <Button onClick={onComplete} className="w-full h-12 text-base font-semibold bg-violet-600 hover:bg-violet-700">
            Proceed to Human QA Review →
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Stage 3 · Human QA Review ────────────────────────────────────────────────

function Stage3({ profile, annotation, onSubmit }: {
  profile:    Profile;
  annotation: Annotation;
  onSubmit:   (a: QAAction) => void;
}) {
  const [selected,         setSelected]         = useState<QAAction | null>(null);
  const [overrideExpanded, setOverrideExpanded] = useState(false);

  const ai = profile.aiResult;
  const humanLbl   = annotation.verdict === "real" ? "✓ Real" : annotation.verdict === "fake" ? "✗ Fake" : "? Unsure";
  const humanColor = annotation.verdict === "real" ? "#10b981" : annotation.verdict === "fake" ? "#ef4444" : "#f59e0b";

  const riskHue = (n: number) => n >= 90 ? "#ef4444" : n >= 70 ? "#f97316" : n >= 50 ? "#f59e0b" : "#10b981";

  const conflict =
    (annotation.verdict === "real"  && ai.overallRisk >= 70) ||
    (annotation.verdict === "fake"  && ai.overallRisk < 50)  ||
    annotation.verdict === "unsure";

  return (
    <div className="space-y-4">
      {/* Role badge */}
      <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-indigo-600/30" style={{ background: "rgba(79,70,229,0.12)" }}>
        <Shield size={22} className="text-indigo-400 flex-shrink-0" />
        <div>
          <div className="text-sm font-bold text-indigo-300">Human QA Review — Teleperformance</div>
          <div className="text-xs text-indigo-400/80">You are a senior QA reviewer. Review both decisions and make the final call.</div>
        </div>
      </div>

      {/* Conflict banner */}
      {conflict && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3 border border-amber-600/40" style={{ background: "rgba(217,119,6,0.12)" }}>
          <AlertTriangle size={17} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-amber-300">Human–AI Conflict Detected</div>
            <div className="text-xs text-amber-400/80 mt-0.5">Your annotation and the AI model disagree. Human QA must make the final determination.</div>
          </div>
        </div>
      )}

      {/* Three-column comparison */}
      <div className="grid grid-cols-3 gap-4">
        {/* Human annotation summary */}
        <div className="rounded-2xl border-2 border-white/10 p-4" style={{ background: "hsl(0,0%,8%)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-3">👤 Human Annotation</p>
          <div className="text-lg font-black mb-2" style={{ color: humanColor }}>{humanLbl}</div>
          <div className="text-xs text-foreground/50 space-y-1">
            <div><span className="font-semibold">Confidence:</span> {annotation.confidence}</div>
            <div className="font-semibold mt-2 mb-1">Signals flagged:</div>
            {annotation.signals.map(s => {
              const sig = RISK_SIGNALS.find(r => r.id === s);
              return sig ? <div key={s} className="text-foreground/60">· {sig.label}</div> : null;
            })}
          </div>
        </div>

        {/* Centre — compact profile + insight */}
        <div className="space-y-3">
          <ProfileCard profile={profile} compact />
          <div className="rounded-xl p-3 border border-violet-600/25" style={{ background: "rgba(109,40,217,0.12)" }}>
            <p className="text-xs font-bold text-violet-400 mb-1">💡 TP Insight</p>
            <p className="text-xs text-violet-300/80 leading-relaxed">{profile.insight}</p>
          </div>
        </div>

        {/* AI decision summary */}
        <div className="rounded-2xl border-2 border-white/10 p-4" style={{ background: "hsl(0,0%,8%)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-3">🤖 AI Model Decision</p>
          <div className="text-lg font-black mb-1" style={{ color: riskHue(ai.overallRisk) }}>
            {ai.overallRisk}/100 Risk
          </div>
          <div className="text-xs font-bold mb-2" style={{ color: riskHue(ai.overallRisk) }}>{ai.verdictLabel}</div>
          <div className="text-xs text-foreground/50 space-y-1">
            {ai.reasons.map((r, i) => <div key={i}>· {r.split("(")[0].trim()}</div>)}
          </div>
        </div>
      </div>

      {/* QA actions */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: "hsl(0,0%,8%)" }}>
        <p className="text-sm font-bold text-foreground mb-4">QA Decision — Select your action:</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { action:"validate" as QAAction, icon:"✓", label:"Validate AI",           sub:"Accept AI decision",       idle:"border-emerald-700/50 text-emerald-400",  idleBg:"rgba(5,150,105,0.12)",  active:"border-emerald-500 bg-emerald-500 text-white" },
            { action:"override" as QAAction, icon:"↩", label:"Override AI",           sub:"Human judgment prevails",  idle:"border-violet-600/40 text-violet-400",    idleBg:"rgba(109,40,217,0.12)", active:"border-violet-600 bg-violet-600 text-white" },
            { action:"escalate" as QAAction, icon:"🔍",label:"Request More Evidence", sub:"Escalate for senior review",idle:"border-amber-700/50 text-amber-400",     idleBg:"rgba(217,119,6,0.12)", active:"border-amber-500 bg-amber-500 text-white" },
          ].map(opt => (
            <button key={opt.action}
              onClick={() => { setSelected(opt.action); if (opt.action === "override") setOverrideExpanded(true); else setOverrideExpanded(false); }}
              className={`p-3 rounded-xl border-2 text-left transition-all ${selected === opt.action ? opt.active : `${opt.idle}`}`}
              style={selected !== opt.action ? { background: opt.idleBg } : {}}>
              <div className="text-xl mb-1">{opt.icon}</div>
              <div className="text-sm font-bold">{opt.label}</div>
              <div className={`text-xs mt-0.5 ${selected === opt.action ? "opacity-80" : "opacity-70"}`}>{opt.sub}</div>
            </button>
          ))}
        </div>

        {/* Override rationale panel */}
        {overrideExpanded && selected === "override" && (
          <div className="rounded-xl p-4 mb-4 border border-violet-600/25" style={{ background: "rgba(109,40,217,0.15)" }}>
            <p className="text-sm font-bold text-violet-200 mb-2">⚠️ Why Human Override Matters</p>
            <div className="text-xs text-violet-300/80 space-y-1.5 leading-relaxed">
              <p>· AI models generate <strong>false positives</strong> — flagging real users incorrectly. Human review prevents wrongful removal.</p>
              <p>· AI models generate <strong>false negatives</strong> — missing sophisticated fraud that mimics authentic behaviour. Human intuition catches edge cases.</p>
              <p>· Human QA is the <strong>accountability layer</strong> that makes AI-assisted moderation defensible to regulators, platforms, and users.</p>
            </div>
            <p className="mt-3 text-xs font-bold text-violet-400">
              TP operates human-in-the-loop QA at scale across 100+ Trust &amp; Safety programs globally.
            </p>
          </div>
        )}

        <Button disabled={!selected} onClick={() => selected && onSubmit(selected)}
          className="w-full h-12 text-base font-semibold bg-violet-600 hover:bg-violet-700">
          Submit QA Decision →
        </Button>
      </div>
    </div>
  );
}

// ─── Stage 4 · Final Decision & Delivery ─────────────────────────────────────

function Stage4({ profile, qaAction, onReset }: {
  profile:   Profile;
  qaAction:  QAAction;
  onReset:   () => void;
}) {
  const decision = profile.finalDecision[qaAction];

  const statusCfg = {
    approved:  { icon: "✅", label: "Profile Approved",  ring: "border-emerald-700/50",  heading: "text-emerald-400", bg: "rgba(5,150,105,0.10)" },
    rejected:  { icon: "🚫", label: "Profile Removed",   ring: "border-red-700/50",       heading: "text-red-400",     bg: "rgba(220,38,38,0.10)" },
    escalated: { icon: "⚠️", label: "Needs Follow-up",   ring: "border-amber-700/50",     heading: "text-amber-400",   bg: "rgba(217,119,6,0.10)" },
  }[decision.status];

  const correctBanner = decision.correct
    ? { bg: "rgba(5,150,105,0.12)",  border: "border-emerald-700/40", icon: <CheckCircle2 size={16} className="text-emerald-500" />, text: "text-emerald-300", msg: "Correct decision — this matches the ground truth outcome." }
    : { bg: "rgba(220,38,38,0.12)", border: "border-red-700/40",      icon: <XCircle      size={16} className="text-red-500"     />, text: "text-red-300",     msg: "Suboptimal decision — see the insight above for the preferred outcome." };

  const metrics = [
    { Icon: Shield,     label: "Users Protected",         value: decision.status === "rejected" ? "2,840" : "1",     sub: decision.status === "rejected" ? "potential victims in region" : "real user outcome resolved", color: "text-violet-400", iconBg: "rgba(109,40,217,0.20)" },
    { Icon: TrendingUp, label: "Platform Trust Score",    value: "+0.3%",  sub: "projected improvement from this decision",          color: "text-emerald-400", iconBg: "rgba(5,150,105,0.20)" },
    { Icon: Zap,        label: "Decision Latency",        value: "<4 min", sub: "annotation → AI → QA → delivery",                  color: "text-blue-400",    iconBg: "rgba(37,99,235,0.20)" },
    { Icon: Users,      label: "TP Specialists Involved", value: "3",      sub: "annotator + AI reviewer + QA approver",             color: "text-indigo-400",  iconBg: "rgba(79,70,229,0.20)" },
  ];

  return (
    <div className="flex flex-col gap-5 items-center max-w-2xl mx-auto w-full">
      {/* Delivery label */}
      <div className="inline-flex items-center gap-2 text-white text-xs font-bold px-4 py-1.5 rounded-full" style={{ background: "hsl(0,0%,14%)" }}>
        <span>📬</span> Step 4: Final Decision Delivered to Client Platform
      </div>

      {/* Status card */}
      <div className={`w-full rounded-2xl border-2 p-6 text-center ${statusCfg.ring}`} style={{ background: statusCfg.bg }}>
        <div className="text-5xl mb-3">{statusCfg.icon}</div>
        <div className={`text-2xl font-black mb-2 ${statusCfg.heading}`}>{decision.heading}</div>
        <p className="text-sm text-foreground/65 leading-relaxed max-w-sm mx-auto">{decision.body}</p>
      </div>

      {/* Correct/incorrect banner */}
      <div className={`w-full rounded-xl border px-4 py-3 flex items-center gap-3 ${correctBanner.border}`} style={{ background: correctBanner.bg }}>
        {correctBanner.icon}
        <p className={`text-xs font-semibold ${correctBanner.text}`}>{correctBanner.msg}</p>
      </div>

      {/* TP Insight */}
      <div className="w-full rounded-xl p-4 border border-violet-600/25" style={{ background: "rgba(109,40,217,0.12)" }}>
        <p className="text-sm font-bold text-violet-300 mb-1">💡 Why This Case Matters</p>
        <p className="text-xs text-violet-300/75 leading-relaxed">{profile.insight}</p>
      </div>

      {/* Impact metrics */}
      <div className="w-full">
        <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-3 text-center">Simulated Impact Metrics</p>
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m, i) => (
            <div key={i} className="rounded-xl border border-white/10 p-4" style={{ background: "hsl(0,0%,8%)" }}>
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2" style={{ background: m.iconBg }}>
                <m.Icon size={18} className={m.color} />
              </div>
              <div className={`text-xl font-black ${m.color}`}>{m.value}</div>
              <div className="text-xs font-semibold text-foreground/75">{m.label}</div>
              <div className="text-xs text-foreground/40 mt-0.5">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TP scale proof points */}
      <div className="w-full rounded-2xl p-5" style={{ background: "hsl(0,0%,10%)" }}>
        <p className="text-sm font-bold text-foreground mb-4">How TP Operationalises This at Scale</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { val: "500K+", sub: "Daily T&S decisions" },
            { val: "99.1%", sub: "QA override accuracy" },
            { val: "40+",   sub: "Languages supported" },
          ].map(kpi => (
            <div key={kpi.val}>
              <div className="text-2xl font-black text-violet-400">{kpi.val}</div>
              <div className="text-xs text-foreground/40 mt-0.5">{kpi.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div className="flex gap-3 w-full">
        <Button variant="outline" onClick={onReset} className="flex-1 gap-2 h-12 border-white/15 text-foreground/80 hover:bg-white/5">
          <RotateCcw size={14} /> Try Another Profile
        </Button>
        <Button onClick={() => window.history.back()} className="flex-1 bg-violet-600 hover:bg-violet-700 gap-2 h-12">
          <ArrowLeft size={14} /> Return to Demo Hub
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CatfishDetection() {
  const navigate = useNavigate();

  const [profileIdx, setProfileIdx] = useState(0);
  const [stage,      setStage]      = useState<Stage>(1);
  const [annotation, setAnnotation] = useState<Annotation | null>(null);
  const [qaAction,   setQaAction]   = useState<QAAction | null>(null);

  const profile = PROFILES[profileIdx];

  const reset = (newIdx?: number) => {
    if (newIdx !== undefined) setProfileIdx(newIdx);
    setStage(1);
    setAnnotation(null);
    setQaAction(null);
  };

  return (
    <div className="min-h-screen" style={{ background: "hsl(0,0%,4%)" }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-white/10">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-white/10 rounded-full transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
            <span onClick={() => navigate("/use-cases")}
              className="text-sm font-bold tracking-wide text-white cursor-pointer hover:text-white/80 transition-colors font-headline shrink-0">
              TP.ai <span style={{ color: "#9071f0" }}>FAB</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-white/40 shrink-0" />
            <span className="text-sm text-white/70 whitespace-nowrap">Dating Trust &amp; Safety</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ShieldAlert size={14} className="text-violet-400" />
            <span className="text-xs bg-violet-600/20 text-violet-300 border border-violet-600/30 px-3 py-1 rounded-full font-semibold">
              Trust &amp; Safety · Live Demo
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
      </header>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Hero title */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-black text-white">
            Real or Fake? <span className="text-violet-400">Catfish Detection</span>
          </h1>
          <p className="text-sm text-foreground/50 mt-1 max-w-xl mx-auto">
            Experience how Teleperformance annotators, AI models, and QA reviewers work together
            to protect dating platform users from fraud and impersonation.
          </p>
        </div>

        {/* Profile selector — only shown on Stage 1 */}
        {stage === 1 && (
          <div className="flex justify-center gap-2 mb-2 flex-wrap">
            {PROFILES.map((p, i) => (
              <button key={p.id} onClick={() => reset(i)}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                  profileIdx === i
                    ? "border-violet-500 bg-violet-600 text-white shadow-sm"
                    : "border-white/10 text-foreground/70 hover:border-violet-500/40 hover:bg-violet-900/20"
                }`}
                style={profileIdx !== i ? { background: "hsl(0,0%,8%)" } : {}}>
                Profile {i + 1}: {p.name.split(" ")[0]}
                <span className={`ml-1.5 text-xs font-normal ${
                  profileIdx === i ? "text-violet-200" :
                  p.groundTruth === "REAL"      ? "text-emerald-400" :
                  p.groundTruth === "FAKE"      ? "text-red-400" :
                                                  "text-amber-400"
                }`}>
                  ({p.groundTruth === "REAL" ? "Real" : p.groundTruth === "FAKE" ? "Fake" : "Tricky"})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Progress stepper */}
        <ProgressStepper stage={stage} />

        {/* Stage content */}
        <div className="mt-2">
          {stage === 1 && (
            <Stage1 profile={profile} onSubmit={a => { setAnnotation(a); setStage(2); }} />
          )}
          {stage === 2 && annotation && (
            <Stage2 profile={profile} annotation={annotation} onComplete={() => setStage(3)} />
          )}
          {stage === 3 && annotation && (
            <Stage3 profile={profile} annotation={annotation} onSubmit={a => { setQaAction(a); setStage(4); }} />
          )}
          {stage === 4 && annotation && qaAction && (
            <Stage4 profile={profile} qaAction={qaAction} onReset={() => reset()} />
          )}
        </div>
      </div>
    </div>
  );
}
