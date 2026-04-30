/**
 * ImpersonationRedaction.tsx
 * "Impersonation Review + Policy Redaction" – Content Moderation Demo
 * 4-stage pipeline: Annotate → AI Review → Human QA → Delivered
 * All data is mock/deterministic. No external APIs.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Brain, Shield, AlertTriangle,
  Zap, Users, RotateCcw, Check,
  ShieldAlert, Scissors, RefreshCw, FileText, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/context/ThemeContext";

// ─── Policy categories (13 categories with definitions) ──────────────────────

const POLICY_CATEGORIES = [
  { id: "hate_speech",        label: "Hate Speech & Harassment",              def: "Content targeting individuals/groups based on protected characteristics such as race, nationality, religion, or gender." },
  { id: "violence",           label: "Violence & Physical Harm",              def: "Threats, glorification of violence, content promoting self-harm, or dangerous activities." },
  { id: "sexual_content",     label: "Sexual Content & Exploitation",         def: "Explicit sexual content shared without consent, non-consensual imagery, or adult content in non-adult contexts." },
  { id: "child_safety",       label: "Child Safety",                          def: "Any content that exploits, endangers, grooms, or sexualises minors." },
  { id: "extremism",          label: "Extremism & Terrorism",                 def: "Promotion of, or recruitment for, extremist ideologies or designated terrorist organisations." },
  { id: "misinfo",            label: "Misinformation & Disinformation",       def: "Deliberately false or misleading content designed to deceive users or manipulate public discourse." },
  { id: "scams_fraud",        label: "Fraud, Scams & Deceptive Practices",   def: "Phishing, romance scams, fake giveaways, fraudulent investment schemes, or impersonation for financial gain." },
  { id: "illegal_goods",      label: "Illegal or Regulated Goods",           def: "Sale or promotion of weapons, drugs, counterfeit items, or other regulated/illegal products." },
  { id: "ip_copyright",       label: "IP & Copyright",                       def: "Unauthorised use or distribution of copyrighted, trademarked, or proprietary content." },
  { id: "sensitive_pii",      label: "Privacy & Personal Data",               def: "Exposure of private contact info, location data, financial details, or identity documents." },
  { id: "platform_integrity", label: "Platform Integrity & Abuse",            def: "Bot activity, fake accounts, coordinated inauthentic behaviour, or ban evasion." },
  { id: "advertising",        label: "Advertising & Commercial",              def: "Unsolicited promotions, spam, affiliate link abuse, or undisclosed commercial intent." },
  { id: "community_conduct",  label: "Community Conduct & Rules",             def: "Violations of platform-specific terms of service or community guidelines not covered above." },
];

// ─── Profile interface ────────────────────────────────────────────────────────

interface ProfilePhoto {
  url:            string;
  caption:        string;
  flag:           string;
  /** If true, render blurred with a content-warning reveal overlay */
  blurred?:       boolean;
  /** Optional badge shown on the photo corner */
  violationType?: "weapon" | "sexual_content";
}

interface AiResult {
  recommendation:          "Escalate" | "Reject" | "Approve";
  confidence:              number;
  signals:                 string[];
  predictedCategories:     string[];
  suggestedRedactionTypes: string[];
}

interface MockProfile {
  profile_id:   string;
  display_name: string;
  age:          number;
  location:     string;
  bio_text:     string;
  photos:       ProfilePhoto[];
  signals:      string[];
  ai_result:    AiResult;
}

// ─── Mock profiles ────────────────────────────────────────────────────────────

const PROFILES: MockProfile[] = [
  // ── Profile 1: Alex Jordan — PII + Scams/Fraud ───────────────────────────
  {
    profile_id:   "USR-20482",
    display_name: "Alex Jordan",
    age:          29,
    location:     "San Francisco, CA",
    bio_text:
      "Freelance photographer & outdoor enthusiast. Reach me at alex.jordan92@gmail.com " +
      "or call +1 (415) 555-0147. Active on Instagram: @alex_j_photos — portfolio at alexjordan.co. " +
      "Based near 4th & King St, San Francisco. Selling vintage camera gear and hunting accessories " +
      "— DM for details, no lowballers \uD83D\uDD2B",
    photos: [
      {
        url:     "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=750&fit=crop&crop=faces",
        caption: "Photo 1 — Primary",
        flag:    "Reverse-image match: 74% similarity to stock portfolio",
      },
      {
        url:     "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=750&fit=crop&crop=faces",
        caption: "Photo 2 — Secondary",
        flag:    "Metadata mismatch: EXIF location \u2260 stated city",
      },
    ],
    signals: [
      "Photo 1 reverse-image match: 74% similarity to stock portfolio",
      "Rapid profile edits (3 edits in 2 hours)",
      "Reused bio snippet (matched 2 other profiles)",
      "Location ping mismatch (IP: Chicago, stated: SF)",
    ],
    ai_result: {
      recommendation:          "Escalate",
      confidence:              84,
      signals: [
        "Contact info in bio: email + phone detected (policy violation)",
        "External handle reference @alex_j_photos (off-platform solicitation risk)",
        "Portfolio link embedded: alexjordan.co (external redirect risk)",
        "Weapon-adjacent context: sale listing + ambiguous item description",
      ],
      predictedCategories:     ["sensitive_pii", "scams_fraud"],
      suggestedRedactionTypes: ["email", "phone", "handle", "link"],
    },
  },

  // ── Profile 2: Jamie Rivera — Hate Speech + Illegal Goods (weapon in photo) ─
  {
    profile_id:   "USR-38817",
    display_name: "Jamie Rivera",
    age:          31,
    location:     "Las Vegas, NV",
    bio_text:
      "Vegas girl, life\u2019s too short for boring dates \uD83C\uDFB2 DM me on Snap @jamie.rv.real or text " +
      "+1 (702) 555-0219 \u2014 faster than the app. Got some items for trade: AR-15 accessories, " +
      "tactical attachments \u2014 cash only, no cops. Only interested in certain types \u2014 NO immigrants " +
      "or foreigners, keeping it 100%. Real deal only \uD83D\uDD25\uD83C\uDDF8",
    photos: [
      {
        url:     "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=750&fit=crop&crop=faces",
        caption: "Photo 1 — Primary",
        flag:    "Reverse-image match: 81% — linked to fitness influencer @fit_by_jamie",
      },
      {
        url:     "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=600&h=750&fit=crop&crop=faces",
        caption: "Photo 2 — Flagged",
        flag:    "Firearm visible in frame — regulated goods policy flag triggered",
        violationType: "weapon",
      },
    ],
    signals: [
      "Photo 2 firearm detection: regulated item visible in profile image",
      "Discriminatory keywords detected in bio (automated scan)",
      "Off-platform handle found in bio text (Snapchat)",
      "Regulated item keywords: AR-15, tactical attachments",
    ],
    ai_result: {
      recommendation:          "Reject",
      confidence:              91,
      signals: [
        "Discriminatory exclusion language detected: nationality-based ('NO immigrants / foreigners')",
        "Off-platform redirect: Snapchat handle @jamie.rv.real (policy: no external solicitation)",
        "Direct contact info: phone +1 (702) 555-0219 embedded in bio",
        "Regulated goods signal: AR-15 accessories, tactical attachments — cash sale offer",
      ],
      predictedCategories:     ["hate_speech", "illegal_goods"],
      suggestedRedactionTypes: ["phone", "handle"],
    },
  },

  // ── Profile 3: Sam Chen — Scams/Fraud + Platform Integrity (blurred photo) ─
  {
    profile_id:   "USR-51293",
    display_name: "Sam Chen",
    age:          34,
    location:     "Los Angeles, CA",
    bio_text:
      "Finance coach & crypto investor based in LA \uD83D\uDCBC I\u2019ve helped 200+ clients achieve 30\u201340% " +
      "monthly returns. Looking for a real connection beyond the app \u2014 reach me on WhatsApp " +
      "+1 (213) 555-0398 or Telegram @sam_trade_pro. Check my verified track record at samchenpro.com. " +
      "Serious inquiries only \u2014 free private consultation for matches \uD83D\uDCB0\uD83D\uDE80 " +
      "Limited spots left, don\u2019t wait!",
    photos: [
      {
        url:     "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=750&fit=crop&crop=faces",
        caption: "Photo 1 — Primary",
        flag:    "Reverse-image match: 68% — same photo found on 3 other dating profiles",
      },
      {
        url:     "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=750&fit=crop&crop=faces",
        caption: "Photo 2 — Flagged",
        flag:    "Potentially explicit content — blurred pending reviewer confirmation",
        blurred:       true,
        violationType: "sexual_content",
      },
    ],
    signals: [
      "Photo 2 flagged: potentially explicit content — pending manual review",
      "Financial promise language: '30–40% monthly returns' (romance scam pattern)",
      "Multiple off-platform redirects: WhatsApp, Telegram, external website",
      "Account age: 2 days · 47 messages sent in 6 hours (bot-like velocity)",
    ],
    ai_result: {
      recommendation:          "Reject",
      confidence:              96,
      signals: [
        "Financial solicitation: '30–40% monthly returns' — textbook romance scam trigger",
        "Multiple off-platform redirects: WhatsApp + Telegram handle + personal website",
        "Urgency manipulation: 'Limited spots left' — high-pressure solicitation tactic",
        "Platform integrity flag: 2-day-old account, 47 messages, likely bot/coordinated",
      ],
      predictedCategories:     ["scams_fraud", "platform_integrity"],
      suggestedRedactionTypes: ["phone", "handle", "link"],
    },
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage        = 1 | 2 | 3 | 4;
type ProfileLabel = "genuine" | "impersonation" | "unsure";
type FinalLabel   = "approve" | "reject" | "escalate";
type QAReason     = "fp_risk" | "fn_risk" | "human_judgment" | "insufficient_evidence";

interface PiiToken {
  id:       string;
  type:     "email" | "phone" | "handle" | "link" | "manual";
  original: string;
  start:    number;
  end:      number;
}

interface Redaction extends PiiToken {
  active: boolean;
}

interface AnnotationState {
  profileLabel:       ProfileLabel | null;
  riskFlags:          Set<string>;
  selectedCategories: Set<string>;
  redactedIds:        Set<string>;
  manualRedactions:   PiiToken[];
  confidence:         number;
  notes:              string;
}

interface QAState {
  finalLabel:         FinalLabel | null;
  activeRedactionIds: Set<string>;
  qaReason:           QAReason | null;
  qaNotes:            string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

let _idN = 0;

export function detectPII(text: string): PiiToken[] {
  const tokens: PiiToken[] = [];
  const occupied = (s: number, e: number) => tokens.some(t => t.start < e && t.end > s);

  const add = (type: PiiToken["type"], regex: RegExp) => {
    let m: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) {
      const s = m.index, e = m.index + m[0].length;
      if (!occupied(s, e)) tokens.push({ id: `pii-${_idN++}`, type, original: m[0], start: s, end: e });
    }
  };

  add("email",  /\b[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}\b/g);
  add("phone",  /\+?1?\s?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g);
  add("handle", /(?<![a-zA-Z0-9_])@[\w.]+/g);
  add("link",   /\b(?:(?:https?:\/\/)?(?:www\.)?[\w\-]+\.(?:co|com|net|org|io|app))(?:\/\S*)?\b/g);

  return tokens.sort((a, b) => a.start - b.start);
}

export function applyRedactions(text: string, redactions: Redaction[]): string {
  const active = redactions.filter(r => r.active).sort((a, b) => a.start - b.start);
  let result = "", cursor = 0;
  for (const r of active) {
    if (r.start >= cursor) { result += text.slice(cursor, r.start) + "[REDACTED]"; cursor = r.end; }
  }
  return result + text.slice(cursor);
}

export function diffDecisions(annotatorLabel: ProfileLabel | null, aiRec: string) {
  const map: Record<string, ProfileLabel> = { Escalate: "unsure", Reject: "impersonation", Approve: "genuine" };
  const agrees = annotatorLabel === (map[aiRec] ?? "unsure");
  return {
    agrees,
    message: agrees
      ? `Both you and AI agree: ${aiRec}`
      : `You labelled "${annotatorLabel}" but AI recommends "${aiRec}"`,
  };
}

// ─── Progress stepper ─────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Annotate"  },
  { n: 2, label: "AI Review" },
  { n: 3, label: "Human QA"  },
  { n: 4, label: "Delivered" },
] as const;

function ProgressStepper({ stage }: { stage: Stage }) {
  return (
    <div className="flex items-center justify-center py-4">
      {STEPS.map((step, i) => {
        const done = stage > step.n, current = stage === step.n;
        return (
          <div key={step.n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                done    ? "bg-violet-600 border-violet-600 text-white" :
                current ? "bg-[var(--s6)] border-violet-500 text-violet-400 ring-4 ring-violet-900/40" :
                          "bg-[var(--s4)] border-white/10 text-white/30"
              }`}>
                {done ? <Check size={16} /> : step.n}
              </div>
              <span className={`mt-1 text-sm font-semibold whitespace-nowrap ${
                current ? "text-violet-400" : done ? "text-foreground/60" : "text-foreground/30"
              }`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mx-1 mb-6 transition-all duration-500 ${stage > step.n ? "bg-violet-600" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PII colour map ───────────────────────────────────────────────────────────

const PII_COL: Record<string, { bg: string; text: string; border: string }> = {
  email:  { bg: "rgba(245,158,11,0.18)",  text: "#f59e0b", border: "rgba(245,158,11,0.4)" },
  phone:  { bg: "rgba(249,115,22,0.18)",  text: "#f97316", border: "rgba(249,115,22,0.4)" },
  handle: { bg: "rgba(59,130,246,0.18)",  text: "#60a5fa", border: "rgba(59,130,246,0.4)" },
  link:   { bg: "rgba(6,182,212,0.18)",   text: "#22d3ee", border: "rgba(6,182,212,0.4)" },
  manual: { bg: "rgba(239,68,68,0.18)",   text: "#f87171", border: "rgba(239,68,68,0.4)" },
};

// ─── Bio redaction editor ─────────────────────────────────────────────────────

type Seg =
  | { kind: "text"; content: string }
  | { kind: "pii"; token: PiiToken; redacted: boolean };

function buildSegs(text: string, tokens: PiiToken[], redactedIds: Set<string>, manual: PiiToken[]): Seg[] {
  const all = [...tokens, ...manual].sort((a, b) => a.start - b.start);
  const segs: Seg[] = [];
  let cur = 0;
  for (const tok of all) {
    if (tok.start > cur) segs.push({ kind: "text", content: text.slice(cur, tok.start) });
    segs.push({ kind: "pii", token: tok, redacted: redactedIds.has(tok.id) });
    cur = tok.end;
  }
  if (cur < text.length) segs.push({ kind: "text", content: text.slice(cur) });
  return segs;
}

function BioEditor({
  bioText, detectedTokens, redactedIds, manualRedactions,
  onToggle, onAddManual, onAutoMark, locked,
}: {
  bioText:          string;
  detectedTokens:   PiiToken[];
  redactedIds:      Set<string>;
  manualRedactions: PiiToken[];
  onToggle:         (id: string) => void;
  onAddManual:      (tok: PiiToken) => void;
  onAutoMark:       (types: string[]) => void;
  locked:           boolean;
}) {
  const bioRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState("");

  const segs = useMemo(
    () => buildSegs(bioText, detectedTokens, redactedIds, manualRedactions),
    [bioText, detectedTokens, redactedIds, manualRedactions],
  );

  function onMouseUp() {
    if (locked) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const raw = sel.toString().trim();
    if (raw.length < 2 || !bioRef.current?.contains(sel.anchorNode)) { setPending(""); return; }
    setPending(raw);
  }

  function redactSelection() {
    if (!pending) return;
    const idx = bioText.indexOf(pending);
    if (idx === -1) return;
    onAddManual({ id: `manual-${Date.now()}`, type: "manual", original: pending, start: idx, end: idx + pending.length });
    setPending("");
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button disabled={locked} onClick={() => onAutoMark(["email", "phone"])}
          className="px-3 py-2 rounded-lg border border-amber-700/50 text-amber-400 text-sm font-semibold hover:bg-amber-950/40 transition disabled:opacity-40 disabled:cursor-not-allowed">
          🔍 Auto-mark phone/email
        </button>
        <button disabled={locked} onClick={() => onAutoMark(["handle", "link"])}
          className="px-3 py-2 rounded-lg border border-blue-700/50 text-blue-400 text-sm font-semibold hover:bg-blue-950/40 transition disabled:opacity-40 disabled:cursor-not-allowed">
          🔗 Auto-mark handles/links
        </button>
      </div>

      <div ref={bioRef} onMouseUp={onMouseUp}
        className="rounded-xl border border-white/10 p-4 text-sm leading-relaxed text-foreground/80 select-text cursor-text"
        style={{ background: "var(--s2)" }}>
        {segs.map((seg, i) => {
          if (seg.kind === "text") return <span key={i}>{seg.content}</span>;
          const col = PII_COL[seg.token.type] ?? PII_COL.manual;
          if (seg.redacted) {
            return (
              <button key={i} disabled={locked} onClick={() => !locked && onToggle(seg.token.id)}
                title="Click to un-redact"
                className="inline mx-0.5 px-2 py-0.5 rounded font-mono text-xs font-bold border transition"
                style={{ background: "rgba(127,29,29,0.35)", color: "#fca5a5", borderColor: "rgba(239,68,68,0.4)" }}>
                [REDACTED]
              </button>
            );
          }
          return (
            <button key={i} disabled={locked} onClick={() => !locked && onToggle(seg.token.id)}
              title={`${seg.token.type} — click to redact`}
              className="inline mx-0.5 px-1.5 py-0.5 rounded border transition-all"
              style={{ background: col.bg, color: col.text, borderColor: col.border }}>
              {seg.token.original}
            </button>
          );
        })}
      </div>

      {!locked && pending && (
        <div className="flex items-center gap-2 p-2 rounded-lg border border-violet-600/30"
          style={{ background: "rgba(109,40,217,0.12)" }}>
          <Scissors size={14} className="text-violet-400" />
          <span className="text-sm text-violet-300 flex-1">
            Selected: <strong>"{pending.slice(0, 40)}{pending.length > 40 ? "…" : ""}"</strong>
          </span>
          <button onClick={redactSelection}
            className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition">
            Redact selection
          </button>
          <button onClick={() => setPending("")} className="text-foreground/40 hover:text-foreground/60 text-sm">✕</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-sm text-foreground/30">Key:</span>
        {(["email","phone","handle","link"] as const).map(type => {
          const col = PII_COL[type];
          return (
            <span key={type} className="text-xs px-2 py-0.5 rounded-full border font-medium"
              style={{ background: col.bg, color: col.text, borderColor: col.border }}>
              {type}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Profile preview card ─────────────────────────────────────────────────────

function ProfileCard({ profile, compact = false }: { profile: MockProfile; compact?: boolean }) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [activePhoto, setActivePhoto] = useState(0);
  const [revealedPhotos, setRevealedPhotos] = useState<Set<number>>(new Set());
  const photo = profile.photos[activePhoto];
  const isRevealed = revealedPhotos.has(activePhoto);

  // Reset state when profile changes
  useEffect(() => {
    setActivePhoto(0);
    setRevealedPhotos(new Set());
  }, [profile.profile_id]);

  if (compact) return (
    <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "var(--s4)" }}>
      <div className="flex items-center gap-3 p-3">
        <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
          <img src={profile.photos[0].url} alt={profile.display_name}
            className="w-full h-full object-cover object-center" />
        </div>
        <div>
          <div className="font-bold text-foreground text-base">{profile.display_name}, {profile.age}</div>
          <div className="text-sm text-foreground/50">{profile.location}</div>
          <div className="text-sm text-foreground/35">ID: {profile.profile_id}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-border overflow-hidden flex-1" style={{ background: "var(--s4)", minWidth: 0 }}>
      {/* Main photo with overlays */}
      <div className="relative w-full overflow-hidden" style={{ height: 420 }}>

        {/* Blurred / normal image */}
        {photo.blurred && !isRevealed ? (
          <>
            <img src={photo.url} alt={profile.display_name}
              className="w-full h-full object-cover object-center"
              style={{ filter: "blur(22px)", transform: "scale(1.1)" }} />
            {/* Content-warning overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6"
              style={{ background: "rgba(0,0,0,0.55)" }}>
              <div className="text-5xl">🔞</div>
              <p className="text-base font-bold text-white text-center leading-snug">
                Potentially Explicit Content
              </p>
              <p className="text-sm text-white/65 text-center">
                AI flagged this photo for manual review
              </p>
              <button
                onClick={() => setRevealedPhotos(prev => new Set([...prev, activePhoto]))}
                className="mt-1 px-5 py-2.5 rounded-xl border border-white/30 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition">
                Click to Review
              </button>
            </div>
          </>
        ) : (
          <img src={photo.url} alt={profile.display_name}
            className="w-full h-full object-cover object-center transition-opacity duration-300" />
        )}

        {/* Dark gradient name scrim */}
        <div className="absolute inset-x-0 bottom-0 h-48"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 50%, transparent 100%)" }} />
        <div className="absolute bottom-3 left-3 right-3">
          <div className="inline-block px-3 py-1.5 rounded-lg mb-1.5"
            style={{ background: "rgba(0,0,0,0.92)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <div style={{ color: "#ffffff", fontWeight: 800, fontSize: "17px", lineHeight: "1.2", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {profile.display_name}, {profile.age}
            </div>
          </div>
          <div className="block">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-semibold"
              style={{ background: "rgba(0,0,0,0.88)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.10)", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              📍 {profile.location}
            </span>
          </div>
        </div>

        {/* Flag banner at top */}
        <div className="absolute top-2 left-2 right-14 flex items-start gap-1.5 px-2.5 py-2 rounded-lg"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}>
          <AlertTriangle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-amber-300 leading-snug font-medium">{photo.flag}</span>
        </div>

        {/* Weapon badge */}
        {photo.violationType === "weapon" && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-white"
            style={{ background: "rgba(220,38,38,0.85)" }}>
            🔫 WEAPON
          </div>
        )}

        {/* Sexual content badge (when revealed) */}
        {photo.violationType === "sexual_content" && isRevealed && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-white"
            style={{ background: "rgba(190,18,60,0.85)" }}>
            🔞 EXPLICIT
          </div>
        )}

        {/* Photo counter */}
        <div className="absolute bottom-3 right-3 text-xs font-bold text-white/70 px-2 py-0.5 rounded-full"
          style={{ background: "rgba(0,0,0,0.55)" }}>
          {activePhoto + 1}/{profile.photos.length}
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 px-3 pt-3 items-center">
        {profile.photos.map((p, i) => (
          <button key={i} onClick={() => setActivePhoto(i)}
            className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
              i === activePhoto ? "border-violet-500" : "border-transparent opacity-60 hover:opacity-80"
            }`}>
            <img src={p.url} alt={p.caption}
              className="w-full h-full object-cover object-center"
              style={p.blurred && !revealedPhotos.has(i) ? { filter: "blur(8px)", transform: "scale(1.1)" } : {}} />
            {p.violationType === "weapon" && (
              <div className="absolute bottom-0 left-0 right-0 bg-red-700/80 text-[9px] font-bold text-white text-center py-0.5">WEAPON</div>
            )}
            {p.violationType === "sexual_content" && (
              <div className="absolute bottom-0 left-0 right-0 bg-pink-900/80 text-[9px] font-bold text-white text-center py-0.5">EXPLICIT</div>
            )}
          </button>
        ))}
        <div className="flex-1 flex flex-col justify-center pl-1 min-w-0">
          <div className="text-sm text-foreground/50 italic truncate">{photo.caption}</div>
          <div className="text-xs text-foreground/30 mt-0.5">Click thumbnails to switch</div>
        </div>
      </div>

      {/* Bio — no scroll */}
      <div className="px-4 pt-3 pb-1">
        <div className="rounded-xl border border-white/8 p-3" style={{ background: "var(--s2)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-1.5">Bio</p>
          <p className="text-sm text-foreground/75 leading-relaxed">{profile.bio_text}</p>
        </div>
      </div>

      {/* System signals */}
      <div className="px-4 py-3">
        <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-2">System Signals</p>
        <div className="space-y-2">
          {profile.signals.map(s => (
            <div key={s} className={`flex items-start gap-2 text-sm ${isLight ? "text-amber-700" : "text-amber-400"}`}>
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Profile selector ─────────────────────────────────────────────────────────

function ProfileSelector({ selected, onChange }: { selected: number; onChange: (i: number) => void }) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  return (
    <div className="rounded-2xl border border-border p-3 mb-4" style={{ background: "var(--s4)" }}>
      <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-2.5">Select Profile to Review</p>
      <div className="grid grid-cols-3 gap-2">
        {PROFILES.map((p, i) => (
          <button key={p.profile_id} onClick={() => onChange(i)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 text-left transition-all min-w-0 overflow-hidden ${
              selected === i
                ? `border-violet-500 ${isLight ? "bg-violet-100" : "bg-violet-900/30"}`
                : `border-border hover:border-violet-500 ${isLight ? "hover:bg-violet-50" : "hover:bg-white/5"}`
            }`}>
            <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
              <img src={p.photos[0].url} alt={p.display_name}
                className="w-full h-full object-cover object-center" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-foreground truncate">{p.display_name}, {p.age}</div>
              <div className="text-xs text-foreground/45 truncate">{p.profile_id}</div>
              <div className={`text-xs truncate ${isLight ? "text-violet-700" : "text-violet-400/70"}`}>{p.location}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Risk flag options ────────────────────────────────────────────────────────

const RISK_FLAGS = [
  { id: "sensitive_pii",      label: "Sensitive Personal Info Present" },
  { id: "policy_violation",   label: "Policy Violation Present" },
  { id: "suspicious_contact", label: "Suspicious External Contact" },
];

// ─── Step 1 · Manual Annotation ───────────────────────────────────────────────

function Step1({ profile, detectedTokens, selectedProfileIdx, onProfileChange, onSubmit }: {
  profile:              MockProfile;
  detectedTokens:       PiiToken[];
  selectedProfileIdx:   number;
  onProfileChange:      (i: number) => void;
  onSubmit:             (a: AnnotationState) => void;
}) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [profileLabel,     setProfileLabel]     = useState<ProfileLabel | null>(null);
  const [riskFlags,        setRiskFlags]         = useState<Set<string>>(new Set());
  const [selectedCats,     setSelectedCats]      = useState<Set<string>>(new Set());
  const [redactedIds,      setRedactedIds]       = useState<Set<string>>(new Set());
  const [manualRedactions, setManualRedactions]  = useState<PiiToken[]>([]);
  const [confidence,       setConfidence]        = useState(50);
  const [notes,            setNotes]             = useState("");

  useEffect(() => {
    setProfileLabel(null);
    setRiskFlags(new Set());
    setSelectedCats(new Set());
    setRedactedIds(new Set());
    setManualRedactions([]);
    setConfidence(50);
    setNotes("");
  }, [selectedProfileIdx]);

  const toggleFlag = (id: string) => setRiskFlags(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleCat  = (id: string) => setSelectedCats(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleId   = (id: string) => setRedactedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const addManual  = (tok: PiiToken) => {
    setManualRedactions(p => [...p, tok]);
    setRedactedIds(p => { const n = new Set(p); n.add(tok.id); return n; });
  };
  const autoMark = (types: string[]) => {
    const ids = detectedTokens.filter(t => types.includes(t.type)).map(t => t.id);
    setRedactedIds(p => { const n = new Set(p); ids.forEach(id => n.add(id)); return n; });
  };

  const canSubmit = profileLabel !== null && (riskFlags.size > 0 || selectedCats.size > 0);

  return (
    <div className="flex gap-5 items-start">
      <ProfileCard profile={profile} />

      <div className="w-[450px] flex-shrink-0 space-y-4">
        {/* Profile selector */}
        <ProfileSelector selected={selectedProfileIdx} onChange={onProfileChange} />

        <div className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${
          isLight
            ? "border-violet-400 bg-violet-100"
            : "border-violet-600/30 bg-[rgba(109,40,217,0.12)]"
        }`}>
          <span className="text-2xl">✏️</span>
          <div>
            <div className={`text-base font-bold ${isLight ? "text-violet-950" : "text-violet-300"}`}>You are the Human Annotator</div>
            <div className={`text-sm ${isLight ? "text-violet-800" : "text-violet-400/80"}`}>Review this profile and submit your assessment</div>
          </div>
        </div>

        {/* 1 · Profile label */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-base font-semibold text-foreground mb-3">1 · Profile Label <span className="text-red-400">*</span></p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { val: "genuine"       as ProfileLabel, label: "Likely Genuine",  act: "bg-emerald-500 border-emerald-500 text-white",
                idleLight: "bg-emerald-100 border-emerald-600 text-emerald-900 hover:bg-emerald-200",
                idleDark:  "bg-emerald-950/30 border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/40" },
              { val: "impersonation" as ProfileLabel, label: "Impersonation",   act: "bg-red-500 border-red-500 text-white",
                idleLight: "bg-red-100 border-red-600 text-red-900 hover:bg-red-200",
                idleDark:  "bg-red-950/30 border-red-700/50 text-red-400 hover:bg-red-900/40" },
              { val: "unsure"        as ProfileLabel, label: "Unsure",          act: "bg-amber-500 border-amber-500 text-white",
                idleLight: "bg-amber-100 border-amber-600 text-amber-900 hover:bg-amber-200",
                idleDark:  "bg-amber-950/30 border-amber-700/50 text-amber-400 hover:bg-amber-900/40" },
            ] as const).map(o => (
              <button key={o.val} onClick={() => setProfileLabel(o.val)}
                className={`py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                  profileLabel === o.val ? o.act : (isLight ? o.idleLight : o.idleDark)
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2 · Risk flags */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-base font-semibold text-foreground mb-3">2 · Risk Flags</p>
          <div className="space-y-2">
            {RISK_FLAGS.map(f => (
              <button key={f.id} onClick={() => toggleFlag(f.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-sm text-left transition-all ${
                  riskFlags.has(f.id)
                    ? `border-violet-500/60 ${isLight ? "text-violet-700" : "text-violet-300"}`
                    : "border-border text-foreground/70 hover:bg-muted/40"
                }`}
                style={riskFlags.has(f.id) ? { background: "rgba(109,40,217,0.18)" } : {}}>
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  riskFlags.has(f.id) ? "bg-violet-600 border-violet-600" : isLight ? "border-gray-400" : "border-white/20"
                }`}>
                  {riskFlags.has(f.id) && <Check size={10} className="text-white" />}
                </div>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3 · Policy categories — compact 2-col grid with tooltips */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-base font-semibold text-foreground mb-1">3 · Policy Categories</p>
          <p className="text-xs text-foreground/35 mb-2.5">Hover a chip for its definition · select all that apply</p>
          <div className="grid grid-cols-2 gap-1.5">
            {POLICY_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => toggleCat(cat.id)}
                title={cat.def}
                className={`px-2.5 py-2 rounded-lg border text-xs font-semibold text-left transition-all truncate ${
                  selectedCats.has(cat.id)
                    ? "bg-violet-600 border-violet-600 text-white"
                    : `border-border text-foreground/70 hover:border-violet-500 ${isLight ? "hover:bg-violet-50" : "hover:bg-violet-900/20"}`
                }`}>
                {cat.label}
              </button>
            ))}
          </div>
          {selectedCats.size > 0 && (
            <p className="text-xs text-violet-400/70 mt-2">{selectedCats.size} categor{selectedCats.size === 1 ? "y" : "ies"} selected</p>
          )}
        </div>

        {/* 4 · Bio redaction */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-base font-semibold text-foreground mb-3">4 · Bio Redaction Tool</p>
          <BioEditor
            bioText={profile.bio_text}
            detectedTokens={detectedTokens}
            redactedIds={redactedIds}
            manualRedactions={manualRedactions}
            onToggle={toggleId}
            onAddManual={addManual}
            onAutoMark={autoMark}
            locked={false}
          />
          <p className="text-sm text-foreground/35 mt-2">{redactedIds.size} token{redactedIds.size !== 1 ? "s" : ""} marked for redaction</p>
        </div>

        {/* 5 · Confidence + notes */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-base font-semibold text-foreground mb-3">5 · Confidence &amp; Notes</p>
          <div className="flex justify-between mb-1">
            <span className="text-sm text-foreground/50">Confidence</span>
            <span className="text-sm font-bold text-violet-400">{confidence}%</span>
          </div>
          <input type="range" min={0} max={100} value={confidence}
            onChange={e => setConfidence(Number(e.target.value))}
            className="w-full accent-violet-600 mb-3" />
          <textarea placeholder="Optional notes…" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground/70 placeholder:text-foreground/25 focus:outline-none focus:border-violet-500/50 resize-none" />
        </div>

        <Button disabled={!canSubmit}
          onClick={() => onSubmit({ profileLabel, riskFlags, selectedCategories: selectedCats, redactedIds, manualRedactions, confidence, notes })}
          className="w-full h-12 text-base font-semibold bg-violet-600 hover:bg-violet-700">
          Submit Annotation →
        </Button>
        {!canSubmit && <p className="text-sm text-foreground/40 text-center">Select a profile label and at least one risk flag or category</p>}
      </div>
    </div>
  );
}

// ─── Step 2 · AI Review ───────────────────────────────────────────────────────

function Step2({ profile, annotation, detectedTokens, onComplete }: {
  profile:        MockProfile;
  annotation:     AnnotationState;
  detectedTokens: PiiToken[];
  onComplete:     () => void;
}) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [phase, setPhase] = useState(0);
  const ai = profile.ai_result;

  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1300),
      setTimeout(() => setPhase(3), 2300),
      setTimeout(() => setPhase(4), 3500),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  const aiSuggestedIds = new Set(
    detectedTokens.filter(t => ai.suggestedRedactionTypes.includes(t.type)).map(t => t.id),
  );
  const agrees    = [...aiSuggestedIds].filter(id => annotation.redactedIds.has(id)).length;
  const onlyAI    = [...aiSuggestedIds].filter(id => !annotation.redactedIds.has(id)).length;
  const onlyHuman = [...annotation.redactedIds].filter(id => !aiSuggestedIds.has(id)).length;
  const diff = diffDecisions(annotation.profileLabel, ai.recommendation);

  const steps = [
    "Scanning bio for contact patterns…",
    "Detecting external handles and links…",
    "Matching policy category signals…",
    "Generating recommendation…",
  ];

  return (
    <div className="flex gap-5 items-start">
      <ProfileCard profile={profile} />
      <div className="w-[450px] flex-shrink-0 space-y-4">
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-blue-600/30"
          style={{ background: "rgba(37,99,235,0.12)" }}>
          <Brain size={24} className="text-blue-400 flex-shrink-0" />
          <div className="flex-1">
            <div className={`text-base font-bold ${isLight ? "text-blue-700" : "text-blue-300"}`}>AI-Assisted Review</div>
            <div className={`text-sm ${isLight ? "text-blue-600" : "text-blue-400/80"}`}>Deterministic simulation · no real model</div>
          </div>
          {phase >= 4 && <span className="text-sm px-2 py-0.5 rounded-full font-semibold border border-blue-600/40 text-blue-300" style={{ background: "rgba(37,99,235,0.25)" }}>Complete</span>}
        </div>

        <div className="rounded-2xl border border-white/10 p-4 space-y-3" style={{ background: "var(--s4)" }}>
          {steps.map((label, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                phase > i ? "bg-blue-600" : "bg-white/8 border border-white/15"
              }`}>
                {phase > i ? <Check size={13} className="text-white" /> :
                  phase === i ? <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /> : null}
              </div>
              <span className={`text-sm transition-colors ${phase > i ? "text-foreground/70" : phase === i ? "text-blue-300" : "text-foreground/25"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {phase >= 4 && (
          <>
            <div className="rounded-2xl border border-amber-700/40 p-4" style={{ background: "rgba(217,119,6,0.12)" }}>
              <p className="text-sm font-bold text-foreground/35 uppercase tracking-wider mb-3">AI Recommendation</p>
              <div className="flex items-center gap-3 mb-3">
                <div className={`text-2xl font-black ${isLight ? "text-amber-600" : "text-amber-400"}`}>{ai.recommendation}</div>
                <div className="text-base text-foreground/50">Confidence: <span className={`font-bold ${isLight ? "text-amber-700" : "text-amber-300"}`}>{ai.confidence}%</span></div>
              </div>
              <div className="space-y-2">
                {ai.signals.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground/60 leading-relaxed">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
              <p className="text-sm font-bold text-foreground/35 uppercase tracking-wider mb-3">Redaction Comparison</p>
              <div className="space-y-2 text-sm">
                {agrees > 0 && <div className="flex items-center gap-2 text-emerald-400"><Check size={13} />{agrees} redaction{agrees > 1 ? "s" : ""} match AI suggestion</div>}
                {onlyAI > 0 && <div className="flex items-center gap-2 text-amber-400"><AlertTriangle size={13} />AI suggests {onlyAI} additional you didn't mark</div>}
                {onlyHuman > 0 && <div className="flex items-center gap-2 text-blue-400"><ShieldAlert size={13} />You marked {onlyHuman} AI didn't flag</div>}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 p-3" style={{ background: "var(--s2)" }}>
              <p className="text-sm font-bold text-foreground/35 uppercase tracking-wider mb-2">Annotator vs AI</p>
              <div className="flex gap-2">
                <div className={`flex-1 text-center py-2.5 rounded-xl border text-sm font-bold ${
                  diff.agrees
                    ? `border-emerald-600/50 ${isLight ? "text-emerald-700" : "text-emerald-400"}`
                    : `border-amber-600/50 ${isLight ? "text-amber-700" : "text-amber-400"}`
                }`}
                  style={diff.agrees ? { background: "rgba(5,150,105,0.12)" } : { background: "rgba(217,119,6,0.12)" }}>
                  You: {annotation.profileLabel}
                </div>
                <div className={`flex-1 text-center py-2.5 rounded-xl border text-sm font-bold border-amber-600/40 ${isLight ? "text-amber-700" : "text-amber-300"}`}
                  style={{ background: "rgba(217,119,6,0.18)" }}>
                  AI: {ai.recommendation}
                </div>
              </div>
              {!diff.agrees && <p className={`text-sm mt-2 text-center ${isLight ? "text-amber-700" : "text-amber-400/70"}`}>{diff.message}</p>}
            </div>

            <Button onClick={onComplete} className="w-full h-12 text-base font-semibold bg-violet-600 hover:bg-violet-700">
              Send to Human QA →
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Step 3 · Human QA ────────────────────────────────────────────────────────

const QA_REASONS: { id: QAReason; label: string }[] = [
  { id: "fp_risk",               label: "AI false positive risk" },
  { id: "fn_risk",               label: "AI false negative risk" },
  { id: "human_judgment",        label: "Context requires human judgment" },
  { id: "insufficient_evidence", label: "Insufficient evidence" },
];

function Step3({ profile, annotation, detectedTokens, onSubmit }: {
  profile:        MockProfile;
  annotation:     AnnotationState;
  detectedTokens: PiiToken[];
  onSubmit:       (qa: QAState) => void;
}) {
  const ai = profile.ai_result;
  const aiSuggestedIds = new Set(
    detectedTokens.filter(t => ai.suggestedRedactionTypes.includes(t.type)).map(t => t.id),
  );

  const { theme } = useTheme();
  const isLight = theme === "light";
  const [finalLabel,          setFinalLabel]         = useState<FinalLabel | null>(null);
  const [activeRedactionIds,  setActiveRedactionIds] = useState<Set<string>>(new Set(annotation.redactedIds));
  const [qaReason,            setQaReason]           = useState<QAReason | null>(null);
  const [qaNotes,             setQaNotes]            = useState("");
  const [showPreview,         setShowPreview]        = useState(false);

  const allTokens  = [...detectedTokens, ...annotation.manualRedactions];
  const toggleRed  = (id: string) => setActiveRedactionIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const applyAI    = () => setActiveRedactionIds(p => { const n = new Set(p); aiSuggestedIds.forEach(id => n.add(id)); return n; });
  const keepHuman  = () => setActiveRedactionIds(new Set(annotation.redactedIds));

  const finalRedactions: Redaction[] = allTokens.map(t => ({ ...t, active: activeRedactionIds.has(t.id) }));
  const previewBio = applyRedactions(profile.bio_text, finalRedactions);

  return (
    <div className="space-y-4">
      <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-indigo-600/30"
        style={{ background: "rgba(79,70,229,0.12)" }}>
        <Shield size={24} className="text-indigo-400 flex-shrink-0" />
        <div>
          <div className={`text-base font-bold ${isLight ? "text-indigo-700" : "text-indigo-300"}`}>Human QA Review — TP</div>
          <div className={`text-sm ${isLight ? "text-indigo-600" : "text-indigo-400/80"}`}>You are a senior QA reviewer. Review both decisions and make the final call.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border-2 border-white/10 p-4" style={{ background: "var(--s4)" }}>
          <p className="text-sm font-bold text-foreground/35 uppercase tracking-wider mb-3">👤 Annotator Result</p>
          <div className={`text-base font-black mb-2 ${annotation.profileLabel === "genuine" ? "text-emerald-400" : annotation.profileLabel === "impersonation" ? "text-red-400" : "text-amber-400"}`}>
            {annotation.profileLabel === "genuine" ? "✓ Likely Genuine" : annotation.profileLabel === "impersonation" ? "✗ Likely Impersonation" : "? Unsure"}
          </div>
          <div className="text-sm text-foreground/50 space-y-1 mb-3">
            <div>Confidence: <strong className="text-foreground/70">{annotation.confidence}%</strong></div>
            <div>Categories: <strong className="text-foreground/70">{[...annotation.selectedCategories].map(id => POLICY_CATEGORIES.find(c => c.id === id)?.label).filter(Boolean).join(", ") || "—"}</strong></div>
            {annotation.notes && <div className="italic text-foreground/40">"{annotation.notes}"</div>}
          </div>
          <p className="text-sm font-semibold text-foreground/35 mb-2">Redaction toggles:</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {allTokens.map(tok => (
              <label key={tok.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={activeRedactionIds.has(tok.id)} onChange={() => toggleRed(tok.id)}
                  className="accent-violet-600 w-3 h-3 flex-shrink-0" />
                <span className={`text-sm font-mono flex-1 ${activeRedactionIds.has(tok.id) ? "line-through text-red-400" : "text-foreground/60"}`}>
                  {tok.original.slice(0, 22)}{tok.original.length > 22 ? "…" : ""}
                </span>
                <span className="text-xs px-1.5 rounded-full border"
                  style={{ color: PII_COL[tok.type]?.text ?? "#fff", borderColor: PII_COL[tok.type]?.border ?? "white", background: PII_COL[tok.type]?.bg ?? "transparent" }}>
                  {tok.type}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-3 pt-3 border-t border-white/8">
            <button onClick={applyAI} className="flex-1 px-2 py-2 rounded-lg border border-amber-700/50 text-amber-400 text-sm font-semibold hover:bg-amber-950/30 transition">Apply AI redactions</button>
            <button onClick={keepHuman} className="flex-1 px-2 py-2 rounded-lg border border-violet-700/50 text-violet-400 text-sm font-semibold hover:bg-violet-950/30 transition">Keep annotator</button>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-white/10 p-4" style={{ background: "var(--s4)" }}>
          <p className="text-sm font-bold text-foreground/35 uppercase tracking-wider mb-3">🤖 AI Result</p>
          <div className={`text-base font-black mb-1 ${isLight ? "text-amber-600" : "text-amber-400"}`}>⚠ {ai.recommendation}</div>
          <div className="text-sm text-foreground/50 space-y-1 mb-3">
            <div>Confidence: <strong className="text-foreground/70">{ai.confidence}%</strong></div>
            <div>Categories: <strong className="text-foreground/70">{ai.predictedCategories.map(id => POLICY_CATEGORIES.find(c => c.id === id)?.label).filter(Boolean).join(", ")}</strong></div>
          </div>
          <p className="text-sm font-semibold text-foreground/35 mb-2">AI suggested redactions:</p>
          <div className="space-y-1.5">
            {detectedTokens.filter(t => ai.suggestedRedactionTypes.includes(t.type)).map(tok => (
              <div key={tok.id} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-sm font-mono text-foreground/60 flex-1">{tok.original.slice(0, 22)}{tok.original.length > 22 ? "…" : ""}</span>
                <span className="text-xs text-amber-400/70">{tok.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-base font-semibold text-foreground">Redacted Bio Preview</p>
          <button onClick={() => setShowPreview(v => !v)} className="flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground/70 transition">
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}{showPreview ? "Hide" : "Show"}
          </button>
        </div>
        {showPreview && (
          <p className="text-sm font-mono leading-relaxed text-foreground/70 p-3 rounded-lg border border-white/8" style={{ background: "var(--s2)" }}>
            {previewBio}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 p-5" style={{ background: "var(--s4)" }}>
        <p className="text-base font-bold text-foreground mb-4">Final QA Decision</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {([
            { val: "approve"  as FinalLabel, icon: "✓", label: "Approve",  sub: "Profile passes review", idle: "border-emerald-700/50 text-emerald-400",  idleBg: "rgba(5,150,105,0.12)",  act: "border-emerald-500 bg-emerald-500 text-white" },
            { val: "reject"   as FinalLabel, icon: "✕", label: "Reject",   sub: "Remove from platform",  idle: "border-red-700/50 text-red-400",           idleBg: "rgba(220,38,38,0.12)", act: "border-red-500 bg-red-500 text-white" },
            { val: "escalate" as FinalLabel, icon: "⚠", label: "Escalate", sub: "Senior review required",idle: "border-amber-700/50 text-amber-400",       idleBg: "rgba(217,119,6,0.12)", act: "border-amber-500 bg-amber-500 text-white" },
          ] as const).map(o => (
            <button key={o.val} onClick={() => setFinalLabel(o.val)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${finalLabel === o.val ? o.act : o.idle}`}
              style={finalLabel !== o.val ? { background: o.idleBg } : {}}>
              <div className="text-xl mb-1">{o.icon}</div>
              <div className="text-base font-bold">{o.label}</div>
              <div className="text-sm opacity-70 mt-0.5">{o.sub}</div>
            </button>
          ))}
        </div>

        <p className="text-sm font-semibold text-foreground/50 mb-2">QA Reason (select if overriding AI):</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {QA_REASONS.map(r => (
            <button key={r.id} onClick={() => setQaReason(qaReason === r.id ? null : r.id)}
              className={`px-3 py-2 rounded-full border text-sm font-semibold transition-all ${
                qaReason === r.id ? "bg-violet-600 border-violet-600 text-white" : "border-border text-foreground/70 hover:border-violet-500"
              }`}>
              {r.label}
            </button>
          ))}
        </div>

        <textarea placeholder="QA notes (optional)…" value={qaNotes} onChange={e => setQaNotes(e.target.value)} rows={2}
          className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground/70 placeholder:text-foreground/25 focus:outline-none focus:border-violet-500/50 resize-none mb-4" />

        <Button disabled={!finalLabel}
          onClick={() => finalLabel && onSubmit({ finalLabel, activeRedactionIds, qaReason, qaNotes })}
          className="w-full h-12 text-base font-semibold bg-violet-600 hover:bg-violet-700">
          Finalize QA →
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4 · Delivery ────────────────────────────────────────────────────────

function Step4({ profile, annotation, qa, detectedTokens, onReset }: {
  profile:        MockProfile;
  annotation:     AnnotationState;
  qa:             QAState;
  detectedTokens: PiiToken[];
  onReset:        () => void;
}) {
  const navigate = useNavigate();
  const [showJson, setShowJson] = useState(false);

  const allTokens       = [...detectedTokens, ...annotation.manualRedactions];
  const finalRedactions: Redaction[] = allTokens.map(t => ({ ...t, active: qa.activeRedactionIds.has(t.id) }));
  const finalBio        = applyRedactions(profile.bio_text, finalRedactions);
  const activeList      = allTokens.filter(t => qa.activeRedactionIds.has(t.id));

  const appliedCategories = [
    ...annotation.selectedCategories,
    ...profile.ai_result.predictedCategories,
  ].filter((v, i, a) => a.indexOf(v) === i);

  const now = new Date();
  const ts  = (off: number) => new Date(now.getTime() - off * 1000).toISOString();

  const packet = {
    profile_id:        profile.profile_id,
    final_decision:    qa.finalLabel,
    final_categories:  appliedCategories.map(id => POLICY_CATEGORIES.find(c => c.id === id)?.label ?? id),
    confidence:        Math.round((annotation.confidence + profile.ai_result.confidence) / 2),
    redactions:        activeList.map(r => ({ type: r.type, original_preview: r.original.slice(0, 12) + (r.original.length > 12 ? "…" : ""), replacement: "[REDACTED]" })),
    audit_trail: [
      { actor: "Annotator",   action: `Labelled: ${annotation.profileLabel}`,                                                    ts: ts(180) },
      { actor: "AI Model",    action: `Recommended: ${profile.ai_result.recommendation} (${profile.ai_result.confidence}%)`,    ts: ts(90)  },
      { actor: "QA Reviewer", action: `Final: ${qa.finalLabel}${qa.qaReason ? ` · ${qa.qaReason}` : ""}`,                       ts: ts(0)   },
    ],
  };

  const cfg = {
    approve:  { icon: "✅", label: "Approved",  ring: "border-emerald-700/50", head: "text-emerald-400", bg: "rgba(5,150,105,0.10)"  },
    reject:   { icon: "🚫", label: "Rejected",  ring: "border-red-700/50",     head: "text-red-400",     bg: "rgba(220,38,38,0.10)"  },
    escalate: { icon: "⚠️", label: "Escalated", ring: "border-amber-700/50",   head: "text-amber-400",   bg: "rgba(217,119,6,0.10)"  },
  }[qa.finalLabel ?? "escalate"];

  const kpis = [
    { icon: <Shield size={18} className="text-violet-400" />,     label: "Sensitive info removed", value: `${activeList.length}`,                  sub: "tokens redacted",           bg: "rgba(109,40,217,0.20)" },
    { icon: <AlertTriangle size={18} className="text-amber-400"/>, label: "Escalations triggered", value: qa.finalLabel === "escalate" ? "1" : "0", sub: "senior review queued",      bg: "rgba(217,119,6,0.20)"  },
    { icon: <Users size={18} className="text-blue-400" />,         label: "QA overrides",          value: qa.qaReason ? "1" : "0",                  sub: qa.qaReason ? QA_REASONS.find(r => r.id === qa.qaReason)?.label ?? "" : "none", bg: "rgba(37,99,235,0.20)" },
    { icon: <Zap size={18} className="text-emerald-400" />,        label: "Time to decision",       value: "~3 min",                                 sub: "annotation → AI → QA",      bg: "rgba(5,150,105,0.20)"  },
  ];

  return (
    <div className="flex flex-col gap-5 items-center max-w-2xl mx-auto w-full">
      <div className="inline-flex items-center gap-2 text-white text-sm font-bold px-4 py-1.5 rounded-full" style={{ background: "var(--s8)" }}>
        📬 Step 4: Final Decision Delivered
      </div>

      <div className={`w-full rounded-2xl border-2 p-6 text-center ${cfg.ring}`} style={{ background: cfg.bg }}>
        <div className="text-5xl mb-3">{cfg.icon}</div>
        <div className={`text-2xl font-black mb-2 ${cfg.head}`}>Profile {cfg.label}</div>
        <p className="text-base text-foreground/60">Final decision: <strong className="text-foreground/80">{qa.finalLabel}</strong></p>
        {qa.qaNotes && <p className="text-sm text-foreground/40 mt-2 italic">"{qa.qaNotes}"</p>}
      </div>

      <div className="w-full rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
        <p className="text-base font-semibold text-foreground mb-2">Final Redacted Bio</p>
        <p className="text-sm font-mono leading-relaxed text-foreground/70 p-3 rounded-lg border border-white/8" style={{ background: "var(--s2)" }}>
          {finalBio}
        </p>
      </div>

      <div className="w-full rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
        <p className="text-base font-semibold text-foreground mb-2">Policy Categories Applied</p>
        <div className="flex flex-wrap gap-2">
          {appliedCategories.map(id => {
            const cat = POLICY_CATEGORIES.find(c => c.id === id);
            return cat ? (
              <span key={id} className="px-3 py-1 rounded-full border border-violet-600/40 text-violet-300 text-sm font-semibold"
                style={{ background: "rgba(109,40,217,0.18)" }}>
                {cat.label}
              </span>
            ) : null;
          })}
        </div>
      </div>

      <div className="w-full rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-semibold text-foreground flex items-center gap-2"><FileText size={15} /> Decision Packet</p>
          <button onClick={() => setShowJson(v => !v)}
            className="flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground/70 transition">
            {showJson ? <EyeOff size={13} /> : <Eye size={13} />}{showJson ? "Hide JSON" : "View JSON"}
          </button>
        </div>
        {showJson && (
          <pre className="text-sm font-mono text-emerald-300/80 p-3 rounded-xl overflow-x-auto border border-white/8"
            style={{ background: "rgba(0,0,0,0.4)" }}>
            {JSON.stringify(packet, null, 2)}
          </pre>
        )}
      </div>

      <div className="w-full">
        <p className="text-sm font-bold text-foreground/35 uppercase tracking-wider mb-3 text-center">Demo Metrics <span className="normal-case font-normal">(simulated)</span></p>
        <div className="grid grid-cols-2 gap-3">
          {kpis.map((kpi, i) => (
            <div key={i} className="rounded-xl border border-border p-4" style={{ background: "var(--s4)" }}>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-2" style={{ background: kpi.bg }}>
                {kpi.icon}
              </div>
              <div className="text-2xl font-black text-foreground">{kpi.value}</div>
              <div className="text-sm font-semibold text-foreground/75">{kpi.label}</div>
              <div className="text-sm text-foreground/40 mt-0.5">{kpi.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 w-full">
        <Button variant="outline" onClick={onReset} className="flex-1 gap-2 h-12 border-white/15 text-foreground/80 hover:bg-white/5">
          <RotateCcw size={15} /> Try Another Profile
        </Button>
        <Button onClick={() => navigate("/use-cases")} className="flex-1 bg-violet-600 hover:bg-violet-700 gap-2 h-12">
          <ArrowLeft size={15} /> Back to DataStudio
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImpersonationRedaction() {
  const navigate = useNavigate();

  const [selectedProfileIdx, setSelectedProfileIdx] = useState(0);
  const [stage,      setStage]      = useState<Stage>(1);
  const [annotation, setAnnotation] = useState<AnnotationState | null>(null);
  const [qa,         setQa]         = useState<QAState | null>(null);

  const profile        = PROFILES[selectedProfileIdx];
  const detectedTokens = useMemo(() => detectPII(profile.bio_text), [selectedProfileIdx]);

  const reset = () => { setStage(1); setAnnotation(null); setQa(null); };

  const handleProfileChange = (idx: number) => {
    setSelectedProfileIdx(idx);
    setStage(1);
    setAnnotation(null);
    setQa(null);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--s0)" }}>
      <header className="dark-surface sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-white/10">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-white/10 rounded-full transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
            <span onClick={() => navigate("/use-cases")}
              className="text-sm font-bold tracking-wide text-white cursor-pointer hover:text-white/80 transition-colors font-headline shrink-0">
              TP.ai <span style={{ color: "#9071f0" }}>Data</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-white/40 shrink-0" />
            <span className="text-sm text-white/70 whitespace-nowrap">Digital Identity Protection</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button onClick={reset}
              className="flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground/80 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 transition">
              <RefreshCw size={13} /> Reset Demo
            </button>
            <ShieldAlert size={15} className="text-violet-400" />
            <span className="text-sm bg-violet-600/20 text-violet-300 border border-violet-600/30 px-3 py-1 rounded-full font-semibold">
              Content Moderation · Live Demo
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-black text-white">
            Digital Identity Protection <span className="text-violet-400">& Policy Enforcement</span>
          </h1>
          <p className="text-sm text-foreground/50 mt-1 max-w-xl mx-auto">
            Profile labeling, content monitoring, and redaction of sensitive info + policy violations.
          </p>
        </div>

        <ProgressStepper stage={stage} />

        <div className="mt-2">
          {stage === 1 && (
            <Step1
              profile={profile}
              detectedTokens={detectedTokens}
              selectedProfileIdx={selectedProfileIdx}
              onProfileChange={handleProfileChange}
              onSubmit={a => { setAnnotation(a); setStage(2); }}
            />
          )}
          {stage === 2 && annotation && (
            <Step2
              profile={profile}
              annotation={annotation}
              detectedTokens={detectedTokens}
              onComplete={() => setStage(3)}
            />
          )}
          {stage === 3 && annotation && (
            <Step3
              profile={profile}
              annotation={annotation}
              detectedTokens={detectedTokens}
              onSubmit={q => { setQa(q); setStage(4); }}
            />
          )}
          {stage === 4 && annotation && qa && (
            <Step4
              profile={profile}
              annotation={annotation}
              qa={qa}
              detectedTokens={detectedTokens}
              onReset={reset}
            />
          )}
        </div>
      </div>
    </div>
  );
}
