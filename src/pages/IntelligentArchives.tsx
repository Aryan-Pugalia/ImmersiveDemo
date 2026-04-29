/**
 * IntelligentArchives.tsx — Intelligent Document Archives
 * Landing page with 3 sub-use-cases, each with a 4-stage pipeline:
 *   Annotate → AI Verify → QA Review → Delivered
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, FileText, ScanLine, Shield,
  Check, RotateCcw, CheckCircle2, XCircle, AlertTriangle,
  Activity, Search, Users, Database, Building2, Layers,
  RefreshCw, ChevronDown, Eye, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";

// ─── Palette ──────────────────────────────────────────────────────────────────
const ACCENT      = "#C8102E";
const ACCENT_SOFT = "rgba(200,16,46,0.10)";
const ACCENT_MID  = "rgba(200,16,46,0.20)";

const SUB_COLOR = {
  classification: "#3b82f6",
  extraction:     "#10b981",
  redaction:      "#f59e0b",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type SubCase = "classification" | "extraction" | "redaction";
type Stage   = 1 | 2 | 3 | 4;

// ─── Static data ──────────────────────────────────────────────────────────────
const SUB_CASES = [
  {
    id: "classification" as SubCase,
    title: "Document Classification & Indexing",
    description: "Annotators assign document type, department, priority, and retention class. AI verifies each label with confidence scores. QA approves before structured indexing.",
    icon: FileText,
    tag: "Indexing",
  },
  {
    id: "extraction" as SubCase,
    title: "Key Field Extraction",
    description: "Annotators highlight and label key fields — dates, parties, amounts, references — from contracts and records. AI validates boundaries. QA approves for structured output.",
    icon: ScanLine,
    tag: "Extraction",
  },
  {
    id: "redaction" as SubCase,
    title: "PII & Compliance Redaction",
    description: "Annotators mark personally identifiable information and sensitive content. AI scans for missed items. QA confirms coverage before secure delivery.",
    icon: Shield,
    tag: "Compliance",
  },
];

const OTHER_USE_CASES = [
  { title: "Contract Risk Flagging",        desc: "Flag high-risk clauses in contracts for legal review",                 Icon: AlertTriangle },
  { title: "Medical Records Digitization",  desc: "Structure unformatted patient records into EHR-ready data",            Icon: Activity      },
  { title: "Legal Discovery Support",       desc: "Tag and classify documents for litigation relevance",                   Icon: Search        },
  { title: "HR Onboarding Documents",       desc: "Extract and verify employee data from onboarding packs",               Icon: Users         },
  { title: "Financial Audit Trail",         desc: "Index and classify financial records for regulatory compliance",        Icon: Database      },
  { title: "Real Estate Document Review",   desc: "Extract property details, parties, and dates from deeds",              Icon: Building2     },
  { title: "Regulatory Filing Indexing",    desc: "Classify and route regulatory submissions to correct teams",           Icon: Layers        },
  { title: "Insurance Claims Processing",   desc: "Label claim types, coverage codes, and damage assessments at scale",   Icon: Shield        },
];

const STEP_LABELS = ["Annotate", "AI Verify", "QA Review", "Delivered"] as const;

// ─── Shared: Progress Stepper ─────────────────────────────────────────────────
function ProgressStepper({ stage, color }: { stage: Stage; color: string }) {
  return (
    <div className="flex items-center justify-center py-5">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Stage;
        const done = stage > n, current = stage === n;
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all"
                style={{
                  background: done ? color : current ? `${color}20` : "var(--s4)",
                  borderColor: done || current ? color : "rgba(255,255,255,0.1)",
                  color: done ? "#fff" : current ? color : "rgba(255,255,255,0.3)",
                }}>
                {done ? <Check size={16} /> : n}
              </div>
              <span className="mt-1 text-xs font-semibold whitespace-nowrap"
                style={{ color: current ? color : done ? "var(--foreground)" : "rgba(255,255,255,0.3)" }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className="w-14 h-0.5 mx-1 mb-5 transition-all"
                style={{ background: stage > n ? color : "rgba(255,255,255,0.1)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared: Stage layout shell ───────────────────────────────────────────────
function StageShell({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex gap-5 items-start">
      <div className="flex-1 min-w-0">{left}</div>
      <div className="w-72 flex-shrink-0 space-y-4">{right}</div>
    </div>
  );
}

// ─── Mock Document components ─────────────────────────────────────────────────

function DocShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ background: "var(--s2)" }}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border" style={{ background: "var(--s4)" }}>
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        <span className="ml-2 text-xs text-foreground/40 font-mono">{title}</span>
      </div>
      <div className="p-5 text-sm font-mono leading-relaxed overflow-y-auto max-h-[380px]">
        {children}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SUB-USE-CASE 1 — Document Classification
// ════════════════════════════════════════════════════════════════════════════════

const DOC_TYPES   = ["Contract", "Invoice", "Report", "Memo", "Legal Filing", "HR Record"];
const DEPARTMENTS = ["Legal", "Finance", "HR", "Operations", "Compliance", "IT"];
const PRIORITIES  = ["High", "Medium", "Low"];
const YEARS       = ["2024", "2023", "2022", "2021", "2020"];

interface ClassificationState { docType: string; department: string; priority: string; year: string; }
const BLANK_CLASS: ClassificationState = { docType: "", department: "", priority: "", year: "" };

const AI_CLASS = { docType: "Contract", department: "Legal", priority: "High", year: "2024" };
const AI_CONF  = { docType: 97, department: 94, priority: 61, year: 99 }; // priority is uncertain

function ClassificationFlow({ stage, onNext, onBack }: { stage: Stage; onNext: () => void; onBack: () => void }) {
  const [ann, setAnn]   = useState<ClassificationState>(BLANK_CLASS);
  const [qaChoice, setQaChoice] = useState<"approve" | "override" | null>(null);
  const [override, setOverride] = useState<Partial<ClassificationState>>({});
  const color = SUB_COLOR.classification;
  const complete = Object.values(ann).every(v => v !== "");

  const final = { ...AI_CLASS, ...ann, ...(qaChoice === "override" ? override : {}) };

  // ── Doc ──
  const doc = (
    <DocShell title="MEMO_Q1_2024_Archive.pdf">
      <div className="text-foreground/80">
        <p className="font-bold text-foreground mb-3 text-base font-sans">MEMORANDUM</p>
        <p><span className="text-foreground/40">To:</span>      Operations Director</p>
        <p><span className="text-foreground/40">From:</span>    Records Management</p>
        <p><span className="text-foreground/40">Date:</span>    March 15, 2024</p>
        <p><span className="text-foreground/40">Ref:</span>     SA-2024-0847</p>
        <p className="mt-3"><span className="text-foreground/40">Re:</span> Q1 Archive Consolidation &amp; Retention Review</p>
        <div className="mt-4 text-foreground/60 font-sans space-y-2 text-xs leading-5">
          <p>This memorandum outlines the records consolidation plan for Q1 2024 in accordance with the company's Document Retention Policy (DRP-2022). All physical and digital records identified below require classification and indexing prior to transfer to the central archive.</p>
          <p>Departments affected: Legal, Finance, and Compliance. Estimated volume: 4,200 documents across 18 record categories. Priority escalation applies to contracts with residual obligations beyond December 2024.</p>
          <p>Please review attached schedules and confirm classification assignments by March 22, 2024.</p>
        </div>
        <p className="mt-4 text-foreground/40 text-xs">— Records Management Office · Confidential</p>
      </div>
    </DocShell>
  );

  // ── Stage 1: Annotate ──
  if (stage === 1) {
    const field = (label: string, key: keyof ClassificationState, opts: string[]) => (
      <div>
        <label className="text-xs font-bold text-foreground/40 uppercase tracking-wider block mb-1">{label}</label>
        <div className="relative">
          <select value={ann[key]} onChange={e => setAnn(p => ({ ...p, [key]: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border text-sm font-semibold appearance-none cursor-pointer"
            style={{ background: "var(--s4)", borderColor: ann[key] ? `${color}60` : "var(--border)", color: ann[key] ? color : "var(--foreground)", outline: "none" }}>
            <option value="">Select…</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none" />
        </div>
      </div>
    );
    return (
      <StageShell left={doc} right={<>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border" style={{ background: `${color}18`, borderColor: `${color}40` }}>
          <FileText size={20} style={{ color }} className="flex-shrink-0" />
          <div>
            <div className="text-sm font-bold" style={{ color }}>Document Classification</div>
            <div className="text-xs opacity-70" style={{ color }}>Assign labels to this document</div>
          </div>
        </div>
        <div className="rounded-2xl border border-border p-4 space-y-3" style={{ background: "var(--s4)" }}>
          {field("Document Type", "docType", DOC_TYPES)}
          {field("Department", "department", DEPARTMENTS)}
          {field("Priority", "priority", PRIORITIES)}
          {field("Year", "year", YEARS)}
        </div>
        <Button disabled={!complete} onClick={onNext}
          className="w-full h-11 font-semibold disabled:opacity-40"
          style={{ background: complete ? color : undefined }}>
          Submit for AI Verification →
        </Button>
        {!complete && <p className="text-xs text-center text-foreground/35">Complete all fields to continue</p>}
      </>} />
    );
  }

  // ── Stage 2: AI Verify ──
  if (stage === 2) {
    const rows: { label: string; annotator: string; ai: string; conf: number }[] = [
      { label: "Document Type", annotator: ann.docType,    ai: AI_CLASS.docType,    conf: AI_CONF.docType    },
      { label: "Department",    annotator: ann.department, ai: AI_CLASS.department, conf: AI_CONF.department },
      { label: "Priority",      annotator: ann.priority,   ai: AI_CLASS.priority,   conf: AI_CONF.priority   },
      { label: "Year",          annotator: ann.year,       ai: AI_CLASS.year,       conf: AI_CONF.year       },
    ];
    return (
      <StageShell left={doc} right={<>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-blue-600/30" style={{ background: "rgba(37,99,235,0.12)" }}>
          <Eye size={20} className="text-blue-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-blue-300">AI Verification</div>
            <div className="text-xs text-blue-400/70">Confidence scores per field</div>
          </div>
        </div>
        <div className="rounded-2xl border border-border p-4 space-y-3" style={{ background: "var(--s4)" }}>
          {rows.map(r => {
            const match = r.annotator === r.ai;
            const low   = r.conf < 70;
            return (
              <div key={r.label} className="p-2.5 rounded-xl border" style={{ borderColor: low ? "#f59e0b40" : match ? "#22c55e30" : "#ef444430", background: low ? "rgba(245,158,11,0.06)" : match ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-foreground/50">{r.label}</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: low ? "#f59e0b20" : "#22c55e20", color: low ? "#f59e0b" : "#22c55e" }}>
                    {r.conf}% conf
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-foreground/40">You:</span>
                  <span className="font-semibold text-foreground/80">{r.annotator}</span>
                  <span className="text-foreground/40 mx-1">·</span>
                  <span className="text-foreground/40">AI:</span>
                  <span className="font-semibold" style={{ color: match ? "#22c55e" : "#f59e0b" }}>{r.ai}</span>
                  {low && <AlertTriangle size={11} className="text-amber-400 ml-auto" />}
                </div>
                {low && <p className="text-xs text-amber-400/70 mt-1">Low confidence — flagged for QA review</p>}
              </div>
            );
          })}
        </div>
        <Button onClick={onNext} className="w-full h-11 font-semibold" style={{ background: color }}>
          Send to QA Review →
        </Button>
      </>} />
    );
  }

  // ── Stage 3: QA Review ──
  if (stage === 3) {
    return (
      <StageShell left={doc} right={<>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-indigo-600/30" style={{ background: "rgba(79,70,229,0.12)" }}>
          <CheckCircle2 size={20} className="text-indigo-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-indigo-300">QA Review</div>
            <div className="text-xs text-indigo-400/70">Approve or override the classification</div>
          </div>
        </div>
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-3">Proposed Classification</p>
          {[
            { label: "Type",       value: ann.docType    },
            { label: "Dept",       value: ann.department },
            { label: "Priority",   value: ann.priority, warn: ann.priority !== AI_CLASS.priority },
            { label: "Year",       value: ann.year       },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
              <span className="text-xs text-foreground/40">{r.label}</span>
              <div className="flex items-center gap-1.5">
                {r.warn && <AlertTriangle size={11} className="text-amber-400" />}
                <span className="text-sm font-semibold text-foreground/80">{r.value}</span>
              </div>
            </div>
          ))}
          <p className="text-xs text-amber-400/70 mt-3">⚠ Priority confidence was 61% — review recommended</p>
        </div>
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-3">QA Decision</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setQaChoice("approve")}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition"
              style={{ borderColor: qaChoice === "approve" ? "#22c55e" : "#22c55e40", background: qaChoice === "approve" ? "rgba(34,197,94,0.15)" : "transparent", color: "#22c55e" }}>
              <CheckCircle2 size={15} /> Approve
            </button>
            <button onClick={() => setQaChoice("override")}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition"
              style={{ borderColor: qaChoice === "override" ? "#f59e0b" : "#f59e0b40", background: qaChoice === "override" ? "rgba(245,158,11,0.15)" : "transparent", color: "#f59e0b" }}>
              <XCircle size={15} /> Override
            </button>
          </div>
          {qaChoice === "override" && (
            <div className="mt-3">
              <label className="text-xs text-foreground/40 block mb-1">Override Priority</label>
              <div className="relative">
                <select value={override.priority ?? ""} onChange={e => setOverride(p => ({ ...p, priority: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm font-semibold appearance-none"
                  style={{ background: "var(--s6)", borderColor: "#f59e0b60", color: "#f59e0b", outline: "none" }}>
                  <option value="">Select…</option>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none" />
              </div>
            </div>
          )}
        </div>
        <Button disabled={!qaChoice || (qaChoice === "override" && !override.priority)} onClick={onNext}
          className="w-full h-11 font-semibold disabled:opacity-40"
          style={{ background: qaChoice ? color : undefined }}>
          Approve &amp; Deliver →
        </Button>
      </>} />
    );
  }

  // ── Stage 4: Delivered ──
  return <DeliveredView color={color} onBack={onBack} onReset={() => { setAnn(BLANK_CLASS); setQaChoice(null); setOverride({}); onBack(); }}>
    <div className="rounded-xl border border-border p-4 font-mono text-xs space-y-1.5" style={{ background: "var(--s2)" }}>
      {[
        ["document_id",    "DOC-2024-004821"         ],
        ["type",           final.docType              ],
        ["department",     final.department           ],
        ["priority",       final.priority             ],
        ["year",           final.year                 ],
        ["qa_status",      qaChoice === "override" ? "OVERRIDDEN" : "APPROVED"],
        ["indexed_at",     new Date().toISOString().split("T")[0]],
        ["retention_yrs",  "7"                        ],
      ].map(([k, v]) => (
        <div key={k} className="flex gap-3">
          <span className="text-foreground/40 w-24 flex-shrink-0">{k}</span>
          <span className="text-emerald-400 font-bold">"{v}"</span>
        </div>
      ))}
    </div>
  </DeliveredView>;
}

// ════════════════════════════════════════════════════════════════════════════════
// SUB-USE-CASE 2 — Key Field Extraction
// ════════════════════════════════════════════════════════════════════════════════

const FIELD_TYPES = ["Date", "Party Name", "Amount", "Reference No.", "Jurisdiction", "Expiry Date"];

const EXTRACTABLE_FIELDS = [
  { id: "ref",    label: "SA-2024-0847",          type: "Reference No.", hint: "Agreement reference" },
  { id: "date",   label: "January 12, 2024",      type: "Date",          hint: "Execution date"       },
  { id: "party1", label: "Meridian Holdings Ltd", type: "Party Name",    hint: "Client entity"        },
  { id: "party2", label: "DataCore Solutions Inc",type: "Party Name",    hint: "Service provider"     },
  { id: "value",  label: "$284,500.00",            type: "Amount",        hint: "Contract value"       },
  { id: "expiry", label: "January 12, 2026",      type: "Expiry Date",   hint: "Contract expiry"      },
  { id: "juris",  label: "State of Delaware",     type: "Jurisdiction",  hint: "Governing law"        },
] as const;

type FieldId = typeof EXTRACTABLE_FIELDS[number]["id"];

const AI_SUGGESTED: FieldId[] = ["juris"]; // AI finds one the annotator might miss

function ExtractionFlow({ stage, onNext, onBack }: { stage: Stage; onNext: () => void; onBack: () => void }) {
  const [labeled, setLabeled]   = useState<Map<FieldId, string>>(new Map());
  const [selected, setSelected] = useState<FieldId | null>(null);
  const [fieldType, setFieldType] = useState("");
  const [qaApproved, setQaApproved] = useState<Set<FieldId>>(new Set());
  const color = SUB_COLOR.extraction;

  const assign = () => {
    if (!selected || !fieldType) return;
    setLabeled(m => new Map(m).set(selected, fieldType));
    setSelected(null); setFieldType("");
  };

  const doc = (highlight: boolean, extraIds: FieldId[] = []) => {
    const allLabeled = new Set([...labeled.keys(), ...(highlight ? extraIds : [])]);
    const span = (f: typeof EXTRACTABLE_FIELDS[number]) => {
      const isLabeled  = labeled.has(f.id);
      const isExtra    = highlight && extraIds.includes(f.id) && !isLabeled;
      const isSelected = selected === f.id;
      const col = isExtra ? "#f59e0b" : color;
      return (
        <span key={f.id}
          onClick={() => stage === 1 ? setSelected(f.id) : undefined}
          className={`rounded px-0.5 transition-all ${stage === 1 ? "cursor-pointer hover:opacity-80" : ""}`}
          style={{
            background: isSelected ? `${color}35` : isLabeled || isExtra ? `${col}22` : "transparent",
            color: isSelected ? color : isLabeled || isExtra ? col : "inherit",
            fontWeight: isLabeled || isExtra || isSelected ? 700 : 400,
            outline: isSelected ? `2px solid ${color}` : "none",
            outlineOffset: 2,
          }}
          title={f.hint}>
          {f.label}
        </span>
      );
    };

    const f = Object.fromEntries(EXTRACTABLE_FIELDS.map(x => [x.id, span(x)]));

    return (
      <DocShell title="SERVICE_AGREEMENT_SA-2024-0847.pdf">
        <div className="text-foreground/80 font-sans text-xs leading-6 space-y-2">
          <p className="font-bold text-base text-foreground mb-3">SERVICE AGREEMENT</p>
          <p>Agreement No: {f.ref}</p>
          <p>Date of Execution: {f.date}</p>
          <p className="mt-2">This Service Agreement is entered into between {f.party1} (&ldquo;Client&rdquo;) and {f.party2} (&ldquo;Service Provider&rdquo;), incorporated under the laws of the {f.juris}.</p>
          <p className="mt-2">Contract Value: {f.value}<br />Term: 24 months from execution date<br />Expiry: {f.expiry}</p>
          <p className="mt-2 text-foreground/50">The parties agree to the terms and conditions set forth in Schedule A attached hereto. This agreement shall be governed by applicable law and subject to binding arbitration.</p>
          {stage === 1 && <p className="text-foreground/30 italic mt-3 text-xs">Click highlighted terms to label them →</p>}
        </div>
      </DocShell>
    );
  };

  // ── Stage 1 ──
  if (stage === 1) {
    return (
      <StageShell left={doc(false)} right={<>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border" style={{ background: `${color}18`, borderColor: `${color}40` }}>
          <ScanLine size={20} style={{ color }} className="flex-shrink-0" />
          <div>
            <div className="text-sm font-bold" style={{ color }}>Field Extraction</div>
            <div className="text-xs opacity-70" style={{ color }}>Click a value in the document to label it</div>
          </div>
        </div>
        {selected && (
          <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: `${color}50`, background: `${color}0d` }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>Label Selected Field</p>
            <p className="text-sm font-mono font-bold text-foreground/80 px-2 py-1.5 rounded" style={{ background: `${color}15` }}>
              {EXTRACTABLE_FIELDS.find(f => f.id === selected)?.label}
            </p>
            <div className="relative">
              <select value={fieldType} onChange={e => setFieldType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm font-semibold appearance-none"
                style={{ background: "var(--s4)", borderColor: `${color}60`, color: fieldType ? color : "var(--foreground)", outline: "none" }}>
                <option value="">Select field type…</option>
                {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none" />
            </div>
            <button onClick={assign} disabled={!fieldType}
              className="w-full py-1.5 rounded-lg text-sm font-bold transition disabled:opacity-40"
              style={{ background: `${color}25`, color }}>
              Assign Label ✓
            </button>
          </div>
        )}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-2">Labelled Fields ({labeled.size})</p>
          {labeled.size === 0
            ? <p className="text-xs text-foreground/30 italic">No fields labelled yet</p>
            : <div className="space-y-1.5">
                {[...labeled.entries()].map(([id, type]) => {
                  const f = EXTRACTABLE_FIELDS.find(x => x.id === id)!;
                  return (
                    <div key={id} className="flex items-center justify-between text-xs">
                      <span className="font-mono truncate text-foreground/60 max-w-[140px]">{f.label}</span>
                      <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>
                        {type}
                      </span>
                    </div>
                  );
                })}
              </div>
          }
        </div>
        <Button disabled={labeled.size < 3} onClick={onNext}
          className="w-full h-11 font-semibold disabled:opacity-40"
          style={{ background: labeled.size >= 3 ? color : undefined }}>
          Submit for AI Verification →
        </Button>
        {labeled.size < 3 && <p className="text-xs text-center text-foreground/35">Label at least 3 fields to continue</p>}
      </>} />
    );
  }

  // ── Stage 2 ──
  if (stage === 2) {
    const missed = EXTRACTABLE_FIELDS.filter(f => AI_SUGGESTED.includes(f.id as FieldId) && !labeled.has(f.id as FieldId));
    return (
      <StageShell left={doc(true, AI_SUGGESTED)} right={<>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-blue-600/30" style={{ background: "rgba(37,99,235,0.12)" }}>
          <Eye size={20} className="text-blue-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-blue-300">AI Field Validation</div>
            <div className="text-xs text-blue-400/70">{labeled.size} confirmed · {missed.length} suggested</div>
          </div>
        </div>
        {missed.length > 0 && (
          <div className="rounded-xl border border-amber-600/40 p-3" style={{ background: "rgba(245,158,11,0.08)" }}>
            <p className="text-xs font-bold text-amber-400 mb-2">⚡ AI found {missed.length} additional field{missed.length > 1 ? "s" : ""}</p>
            {missed.map(f => (
              <div key={f.id} className="text-xs text-amber-300/80">
                <span className="font-mono">{f.label}</span> → <span className="font-bold">{f.type}</span>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-3">Validated Fields</p>
          <div className="space-y-1.5">
            {EXTRACTABLE_FIELDS.map(f => {
              const userLabeled = labeled.has(f.id as FieldId);
              const aiSuggested = AI_SUGGESTED.includes(f.id as FieldId);
              if (!userLabeled && !aiSuggested) return null;
              return (
                <div key={f.id} className="flex items-center justify-between text-xs py-0.5">
                  <span className="font-mono truncate text-foreground/60 max-w-[130px]">{f.label}</span>
                  <div className="flex items-center gap-1">
                    {!userLabeled && aiSuggested && <span className="text-amber-400 text-xs">AI</span>}
                    {userLabeled && <span className="text-emerald-400 text-xs">✓</span>}
                    <span className="font-bold px-1.5 py-0.5 rounded text-xs"
                      style={{ background: `${color}20`, color }}>
                      {labeled.get(f.id as FieldId) ?? f.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Button onClick={onNext} className="w-full h-11 font-semibold" style={{ background: color }}>
          Send to QA Review →
        </Button>
      </>} />
    );
  }

  // ── Stage 3 ──
  if (stage === 3) {
    const allFields = [
      ...EXTRACTABLE_FIELDS.filter(f => labeled.has(f.id as FieldId)),
      ...EXTRACTABLE_FIELDS.filter(f => AI_SUGGESTED.includes(f.id as FieldId) && !labeled.has(f.id as FieldId)),
    ];
    return (
      <StageShell left={doc(true, AI_SUGGESTED)} right={<>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-indigo-600/30" style={{ background: "rgba(79,70,229,0.12)" }}>
          <CheckCircle2 size={20} className="text-indigo-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-indigo-300">QA Field Review</div>
            <div className="text-xs text-indigo-400/70">Approve or flag individual fields</div>
          </div>
        </div>
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-3">Field Map ({allFields.length})</p>
          <div className="space-y-2">
            {allFields.map(f => {
              const approved = qaApproved.has(f.id as FieldId);
              return (
                <div key={f.id} className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-foreground/60 truncate">{f.label}</div>
                    <div className="text-xs font-bold" style={{ color }}>{labeled.get(f.id as FieldId) ?? f.type}</div>
                  </div>
                  <button onClick={() => setQaApproved(s => { const ns = new Set(s); ns.has(f.id as FieldId) ? ns.delete(f.id as FieldId) : ns.add(f.id as FieldId); return ns; })}
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border transition"
                    style={{ borderColor: approved ? "#22c55e" : "var(--border)", background: approved ? "rgba(34,197,94,0.15)" : "transparent" }}>
                    {approved ? <Check size={13} className="text-emerald-400" /> : <span className="text-foreground/30 text-xs">?</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <Button disabled={qaApproved.size === 0} onClick={onNext}
          className="w-full h-11 font-semibold disabled:opacity-40"
          style={{ background: qaApproved.size > 0 ? color : undefined }}>
          Approve &amp; Deliver ({qaApproved.size}/{allFields.length}) →
        </Button>
      </>} />
    );
  }

  // ── Stage 4 ──
  const allExtracted = [
    ...EXTRACTABLE_FIELDS.filter(f => labeled.has(f.id as FieldId)),
    ...EXTRACTABLE_FIELDS.filter(f => AI_SUGGESTED.includes(f.id as FieldId) && !labeled.has(f.id as FieldId)),
  ];
  return <DeliveredView color={color} onBack={onBack} onReset={() => { setLabeled(new Map()); setSelected(null); setQaApproved(new Set()); onBack(); }}>
    <div className="rounded-xl border border-border overflow-hidden" style={{ background: "var(--s2)" }}>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border text-xs text-foreground/40 font-mono" style={{ background: "var(--s4)" }}>
        <span className="text-emerald-400">extracted_fields.json</span>
      </div>
      <div className="p-4 font-mono text-xs space-y-1">
        {allExtracted.map((f, i) => (
          <div key={f.id} className="flex gap-2">
            <span className="text-blue-400">"{labeled.get(f.id as FieldId) ?? f.type}"</span>
            <span className="text-foreground/30">:</span>
            <span className="text-amber-300">"{f.label}"</span>
            {i < allExtracted.length - 1 && <span className="text-foreground/30">,</span>}
          </div>
        ))}
      </div>
    </div>
  </DeliveredView>;
}

// ════════════════════════════════════════════════════════════════════════════════
// SUB-USE-CASE 3 — PII Redaction
// ════════════════════════════════════════════════════════════════════════════════

const PII_TYPES = ["Full Name", "Date of Birth", "SSN / ID No.", "Address", "Phone", "Email", "Account No."];

const PII_TOKENS: { id: string; text: string; piiType: string; space?: boolean }[] = [
  { id: "t1",  text: "EMPLOYEE RECORD",         piiType: "" },
  { id: "t2",  text: "— CONFIDENTIAL",          piiType: "" },
  { id: "t3",  text: "Full Name:",              piiType: "" },
  { id: "t4",  text: "James R. Mitchell",       piiType: "Full Name",    space: true },
  { id: "t5",  text: "Date of Birth:",          piiType: "" },
  { id: "t6",  text: "14 April 1982",           piiType: "Date of Birth", space: true },
  { id: "t7",  text: "Social Security:",        piiType: "" },
  { id: "t8",  text: "542-71-8834",             piiType: "SSN / ID No.", space: true },
  { id: "t9",  text: "Home Address:",           piiType: "" },
  { id: "t10", text: "47 Elmwood Drive, Austin, TX 78701", piiType: "Address", space: true },
  { id: "t11", text: "Phone:",                  piiType: "" },
  { id: "t12", text: "(512) 448-9273",          piiType: "Phone",        space: true },
  { id: "t13", text: "Email:",                  piiType: "" },
  { id: "t14", text: "j.mitchell@personalmail.com", piiType: "Email",    space: true },
  { id: "t15", text: "Bank Account:",           piiType: "" },
  { id: "t16", text: "****  ****  4821",        piiType: "Account No.", space: true },
  { id: "t17", text: "Emergency Contact:",      piiType: "" },
  { id: "t18", text: "Sarah Mitchell",          piiType: "Full Name",    space: true },
  { id: "t19", text: "(512) 883-0044",          piiType: "Phone",        space: true },
];

const PII_TOKEN_IDS = PII_TOKENS.filter(t => t.piiType).map(t => t.id);
const AI_MISSED_PII: string[] = ["t18", "t19"]; // AI catches contact person details

function RedactionFlow({ stage, onNext, onBack }: { stage: Stage; onNext: () => void; onBack: () => void }) {
  const [redacted, setRedacted]   = useState<Map<string, string>>(new Map()); // id → piiType
  const [selToken, setSelToken]   = useState<string | null>(null);
  const [piiType, setPiiType]     = useState("");
  const [showAI, setShowAI]       = useState(false);
  const [qaApproved, setQaApproved] = useState(false);
  const color = SUB_COLOR.redaction;

  const toggle = (id: string) => {
    if (redacted.has(id)) { setRedacted(m => { const n = new Map(m); n.delete(id); return n; }); setSelToken(null); }
    else setSelToken(id);
  };
  const assignPII = () => {
    if (!selToken || !piiType) return;
    setRedacted(m => new Map(m).set(selToken, piiType));
    setSelToken(null); setPiiType("");
  };

  const allRedacted = (withAI: boolean) => new Set([
    ...redacted.keys(),
    ...(withAI ? AI_MISSED_PII : []),
  ]);

  const renderDoc = (withAI: boolean, revealed = false) => (
    <DocShell title="EMP_RECORD_JRM_CONF.pdf">
      <div className="font-sans text-xs leading-7 space-y-1">
        {PII_TOKENS.map(token => {
          const isRedacted = allRedacted(withAI).has(token.id);
          const isAISuggested = withAI && AI_MISSED_PII.includes(token.id) && !redacted.has(token.id);
          const isSelected = selToken === token.id;
          const hasPII = !!token.piiType;
          return (
            <span key={token.id}
              onClick={() => stage === 1 && hasPII ? toggle(token.id) : undefined}
              className={`${token.space ? "ml-1" : "block"} ${stage === 1 && hasPII ? "cursor-pointer" : ""} transition-all rounded px-0.5`}
              style={{
                background: isSelected ? `${color}30` : isAISuggested ? "rgba(245,158,11,0.2)" : isRedacted && !revealed ? "#000" : "transparent",
                color: isSelected ? color : isRedacted && !revealed ? "#000" : "var(--foreground)",
                fontWeight: isRedacted || isSelected ? 700 : 400,
                outline: isSelected ? `2px solid ${color}` : "none",
                outlineOffset: 1,
                borderRadius: 3,
              }}>
              {isRedacted && !revealed ? "█████████" : token.text}
            </span>
          );
        })}
        {stage === 1 && <p className="text-foreground/30 italic mt-3 text-xs block">Click PII values to mark for redaction →</p>}
      </div>
    </DocShell>
  );

  // ── Stage 1 ──
  if (stage === 1) {
    return (
      <StageShell left={renderDoc(false)} right={<>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border" style={{ background: `${color}18`, borderColor: `${color}40` }}>
          <Lock size={20} style={{ color }} className="flex-shrink-0" />
          <div>
            <div className="text-sm font-bold" style={{ color }}>PII Redaction</div>
            <div className="text-xs opacity-70" style={{ color }}>Click PII values in the document</div>
          </div>
        </div>
        {selToken && (
          <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: `${color}50`, background: `${color}0d` }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>Classify PII</p>
            <p className="text-sm font-mono font-bold text-foreground/80 px-2 py-1.5 rounded truncate" style={{ background: `${color}15` }}>
              {PII_TOKENS.find(t => t.id === selToken)?.text}
            </p>
            <div className="relative">
              <select value={piiType} onChange={e => setPiiType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm font-semibold appearance-none"
                style={{ background: "var(--s4)", borderColor: `${color}60`, color: piiType ? color : "var(--foreground)", outline: "none" }}>
                <option value="">PII type…</option>
                {PII_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none" />
            </div>
            <button onClick={assignPII} disabled={!piiType}
              className="w-full py-1.5 rounded-lg text-sm font-bold disabled:opacity-40"
              style={{ background: `${color}25`, color }}>
              Redact ████
            </button>
          </div>
        )}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-2">
            Redacted ({redacted.size} / {PII_TOKEN_IDS.length})
          </p>
          {redacted.size === 0
            ? <p className="text-xs text-foreground/30 italic">No items redacted yet</p>
            : <div className="space-y-1">
                {[...redacted.entries()].map(([id, type]) => (
                  <div key={id} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-foreground/40 truncate max-w-[120px]">
                      {PII_TOKENS.find(t => t.id === id)?.text}
                    </span>
                    <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>{type}</span>
                  </div>
                ))}
              </div>
          }
        </div>
        <Button disabled={redacted.size < 3} onClick={onNext}
          className="w-full h-11 font-semibold disabled:opacity-40"
          style={{ background: redacted.size >= 3 ? color : undefined }}>
          Submit for AI Review →
        </Button>
        {redacted.size < 3 && <p className="text-xs text-center text-foreground/35">Redact at least 3 items to continue</p>}
      </>} />
    );
  }

  // ── Stage 2 ──
  if (stage === 2) {
    const missed = AI_MISSED_PII.filter(id => !redacted.has(id));
    return (
      <StageShell left={renderDoc(true)} right={<>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-blue-600/30" style={{ background: "rgba(37,99,235,0.12)" }}>
          <Eye size={20} className="text-blue-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-blue-300">AI PII Scan</div>
            <div className="text-xs text-blue-400/70">{redacted.size} redacted · {missed.length} flagged</div>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-700/40 p-3" style={{ background: "rgba(34,197,94,0.08)" }}>
          <p className="text-xs font-bold text-emerald-400 mb-1">✓ {redacted.size} items confirmed</p>
          <p className="text-xs text-emerald-300/70">Annotator redactions validated by AI model</p>
        </div>
        {missed.length > 0 && (
          <div className="rounded-xl border border-amber-600/40 p-3" style={{ background: "rgba(245,158,11,0.08)" }}>
            <p className="text-xs font-bold text-amber-400 mb-2">⚡ AI found {missed.length} additional PII</p>
            {missed.map(id => {
              const token = PII_TOKENS.find(t => t.id === id)!;
              return (
                <div key={id} className="text-xs text-amber-300/80">
                  <span className="font-mono">{token.text}</span> → <span className="font-bold">{token.piiType}</span>
                </div>
              );
            })}
            <p className="text-xs text-amber-400/60 mt-1">Highlighted in orange on document</p>
          </div>
        )}
        <Button onClick={onNext} className="w-full h-11 font-semibold" style={{ background: color }}>
          Send to QA Review →
        </Button>
      </>} />
    );
  }

  // ── Stage 3 ──
  if (stage === 3) {
    const coverage = Math.round(((redacted.size + AI_MISSED_PII.length) / PII_TOKEN_IDS.length) * 100);
    return (
      <StageShell left={renderDoc(true)} right={<>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-indigo-600/30" style={{ background: "rgba(79,70,229,0.12)" }}>
          <CheckCircle2 size={20} className="text-indigo-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-indigo-300">QA Redaction Review</div>
            <div className="text-xs text-indigo-400/70">Confirm coverage before delivery</div>
          </div>
        </div>
        <div className="rounded-2xl border border-violet-700/40 p-4" style={{ background: "rgba(109,40,217,0.12)" }}>
          <p className="text-xs font-bold text-violet-400/60 uppercase tracking-wider mb-2">PII Coverage</p>
          <div className="text-3xl font-black text-violet-300 mb-2">{coverage}%</div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--s6)" }}>
            <div className="h-full rounded-full" style={{ width: `${coverage}%`, background: "linear-gradient(90deg,#f59e0b,#10b981)" }} />
          </div>
          <div className="flex justify-between text-xs text-foreground/35 mt-1">
            <span>{redacted.size + AI_MISSED_PII.length} redacted</span>
            <span>{PII_TOKEN_IDS.length} total PII items</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-2">Compliance Check</p>
          {[
            { label: "GDPR Article 17",  pass: true  },
            { label: "HIPAA Safe Harbor", pass: true  },
            { label: "CCPA § 1798.105",  pass: coverage >= 80 },
          ].map(c => (
            <div key={c.label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
              <span className="text-xs text-foreground/60">{c.label}</span>
              <span className="text-xs font-bold" style={{ color: c.pass ? "#22c55e" : "#ef4444" }}>
                {c.pass ? "✓ Pass" : "✕ Fail"}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setQaApproved(false)}
            className="flex-1 py-2 rounded-xl border text-sm font-bold transition"
            style={{ borderColor: !qaApproved ? "#ef444460" : "var(--border)", color: !qaApproved ? "#ef4444" : "var(--foreground)", background: !qaApproved ? "rgba(239,68,68,0.1)" : "transparent" }}>
            Request Fix
          </button>
          <button onClick={() => setQaApproved(true)}
            className="flex-1 py-2 rounded-xl border text-sm font-bold transition"
            style={{ borderColor: qaApproved ? "#22c55e60" : "var(--border)", color: qaApproved ? "#22c55e" : "var(--foreground)", background: qaApproved ? "rgba(34,197,94,0.1)" : "transparent" }}>
            Approve ✓
          </button>
        </div>
        <Button disabled={!qaApproved} onClick={onNext}
          className="w-full h-11 font-semibold disabled:opacity-40"
          style={{ background: qaApproved ? color : undefined }}>
          Deliver Redacted Document →
        </Button>
      </>} />
    );
  }

  // ── Stage 4 ──
  return <DeliveredView color={color} onBack={onBack} onReset={() => { setRedacted(new Map()); setSelToken(null); setQaApproved(false); onBack(); }}>
    {renderDoc(true, false)}
    <div className="rounded-xl border border-border p-3 text-xs font-mono space-y-1" style={{ background: "var(--s2)" }}>
      <div className="flex justify-between"><span className="text-foreground/40">items_redacted</span><span className="text-emerald-400">{redacted.size + AI_MISSED_PII.length}</span></div>
      <div className="flex justify-between"><span className="text-foreground/40">pii_coverage</span><span className="text-emerald-400">{Math.round(((redacted.size + AI_MISSED_PII.length) / PII_TOKEN_IDS.length) * 100)}%</span></div>
      <div className="flex justify-between"><span className="text-foreground/40">compliance</span><span className="text-emerald-400">"GDPR · HIPAA · CCPA"</span></div>
      <div className="flex justify-between"><span className="text-foreground/40">format</span><span className="text-emerald-400">"PDF/A-1b (redacted)"</span></div>
    </div>
  </DeliveredView>;
}

// ─── Shared Stage 4 shell ─────────────────────────────────────────────────────
function DeliveredView({ color, onBack, onReset, children }: {
  color: string; onBack: () => void; onReset: () => void; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 items-center max-w-2xl mx-auto w-full">
      <div className="inline-flex items-center gap-2 text-white text-sm font-bold px-4 py-1.5 rounded-full"
        style={{ background: "var(--s8)" }}>
        📦 Delivered to Client
      </div>
      <div className="w-full rounded-2xl border-2 border-emerald-700/50 p-5 text-center"
        style={{ background: "rgba(5,150,105,0.10)" }}>
        <div className="text-4xl mb-2">✅</div>
        <div className="text-xl font-black text-emerald-400 mb-1">Task Complete</div>
        <p className="text-sm text-foreground/60">QA approved · Delivered in structured format</p>
      </div>
      <div className="w-full space-y-3">{children}</div>
      <div className="flex gap-3 w-full mt-2">
        <Button variant="outline" onClick={onReset} className="flex-1 h-10 gap-2 border-white/15 text-foreground/70">
          <RotateCcw size={14} /> Try Again
        </Button>
        <Button onClick={onBack} className="flex-1 h-10 gap-2" style={{ background: color }}>
          <ArrowLeft size={14} /> Back to Use Cases
        </Button>
      </div>
    </div>
  );
}

// ─── Landing page ─────────────────────────────────────────────────────────────
function LandingView({ onSelect }: { onSelect: (s: SubCase) => void }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      {/* Hero */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
          style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT_MID}` }}>
          IM-001 · Digitization · Search · Enterprise AI
        </div>
        <h1 className="text-3xl font-black text-foreground mb-3">Intelligent Document Archives</h1>
        <p className="text-base text-foreground/55 max-w-2xl mx-auto">
          From physical records to AI-ready enterprise knowledge. Each workflow follows a
          human-annotation → AI verification → QA review → delivery pipeline.
        </p>
      </div>

      {/* 3 Sub-use-case cards */}
      <div className="grid grid-cols-3 gap-5">
        {SUB_CASES.map(sc => {
          const col = SUB_COLOR[sc.id];
          return (
            <button key={sc.id} onClick={() => onSelect(sc.id)}
              className="text-left rounded-2xl border p-6 transition-all hover:scale-[1.02] hover:shadow-lg group"
              style={{ background: "var(--s4)", borderColor: `${col}30` }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${col}20` }}>
                <sc.icon size={24} style={{ color: col }} />
              </div>
              <div className="text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-2"
                style={{ background: `${col}20`, color: col }}>
                {sc.tag}
              </div>
              <h3 className="text-base font-bold text-foreground mb-2 leading-snug">{sc.title}</h3>
              <p className="text-sm text-foreground/55 leading-relaxed mb-5">{sc.description}</p>
              <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: col }}>
                Start Demo <ChevronRight size={15} className="transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Pipeline legend */}
      <div className="rounded-2xl border border-border p-5" style={{ background: "var(--s4)" }}>
        <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-4 text-center">
          Each sub-use case follows this pipeline
        </p>
        <div className="flex items-center justify-center gap-0">
          {["Annotator Labels", "AI Verifies", "QA Reviews", "Delivered"].map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2"
                  style={{ borderColor: ACCENT, background: ACCENT_SOFT, color: ACCENT }}>
                  {i + 1}
                </div>
                <span className="text-xs text-foreground/50 mt-1 whitespace-nowrap">{label}</span>
              </div>
              {i < 3 && <div className="w-10 h-0.5 mx-1 mb-4" style={{ background: ACCENT_MID }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Other use cases */}
      <div>
        <p className="text-sm font-bold text-foreground/40 uppercase tracking-wider mb-4">
          Other possible use cases
        </p>
        <div className="grid grid-cols-4 gap-3">
          {OTHER_USE_CASES.map(uc => (
            <div key={uc.title} className="rounded-xl border border-border p-4 opacity-75 hover:opacity-100 transition-opacity"
              style={{ background: "var(--s4)" }}>
              <uc.Icon size={18} className="text-foreground/40 mb-2" />
              <div className="text-sm font-semibold text-foreground/75 mb-1 leading-snug">{uc.title}</div>
              <div className="text-xs text-foreground/40 leading-snug">{uc.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function IntelligentArchives() {
  const navigate = useNavigate();
  const [view,  setView]  = useState<"landing" | SubCase>("landing");
  const [stage, setStage] = useState<Stage>(1);

  const goToSub = (sub: SubCase) => { setView(sub); setStage(1); };
  const goBack  = () => { setView("landing"); setStage(1); };
  const next    = () => setStage(s => Math.min(s + 1, 4) as Stage);

  const subColor = view !== "landing" ? SUB_COLOR[view] : ACCENT;
  const subTitle = SUB_CASES.find(s => s.id === view)?.title ?? "Intelligent Document Archives";

  return (
    <div className="min-h-screen" style={{ background: "var(--s0)" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/10" style={{ background: "hsl(0,0%,5%)" }}>
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={view === "landing" ? () => navigate("/use-cases") : goBack}
              className="p-2 hover:bg-white/10 rounded-full transition shrink-0">
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
            <span onClick={() => navigate("/use-cases")}
              className="text-sm font-bold text-white cursor-pointer hover:text-white/80 shrink-0">
              TP.ai <span style={{ color: "#9071f0" }}>Data</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-white/40 shrink-0" />
            <span className="text-sm text-white/70 truncate">
              {view === "landing" ? "Intelligent Document Archives" : subTitle}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            {view !== "landing" && (
              <button onClick={goBack}
                className="flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground/80 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 transition">
                <RefreshCw size={13} /> All Use Cases
              </button>
            )}
            <span className="text-sm px-3 py-1 rounded-full font-semibold"
              style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT_MID}` }}>
              Document AI · Live Demo
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${ACCENT}, #9071f0)` }} />
      </header>

      {/* Body */}
      {view === "landing" ? (
        <LandingView onSelect={goToSub} />
      ) : (
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="text-center mb-2">
            <h1 className="text-2xl font-black text-white">{subTitle}</h1>
          </div>
          <ProgressStepper stage={stage} color={subColor} />
          <div className="mt-4">
            {view === "classification" && <ClassificationFlow stage={stage} onNext={next} onBack={goBack} />}
            {view === "extraction"     && <ExtractionFlow     stage={stage} onNext={next} onBack={goBack} />}
            {view === "redaction"      && <RedactionFlow      stage={stage} onNext={next} onBack={goBack} />}
          </div>
        </div>
      )}
    </div>
  );
}
