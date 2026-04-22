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
  Check, AlertOctagon, ShieldAlert,
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
  Avatar:      () => JSX.Element;
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

// ─── SVG Avatars (self-contained, no external assets) ────────────────────────

/** Sarah Chen — genuine user, warm natural look */
const SarahAvatar = () => (
  <svg viewBox="0 0 120 140" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="70" r="65" fill="#fde8dc" />
    {/* hair */}
    <ellipse cx="60" cy="50" rx="35" ry="31" fill="#2c1810" />
    {/* face */}
    <ellipse cx="60" cy="86" rx="29" ry="35" fill="#f5c6a8" />
    {/* eyes */}
    <circle cx="49" cy="79" r="5.5" fill="#2c1810" />
    <circle cx="71" cy="79" r="5.5" fill="#2c1810" />
    <circle cx="50.5" cy="77.5" r="2" fill="white" />
    <circle cx="72.5" cy="77.5" r="2" fill="white" />
    {/* nose */}
    <ellipse cx="60" cy="90" rx="3.5" ry="2.5" fill="#e8a882" />
    {/* smile */}
    <path d="M 51 100 Q 60 109 69 100" stroke="#c47350" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    {/* blush */}
    <ellipse cx="44" cy="93" rx="6" ry="3.5" fill="#f0b0a0" opacity="0.5" />
    <ellipse cx="76" cy="93" rx="6" ry="3.5" fill="#f0b0a0" opacity="0.5" />
  </svg>
);

/** Marcus King — too-perfect "model" look, romance-scam archetype */
const MarcusAvatar = () => (
  <svg viewBox="0 0 120 140" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="70" r="65" fill="#e8f0f8" />
    {/* styled hair */}
    <path d="M 26 65 Q 28 22 60 18 Q 92 22 94 65 Q 87 54 60 52 Q 33 54 26 65" fill="#1a0a00" />
    {/* neck */}
    <rect x="49" y="114" width="22" height="20" rx="5" fill="#c8845a" />
    {/* face */}
    <path d="M 32 67 Q 30 90 33 105 Q 46 122 60 124 Q 74 122 87 105 Q 90 90 88 67 Q 86 54 60 52 Q 34 54 32 67" fill="#c8845a" />
    {/* eyes */}
    <ellipse cx="48" cy="79" rx="6" ry="5.5" fill="#1a0a00" />
    <ellipse cx="72" cy="79" rx="6" ry="5.5" fill="#1a0a00" />
    <circle cx="50" cy="77.5" r="2.2" fill="white" />
    <circle cx="74" cy="77.5" r="2.2" fill="white" />
    {/* perfect smile */}
    <path d="M 48 99 Q 60 111 72 99 Q 60 115 48 99" fill="white" opacity="0.65" />
    <path d="M 48 99 Q 60 110 72 99" stroke="#a0614a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </svg>
);

/** Priya Sharma — ambiguous, could be real or AI-generated */
const PriyaAvatar = () => (
  <svg viewBox="0 0 120 140" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="70" r="65" fill="#f5ede8" />
    {/* long dark hair */}
    <ellipse cx="60" cy="52" rx="33" ry="30" fill="#1a0a00" />
    <path d="M 28 74 Q 24 100 28 124" stroke="#1a0a00" strokeWidth="12" strokeLinecap="round" fill="none" />
    <path d="M 92 74 Q 96 100 92 124" stroke="#1a0a00" strokeWidth="9" strokeLinecap="round" fill="none" />
    {/* face */}
    <ellipse cx="60" cy="88" rx="28" ry="33" fill="#d4956a" />
    {/* eyes */}
    <ellipse cx="49" cy="81" rx="5" ry="4.5" fill="#1a0a00" />
    <ellipse cx="71" cy="81" rx="5" ry="4.5" fill="#1a0a00" />
    <circle cx="50.5" cy="79.5" r="1.8" fill="white" />
    <circle cx="72.5" cy="79.5" r="1.8" fill="white" />
    {/* bindi */}
    <circle cx="60" cy="65" r="3" fill="#dc2626" />
    {/* nose */}
    <ellipse cx="60" cy="92" rx="3" ry="2" fill="#c47850" />
    {/* neutral mouth */}
    <path d="M 53 102 Q 60 107 67 102" stroke="#b87050" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </svg>
);

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
    Avatar: SarahAvatar,
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
    Avatar: MarcusAvatar,
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
    Avatar: PriyaAvatar,
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
                current ? "bg-white border-violet-600 text-violet-600 ring-4 ring-violet-100" :
                          "bg-white border-slate-200 text-slate-400"
              }`}>
                {done ? <Check size={15} /> : step.n}
              </div>
              <span className={`mt-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                current ? "text-violet-600" : done ? "text-slate-600" : "text-slate-400"
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-14 h-0.5 mx-1 mb-5 transition-all duration-500 ${
                stage > step.n ? "bg-violet-600" : "bg-slate-200"
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
  const { Avatar } = profile;

  if (compact) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
            <Avatar />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm">{profile.name}, {profile.age}</div>
            <div className="text-xs text-slate-500">{profile.location}</div>
            <div className="text-xs text-slate-400">{profile.occupation}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
      {/* Avatar */}
      <div className="relative w-full" style={{ aspectRatio: "4/3", background: "linear-gradient(135deg,#f0f4f8,#e8eef5)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
        <div style={{ width: 190, height: 220 }}>
          <Avatar />
        </div>
        {/* Tags */}
        <div className="absolute bottom-3 left-3 flex gap-1.5 flex-wrap">
          {profile.tags.map(tag => (
            <span key={tag.label} className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
              tag.warn
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-white/90 text-slate-700 border-slate-200"
            }`}>
              {tag.label}
            </span>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="p-5">
        <div className="flex items-baseline gap-2 mb-0.5">
          <h2 className="text-xl font-bold text-slate-900">{profile.name}</h2>
          <span className="text-slate-400 text-lg">{profile.age}</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">📍 {profile.location} · {profile.occupation}</p>
        <p className="text-sm text-slate-700 leading-relaxed mb-4">{profile.bio}</p>

        <div className="space-y-3">
          {profile.prompts.map((p, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-1">{p.q}</div>
              <div className="text-sm text-slate-700">{p.a}</div>
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
        <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">✏️</span>
          <div>
            <div className="text-sm font-bold text-violet-900">You are the Human Annotator</div>
            <div className="text-xs text-violet-600">Review this profile and submit your assessment</div>
          </div>
        </div>

        {/* Q1 · Verdict */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 mb-3">1 · Is this profile real, fake, or unsure?</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: "real"   as Verdict, label: "Real",  activeClass: "bg-emerald-500 border-emerald-500 text-white", idleClass: "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100" },
              { val: "fake"   as Verdict, label: "Fake",  activeClass: "bg-red-500 border-red-500 text-white",         idleClass: "bg-red-50 border-red-300 text-red-800 hover:bg-red-100" },
              { val: "unsure" as Verdict, label: "Unsure",activeClass: "bg-amber-500 border-amber-500 text-white",     idleClass: "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100" },
            ].map(opt => (
              <button key={opt.val} onClick={() => setVerdict(opt.val)}
                className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${verdict === opt.val ? opt.activeClass : opt.idleClass}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Q2 · Risk signals */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 mb-3">2 · Flag any risk signals (select all that apply)</p>
          <div className="space-y-2">
            {RISK_SIGNALS.map(sig => (
              <button key={sig.id} onClick={() => toggleSignal(sig.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${
                  signals.includes(sig.id)
                    ? "bg-violet-50 border-violet-400 text-violet-800 font-medium"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}>
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  signals.includes(sig.id) ? "bg-violet-600 border-violet-600" : "border-slate-300"
                }`}>
                  {signals.includes(sig.id) && <Check size={10} className="text-white" />}
                </div>
                {sig.label}
              </button>
            ))}
          </div>
        </div>

        {/* Q3 · Confidence */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 mb-3">3 · Your confidence level</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(["low","medium","high"] as Confidence[]).map(c => (
              <button key={c} onClick={() => setConfidence(c)}
                className={`py-2 rounded-xl border-2 text-sm font-bold capitalize transition-all ${
                  confidence === c ? "bg-slate-800 border-slate-800 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Human confidence:</span>
            <div className="flex gap-1">
              {[1,2,3].map(i => (
                <div key={i} className={`h-2 w-8 rounded-full transition-all duration-300 ${i <= confLevel ? "bg-violet-500" : "bg-slate-200"}`} />
              ))}
            </div>
            {confidence && <span className="text-xs font-semibold text-violet-600 capitalize ml-1">{confidence}</span>}
          </div>
        </div>

        <Button disabled={!canSubmit} onClick={() => onSubmit({ verdict, signals, confidence })}
          className="w-full h-12 text-base font-semibold bg-violet-600 hover:bg-violet-700">
          Submit Annotation →
        </Button>
        {!canSubmit && <p className="text-xs text-slate-400 text-center">Complete all three fields to continue</p>}
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

  const riskHue   = (n: number) => n >= 90 ? "#dc2626" : n >= 70 ? "#ea580c" : n >= 50 ? "#d97706" : "#059669";
  const riskBg    = (n: number) => n >= 90 ? "#fef2f2" : n >= 70 ? "#fff7ed" : n >= 50 ? "#fffbeb" : "#f0fdf4";
  const humanLbl  = annotation.verdict === "real" ? "✓ Real" : annotation.verdict === "fake" ? "✗ Fake" : "? Unsure";
  const humanCls  = annotation.verdict === "real"
    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
    : annotation.verdict === "fake"
    ? "bg-red-50 border-red-300 text-red-700"
    : "bg-amber-50 border-amber-300 text-amber-700";

  const ScoreBar = ({ label, score, active }: { label: string; score: number; active: boolean }) => (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: active ? riskHue(score) : "#94a3b8" }}>
          {active ? `${score}/100` : "—"}
        </span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
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
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Brain size={22} className="text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-bold text-blue-900">AI Detection Model Review</div>
            <div className="text-xs text-blue-600">AI-assisted · not a final decision</div>
          </div>
          {phase >= 4 && scores.overall > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Complete</span>
          )}
        </div>

        {/* Animated score bars */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <ScoreBar label="Image Authenticity"  score={scores.image}    active={phase >= 2} />
          <ScoreBar label="Text Consistency"    score={scores.text}     active={phase >= 3} />
          <ScoreBar label="Behavioral Risk"     score={scores.behavior} active={phase >= 4} />

          {phase >= 4 && scores.overall > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Overall AI Risk Score</p>
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
                  <div className="text-xs text-slate-400 mt-0.5">AI confidence: High</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI reasoning */}
        {phase >= 4 && scores.overall > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800 mb-3">Why the AI flagged this profile:</p>
            <div className="space-y-2.5">
              {profile.aiResult.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-slate-600 leading-relaxed">{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Human vs AI comparison chip */}
        {phase >= 4 && scores.overall > 0 && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Your annotation vs AI</p>
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
  const humanColor = annotation.verdict === "real" ? "#059669" : annotation.verdict === "fake" ? "#dc2626" : "#d97706";

  const riskHue = (n: number) => n >= 90 ? "#dc2626" : n >= 70 ? "#ea580c" : n >= 50 ? "#d97706" : "#059669";
  const riskBg  = (n: number) => n >= 90 ? "#fef2f2" : n >= 70 ? "#fff7ed" : n >= 50 ? "#fffbeb" : "#f0fdf4";

  const conflict =
    (annotation.verdict === "real"  && ai.overallRisk >= 70) ||
    (annotation.verdict === "fake"  && ai.overallRisk < 50)  ||
    annotation.verdict === "unsure";

  return (
    <div className="space-y-4">
      {/* Role badge */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <Shield size={22} className="text-indigo-600 flex-shrink-0" />
        <div>
          <div className="text-sm font-bold text-indigo-900">Human QA Review — Teleperformance</div>
          <div className="text-xs text-indigo-600">You are a senior QA reviewer. Review both decisions and make the final call.</div>
        </div>
      </div>

      {/* Conflict banner */}
      {conflict && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={17} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-amber-800">Human–AI Conflict Detected</div>
            <div className="text-xs text-amber-700 mt-0.5">Your annotation and the AI model disagree. Human QA must make the final determination.</div>
          </div>
        </div>
      )}

      {/* Three-column comparison */}
      <div className="grid grid-cols-3 gap-4">
        {/* Human annotation summary */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">👤 Human Annotation</p>
          <div className="text-lg font-black mb-2" style={{ color: humanColor }}>{humanLbl}</div>
          <div className="text-xs text-slate-500 space-y-1">
            <div><span className="font-semibold">Confidence:</span> {annotation.confidence}</div>
            <div className="font-semibold mt-2 mb-1">Signals flagged:</div>
            {annotation.signals.map(s => {
              const sig = RISK_SIGNALS.find(r => r.id === s);
              return sig ? <div key={s} className="text-slate-600">· {sig.label}</div> : null;
            })}
          </div>
        </div>

        {/* Centre — compact profile + insight */}
        <div className="space-y-3">
          <ProfileCard profile={profile} compact />
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
            <p className="text-xs font-bold text-violet-700 mb-1">💡 TP Insight</p>
            <p className="text-xs text-violet-800 leading-relaxed">{profile.insight}</p>
          </div>
        </div>

        {/* AI decision summary */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">🤖 AI Model Decision</p>
          <div className="text-lg font-black mb-1" style={{ color: riskHue(ai.overallRisk) }}>
            {ai.overallRisk}/100 Risk
          </div>
          <div className="text-xs font-bold mb-2" style={{ color: riskHue(ai.overallRisk) }}>{ai.verdictLabel}</div>
          <div className="text-xs text-slate-500 space-y-1">
            {ai.reasons.map((r, i) => <div key={i}>· {r.split("(")[0].trim()}</div>)}
          </div>
        </div>
      </div>

      {/* QA actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-800 mb-4">QA Decision — Select your action:</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { action:"validate" as QAAction, icon:"✓", label:"Validate AI",           sub:"Accept AI decision",      idle:"border-emerald-300 bg-emerald-50 text-emerald-800",    active:"border-emerald-500 bg-emerald-500 text-white" },
            { action:"override" as QAAction, icon:"↩", label:"Override AI",           sub:"Human judgment prevails", idle:"border-violet-300 bg-violet-50 text-violet-800",       active:"border-violet-600 bg-violet-600 text-white" },
            { action:"escalate" as QAAction, icon:"🔍",label:"Request More Evidence", sub:"Escalate for senior review",idle:"border-amber-300 bg-amber-50 text-amber-800",        active:"border-amber-500 bg-amber-500 text-white" },
          ].map(opt => (
            <button key={opt.action}
              onClick={() => { setSelected(opt.action); if (opt.action === "override") setOverrideExpanded(true); else setOverrideExpanded(false); }}
              className={`p-3 rounded-xl border-2 text-left transition-all ${selected === opt.action ? opt.active : opt.idle}`}>
              <div className="text-xl mb-1">{opt.icon}</div>
              <div className="text-sm font-bold">{opt.label}</div>
              <div className={`text-xs mt-0.5 ${selected === opt.action ? "opacity-80" : "opacity-70"}`}>{opt.sub}</div>
            </button>
          ))}
        </div>

        {/* Override rationale panel */}
        {overrideExpanded && selected === "override" && (
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-bold text-violet-900 mb-2">⚠️ Why Human Override Matters</p>
            <div className="text-xs text-violet-800 space-y-1.5 leading-relaxed">
              <p>· AI models generate <strong>false positives</strong> — flagging real users incorrectly. Human review prevents wrongful removal.</p>
              <p>· AI models generate <strong>false negatives</strong> — missing sophisticated fraud that mimics authentic behaviour. Human intuition catches edge cases.</p>
              <p>· Human QA is the <strong>accountability layer</strong> that makes AI-assisted moderation defensible to regulators, platforms, and users.</p>
            </div>
            <p className="mt-3 text-xs font-bold text-violet-700">
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
    approved:  { icon: "✅", label: "Profile Approved",       ring: "border-emerald-300 bg-emerald-50", heading: "text-emerald-700" },
    rejected:  { icon: "🚫", label: "Profile Removed",        ring: "border-red-300 bg-red-50",         heading: "text-red-700" },
    escalated: { icon: "⚠️", label: "Needs Follow-up",        ring: "border-amber-300 bg-amber-50",     heading: "text-amber-700" },
  }[decision.status];

  const correctBanner = decision.correct
    ? { bg: "bg-emerald-50 border-emerald-200", icon: <CheckCircle2 size={16} className="text-emerald-600" />, text: "text-emerald-800", msg: "Correct decision — this matches the ground truth outcome." }
    : { bg: "bg-red-50 border-red-200",         icon: <XCircle      size={16} className="text-red-600"     />, text: "text-red-800",     msg: "Suboptimal decision — see the insight above for the preferred outcome." };

  const metrics = [
    { Icon: Shield,     label: "Users Protected",       value: decision.status === "rejected" ? "2,840" : "1",     sub: decision.status === "rejected" ? "potential victims in region" : "real user outcome resolved", color: "text-violet-600 bg-violet-50" },
    { Icon: TrendingUp, label: "Platform Trust Score",  value: "+0.3%",                                            sub: "projected improvement from this decision",                                                   color: "text-emerald-600 bg-emerald-50" },
    { Icon: Zap,        label: "Decision Latency",      value: "<4 min",                                           sub: "annotation → AI → QA → delivery",                                                           color: "text-blue-600 bg-blue-50" },
    { Icon: Users,      label: "TP Specialists Involved", value: "3",                                              sub: "annotator + AI reviewer + QA approver",                                                      color: "text-indigo-600 bg-indigo-50" },
  ];

  return (
    <div className="flex flex-col gap-5 items-center max-w-2xl mx-auto w-full">
      {/* Delivery label */}
      <div className="inline-flex items-center gap-2 bg-slate-800 text-white text-xs font-bold px-4 py-1.5 rounded-full">
        <span>📬</span> Step 4: Final Decision Delivered to Client Platform
      </div>

      {/* Status card */}
      <div className={`w-full rounded-2xl border-2 p-6 text-center ${statusCfg.ring}`}>
        <div className="text-5xl mb-3">{statusCfg.icon}</div>
        <div className={`text-2xl font-black mb-2 ${statusCfg.heading}`}>{decision.heading}</div>
        <p className="text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">{decision.body}</p>
      </div>

      {/* Correct/incorrect banner */}
      <div className={`w-full rounded-xl border px-4 py-3 flex items-center gap-3 ${correctBanner.bg}`}>
        {correctBanner.icon}
        <p className={`text-xs font-semibold ${correctBanner.text}`}>{correctBanner.msg}</p>
      </div>

      {/* TP Insight */}
      <div className="w-full bg-violet-50 border border-violet-200 rounded-xl p-4">
        <p className="text-sm font-bold text-violet-900 mb-1">💡 Why This Case Matters</p>
        <p className="text-xs text-violet-800 leading-relaxed">{profile.insight}</p>
      </div>

      {/* Impact metrics */}
      <div className="w-full">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 text-center">Simulated Impact Metrics</p>
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2 ${m.color}`}>
                <m.Icon size={18} />
              </div>
              <div className="text-xl font-black text-slate-900">{m.value}</div>
              <div className="text-xs font-semibold text-slate-700">{m.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TP scale proof points */}
      <div className="w-full bg-slate-900 text-white rounded-2xl p-5">
        <p className="text-sm font-bold mb-4">How TP Operationalises This at Scale</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { val: "500K+", sub: "Daily T&S decisions" },
            { val: "99.1%", sub: "QA override accuracy" },
            { val: "40+",   sub: "Languages supported" },
          ].map(kpi => (
            <div key={kpi.val}>
              <div className="text-2xl font-black text-violet-400">{kpi.val}</div>
              <div className="text-xs text-slate-400 mt-0.5">{kpi.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div className="flex gap-3 w-full">
        <Button variant="outline" onClick={onReset} className="flex-1 gap-2 h-12">
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
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>
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
          <h1 className="text-2xl font-black text-slate-900">
            Real or Fake? <span className="text-violet-600">Catfish Detection</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl mx-auto">
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
                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50"
                }`}>
                Profile {i + 1}: {p.name.split(" ")[0]}
                <span className={`ml-1.5 text-xs font-normal ${
                  profileIdx === i ? "text-violet-200" :
                  p.groundTruth === "REAL"      ? "text-emerald-500" :
                  p.groundTruth === "FAKE"      ? "text-red-500" :
                                                  "text-amber-500"
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
