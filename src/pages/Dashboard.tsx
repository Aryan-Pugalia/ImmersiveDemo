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
  title: string; detail: string; ts: string; project: string;
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

const EVENT_POOL: Omit<LiveEvent, "id" | "ts">[] = [
  { kind:"ready",     prio:"high",   title:"Dataset ready for client download", detail:"Multilingual Speech Batch 7 — ZH subset (847 segments, 2.3 GB)", project:"p1" },
  { kind:"flagged",   prio:"high",   title:"Deadline at risk — immediate attention", detail:"Video Temporal Annotation is 16% complete; due Apr 20", project:"p6" },
  { kind:"ready",     prio:"high",   title:"Dataset ready for client download", detail:"Invoice APAC — KO subset export available (198 documents)", project:"p4" },
  { kind:"flagged",   prio:"high",   title:"QA flag: re-annotation required",   detail:"AutoVision LiDAR frame 0412 — missed occlusion, 3 boxes deleted", project:"p2" },
  { kind:"completed", prio:"medium", title:"Batch completed — review open",     detail:"Korean CX Transcription — 40 tasks submitted, IAA 88%", project:"p7" },
  { kind:"review",    prio:"medium", title:"Awaiting senior QA sign-off",       detail:"Medical Scan Annotation — 12 scans queued for final approval", project:"p3" },
  { kind:"ready",     prio:"high",   title:"Dataset ready for client download", detail:"French Legal IDP — first 67 invoices exported (JSON + SRT)", project:"p8" },
  { kind:"flagged",   prio:"medium", title:"Low-confidence segments flagged",   detail:"Hindi Batch hi_02 — 3 segments marked needs-pass-2", project:"p1" },
  { kind:"assigned",  prio:"low",    title:"Annotators onboarded",             detail:"3 new annotators added to RLHF Image Preference (GenAI Studio)", project:"p5" },
  { kind:"completed", prio:"medium", title:"Quality milestone reached",         detail:"RLHF Image Preference exceeded 85% IAA threshold — ahead of schedule", project:"p5" },
  { kind:"flagged",   prio:"high",   title:"Client SLA at risk",               detail:"AutoVision delivery window closes Apr 23 — 38 tasks remain in queue", project:"p2" },
  { kind:"ready",     prio:"high",   title:"Dataset ready for client download", detail:"Medical Scan Annotation — all 95 scans annotated, QC passed", project:"p3" },
];

// Daily throughput for sparkline (last 7 days)
const THROUGHPUT = [112, 98, 145, 133, 167, 121, 188];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MAP_W = 1000, MAP_H = 460;
function project(lon: number, lat: number) {
  return { x: ((lon + 180) / 360) * MAP_W, y: ((90 - lat) / 180) * MAP_H };
}

function statusColor(s: ProjStatus) {
  return s === "completed" ? "#22c55e"
       : s === "on_track"  ? "#818cf8"
       : s === "at_risk"   ? "#f59e0b"
       :                     "#ef4444";
}
function statusLabel(s: ProjStatus) {
  return s === "completed" ? "Completed"
       : s === "on_track"  ? "On Track"
       : s === "at_risk"   ? "At Risk"
       :                     "Delayed";
}
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
function prioLabel(p: EventPrio) {
  return p === "high" ? "HIGH" : p === "medium" ? "MED" : "LOW";
}
function prioColor(p: EventPrio) {
  return p === "high" ? "#ef4444" : p === "medium" ? "#f59e0b" : "#94a3b8";
}
function nowStr() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`;
}
let _eid = 0;
function makeEvent(pool: typeof EVENT_POOL): LiveEvent {
  const e = pool[Math.floor(Math.random() * pool.length)];
  return { ...e, id: `ev_${++_eid}`, ts: nowStr() };
}

// ─── World Map SVG ────────────────────────────────────────────────────────────
// City screen coords (W=1000, H=460, equirectangular):
//   New York  (294,126)  London    (500, 98)  Paris     (506,105)
//   Cairo     (587,153)  Casablanca(479,144)  Nairobi   (602,234)
//   Hyderabad (718,186)  Beijing   (823,128)  Seoul     (853,134)
//   Tokyo     (888,139)  Manila    (836,193)  SaoPaulo  (371,290)
//   Bogota    (294,218)  Sydney    (920,317)
const CONTINENTS = [
  // North America — east coast passes ~x=295 at y=126 so New York (294,126) sits inside
  { d:"M 40,82 L 64,60 L 75,50 L 96,44 L 132,34 L 170,26 L 198,22 L 228,24 L 254,35 L 276,48 L 292,64 L 320,80 L 362,107 L 358,117 L 310,117 L 300,123 L 294,131 L 284,149 L 276,166 L 266,183 L 263,205 L 249,211 L 237,205 L 223,193 L 207,179 L 195,159 L 184,139 L 164,123 L 149,107 L 129,91 L 101,83 L 75,79 Z" },
  // Greenland
  { d:"M 284,22 L 320,16 L 357,22 L 374,38 L 367,57 L 342,67 L 310,67 L 283,56 L 273,39 Z" },
  // Iceland
  { d:"M 412,46 L 428,40 L 445,44 L 449,55 L 441,63 L 422,63 L 410,55 Z" },
  // South America — must contain Bogotá (294,218) and São Paulo (371,290)
  { d:"M 267,208 L 300,194 L 342,195 L 364,205 L 404,229 L 410,269 L 402,295 L 392,307 L 369,331 L 350,345 L 322,368 L 300,361 L 285,339 L 277,305 L 272,263 L 269,227 Z" },
  // Europe — mainland; contains Paris (506,105)
  { d:"M 454,61 L 475,53 L 502,51 L 522,55 L 542,63 L 554,77 L 549,93 L 559,109 L 549,123 L 529,133 L 509,135 L 488,129 L 467,119 L 453,107 L 447,91 Z" },
  // British Isles — separate island; contains London (500,98)
  { d:"M 455,81 L 477,71 L 506,73 L 510,89 L 504,103 L 489,109 L 463,105 L 451,93 Z" },
  // Ireland
  { d:"M 438,82 L 451,76 L 456,84 L 452,94 L 440,96 L 433,89 Z" },
  // Scandinavia
  { d:"M 500,50 L 518,44 L 538,48 L 554,62 L 552,76 L 542,63 L 522,55 Z" },
  // Africa — NE corner extended to x=607 so Cairo (587,153) is inside; Nairobi (602,234) inside
  { d:"M 455,137 L 481,131 L 511,133 L 543,137 L 571,143 L 597,141 L 607,155 L 615,163 L 621,181 L 619,205 L 609,221 L 609,253 L 595,283 L 579,309 L 555,333 L 525,351 L 497,357 L 469,345 L 449,321 L 441,293 L 441,264 L 447,233 L 453,201 L 457,171 Z" },
  // Arabian Peninsula (Asia extension — connects to Asia main at x=597,y=141)
  { d:"M 597,141 L 627,154 L 636,169 L 641,197 L 633,219 L 617,229 L 605,223 L 597,201 L 591,179 L 595,161 Z" },
  // Asia main — right boundary at y=128 is x=883, so Beijing (823,128) and Seoul (853,134) inside
  { d:"M 573,67 L 635,53 L 713,51 L 787,53 L 841,61 L 889,75 L 907,93 L 901,115 L 877,135 L 853,151 L 819,163 L 784,171 L 751,175 L 717,179 L 684,176 L 654,167 L 627,154 L 601,139 L 577,123 L 559,103 L 559,81 Z" },
  // India — widened to x=757 at y=186 so Hyderabad (718,186) is inside
  { d:"M 691,169 L 731,165 L 761,174 L 757,191 L 725,201 L 715,211 L 706,235 L 699,233 L 695,211 L 693,189 Z" },
  // Sri Lanka
  { d:"M 706,235 L 716,232 L 720,240 L 713,246 L 705,242 Z" },
  // Malay Peninsula + Indochina
  { d:"M 717,179 L 749,184 L 765,201 L 761,221 L 743,229 L 723,221 L 717,207 Z" },
  // Japan — contains Tokyo (888,139)
  { d:"M 874,127 L 893,121 L 908,131 L 909,149 L 897,157 L 876,150 L 869,137 Z" },
  // Philippines — contains Manila (836,193)
  { d:"M 824,188 L 844,183 L 857,197 L 853,213 L 835,217 L 821,207 Z" },
  // Borneo
  { d:"M 762,200 L 800,194 L 820,202 L 822,222 L 806,234 L 782,232 L 764,218 Z" },
  // Sumatra
  { d:"M 736,206 L 762,200 L 764,218 L 750,228 L 730,222 Z" },
  // Australia — contains Sydney (920,317)
  { d:"M 801,279 L 859,269 L 915,275 L 943,293 L 947,319 L 939,346 L 915,361 L 874,366 L 835,359 L 805,338 L 794,311 Z" },
  // New Zealand
  { d:"M 951,325 L 962,317 L 971,327 L 965,339 L 953,339 Z" },
];

function WorldMap({ cities, activeUsers }: { cities: CityNode[]; activeUsers: number[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ background: "hsl(0,0%,5%)", border: "1px solid hsl(var(--border)/0.2)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-primary" />
          <span className="text-sm font-bold text-foreground font-headline uppercase tracking-wide">Live Annotator Activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
          <span className="text-xs text-muted-foreground font-body">{activeUsers.reduce((a,b)=>a+b,0)} annotators online</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="w-full"
        style={{ display:"block" }}
      >
        {/* Ocean background */}
        <rect width={MAP_W} height={MAP_H} fill="hsl(0,0%,6%)" />

        {/* Subtle grid */}
        <defs>
          <pattern id="mapgrid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="hsl(0,0%,12%)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width={MAP_W} height={MAP_H} fill="url(#mapgrid)" />

        {/* Equator + Prime Meridian guides */}
        <line x1="0" y1={MAP_H/2} x2={MAP_W} y2={MAP_H/2} stroke="hsl(0,0%,14%)" strokeWidth="0.8" strokeDasharray="4 6"/>
        <line x1={MAP_W/2} y1="0" x2={MAP_W/2} y2={MAP_H} stroke="hsl(0,0%,14%)" strokeWidth="0.8" strokeDasharray="4 6"/>

        {/* Continents */}
        {CONTINENTS.map((c, i) => (
          <path key={i} d={c.d} fill="hsl(0,0%,16%)" stroke="hsl(0,0%,22%)" strokeWidth="0.8"/>
        ))}

        {/* City bubbles */}
        {cities.map((city, i) => {
          const { x, y } = project(city.lon, city.lat);
          const users = activeUsers[i] ?? city.base;
          const r = Math.max(6, Math.min(28, 5 + users * 0.32));
          const isHov = hovered === i;
          return (
            <g key={city.name} style={{ cursor:"pointer" }} onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}>
              {/* Pulse ring */}
              <circle cx={x} cy={y} r={r + 6} fill="none" stroke="#9071f0" strokeWidth="1" opacity="0.25">
                <animate attributeName="r" values={`${r+4};${r+14};${r+4}`} dur="2.8s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.25;0;0.25" dur="2.8s" repeatCount="indefinite"/>
              </circle>
              {/* Core bubble */}
              <circle cx={x} cy={y} r={r} fill="#9071f0" opacity={isHov ? 0.95 : 0.72}/>
              {/* User count */}
              <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle"
                fontSize={users >= 20 ? 9 : 8} fontWeight="700" fill="white" opacity="0.95"
                style={{ pointerEvents:"none", fontFamily:"sans-serif" }}>
                {users}
              </text>
              {/* Tooltip on hover */}
              {isHov && (
                <g>
                  <rect x={x - 52} y={y - r - 38} width="104" height="30" rx="5"
                    fill="hsl(0,0%,8%)" stroke="hsl(var(--border)/0.4)" strokeWidth="1"/>
                  <text x={x} y={y - r - 27} textAnchor="middle" fontSize="9" fontWeight="700" fill="white" style={{ fontFamily:"sans-serif" }}>{city.name}</text>
                  <text x={x} y={y - r - 16} textAnchor="middle" fontSize="8" fill="#9071f0" style={{ fontFamily:"sans-serif" }}>{users} active annotators</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="px-5 py-2.5 border-t border-border/20 flex items-center gap-5 text-xs text-muted-foreground font-body">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary/70 inline-block"/>&lt; 15 annotators</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-primary/80 inline-block"/>&gt; 15</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-primary/90 inline-block"/>&gt; 40</span>
        <span className="ml-auto italic opacity-60">Hover a bubble for details</span>
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
function ProjectRow({ p, idx }: { p: Project; idx: number }) {
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
            <p className="text-sm font-bold text-foreground font-headline leading-tight">{p.name}</p>
            <p className="text-xs text-muted-foreground font-body">{p.client}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 hidden md:table-cell">
        <span className="text-xs text-muted-foreground font-body">{p.language}</span>
      </td>
      <td className="py-3 px-4">
        <div className="flex flex-col gap-1 min-w-[100px]">
          {/* Stacked progress: completed + in-review */}
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
          {statusLabel(p.status)}
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
  const ec = eventColor(ev.kind);
  const pc = prioColor(ev.prio);
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
          <span className="text-xs font-bold text-foreground font-headline leading-tight">{ev.title}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background:`${pc}18`, color: pc }}>
            {prioLabel(ev.prio)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-body leading-snug truncate">{ev.detail}</p>
        <span className="text-[10px] text-muted-foreground/50 font-body">{ev.ts}</span>
      </div>
    </motion.div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();

  // Live user counts per city (fluctuate every ~5 s)
  const [userCounts, setUserCounts] = useState<number[]>(CITIES.map(c => c.base));
  // Live event feed (max 12 shown)
  const [events, setEvents] = useState<LiveEvent[]>(() => {
    // Seed with 5 initial events
    return Array.from({ length: 5 }, () => makeEvent(EVENT_POOL));
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
        const next = [makeEvent(EVENT_POOL), ...prev].slice(0, 12);
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
      <header className="sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-border/20">
        <div className="flex items-center justify-between px-6 py-3 h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-muted rounded-full transition-colors">
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </button>
            <span className="text-sm font-bold tracking-wide text-white cursor-pointer hover:text-white/80 transition-colors font-headline"
              onClick={() => navigate("/use-cases")}>
              TP.ai <span style={{ color:"#9071f0" }}>FAB</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-foreground/80 font-body">Project Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body">
              <RefreshCw size={11} className="text-green-400"/>
              <span>Live · updated {lastRefresh}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-xs font-bold text-primary font-body">{totalOnline} online</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
      </header>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8 space-y-8">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold font-headline text-foreground uppercase tracking-wide">Operations Overview</h1>
          <p className="text-sm text-muted-foreground font-body mt-0.5">Real-time status across all active annotation projects</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Active Projects"
            value={PROJECTS.filter(p=>p.status!=="completed").length}
            sub={`${PROJECTS.length} total · ${PROJECTS.filter(p=>p.status==="completed").length} completed`}
            icon={BarChart3}
            accent="#818cf8"
            trend="↑ 2 this week"
          />
          <KPICard
            label="Overall Completion"
            value={`${completionPct}%`}
            sub={`${totalDone.toLocaleString()} of ${totalTasks.toLocaleString()} tasks done`}
            icon={TrendingUp}
            accent="#22c55e"
          />
          <KPICard
            label="Needs Attention"
            value={atRiskCount}
            sub="Projects at risk or delayed"
            icon={AlertTriangle}
            accent={atRiskCount > 0 ? "#ef4444" : "#22c55e"}
          />
          <KPICard
            label="Ready for Download"
            value={readyCount}
            sub="Datasets awaiting client pickup"
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
                <span className="text-sm font-bold font-headline uppercase tracking-wide text-foreground">Project Tracker</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/80"/><span className="text-xs text-muted-foreground font-body">On Track</span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 ml-1"/><span className="text-xs text-muted-foreground font-body">At Risk</span>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/80 ml-1"/><span className="text-xs text-muted-foreground font-body">Delayed</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/15 text-left">
                    <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground font-body">Project / Client</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground font-body hidden md:table-cell">Language</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground font-body">Progress</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground font-body">Status</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground font-body hidden lg:table-cell">Due</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground font-body hidden lg:table-cell">Team</th>
                  </tr>
                </thead>
                <tbody>
                  {PROJECTS.map((p, i) => <ProjectRow key={p.id} p={p} idx={i}/>)}
                </tbody>
              </table>
            </div>
            {/* Throughput bar */}
            <div className="flex items-center gap-4 px-5 py-3 border-t border-border/20 bg-muted/10">
              <div className="flex items-center gap-2">
                <Zap size={12} className="text-primary"/>
                <span className="text-xs text-muted-foreground font-body">7-day throughput</span>
              </div>
              <Sparkline data={THROUGHPUT}/>
              <span className="text-xs font-bold text-primary font-body ml-auto">{THROUGHPUT[THROUGHPUT.length-1]} tasks today</span>
            </div>
          </div>

          {/* Live event feed */}
          <div className="industrial-card rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/20 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-primary"/>
                <span className="text-sm font-bold font-headline uppercase tracking-wide text-foreground">Live Events</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"/>
                <span className="text-xs text-muted-foreground font-body">auto-updating</span>
              </div>
            </div>
            {/* Filter pills */}
            <div className="flex gap-1.5 px-5 py-2.5 border-b border-border/10 flex-shrink-0">
              {(["All","Ready","Flagged","Completed"] as const).map(f => (
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
        <WorldMap cities={CITIES} activeUsers={userCounts}/>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground/40 font-body pb-4">
          All data is simulated for demonstration purposes · TP.ai FABStudio Platform Dashboard
        </p>
      </div>
    </div>
  );
}
