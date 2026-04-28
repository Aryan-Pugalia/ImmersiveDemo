/**
 * IntelligentArchives.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Iron Mountain – Intelligent Document Archives
 * Priority #1 monetisation play: Intelligent Archive / Enterprise AI
 *
 * Modules:
 *   A – Archive Source selector (maps to IM data assets)
 *   B – Digitisation → Structuring → Intelligence pipeline
 *   C – InSight DXP mock UI (search, filter, AI metadata)
 *   D – Retrieval & Activation timeline
 *   E – Trust, Governance & Data Risk
 *
 * Two modes:
 *   Presenter – talking-point sidebar with 3-5 min script
 *   Kiosk     – large tap targets, 60 s inactivity auto-reset
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Search, Brain, Shield, FileText,
  Database, Clock, Users, Lock, CheckCircle2, ArrowRight,
  ScanLine, Archive, Presentation, Monitor, Layers,
  Building2, Eye, Send, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";

// ─── Iron Mountain palette ────────────────────────────────────────────────────
const IM      = "#C8102E";
const IM_SOFT = "rgba(200,16,46,0.10)";
const IM_MID  = "rgba(200,16,46,0.20)";

// ─── Types ────────────────────────────────────────────────────────────────────
type DemoModule    = "source" | "pipeline" | "insight" | "retrieval" | "governance";
type DemoMode      = "presenter" | "kiosk";
type ArchiveSource = "physical" | "digitized" | "backup";
type PipelineStage = 0 | 1 | 2;
type RetrievalStep = 0 | 1 | 2 | 3;
type AccessRole    = "viewer" | "approver" | "admin";

// ─── Static Data ──────────────────────────────────────────────────────────────

const ARCHIVE_SOURCES: Record<ArchiveSource, {
  title: string; subtitle: string; desc: string;
  risk: string; riskColor: string; volume: string;
  plays: { label: string; primary: boolean }[];
}> = {
  physical: {
    title: "Physical / Paper Records",
    subtitle: "Contracts, HR, Legal, Patient Records",
    desc: "Boxes and filing cabinets holding decades of contracts, HR files, legal documents, tax records, and patient files. High-value, low-discoverability until digitised.",
    risk: "Low", riskColor: "#22c55e", volume: "~62% of enterprise archives",
    plays: [
      { label: "✅  Intelligent Archive — Priority #1", primary: true },
      { label: "Industry AI Models (consent required)", primary: false },
      { label: "Labeled Datasets (high-risk · optional)", primary: false },
    ],
  },
  digitized: {
    title: "Digitized / Scanned Content",
    subtitle: "AI-ready structured datasets",
    desc: "Physical records already converted to digital formats via scanning and OCR. Structured and indexed for immediate AI ingestion — the fastest path to value.",
    risk: "Low", riskColor: "#22c55e", volume: "~28% of enterprise archives",
    plays: [
      { label: "✅  Intelligent Archive — Priority #1", primary: true },
      { label: "Industry AI Models (consent required)", primary: false },
    ],
  },
  backup: {
    title: "Digital Backup Media",
    subtitle: "Tapes, hard drives, optical disks",
    desc: "Legacy backup media containing structured and unstructured enterprise data. Requires format conversion and validation before AI activation.",
    risk: "Medium", riskColor: "#f59e0b", volume: "~10% of enterprise archives",
    plays: [
      { label: "✅  Intelligent Archive (with conversion)", primary: true },
      { label: "Labeled Datasets (case-by-case)", primary: false },
    ],
  },
};

const PIPELINE_STAGES = [
  {
    label: "Digitization", subtitle: "Scan · Convert · Ingest",
    detail: "High-fidelity document scanning via Iron Mountain SecureBase facilities. OCR, barcode recognition, and image enhancement. Output: raw digital files + metadata JSON. Chain-of-custody initiated at scan time.",
    bullets: ["300+ DPI scanning", "Multi-language OCR", "Barcode & QR indexing", "Chain-of-custody started"],
    videoSrc: "/videos/im-scanning.mp4",
    videoPoster: "/videos/im-scanning-poster.jpg",
  },
  {
    label: "Structuring", subtitle: "Classify · Index · Enrich",
    detail: "InSight DXP applies AI-powered document classification, named-entity extraction, and hierarchical indexing. Every scanned document becomes a searchable, structured, and auditable record.",
    bullets: ["Document type classification", "Named entity extraction", "Departmental taxonomy", "Metadata enrichment"],
    videoSrc: null, videoPoster: null,
  },
  {
    label: "Intelligence Layer", subtitle: "Search · Workflows · Insights",
    detail: "Enterprise AI layer activated on client-owned, governed archives. Enables semantic search, automated workflow triggers, compliance alerts, and executive insights — all within the client's data boundary.",
    bullets: ["Semantic / NL search", "Automated workflow triggers", "Compliance anomaly alerts", "Executive summaries"],
    videoSrc: null, videoPoster: null,
  },
];

const MOCK_DOCS = [
  {
    id: "d1", name: "Phillips v. Acme Corp — Settlement Agreement",
    type: "Legal Contract", dept: "Legal", date: "2019-03-14", pages: 47, confidence: 98.2,
    labels: ["Contract", "Settlement", "Signed"],
    summary: "Settlement resolving IP dispute. $2.4M agreed resolution. Effective March 2019.",
    fields: { "Party A": "Phillips Ltd.", "Party B": "Acme Corp.", "Amount": "$2,400,000", "Effective": "2019-03-14" },
  },
  {
    id: "d2", name: "HR-2022 — Employee File K.Walsh",
    type: "HR Record", dept: "Human Resources", date: "2022-07-01", pages: 12, confidence: 96.5,
    labels: ["HR", "Personnel", "Confidential"],
    summary: "Employee file for K. Walsh. Performance reviews, onboarding, and benefits through 2022.",
    fields: { "Employee": "K. Walsh", "Start Date": "2018-04-10", "Department": "Operations", "Level": "Senior" },
  },
  {
    id: "d3", name: "Tax Return FY2022 Consolidated",
    type: "Tax Document", dept: "Finance", date: "2023-04-15", pages: 89, confidence: 99.1,
    labels: ["Tax", "Finance", "Statutory"],
    summary: "Consolidated federal filing for FY2022. All subsidiaries included. Filed April 15 2023.",
    fields: { "Entity": "Acme Corp (consolidated)", "FY": "2022", "Filed": "2023-04-15", "Status": "Accepted" },
  },
  {
    id: "d4", name: "Lease Agreement — NYC HQ 2021",
    type: "Legal Contract", dept: "Real Estate", date: "2021-06-01", pages: 31, confidence: 97.8,
    labels: ["Contract", "Lease", "Property"],
    summary: "NYC headquarters lease. 10-year term from June 2021. $4.2M annual rent.",
    fields: { "Lessor": "Midtown Realty LLC", "Term": "10 years", "Annual Rent": "$4,200,000", "Location": "440 Park Ave, NYC" },
  },
  {
    id: "d5", name: "Patient Record MRN-48291",
    type: "Healthcare Record", dept: "Medical", date: "2020-11-22", pages: 23, confidence: 94.3,
    labels: ["PHI", "Medical", "HIPAA"],
    summary: "Patient medical record. Lab results, physician notes, prescription history. HIPAA protected.",
    fields: { "MRN": "48291", "DOB": "1978-06-15", "Physician": "Dr. R. Chen", "HIPAA": "Protected" },
  },
];

const CUSTODY_LOG = [
  { ts: "2024-01-15  09:23", event: "Document scanned",             actor: "Operator: J.Martinez",   loc: "IMF-NYC-003" },
  { ts: "2024-01-15  09:24", event: "QR label applied & ingested",  actor: "AutoIngest v4.2",         loc: "IMF-NYC-003" },
  { ts: "2024-01-15  09:25", event: "AI classification complete",   actor: "InSight DXP",             loc: "Cloud: IM-US-EAST" },
  { ts: "2024-01-15  11:02", event: "Reviewed & approved",          actor: "Approver: K.Walsh",       loc: "Client Portal" },
  { ts: "2024-01-16  08:15", event: "Retrieval authorised",         actor: "Client Legal Team",       loc: "REQ-2024-0045" },
  { ts: "2024-01-16  08:17", event: "Document delivered (Digital)", actor: "System: IM-DDX",          loc: "Client Secure Drive" },
];

const RETRIEVAL_STEPS = [
  {
    label: "Retrieve",
    desc: "Client submits retrieval request via InSight DXP. Document located instantly from the indexed archive.",
    detail: ["Request logged with timestamp", "Semantic index lookup", "Authorisation check passed", "File pre-fetched from vault"],
  },
  {
    label: "Review",
    desc: "Authorised reviewer previews the document in a secure in-browser environment. No download until approved.",
    detail: ["Secure in-browser preview", "Side-by-side AI summary", "Redaction tools available", "Audit trail updated"],
  },
  {
    label: "Action",
    desc: "Reviewer routes to the appropriate workflow — legal review, HR action, audit response, or direct delivery.",
    detail: ["Route to workflow", "Notify stakeholders", "Attach compliance notes", "Set retention trigger"],
  },
  {
    label: "Archive",
    desc: "Document re-archived with enriched metadata. Full chain-of-custody maintained for audit and compliance.",
    detail: ["Metadata enriched", "Retention schedule updated", "Chain-of-custody closed", "Compliance record stored"],
  },
];

const ACCESS_ROLES: Record<AccessRole, { label: string; color: string; permissions: string[] }> = {
  viewer:   { label: "Viewer",   color: "#3b82f6", permissions: ["Search documents", "Preview indexed metadata", "View AI summaries"] },
  approver: { label: "Approver", color: "#f59e0b", permissions: ["All Viewer permissions", "Approve retrieval requests", "Add compliance notes", "Route to workflows"] },
  admin:    { label: "Admin",    color: IM,        permissions: ["All Approver permissions", "Configure access controls", "Manage retention policies", "Export audit logs"] },
};

const PRESENTER_SCRIPTS: Record<DemoModule, { title: string; points: string[]; handoff: string }> = {
  source: {
    title: "Why Archive Source Matters",
    points: [
      "Iron Mountain manages 950M+ boxes globally — the largest physical archive in enterprise.",
      "Priority #1 play: Intelligent Archive operates on CLIENT-OWNED data — lowest possible data risk.",
      "Physical records (~62%) are the biggest opportunity with near-zero consent friction.",
      "Digitised content is already structured — fastest path to AI activation.",
      "Backup media adds the edge case — still within the client's boundary.",
    ],
    handoff: "→ Intelligent Archive leads because it's enterprise-grade AI with near-zero consent overhead.",
  },
  pipeline: {
    title: "The Digitisation-to-Intelligence Stack",
    points: [
      "Stage 1 – Digitisation: Iron Mountain's existing scan ops become the data pipeline.",
      "Stage 2 – Structuring: InSight DXP classifies and indexes every document automatically.",
      "Stage 3 – Intelligence: AI activates search, workflows, and insights on the structured archive.",
      "This end-to-end stack is already proprietary IM infrastructure — minimal new capex.",
      "TP provides the annotation, QA, and RLHF layer between Stage 2 and 3.",
    ],
    handoff: "→ TP's role: train the models powering InSight DXP classification and extraction accuracy.",
  },
  insight: {
    title: "InSight DXP — The Product",
    points: [
      "InSight DXP is Iron Mountain's AI-powered document management platform.",
      "Enables natural-language search across millions of classified, indexed records.",
      "AI metadata (labels, summaries, extracted fields) cuts manual review time by 70-85%.",
      "Client retains full ownership — InSight never exposes data cross-client.",
      "Revenue: per-seat SaaS or enterprise licensing ($200K–$2M ACV).",
    ],
    handoff: "→ The mock UI shows what a legal or HR team sees every day using InSight DXP.",
  },
  retrieval: {
    title: "Retrieval & Activation — The Value Moment",
    points: [
      "Retrieve → Review → Action → Archive is the core enterprise workflow.",
      "Digital Delivery (DDX) and Image on Demand are IM's existing retrieval products.",
      "Intelligent Archive extends these to AI-powered: search in seconds, not days.",
      "Every retrieval is logged, authorised, and audited — critical for regulated industries.",
      "Legal, HR, Finance, Healthcare — all verticals with strict compliance mandates.",
    ],
    handoff: "→ Speed-to-retrieval is the primary ROI driver: $15-40K/month saved per enterprise client.",
  },
  governance: {
    title: "Trust & Governance — The Competitive Moat",
    points: [
      "Intelligent Archive is LOW DATA RISK — operates within the client's data boundary.",
      "Chain-of-custody: every action logged, every access authorised — audit-ready by default.",
      "Role-based access: Viewer → Approver → Admin with strict permission segregation.",
      "No cross-client data exposure. No model training without explicit consent.",
      "This governance posture is WHY we can scale Intelligent Archive before riskier plays.",
    ],
    handoff: "→ Regulated industries will only buy from a governed AI stack. This is the moat.",
  },
};

// ─── Presenter Sidebar ────────────────────────────────────────────────────────
function PresenterSidebar({ module, isLight }: { module: DemoModule; isLight: boolean }) {
  const s = PRESENTER_SCRIPTS[module];
  return (
    <div
      className="rounded-xl border p-5 space-y-4 sticky top-24"
      style={{ borderColor: IM_MID, background: isLight ? "#fff9f9" : IM_SOFT }}
    >
      <div className="flex items-center gap-2">
        <Presentation className="w-4 h-4" style={{ color: IM }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: IM }}>Presenter Notes</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{s.title}</p>
      <ul className="space-y-2.5">
        {s.points.map((pt, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground leading-snug">
            <span
              className="mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: IM }}
            >{i + 1}</span>
            {pt}
          </li>
        ))}
      </ul>
      <div className="rounded-lg p-3 text-sm font-semibold leading-snug" style={{ background: IM_MID, color: IM }}>
        {s.handoff}
      </div>
    </div>
  );
}

// ─── Module A: Archive Source ─────────────────────────────────────────────────
function ModuleA({
  source, onSelect, isLight, kiosk,
}: { source: ArchiveSource; onSelect: (s: ArchiveSource) => void; isLight: boolean; kiosk: boolean }) {
  const sel = ARCHIVE_SOURCES[source];
  const keys: ArchiveSource[] = ["physical", "digitized", "backup"];
  const icons: Record<ArchiveSource, React.ReactNode> = {
    physical:  <FileText className={kiosk ? "w-10 h-10" : "w-7 h-7"} />,
    digitized: <ScanLine className={kiosk ? "w-10 h-10" : "w-7 h-7"} />,
    backup:    <Database className={kiosk ? "w-10 h-10" : "w-7 h-7"} />,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`font-bold text-foreground mb-1 ${kiosk ? "text-2xl" : "text-xl"}`}>
          Choose Archive Source
        </h2>
        <p className="text-sm text-muted-foreground">
          Select an Iron Mountain data asset type to see how it maps to the Intelligent Archive monetisation play.
        </p>
      </div>

      <div className={`grid gap-4 ${kiosk ? "grid-cols-3" : "grid-cols-3"}`}>
        {keys.map((key) => {
          const src = ARCHIVE_SOURCES[key];
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className="rounded-xl border-2 text-left transition-all duration-200"
              style={{
                borderColor: source === key ? IM : isLight ? "#e5e7eb" : "rgba(255,255,255,0.10)",
                background:  source === key ? IM_SOFT : isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
                padding: kiosk ? "24px" : "18px",
              }}
            >
              <div className="mb-3" style={{ color: source === key ? IM : "var(--muted-foreground)" }}>
                {icons[key]}
              </div>
              <p className={`font-bold text-foreground mb-1 ${kiosk ? "text-base" : "text-sm"}`}>{src.title}</p>
              <p className="text-xs text-muted-foreground">{src.subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      <div className="rounded-xl border p-6 space-y-5"
        style={{ borderColor: isLight ? "#e5e7eb" : "rgba(255,255,255,0.08)" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-foreground">{sel.title}</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{sel.desc}</p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap"
              style={{ background: `${sel.riskColor}20`, color: sel.riskColor }}>
              Risk: {sel.risk}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{sel.volume}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Eligible Monetisation Plays
          </p>
          <div className="space-y-2">
            {sel.plays.map((play, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg text-sm"
                style={{
                  background: play.primary ? IM_SOFT : isLight ? "#f3f4f6" : "rgba(255,255,255,0.04)",
                  fontWeight: play.primary ? 600 : 400,
                  color: play.primary ? IM : "var(--muted-foreground)",
                }}
              >
                {play.primary
                  ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: IM }} />
                  : <span className="w-4 h-4 shrink-0 opacity-30">○</span>}
                {play.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Module B: Pipeline ───────────────────────────────────────────────────────
function ModuleB({
  stage, onStage, isLight, kiosk,
}: { stage: PipelineStage; onStage: (s: PipelineStage) => void; isLight: boolean; kiosk: boolean }) {
  const active = PIPELINE_STAGES[stage];
  const stageIcons = [
    <ScanLine className="w-6 h-6" />,
    <Layers className="w-6 h-6" />,
    <Brain className="w-6 h-6" />,
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`font-bold text-foreground mb-1 ${kiosk ? "text-2xl" : "text-xl"}`}>
          Digitisation → Intelligence Pipeline
        </h2>
        <p className="text-sm text-muted-foreground">
          Tap a stage to see how Iron Mountain converts physical archives into an enterprise AI knowledge layer.
        </p>
      </div>

      {/* Stage selector */}
      <div className="flex items-center gap-0">
        {PIPELINE_STAGES.map((s, i) => (
          <div key={s.label} className="flex items-center flex-1">
            <button
              onClick={() => onStage(i as PipelineStage)}
              className="flex-1 rounded-xl border-2 text-center transition-all duration-200"
              style={{
                borderColor: stage === i ? IM : isLight ? "#e5e7eb" : "rgba(255,255,255,0.08)",
                background:  stage === i ? IM_SOFT : isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
                padding: kiosk ? "20px 12px" : "14px 10px",
              }}
            >
              <div className="flex justify-center mb-2" style={{ color: stage === i ? IM : "var(--muted-foreground)" }}>
                {stageIcons[i]}
              </div>
              <p className="text-sm font-bold text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{s.subtitle}</p>
            </button>
            {i < PIPELINE_STAGES.length - 1 && (
              <ArrowRight className="w-5 h-5 mx-2 shrink-0 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Stage detail */}
      <div className="rounded-xl border p-6"
        style={{ borderColor: isLight ? "#e5e7eb" : "rgba(255,255,255,0.08)" }}>
        <div className="flex gap-6">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: IM_SOFT, color: IM }}>
                {stageIcons[stage]}
              </div>
              <div>
                <p className="font-bold text-foreground">{active.label}</p>
                <p className="text-sm text-muted-foreground">{active.subtitle}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{active.detail}</p>
            <ul className="grid grid-cols-2 gap-2">
              {active.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: IM }} />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Video / placeholder */}
          <div className="w-56 shrink-0 rounded-xl overflow-hidden flex flex-col items-center justify-center"
            style={{
              minHeight: 160,
              background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.04)",
              border: `1px solid ${isLight ? "#e5e7eb" : "rgba(255,255,255,0.06)"}`,
            }}>
            {active.videoSrc ? (
              <video
                src={active.videoSrc}
                poster={active.videoPoster ?? undefined}
                autoPlay muted loop playsInline
                className="w-full h-full object-cover"
                style={{ minHeight: 160 }}
              />
            ) : (
              <div className="p-5 text-center space-y-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: IM_SOFT, color: IM }}>
                  {stageIcons[stage]}
                </div>
                <p className="text-xs text-muted-foreground">Video asset:</p>
                <code className="text-xs block" style={{ color: IM }}>
                  /videos/im-{active.label.toLowerCase().replace(/ /g, "-")}.mp4
                </code>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* InSight DXP callout */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl"
        style={{ background: IM_SOFT, border: `1px solid ${IM_MID}` }}>
        <Brain className="w-5 h-5 shrink-0" style={{ color: IM }} />
        <p className="text-sm" style={{ color: IM }}>
          <strong>InSight DXP</strong> powers Stages 2 & 3:
          AI-powered classification, indexing, and enterprise search across governed archives.
        </p>
      </div>
    </div>
  );
}

// ─── Module C: InSight DXP ────────────────────────────────────────────────────
function ModuleC({ isLight }: { isLight: boolean }) {
  const [query, setQuery]             = useState("");
  const [selectedDoc, setSelectedDoc] = useState(MOCK_DOCS[0]);
  const [typeFilter, setTypeFilter]   = useState("All");
  const [deptFilter, setDeptFilter]   = useState("All");

  const types = ["All", ...Array.from(new Set(MOCK_DOCS.map((d) => d.type)))];
  const depts = ["All", ...Array.from(new Set(MOCK_DOCS.map((d) => d.dept)))];

  const filtered = MOCK_DOCS.filter((d) => {
    const q = query.toLowerCase();
    const matchQ = !query || d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q) || d.dept.toLowerCase().includes(q);
    const matchT = typeFilter === "All" || d.type === typeFilter;
    const matchD = deptFilter === "All" || d.dept === deptFilter;
    return matchQ && matchT && matchD;
  });

  const border = isLight ? "#e5e7eb" : "rgba(255,255,255,0.09)";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">InSight DXP — Enterprise Archive Search</h2>
        <p className="text-sm text-muted-foreground">
          AI-powered classification, indexing, and search across your governed archive.{" "}
          <em className="text-muted-foreground/60">Mock interface — clearly labelled.</em>
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search archives — e.g. "settlement", "HR Walsh", "tax 2022"'
          className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2"
          style={{ borderColor: border }}
        />
      </div>

      {/* 3-column layout */}
      <div className="flex gap-4" style={{ height: 420 }}>

        {/* Filters */}
        <div className="w-40 shrink-0 overflow-y-auto space-y-5 pr-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Doc Type</p>
            {types.map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className="w-full text-left px-3 py-1.5 rounded-lg text-sm mb-1 transition-colors"
                style={{
                  background: typeFilter === t ? IM_SOFT : "transparent",
                  color: typeFilter === t ? IM : "var(--foreground)",
                  fontWeight: typeFilter === t ? 600 : 400,
                }}>
                {t}
              </button>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Department</p>
            {depts.map((d) => (
              <button key={d} onClick={() => setDeptFilter(d)}
                className="w-full text-left px-3 py-1.5 rounded-lg text-sm mb-1 transition-colors"
                style={{
                  background: deptFilter === d ? IM_SOFT : "transparent",
                  color: deptFilter === d ? IM : "var(--foreground)",
                  fontWeight: deptFilter === d ? 600 : 400,
                }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="w-60 shrink-0 overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">No results</p>
          )}
          {filtered.map((doc) => (
            <button key={doc.id} onClick={() => setSelectedDoc(doc)}
              className="w-full text-left rounded-xl border p-3 transition-all"
              style={{
                borderColor: selectedDoc.id === doc.id ? IM : border,
                background:  selectedDoc.id === doc.id ? IM_SOFT : isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
              }}>
              <p className="text-sm font-semibold text-foreground line-clamp-2 mb-1.5">{doc.name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: IM_SOFT, color: IM }}>{doc.type}</span>
                <span className="text-xs text-muted-foreground">{doc.pages}p</span>
              </div>
            </button>
          ))}
        </div>

        {/* Preview + AI metadata */}
        <div className="flex-1 overflow-y-auto rounded-xl border p-5 space-y-4"
          style={{ borderColor: border }}>
          <div>
            <p className="font-bold text-foreground leading-tight">{selectedDoc.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedDoc.dept} · {selectedDoc.date} · {selectedDoc.pages} pages
            </p>
          </div>

          {/* Confidence badge */}
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: IM_SOFT }}>
            <Brain className="w-4 h-4 shrink-0" style={{ color: IM }} />
            <div>
              <p className="text-xs font-bold" style={{ color: IM }}>
                AI Classification Confidence: {selectedDoc.confidence}%
              </p>
              <p className="text-xs text-muted-foreground">Powered by InSight DXP</p>
            </div>
          </div>

          {/* Labels */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">AI Labels</p>
            <div className="flex flex-wrap gap-2">
              {selectedDoc.labels.map((l) => (
                <span key={l} className="text-xs px-2.5 py-1 rounded-full border font-medium"
                  style={{ borderColor: IM, color: IM }}>{l}</span>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">AI Summary</p>
            <p className="text-sm text-foreground leading-relaxed">{selectedDoc.summary}</p>
          </div>

          {/* Extracted fields */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Extracted Fields</p>
            <div className="space-y-1.5">
              {Object.entries(selectedDoc.fields).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm gap-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-foreground text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Module D: Retrieval & Activation ────────────────────────────────────────
function ModuleD({
  step, onStep, isLight, kiosk,
}: { step: RetrievalStep; onStep: (s: RetrievalStep) => void; isLight: boolean; kiosk: boolean }) {
  const active = RETRIEVAL_STEPS[step];
  const stepIcons = [
    <Search className="w-5 h-5" />,
    <Eye className="w-5 h-5" />,
    <Send className="w-5 h-5" />,
    <Archive className="w-5 h-5" />,
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`font-bold text-foreground mb-1 ${kiosk ? "text-2xl" : "text-xl"}`}>
          Retrieval & Activation
        </h2>
        <p className="text-sm text-muted-foreground">
          Enterprise-safe document retrieval: authorised, logged, and audit-ready at every step.
        </p>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-0">
        {RETRIEVAL_STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center flex-1">
            <button
              onClick={() => onStep(i as RetrievalStep)}
              className="flex-1 text-center rounded-xl border-2 transition-all duration-200"
              style={{
                padding: kiosk ? "20px 12px" : "14px 10px",
                borderColor: step === i ? IM : step > i ? "#22c55e" : isLight ? "#e5e7eb" : "rgba(255,255,255,0.08)",
                background:  step === i ? IM_SOFT : step > i ? "rgba(34,197,94,0.08)" : isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
              }}
            >
              <div className="flex justify-center mb-2"
                style={{ color: step === i ? IM : step > i ? "#22c55e" : "var(--muted-foreground)" }}>
                {stepIcons[i]}
              </div>
              <p className="text-sm font-bold text-foreground">{s.label}</p>
            </button>
            {i < RETRIEVAL_STEPS.length - 1 && (
              <ArrowRight className="w-4 h-4 mx-2 shrink-0 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step detail */}
      <div className="rounded-xl border p-6 space-y-4"
        style={{ borderColor: isLight ? "#e5e7eb" : "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: IM_SOFT, color: IM }}>
            {stepIcons[step]}
          </div>
          <div>
            <p className="font-bold text-foreground">{active.label}</p>
            <p className="text-sm text-muted-foreground">{active.desc}</p>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {active.detail.map((d) => (
            <li key={d} className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: IM }} />
              {d}
            </li>
          ))}
        </ul>
        <div className="flex justify-between pt-2">
          <Button variant="outline" size="sm" disabled={step === 0}
            onClick={() => onStep((step - 1) as RetrievalStep)}>
            ← Previous
          </Button>
          <Button size="sm" disabled={step === 3}
            onClick={() => onStep((step + 1) as RetrievalStep)}
            style={{ background: IM, color: "#fff", border: "none" }}>
            {step === 3 ? "✓ Complete" : "Next →"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Module E: Governance ─────────────────────────────────────────────────────
function ModuleE({
  role, onRole, isLight,
}: { role: AccessRole; onRole: (r: AccessRole) => void; isLight: boolean }) {
  const roleData = ACCESS_ROLES[role];
  const border = isLight ? "#e5e7eb" : "rgba(255,255,255,0.08)";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Trust, Governance & Data Risk</h2>
        <p className="text-sm text-muted-foreground">
          Client-controlled archives. Chain-of-custody logged. Role-based access enforced.
          This governance posture is why Intelligent Archive can scale before riskier monetisation plays.
        </p>
      </div>

      {/* Risk banner */}
      <div className="rounded-xl p-4 flex items-center gap-4"
        style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.30)" }}>
        <Shield className="w-6 h-6 shrink-0" style={{ color: "#22c55e" }} />
        <div>
          <p className="font-bold text-sm" style={{ color: "#22c55e" }}>Same-Owner Data: LOW RISK</p>
          <p className="text-sm text-muted-foreground">
            Intelligent Archive operates entirely within the client's data boundary.
            No cross-client exposure. Consent required only for downstream AI model training.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* Chain of custody */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Chain-of-Custody Log
          </p>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: border }}>
            {CUSTODY_LOG.map((entry, i) => (
              <div key={i}
                className="px-4 py-3 flex items-start gap-3"
                style={{ borderTop: i > 0 ? `1px solid ${border}` : "none" }}>
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#22c55e" }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">{entry.event}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{entry.ts} · {entry.actor}</p>
                  <p className="text-xs text-muted-foreground">{entry.loc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RBAC + governance principles */}
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Role-Based Access Control
          </p>

          {/* Role selector */}
          <div className="flex gap-2">
            {(Object.entries(ACCESS_ROLES) as [AccessRole, typeof ACCESS_ROLES[AccessRole]][]).map(([key, r]) => (
              <button key={key} onClick={() => onRole(key)}
                className="flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition-all"
                style={{
                  borderColor: role === key ? r.color : border,
                  background:  role === key ? `${r.color}18` : "transparent",
                  color: role === key ? r.color : "var(--muted-foreground)",
                }}>
                {r.label}
              </button>
            ))}
          </div>

          {/* Permissions */}
          <div className="rounded-xl border p-4 space-y-2.5" style={{ borderColor: border }}>
            <p className="text-sm font-semibold mb-3" style={{ color: roleData.color }}>
              {roleData.label} Permissions
            </p>
            {roleData.permissions.map((p) => (
              <div key={p} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: roleData.color }} />
                {p}
              </div>
            ))}
          </div>

          {/* Governance principles */}
          <div className="space-y-2.5">
            {[
              { icon: <Lock className="w-4 h-4" />,          text: "Client retains full data ownership" },
              { icon: <Users className="w-4 h-4" />,         text: "No cross-client data exposure" },
              { icon: <AlertTriangle className="w-4 h-4" />, text: "Downstream AI training requires consent" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span style={{ color: IM }}>{icon}</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function IntelligentArchives() {
  const navigate  = useNavigate();
  const { theme } = useTheme();
  const isLight   = theme === "light";

  const [mode,          setMode]          = useState<DemoMode>("presenter");
  const [activeModule,  setActiveModule]  = useState<DemoModule>("source");
  const [archiveSource, setArchiveSource] = useState<ArchiveSource>("physical");
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(0);
  const [retrievalStep, setRetrievalStep] = useState<RetrievalStep>(0);
  const [accessRole,    setAccessRole]    = useState<AccessRole>("viewer");

  // Kiosk: 60 s inactivity reset
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetKiosk = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => {
      setActiveModule("source");
      setArchiveSource("physical");
      setPipelineStage(0);
      setRetrievalStep(0);
      setAccessRole("viewer");
    }, 60_000);
  }, []);

  useEffect(() => {
    if (mode !== "kiosk") {
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      return;
    }
    document.addEventListener("click",      resetKiosk);
    document.addEventListener("touchstart", resetKiosk);
    resetKiosk();
    return () => {
      document.removeEventListener("click",      resetKiosk);
      document.removeEventListener("touchstart", resetKiosk);
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
    };
  }, [mode, resetKiosk]);

  const MODULES: { id: DemoModule; label: string; letter: string }[] = [
    { id: "source",     label: "Archive Source", letter: "A" },
    { id: "pipeline",   label: "Pipeline",       letter: "B" },
    { id: "insight",    label: "InSight DXP",    letter: "C" },
    { id: "retrieval",  label: "Retrieval",      letter: "D" },
    { id: "governance", label: "Governance",     letter: "E" },
  ];

  const kiosk = mode === "kiosk";
  const headerBg = isLight ? "#fff" : "hsl(0,0%,5%)";

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/20"
        style={{ background: headerBg }}>
        <div className="flex items-center justify-between px-6 py-3 h-16">

          {/* Left: breadcrumb */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-muted rounded-full transition-colors">
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </button>
            <span
              className="text-sm font-bold tracking-wide cursor-pointer hover:opacity-80 transition-opacity font-headline shrink-0"
              style={{ color: isLight ? "#111" : "#fff" }}
              onClick={() => navigate("/use-cases")}>
              TP.ai <span style={{ color: "#9071f0" }}>Data</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-bold" style={{ color: IM }}>
              Intelligent Document Archives
            </span>
            <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full font-bold ml-1"
              style={{ background: IM_SOFT, color: IM }}>
              Iron Mountain
            </span>
          </div>

          {/* Right: theme + mode */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-1 rounded-lg border border-border/30 p-1">
              <button onClick={() => setMode("presenter")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all"
                style={{
                  background: mode === "presenter" ? IM : "transparent",
                  color: mode === "presenter" ? "#fff" : "var(--muted-foreground)",
                }}>
                <Presentation className="w-3.5 h-3.5" /> Presenter
              </button>
              <button onClick={() => setMode("kiosk")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all"
                style={{
                  background: mode === "kiosk" ? IM : "transparent",
                  color: mode === "kiosk" ? "#fff" : "var(--muted-foreground)",
                }}>
                <Monitor className="w-3.5 h-3.5" /> Kiosk
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-[2px] w-full"
          style={{ background: `linear-gradient(90deg, ${IM}, #9071f0, ${IM})` }} />
      </header>

      {/* ── Module tabs ─────────────────────────────────────────────────────── */}
      <div className="border-b border-border/20"
        style={{ background: isLight ? "#fafafa" : "rgba(255,255,255,0.02)" }}>
        <div className="flex items-center gap-0 max-w-7xl mx-auto px-6 overflow-x-auto">
          {MODULES.map((m) => {
            const active = activeModule === m.id;
            return (
              <button key={m.id} onClick={() => setActiveModule(m.id)}
                className="flex items-center gap-2 px-4 border-b-2 transition-all whitespace-nowrap"
                style={{
                  paddingTop: kiosk ? 16 : 12,
                  paddingBottom: kiosk ? 16 : 12,
                  borderColor: active ? IM : "transparent",
                  color: active ? IM : "var(--muted-foreground)",
                  fontSize: kiosk ? 15 : 14,
                  fontWeight: 600,
                }}>
                <span
                  className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold shrink-0"
                  style={{
                    background: active ? IM : isLight ? "#e5e7eb" : "rgba(255,255,255,0.10)",
                    color: active ? "#fff" : "var(--muted-foreground)",
                  }}>
                  {m.letter}
                </span>
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className={mode === "presenter" ? "flex gap-8" : ""}>

          {/* Main module area */}
          <div className="flex-1 min-w-0">
            {activeModule === "source" && (
              <ModuleA source={archiveSource} onSelect={setArchiveSource} isLight={isLight} kiosk={kiosk} />
            )}
            {activeModule === "pipeline" && (
              <ModuleB stage={pipelineStage} onStage={setPipelineStage} isLight={isLight} kiosk={kiosk} />
            )}
            {activeModule === "insight" && (
              <ModuleC isLight={isLight} />
            )}
            {activeModule === "retrieval" && (
              <ModuleD step={retrievalStep} onStep={setRetrievalStep} isLight={isLight} kiosk={kiosk} />
            )}
            {activeModule === "governance" && (
              <ModuleE role={accessRole} onRole={setAccessRole} isLight={isLight} />
            )}

            {/* Module navigation footer */}
            <div className="flex items-center justify-between mt-10 pt-6 border-t border-border/20">
              <Button variant="outline" size="sm"
                disabled={activeModule === "source"}
                onClick={() => {
                  const idx = MODULES.findIndex(m => m.id === activeModule);
                  if (idx > 0) setActiveModule(MODULES[idx - 1].id);
                }}>
                ← Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Module {MODULES.findIndex(m => m.id === activeModule) + 1} of {MODULES.length}
              </span>
              <Button size="sm"
                disabled={activeModule === "governance"}
                onClick={() => {
                  const idx = MODULES.findIndex(m => m.id === activeModule);
                  if (idx < MODULES.length - 1) setActiveModule(MODULES[idx + 1].id);
                }}
                style={{ background: IM, color: "#fff", border: "none" }}>
                Next Module →
              </Button>
            </div>
          </div>

          {/* Presenter sidebar */}
          {mode === "presenter" && (
            <div className="w-72 shrink-0">
              <PresenterSidebar module={activeModule} isLight={isLight} />
            </div>
          )}
        </div>
      </div>

      {/* ── Kiosk: inactivity notice ─────────────────────────────────────────── */}
      {kiosk && (
        <div className="fixed bottom-4 right-4 text-xs px-3 py-1.5 rounded-full"
          style={{ background: IM_SOFT, color: IM, border: `1px solid ${IM_MID}` }}>
          <Clock className="w-3 h-3 inline mr-1.5" />
          Kiosk mode · auto-resets after 60 s inactivity
        </div>
      )}
    </div>
  );
}
