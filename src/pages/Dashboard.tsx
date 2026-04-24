import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronRight, TrendingUp, Users, Download,
  AlertTriangle, CheckCircle2, Clock, Zap, BarChart3,
  RefreshCw, Activity, Flag, Globe, FileCheck, Bell,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { LanguagePicker } from "@/components/LanguagePicker";
import { ThemeToggle } from "@/components/ThemeToggle";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProjStatus = "on_track" | "at_risk" | "delayed" | "completed";
interface Project {
  id: string; name: string; client: string;
  type: string; typeIcon: string;
  totalTasks: number; completed: number; inReview: number;
  status: ProjStatus; dueDate: string; team: number; language: string;
}
interface CityNode {
  name: string; country: string; lat: number; lon: number; base: number;
}
type EventKind = "ready" | "flagged" | "completed" | "assigned" | "review";
type EventPrio = "high" | "medium" | "low";
interface LiveEvent {
  id: string; kind: EventKind; prio: EventPrio;
  /** index into t.dashboard.eventPool for localised title+detail */
  idx: number; ts: string; project: string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────
const PROJECTS: Project[] = [
  { id:"p1", name:"Multilingual Speech — Batch 7",  client:"DataCorp AI",    type:"Audio",    typeIcon:"mic",          totalTasks:240, completed:187, inReview:28, status:"on_track",  dueDate:"Apr 28", team:14, language:"ZH / HI / AR" },
  { id:"p2", name:"Autonomous Driving — Q2 Set",    client:"AutoVision",     type:"LiDAR",    typeIcon:"view_in_ar",   totalTasks:180, completed:142, inReview:18, status:"at_risk",   dueDate:"Apr 23", team:9,  language:"—" },
  { id:"p3", name:"Medical Scan Annotation",         client:"MedTech Labs",   type:"Medical",  typeIcon:"radiology",    totalTasks:95,  completed:95,  inReview:0,  status:"completed", dueDate:"Apr 18", team:6,  language:"—" },
  { id:"p4", name:"Invoice Extraction — APAC",       client:"FinServ Group",  type:"Document", typeIcon:"receipt_long", totalTasks:320, completed:198, inReview:44, status:"at_risk",   dueDate:"Apr 25", team:18, language:"ZH / JA / KO" },
  { id:"p5", name:"RLHF Image Preference",           client:"GenAI Studio",   type:"Image",    typeIcon:"compare",      totalTasks:500, completed:411, inReview:62, status:"on_track",  dueDate:"May 05", team:22, language:"—" },
  { id:"p6", name:"Video Temporal Annotation",       client:"StreamAI",       type:"Video",    typeIcon:"movie",        totalTasks:75,  completed:12,  inReview:5,  status:"delayed",   dueDate:"Apr 20", team:4,  language:"—" },
  { id:"p7", name:"Korean CX Transcription",         client:"TelecomKR",      type:"Audio",    typeIcon:"mic",          totalTasks:160, completed:88,  inReview:31, status:"on_track",  dueDate:"May 10", team:11, language:"KO" },
  { id:"p8", name:"French Legal Document IDP",       client:"LexGroup Paris", type:"Document", typeIcon:"receipt_long", totalTasks:210, completed:67,  inReview:22, status:"on_track",  dueDate:"May 15", team:8,  language:"FR" },
];

const CITIES: CityNode[] = [
  { name:"Hyderabad",  country:"IN", lat:17.4,  lon:78.5,   base:72 },
  { name:"Manila",     country:"PH", lat:14.6,  lon:121.0,  base:58 },
  { name:"New York",   country:"US", lat:40.7,  lon:-74.0,  base:34 },
  { name:"Beijing",    country:"CN", lat:39.9,  lon:116.4,  base:41 },
  { name:"London",     country:"GB", lat:51.5,  lon:-0.1,   base:28 },
  { name:"Seoul",      country:"KR", lat:37.6,  lon:127.0,  base:23 },
  { name:"Cairo",      country:"EG", lat:30.0,  lon:31.2,   base:19 },
  { name:"Paris",      country:"FR", lat:48.8,  lon:2.3,    base:15 },
  { name:"Tokyo",      country:"JP", lat:35.7,  lon:139.7,  base:18 },
  { name:"Nairobi",    country:"KE", lat:-1.3,  lon:36.8,   base:12 },
  { name:"São Paulo",  country:"BR", lat:-23.5, lon:-46.6,  base:9  },
  { name:"Sydney",     country:"AU", lat:-33.9, lon:151.2,  base:7  },
  { name:"Casablanca", country:"MA", lat:33.6,  lon:-7.6,   base:8  },
  { name:"Bogotá",     country:"CO", lat:4.7,   lon:-74.1,  base:6  },
];

// Metadata only — title & detail come from t.dashboard.eventPool[idx] at render time
const EVENT_POOL_META: Omit<LiveEvent, "id" | "ts">[] = [
  { kind:"ready",     prio:"high",   idx:0,  project:"p1" },
  { kind:"flagged",   prio:"high",   idx:1,  project:"p6" },
  { kind:"ready",     prio:"high",   idx:2,  project:"p4" },
  { kind:"flagged",   prio:"high",   idx:3,  project:"p2" },
  { kind:"completed", prio:"medium", idx:4,  project:"p7" },
  { kind:"review",    prio:"medium", idx:5,  project:"p3" },
  { kind:"ready",     prio:"high",   idx:6,  project:"p8" },
  { kind:"flagged",   prio:"medium", idx:7,  project:"p1" },
  { kind:"assigned",  prio:"low",    idx:8,  project:"p5" },
  { kind:"completed", prio:"medium", idx:9,  project:"p5" },
  { kind:"flagged",   prio:"high",   idx:10, project:"p2" },
  { kind:"ready",     prio:"high",   idx:11, project:"p3" },
];

// Daily throughput for sparkline (last 7 days)
const THROUGHPUT = [112, 98, 145, 133, 167, 121, 188];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusColor(s: ProjStatus) {
  return s === "completed" ? "#22c55e"
       : s === "on_track"  ? "#818cf8"
       : s === "at_risk"   ? "#f59e0b"
       :                     "#ef4444";
}
// statusLabel is now provided via t.dashboard.status in components
function eventColor(k: EventKind) {
  return k === "ready"     ? "#22c55e"
       : k === "flagged"   ? "#ef4444"
       : k === "completed" ? "#818cf8"
       : k === "review"    ? "#f59e0b"
       :                     "#06b6d4";
}
function eventIcon(k: EventKind) {
  return k === "ready"     ? <Download size={13}/>
       : k === "flagged"   ? <AlertTriangle size={13}/>
       : k === "completed" ? <CheckCircle2 size={13}/>
       : k === "review"    ? <FileCheck size={13}/>
       :                     <Users size={13}/>;
}
function prioLabel(p: EventPrio, prio: { high: string; med: string; low: string }) {
  return p === "high" ? prio.high : p === "medium" ? prio.med : prio.low;
}
function prioColor(p: EventPrio) {
  return p === "high" ? "#ef4444" : p === "medium" ? "#f59e0b" : "#94a3b8";
}
function nowStr() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`;
}
let _eid = 0;
function makeEvent(pool: typeof EVENT_POOL_META): LiveEvent {
  const e = pool[Math.floor(Math.random() * pool.length)];
  return { ...e, id: `ev_${++_eid}`, ts: nowStr() };
}

// ─── World Map (react-simple-maps + Natural Earth atlas) ─────────────────────
// Country borders fetched from the public-domain Natural Earth 110m topojson
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

function WorldMap({ cities, activeUsers, labels }: { cities: CityNode[]; activeUsers: number[]; labels: { liveMap: string; annotators: string; hoverHint: string; activeAnnotators: string } }) {
  const [hovered, setHovered] = useState<number | null>(null);
  // Dynamic import so we don't break the build if the package isn't installed yet
  const [RSM, setRSM] = useState<any>(null);
  useEffect(() => {
    import("react-simple-maps").then(m => setRSM(m)).catch(() => setRSM(null));
  }, []);

  const totalOnline = activeUsers.reduce((a, b) => a + b, 0);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ background: "var(--s1)", border: "1px solid hsl(var(--border)/0.2)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-primary" />
          <span className="text-sm font-bold text-foreground font-headline uppercase tracking-wide">{labels.liveMap}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
          <span className="text-xs text-muted-foreground font-body">{totalOnline} {labels.annotators}</span>
        </div>
      </div>

      {/* Map body */}
      <div style={{ background:"var(--s2)" }}>
        {!RSM ? (
          /* Fallback while loading */
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm font-body">
            Loading map… (run <code className="mx-1 px-1 bg-muted rounded text-xs">npm install react-simple-maps</code> if this persists)
          </div>
        ) : (() => {
          const { ComposableMap, Geographies, Geography, Marker } = RSM;
          return (
            <ComposableMap
              projection="geoEqualEarth"
              projectionConfig={{ scale: 158, center: [10, 5] }}
              style={{ width:"100%", height:"auto" }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }: { geographies: any[] }) =>
                  geographies.map((geo: any) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="hsl(0,0%,18%)"
                      stroke="hsl(0,0%,28%)"
                      strokeWidth={0.4}
                      style={{
                        default: { outline:"none" },
                        hover:   { fill:"hsl(0,0%,23%)", outline:"none" },
                        pressed: { outline:"none" },
                      }}
                    />
                  ))
                }
              </Geographies>

              {cities.map((city, i) => {
                const users = activeUsers[i] ?? city.base;
                const r = Math.max(5, Math.min(22, 4 + users * 0.26));
                const isHov = hovered === i;
                return (
                  <Marker
                    key={city.name}
                    coordinates={[city.lon, city.lat] as [number, number]}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {/* Pulse ring */}
                    <circle r={r + 5} fill="none" stroke="#9071f0" strokeWidth="1" opacity="0.28" style={{ pointerEvents:"none" }}>
                      <animate attributeName="r"       values={`${r+3};${r+13};${r+3}`} dur="3s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.28;0;0.28"             dur="3s" repeatCount="indefinite"/>
                    </circle>
                    {/* Core bubble */}
                    <circle
                      r={r}
                      fill="#9071f0"
                      opacity={isHov ? 0.97 : 0.78}
                      style={{ cursor:"pointer" }}
                    />
                    {/* Count label */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      y={0.5}
                      fontSize={r > 9 ? 8 : 7}
                      fontWeight="700"
                      fill="white"
                      style={{ pointerEvents:"none", fontFamily:"sans-serif", userSelect:"none" }}
                    >
                      {users}
                    </text>
                    {/* Hover tooltip */}
                    {isHov && (
                      <g style={{ pointerEvents:"none" }}>
                        <rect x={-54} y={-r - 38} width="108" height="30" rx="5"
                          fill="hsl(0,0%,8%)" stroke="rgba(144,113,240,0.45)" strokeWidth="1"/>
                        <text y={-r - 26} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="white"
                          style={{ fontFamily:"sans-serif" }}>{city.name}</text>
                        <text y={-r - 14} textAnchor="middle" fontSize="8.5" fill="#9071f0"
                          style={{ fontFamily:"sans-serif" }}>{users} {labels.activeAnnotators}</text>
                      </g>
                    )}
                  </Marker>
                );
              })}
            </ComposableMap>
          );
        })()}
      </div>

      {/* Legend */}
      <div className="px-5 py-2.5 border-t border-border/20 flex items-center gap-5 text-xs text-muted-foreground font-body">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary/70 inline-block"/>&lt; 15</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-primary/80 inline-block"/>&gt; 15</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-primary/90 inline-block"/>&gt; 40</span>
        <span className="ml-auto italic opacity-60">{labels.hoverHint}</span>
      </div>
    </div>
  );
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  const w = 120, h = 32, pad = 3;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / range) * (h - pad * 2),
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#9071f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="2.5" fill="#9071f0"/>
    </svg>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, accent, trend }: {
  label: string; value: string | number; sub: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string; trend?: string;
}) {
  return (
    <div className="industrial-card rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground font-body">{label}</span>
        <div className="p-2 rounded-lg" style={{ background: `${accent}18` }}>
          <Icon size={16} style={{ color: accent }} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold font-headline text-foreground" style={{ color: accent }}>{value}</span>
        {trend && <span className="text-xs text-green-400 mb-1 font-body">{trend}</span>}
      </div>
      <span className="text-xs text-muted-foreground font-body">{sub}</span>
    </div>
  );
}

// ─── Project Row ───────────────────────────────────────────────────────────────
function ProjectRow({ p, idx, statusLabels, projectName }: { p: Project; idx: number; statusLabels: Record<string,string>; projectName: string }) {
  const pct = Math.round((p.completed / p.totalTasks) * 100);
  const revPct = Math.round((p.inReview / p.totalTasks) * 100);
  const sc = statusColor(p.status);
  return (
    <motion.tr
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.06 }}
      className="border-b border-border/15 hover:bg-muted/20 transition-colors"
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-lg text-foreground/40">{p.typeIcon}</span>
          <div>
            <p className="text-sm font-bold text-foreground font-headline leading-tight">{projectName}</p>
            <p className="text-xs text-muted-foreground font-body">{p.client}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 hidden md:table-cell">
        <span className="text-xs text-muted-foreground font-body">{p.language}</span>
      </td>
      <td className="py-3 px-4">
        <div className="flex flex-col gap-1 min-w-[100px]">
          <div className="h-2 rounded-full bg-muted/40 overflow-hidden flex">
            <div className="h-full rounded-l-full transition-all duration-700" style={{ width:`${pct}%`, background: sc }} />
            <div className="h-full transition-all duration-700" style={{ width:`${revPct}%`, background:"#f59e0b", opacity:0.65 }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground font-body">
            <span>{p.completed}/{p.totalTasks}</span>
            <span>{pct}%</span>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full font-body"
          style={{ background:`${sc}18`, color: sc }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc }}/>
          {statusLabels[p.status]}
        </span>
      </td>
      <td className="py-3 px-4 hidden lg:table-cell">
        <span className="text-xs text-muted-foreground font-body flex items-center gap-1">
          <Clock size={11}/> {p.dueDate}
        </span>
      </td>
      <td className="py-3 px-4 hidden lg:table-cell">
        <span className="text-xs text-muted-foreground font-body flex items-center gap-1">
          <Users size={11}/> {p.team}
        </span>
      </td>
    </motion.tr>
  );
}

// ─── Event Item ────────────────────────────────────────────────────────────────
function EventItem({ ev }: { ev: LiveEvent }) {
  const { t } = useLanguage();
  const ec = eventColor(ev.kind);
  const pc = prioColor(ev.prio);
  const text = t.dashboard.eventPool[ev.idx] ?? { title: "", detail: "" };
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="flex gap-3 py-3 border-b border-border/15 last:border-0"
    >
      <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background:`${ec}20`, color: ec }}>
        {eventIcon(ev.kind)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-xs font-bold text-foreground font-headline leading-tight">{text.title}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background:`${pc}18`, color: pc }}>
            {prioLabel(ev.prio, t.dashboard.prio)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-body leading-snug truncate">{text.detail}</p>
        <span className="text-[10px] text-muted-foreground/50 font-body">{ev.ts}</span>
      </div>
    </motion.div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const d = t.dashboard;

  // Live user counts per city (fluctuate every ~5 s)
  const [userCounts, setUserCounts] = useState<number[]>(CITIES.map(c => c.base));
  // Live event feed (max 12 shown)
  const [events, setEvents] = useState<LiveEvent[]>(() => {
    // Seed with 5 initial events
    return Array.from({ length: 5 }, () => makeEvent(EVENT_POOL_META));
  });
  const [lastRefresh, setLastRefresh] = useState<string>(nowStr());
  const [totalOnline, setTotalOnline] = useState(0);

  // Total online = sum of user counts
  useEffect(() => {
    setTotalOnline(userCounts.reduce((a, b) => a + b, 0));
  }, [userCounts]);

  // Fluctuate user counts every 4 s
  useEffect(() => {
    const id = setInterval(() => {
      setUserCounts(prev =>
        prev.map((v, i) => {
          const base = CITIES[i].base;
          const delta = Math.round((Math.random() - 0.45) * Math.max(3, base * 0.18));
          return Math.max(1, Math.min(base * 2, v + delta));
        })
      );
      setLastRefresh(nowStr());
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Push new events every 7 s
  useEffect(() => {
    const id = setInterval(() => {
      setEvents(prev => {
        const next = [makeEvent(EVENT_POOL_META), ...prev].slice(0, 12);
        return next;
      });
    }, 7000);
    return () => clearInterval(id);
  }, []);

  // Derived KPIs
  const totalTasks    = PROJECTS.reduce((a, p) => a + p.totalTasks, 0);
  const totalDone     = PROJECTS.reduce((a, p) => a + p.completed, 0);
  const completionPct = Math.round((totalDone / totalTasks) * 100);
  const atRiskCount   = PROJECTS.filter(p => p.status === "at_risk" || p.status === "delayed").length;
  const readyCount    = events.filter(e => e.kind === "ready").length;

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="dark-surface sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-border/20">
        <div className="flex items-center justify-between px-6 py-3 h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-muted rounded-full transition-colors">
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </button>
            <span
              className="text-sm font-bold tracking-wide text-white cursor-pointer hover:text-white/80 transition-colors font-headline shrink-0"
              onClick={() => navigate("/use-cases")}
            >
              TP.ai <span style={{ color: "#9071f0" }}>Data</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-foreground/80 font-body">{d.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LanguagePicker />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body">
              <RefreshCw size={11} className="text-green-400"/>
              <span>{d.live} {lastRefresh}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-xs font-bold text-primary font-body">{totalOnline} {d.onlineLabel}</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
      </header>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8 space-y-8">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold font-headline text-foreground uppercase tracking-wide">{d.title}</h1>
          <p className="text-sm text-muted-foreground font-body mt-0.5">{d.subtitle}</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label={d.kpi.activeProjects}
            value={PROJECTS.filter(p=>p.status!=="completed").length}
            sub={d.kpi.activeProjectsSub(PROJECTS.filter(p=>p.status==="completed").length, PROJECTS.length)}
            icon={BarChart3}
            accent="#818cf8"
            trend={d.thisWeek}
          />
          <KPICard
            label={d.kpi.completion}
            value={`${completionPct}%`}
            sub={d.kpi.completionSub(totalDone, totalTasks)}
            icon={TrendingUp}
            accent="#22c55e"
          />
          <KPICard
            label={d.kpi.attention}
            value={atRiskCount}
            sub={d.kpi.attentionSub}
            icon={AlertTriangle}
            accent={atRiskCount > 0 ? "#ef4444" : "#22c55e"}
          />
          <KPICard
            label={d.kpi.ready}
            value={readyCount}
            sub={d.kpi.readySub}
            icon={Download}
            accent="#f59e0b"
          />
        </div>

        {/* Middle row: project table + event feed */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">

          {/* Project table */}
          <div className="industrial-card rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-primary"/>
                <span className="text-sm font-bold font-headline uppercase tracking-wide text-foreground">{d.projectTracker}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/80"/><span className="text-xs text-muted-foreground font-body">{d.status.onTrack}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 ml-1"/><span className="text-xs text-muted-foreground font-body">{d.status.atRisk}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/80 ml-1"/><span className="text-xs text-muted-foreground font-body">{d.status.delayed}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/15 text-left">
                    <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground font-body">{d.col.project}</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground font-body hidden md:table-cell">{d.col.language}</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground font-body">{d.col.progress}</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground font-body">{d.col.status}</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground font-body hidden lg:table-cell">{d.col.due}</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground font-body hidden lg:table-cell">{d.col.team}</th>
                  </tr>
                </thead>
                <tbody>
                  {PROJECTS.map((p, i) => (
                    <ProjectRow
                      key={p.id}
                      p={p}
                      idx={i}
                      statusLabels={d.status}
                      projectName={d.projects[p.id] ?? p.name}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {/* Throughput bar */}
            <div className="flex items-center gap-4 px-5 py-3 border-t border-border/20 bg-muted/10">
              <div className="flex items-center gap-2">
                <Zap size={12} className="text-primary"/>
                <span className="text-xs text-muted-foreground font-body">{d.throughput}</span>
              </div>
              <Sparkline data={THROUGHPUT}/>
              <span className="text-xs font-bold text-primary font-body ml-auto">{THROUGHPUT[THROUGHPUT.length-1]} {d.tasksToday}</span>
            </div>
          </div>

          {/* Live event feed */}
          <div className="industrial-card rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/20 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-primary"/>
                <span className="text-sm font-bold font-headline uppercase tracking-wide text-foreground">{d.liveEvents}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"/>
                <span className="text-xs text-muted-foreground font-body">{d.autoUpdating}</span>
              </div>
            </div>
            {/* Filter pills */}
            <div className="flex gap-1.5 px-5 py-2.5 border-b border-border/10 flex-shrink-0">
              {([d.filterAll, d.filterReady, d.filterFlagged, d.filterCompleted]).map(f => (
                <button key={f} className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border font-body transition-colors hover:border-primary/60 hover:text-primary"
                  style={{ borderColor:"hsl(var(--border)/0.3)", color:"hsl(var(--muted-foreground))" }}>
                  {f}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-4 divide-y divide-border/10" style={{ maxHeight:460 }}>
              <AnimatePresence initial={false}>
                {events.map(ev => <EventItem key={ev.id} ev={ev}/>)}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* World map */}
        <WorldMap cities={CITIES} activeUsers={userCounts} labels={{ liveMap: d.liveMap, annotators: d.annotators, hoverHint: d.hoverHint, activeAnnotators: d.activeAnnotators }}/>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground/40 font-body pb-4">
          {d.footerNote}
        </p>
      </div>
    </div>
  );
}
