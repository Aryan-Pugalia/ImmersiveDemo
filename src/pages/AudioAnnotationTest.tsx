import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Play, Pause, Download, Save, Send,
  SkipBack, SkipForward, Volume2, CheckCircle, XCircle,
  Copy, Check, ChevronRight, X, FileEdit, Sparkles,
  ClipboardCheck, PackageCheck, HelpCircle,
} from "lucide-react";

// ─── Script.json type ─────────────────────────────────────────────────────────
interface ScriptSegment {
  id: string;
  speaker: string;
  role: string;
  startMs: number;
  endMs: number;
  sourceText: string;
  englishText: string;
}
interface ScriptJson {
  title: string;
  language: string;
  languageLabel: string;
  audioFile: string;
  durationSec: number;
  domain: string;
  difficulty: "easy" | "medium";
  segments: ScriptSegment[];
}

// ─── Auto-discover all Script.json files under src/queues/*/Script.json ───────
// Adding a new folder with Script.json + public/queues/{Folder}/Audio.mp3
// is all that's needed to add a new queue — no code changes required.
const scriptModules = import.meta.glob("../queues/*/Script.json", { eager: true });

interface Task {
  id: string;
  queueName: string;
  audioPath: string;
  title: string;
  language: string;
  languageLabel: string;
  durationSec: number;
  domain: string;
  difficulty: "easy" | "medium";
  segments: ScriptSegment[];
}

const TASKS: Task[] = Object.entries(scriptModules).map(([path, mod]) => {
  const queueName = path.match(/queues\/(.+)\/Script\.json/)?.[1] ?? "unknown";
  const script = (mod as { default: ScriptJson }).default ?? (mod as ScriptJson);
  return {
    id: queueName.toLowerCase().replace(/\s+/g, "_"),
    queueName,
    audioPath: `/queues/${queueName}/${script.audioFile}`,
    title: script.title,
    language: script.language,
    languageLabel: script.languageLabel,
    durationSec: script.durationSec,
    domain: script.domain,
    difficulty: script.difficulty,
    segments: script.segments,
  };
});

// ─── Language meta ────────────────────────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {
  es: "🇪🇸", en: "🇺🇸", fr: "🇫🇷", pt: "🇧🇷",
  zh: "🇨🇳", ar: "🇸🇦", hi: "🇮🇳", ko: "🇰🇷", ja: "🇯🇵", de: "🇩🇪",
};
function langFlag(code: string) { return FLAG_MAP[code] ?? "🌐"; }

const SPEAKER_COLORS: Record<string, string> = {
  S1: "#818cf8", S2: "#34d399", OVERLAP: "#fb923c", UNK: "#94a3b8",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function msToTC(ms: number) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), ss = s % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}.${String(cs).padStart(2,"0")}`;
}
function fmtDur(s: number) { const m = Math.floor(s/60), ss=s%60; return m>0?`${m}m ${ss}s`:`${ss}s`; }
function makeWaveBars(seed: string, count=80): number[] {
  let h=0; for(let i=0;i<seed.length;i++) h=((h<<5)-h+seed.charCodeAt(i))|0;
  return Array.from({length:count},(_,i)=>{ h=(h*1664525+1013904223)|0; const b=0.15+0.6*Math.abs(Math.sin(i*0.35+(h&0xffff)/65536)); return Math.min(1,b+0.05*((h>>16)/65536)); });
}

// ─── Workflow stepper ─────────────────────────────────────────────────────────
type WfStage = "annotate" | "ai_verify" | "qa_review" | "delivered";
const WF_STAGES: { id: WfStage; label: string; Icon: React.ComponentType<{size?:number}> }[] = [
  { id:"annotate",  label:"Annotate",   Icon: FileEdit      },
  { id:"ai_verify", label:"AI Verify",  Icon: Sparkles      },
  { id:"qa_review", label:"QA Review",  Icon: ClipboardCheck},
  { id:"delivered", label:"Delivered",  Icon: PackageCheck  },
];

function WorkflowStepper({ current }: { current: WfStage }) {
  const idx = WF_STAGES.findIndex(s => s.id === current);
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const NOTES: Record<WfStage,string> = {
    annotate:  "Fill in all segment transcripts and translations, then Submit.",
    ai_verify: "Our AI model is cross-checking timestamps and translation quality.",
    qa_review: "A senior reviewer is checking for errors before final sign-off.",
    delivered: "All checks passed. Annotations exported to the data pipeline.",
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="px-1 pt-2">
        <div className="flex items-center justify-between">
          {WF_STAGES.map((s,i) => {
            const { Icon } = s;
            const isDone    = i < idx;
            const isCurrent = i === idx;
            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center flex-1">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300"
                    style={{
                      borderColor: isDone||isCurrent ? "hsl(var(--primary))" : isLight ? "rgba(0,0,0,0.2)" : "hsl(0,0%,28%)",
                      background:  isCurrent ? "hsl(var(--primary)/0.15)" : isDone ? "hsl(var(--primary)/0.85)" : "transparent",
                      color:       isCurrent ? "hsl(var(--primary))"       : isDone ? "#fff"                     : isLight ? "rgba(0,0,0,0.45)" : "hsl(0,0%,55%)",
                    }}>
                    <Icon size={15}/>
                  </div>
                  <span className="mt-1.5 text-[11px] font-semibold whitespace-nowrap"
                    style={{ color: isCurrent?"hsl(var(--primary))":isDone ? "hsl(var(--foreground))" : isLight ? "rgba(0,0,0,0.45)" : "hsl(0,0%,55%)" }}>
                    {s.label}
                  </span>
                </div>
                {i < WF_STAGES.length-1 && (
                  <div className="h-px flex-1 mx-1 -translate-y-3.5 transition-all duration-500"
                    style={{ background: i<idx?"hsl(var(--primary))": isLight ? "rgba(0,0,0,0.12)" : "hsl(0,0%,20%)" }}/>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      <div className="bg-primary/8 border border-primary/20 rounded-xl px-3 py-2.5 text-xs text-foreground/70 leading-relaxed">
        <span className="font-semibold text-primary capitalize">{current.replace("_"," ")}:</span>{" "}{NOTES[current]}
      </div>
    </div>
  );
}

// ─── Tutorial ─────────────────────────────────────────────────────────────────
interface TutStep { title:string; body:string; target:string; position:"top"|"bottom"|"left"|"right"; action:string; }
const AUDIO_TUTORIAL: TutStep[] = [
  { title:"Audio Waveform",     target:"aud-waveform",       position:"bottom", action:"Click Next to continue",
    body:"Visualises the full audio recording. Coloured regions are annotated segments. Shift+drag to create a new segment." },
  { title:"Playback",           target:"aud-controls",       position:"bottom", action:"Click Play to hear the real audio",
    body:"Press Play to hear the actual recording. Use J / L to seek 2s back or forward. The playhead tracks real audio time." },
  { title:"Segment Table",      target:"aud-table",          position:"top",    action:"Click a row to jump to that segment",
    body:"Each row is one spoken turn. Click any row to seek the playhead to its start. Edit source text and English translation directly." },
  { title:"Speaker Labels",     target:"aud-speaker-0",      position:"right",  action:"Change the dropdown to S2 for the second speaker",
    body:"Assign S1 or S2 to each segment. Use OVERLAP for simultaneous speech, UNK if you cannot determine the speaker." },
  { title:"Transcript Tab",     target:"aud-tab-transcript", position:"bottom", action:"Switch to the Transcript tab",
    body:"Segment-by-segment transcript editor. Type exactly what you hear — use [inaudible] for unclear speech." },
  { title:"Translation Tab",    target:"aud-tab-translation",position:"bottom", action:"Switch to the Translation tab",
    body:"Add the English translation for each segment. Stay faithful to meaning rather than word-for-word." },
  { title:"Submit for Review",  target:"aud-submit",         position:"left",   action:"Click Submit when all segments are filled",
    body:"Once all segments have source text and a translation, click Submit to advance through the pipeline." },
];

function AudioTutorial({ step, total, onNext, onSkip }: {
  step:TutStep; total:number; stepIdx:number; onNext:()=>void; onSkip:()=>void;
}) {
  const [rect, setRect] = useState<{top:number;left:number;width:number;height:number}|null>(null);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const update = () => {
      const el = document.querySelector(`[data-aud="${step.target}"]`);
      if (el) { const r=el.getBoundingClientRect(), p=8; setRect({top:r.top-p,left:r.left-p,width:r.width+p*2,height:r.height+p*2}); }
      else setRect(null);
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step.target]);

  const tipStyle = (): React.CSSProperties => {
    if (!rect) return { position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)" };
    const g=16, vw=window.innerWidth, vh=window.innerHeight;
    const clampL = (l:number,w:number) => Math.max(8,Math.min(l,vw-w-8));
    switch(step.position) {
      case "right": return { position:"fixed", top:Math.max(8,Math.min(rect.top,vh-200)), left:Math.min(rect.left+rect.width+g,vw-316), maxWidth:300 };
      case "left":  return { position:"fixed", top:Math.max(8,Math.min(rect.top,vh-200)), right:vw-rect.left+g, maxWidth:300 };
      case "top":   return { position:"fixed", bottom:Math.max(8,vh-rect.top+g), left:clampL(rect.left,340), maxWidth:340 };
      case "bottom":return { position:"fixed", top:Math.min(rect.top+rect.height+g,vh-220), left:clampL(rect.left,340), maxWidth:340 };
    }
  };

  return (
    <>
      {rect ? (<>
        <div className="fixed z-[100] bg-black/65" style={{top:0,left:0,right:0,height:Math.max(0,rect.top)}}/>
        <div className="fixed z-[100] bg-black/65" style={{top:rect.top+rect.height,left:0,right:0,bottom:0}}/>
        <div className="fixed z-[100] bg-black/65" style={{top:rect.top,left:0,width:Math.max(0,rect.left),height:rect.height}}/>
        <div className="fixed z-[100] bg-black/65" style={{top:rect.top,left:rect.left+rect.width,right:0,height:rect.height}}/>
        <div className="fixed z-[101] rounded-xl border-2 border-primary animate-pulse pointer-events-none"
          style={{top:rect.top,left:rect.left,width:rect.width,height:rect.height,transition:"all 0.25s ease"}}/>
      </>) : <div className="fixed inset-0 z-[100] bg-black/65"/>}
      <div className="fixed z-[103] animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={tipStyle()}>
        <div className="bg-card border border-border rounded-xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-primary">Step {AUDIO_TUTORIAL.indexOf(step)+1} of {total}</span>
            <button onClick={onSkip} className="text-muted-foreground/60 hover:text-foreground"><X size={13}/></button>
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1">{step.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">{step.body}</p>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 mb-3">
            <ChevronRight size={11} className="text-primary shrink-0"/>
            <span className="text-xs font-medium text-primary">{step.action}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onNext} className="flex-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/80">Next</button>
            <button onClick={onSkip} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">Skip</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Waveform ─────────────────────────────────────────────────────────────────
interface AnnotSeg {
  id:string; startMs:number; endMs:number; speaker:string; nonSpeech:string;
  sourceText:string; englishText:string; lowConf:boolean; needsPass2:boolean;
  audioIssue:string; comments:{by:string;text:string;at:string}[];
}

// Parse "MM:SS.cs" timecode back to milliseconds
function parseTC(tc: string): number | null {
  const m = tc.match(/^(\d+):(\d{2})\.(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1])*60000 + parseInt(m[2])*1000 + parseInt(m[3])*10;
}

function Waveform({ taskId, durationSec, segments, selectedId, playheadRatio, onSeek, onAddSegment, onResizeSeg }: {
  taskId:string; durationSec:number; segments:AnnotSeg[]; selectedId:string|null;
  playheadRatio:number; onSeek:(r:number)=>void; onAddSegment:(s:number,e:number)=>void;
  onResizeSeg:(id:string, startMs:number, endMs:number)=>void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [newSegDrag, setNewSegDrag] = useState<{startX:number}|null>(null);
  const [resizeDrag, setResizeDrag] = useState<{segId:string; edge:'start'|'end'}|null>(null);
  const [hover,      setHover]      = useState<number|null>(null);
  const [edgeHover,  setEdgeHover]  = useState<{segId:string; edge:'start'|'end'}|null>(null);

  const bars    = makeWaveBars(taskId);
  const totalMs = durationSec * 1000;
  const EDGE_HIT = 0.018; // 1.8% of total width as hit zone

  const xToR = (cx:number) => { const r=svgRef.current?.getBoundingClientRect(); if(!r)return 0; return Math.max(0,Math.min(1,(cx-r.left)/r.width)); };

  const findEdge = (r:number) => {
    for (const seg of segments) {
      if (Math.abs(r - seg.startMs/totalMs) < EDGE_HIT) return { segId:seg.id, edge:'start' as const };
      if (Math.abs(r - seg.endMs/totalMs)   < EDGE_HIT) return { segId:seg.id, edge:'end'   as const };
    }
    return null;
  };

  const onMM = (e:React.MouseEvent) => {
    const r = xToR(e.clientX);
    setHover(r);
    if (resizeDrag) {
      const seg = segments.find(s => s.id === resizeDrag.segId);
      if (!seg) return;
      const ms = Math.round(r * totalMs);
      if (resizeDrag.edge === 'start') onResizeSeg(seg.id, Math.min(ms, seg.endMs - 200), seg.endMs);
      else                             onResizeSeg(seg.id, seg.startMs, Math.max(ms, seg.startMs + 200));
      return;
    }
    setEdgeHover(findEdge(r));
  };

  const onMD = (e:React.MouseEvent) => {
    const r = xToR(e.clientX);
    const edge = findEdge(r);
    if (edge) { e.stopPropagation(); setResizeDrag(edge); return; }
    if (e.shiftKey) setNewSegDrag({ startX: r });
    else onSeek(r);
  };

  const onMU = (e:React.MouseEvent) => {
    if (resizeDrag) { setResizeDrag(null); return; }
    if (newSegDrag) {
      const er=xToR(e.clientX), lo=Math.min(newSegDrag.startX,er), hi=Math.max(newSegDrag.startX,er);
      if (hi-lo>0.01) onAddSegment(Math.round(lo*totalMs), Math.round(hi*totalMs));
      setNewSegDrag(null);
    }
  };

  const onML = () => { setHover(null); setEdgeHover(null); if (resizeDrag) setResizeDrag(null); };

  const cursor = resizeDrag || edgeHover ? 'ew-resize' : newSegDrag ? 'col-resize' : 'crosshair';

  return (
    <div data-aud="aud-waveform">
      <svg ref={svgRef} viewBox="0 0 100 40" preserveAspectRatio="none"
        className="w-full h-20 select-none" style={{ cursor }}
        onMouseDown={onMD} onMouseMove={onMM} onMouseLeave={onML} onMouseUp={onMU}>
        <rect width="100" height="40" fill="#0a0f1e"/>
        {bars.map((h,i)=>{ const x=i/bars.length*100,w=100/bars.length*0.7,bh=h*28,y=(40-bh)/2;
          return <rect key={i} x={x} y={y} width={w} height={bh} fill={(i+.5)/bars.length<=playheadRatio?"#7c3aed":"#1e293b"} rx=".3"/>; })}

        {/* Segment regions with draggable edge handles */}
        {segments.map(seg=>{
          const x1=(seg.startMs/totalMs)*100, x2=(seg.endMs/totalMs)*100;
          const col=SPEAKER_COLORS[seg.speaker]||"#818cf8", sel=seg.id===selectedId;
          const resizing = resizeDrag?.segId === seg.id;
          return (
            <g key={seg.id}>
              {/* Fill */}
              <rect x={x1} y={0} width={x2-x1} height={40} fill={col+(resizing?"55":sel?"44":"1a")} stroke={col} strokeWidth={sel||resizing?.4:.2}/>
              {/* Visible edge bars */}
              <rect x={x1-.35} y={2} width={.7} height={36} fill={col} opacity={.85} rx=".2"/>
              <rect x={x2-.35} y={2} width={.7} height={36} fill={col} opacity={.85} rx=".2"/>
              {/* Wide transparent hit zones on edges — trigger ew-resize cursor */}
              <rect x={x1-1.5} y={0} width={3} height={40} fill="transparent" style={{cursor:'ew-resize'}}/>
              <rect x={x2-1.5} y={0} width={3} height={40} fill="transparent" style={{cursor:'ew-resize'}}/>
            </g>
          );
        })}

        {newSegDrag&&hover!=null&&<rect x={Math.min(newSegDrag.startX,hover)*100} y={0} width={Math.abs(hover-newSegDrag.startX)*100} height={40} fill="#818cf844" stroke="#818cf8" strokeWidth=".3"/>}
        <line x1={playheadRatio*100} y1={0} x2={playheadRatio*100} y2={40} stroke="#a78bfa" strokeWidth=".5"/>
        {hover!=null&&!newSegDrag&&!resizeDrag&&<line x1={hover*100} y1={0} x2={hover*100} y2={40} stroke="#ffffff33" strokeWidth=".3" strokeDasharray="1"/>}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-600 mt-0.5 font-mono">
        {Array.from({length:7},(_,i)=><span key={i}>{msToTC(Math.round(i/6*totalMs))}</span>)}
      </div>
      <p className="text-[10px] text-slate-600 mt-1 text-center select-none">
        Drag edge to resize · Shift+drag to create · click to seek
      </p>
    </div>
  );
}

// ─── Export modal ─────────────────────────────────────────────────────────────
function ExportModal({ task, segs, status, onClose }: { task:Task; segs:AnnotSeg[]; status:string; onClose:()=>void; }) {
  const [fmt,setFmt]      = useState<"json"|"csv">("json");
  const [copied,setCopied]= useState(false);
  const jsonStr = JSON.stringify({ project:"audio_transcribe_translate_test", taskId:task.id, queue:task.queueName,
    sourceLanguage:task.language, createdAt:new Date().toISOString(), status,
    segments:segs.map(s=>({segmentId:s.id,startMs:s.startMs,endMs:s.endMs,speaker:s.speaker,
      nonSpeech:s.nonSpeech,sourceText:s.sourceText,englishText:s.englishText,
      flags:{lowConfidence:s.lowConf,needsSecondPass:s.needsPass2,audioIssue:s.audioIssue},comments:s.comments})),
    taskLevel:{overallAudioQuality:"good",piiPresent:"none",reviewOutcome:status==="delivered"?"approved":"pending"},
  },null,2);
  const csvStr = ["segmentId,startMs,endMs,speaker,sourceText,englishText,audioIssue",
    ...segs.map(s=>[s.id,s.startMs,s.endMs,s.speaker,`"${s.sourceText.replace(/"/g,'""')}"`,`"${s.englishText.replace(/"/g,'""')}"`,s.audioIssue].join(","))
  ].join("\n");
  const content = fmt==="json"?jsonStr:csvStr;
  const filename = `${task.id}_annotation.${fmt}`;
  const dl = () => { const a=Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([content],{type:fmt==="json"?"application/json":"text/csv"})),download:filename}); a.click(); URL.revokeObjectURL(a.href); };
  const cp = async () => { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <motion.div initial={{opacity:0,scale:.95}} animate={{opacity:1,scale:1}}
        className="bg-[hsl(var(--md-surface-container))] border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-headline font-bold text-foreground">Export Annotations</h2>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground text-xl">✕</button>
        </div>
        <div className="flex flex-col gap-4 p-6 overflow-y-auto flex-1">
          <div className="flex gap-2 text-xs text-foreground/50">
            <span>Queue: <strong className="text-foreground">{task.queueName}</strong></span>·
            <span>Lang: <strong className="text-foreground">{task.languageLabel}</strong></span>·
            <span>Segs: <strong className="text-foreground">{segs.length}</strong></span>
          </div>
          <div className="flex gap-2">
            {(["json","csv"] as const).map(f=>(
              <button key={f} onClick={()=>setFmt(f)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-colors ${fmt===f?"bg-primary text-primary-foreground":"bg-[hsl(var(--md-surface-container-high))] text-foreground/60 hover:text-foreground"}`}>{f}</button>
            ))}
          </div>
          <pre className="bg-black/60 border border-border rounded-xl p-4 text-xs text-foreground/70 overflow-auto max-h-52 font-mono">
            {content.slice(0,2500)}{content.length>2500?"\n…":""}
          </pre>
        </div>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-border">
          <button onClick={dl} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-sm"><Download size={14}/> Download {filename}</button>
          <button onClick={cp} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(var(--md-surface-container-high))] text-foreground/80 text-sm hover:text-foreground">
            {copied?<><Check size={13} className="text-green-400"/> Copied!</>:<><Copy size={13}/> Copy</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Task Queue (landing) ─────────────────────────────────────────────────────
function TaskQueue({ onSelect }: { onSelect:(t:Task)=>void }) {
  const navigate = useNavigate();
  const { t: lang } = useLanguage();
  const pa = lang.pages.audio;

  // Derive unique language codes from discovered tasks for the filter bar
  const langCodes = ["all", ...Array.from(new Set(TASKS.map(t => t.language)))];

  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? TASKS : TASKS.filter(t => t.language === filter);

  const DC: Record<string,string> = {
    business:"border-primary/30 text-primary", conversational:"border-primary/30 text-primary",
    travel:"border-blue-500/30 text-blue-400", "healthcare-lite":"border-green-500/30 text-green-400",
    customer_support:"border-orange-500/30 text-orange-400",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="dark-surface sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-border/20">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={()=>navigate("/use-cases")} className="flex items-center justify-center p-2 hover:bg-muted rounded-full transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4 text-foreground"/>
            </button>
            <span className="text-sm font-bold tracking-wide text-white cursor-pointer hover:text-white/80 transition-colors font-headline shrink-0" onClick={()=>navigate("/use-cases")}>
              TP.ai <span style={{color:"#9071f0"}}>Data</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0"/>
            <span className="text-sm text-foreground/80 font-body whitespace-nowrap">
              {pa.breadcrumb}
            </span>
          </div>
          <ThemeToggle/>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient"/>
      </header>

      <div className="max-w-5xl mx-auto w-full px-6 py-10">
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
          <h1 className="font-headline font-black text-4xl text-foreground text-center mb-8">{pa.selectTask}</h1>

          {/* Language filter — built dynamically from discovered tasks */}
          <div className="flex items-center gap-2 flex-wrap justify-center mb-8">
            {langCodes.map(l=>(
              <button key={l} onClick={()=>setFilter(l)}
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors border ${filter===l?"bg-primary border-primary text-primary-foreground":"border-border text-foreground/40 hover:text-foreground hover:border-primary/40"}`}>
                {l==="all"?"All":`${langFlag(l)} ${l.toUpperCase()}`}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((task,i)=>(
              <motion.div key={task.id} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*.04}}
                onClick={()=>onSelect(task)} className="industrial-card p-5 rounded-[12px] flex flex-col gap-3 cursor-pointer group">
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{langFlag(task.language)}</span>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-bold uppercase tracking-widest border rounded-full px-2 py-0.5 ${task.difficulty==="easy"?"border-green-500/30 text-green-400":"border-amber-500/30 text-amber-400"}`}>{task.difficulty}</span>
                    <span className="text-xs text-foreground/30 font-mono">{task.queueName}</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-foreground uppercase tracking-wide text-sm mb-1">{task.title}</h3>
                  <p className="text-foreground/50 text-xs">{task.languageLabel} → English · {fmtDur(task.durationSec)} · {task.segments.length} segments</p>
                </div>
              </motion.div>
            ))}
            {filtered.length===0&&(
              <div className="col-span-3 text-center py-16 text-foreground/30 text-sm">No queues for this language yet.</div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Workspace ────────────────────────────────────────────────────────────────
let _ctr = 100;
function nextId() { return `seg_${String(++_ctr).padStart(3,"0")}`; }
function makeAnnotSegs(task: Task): AnnotSeg[] {
  return task.segments.map((r,i)=>({
    id: r.id ?? `seg_${String(i+1).padStart(3,"0")}`,
    startMs: r.startMs, endMs: r.endMs,
    speaker: r.speaker, nonSpeech: "NONE",
    sourceText: r.sourceText, englishText: r.englishText,
    lowConf: false, needsPass2: false, audioIssue: "NONE", comments: [],
  }));
}

type WorkspaceTab = "transcript"|"translation"|"qc";
type AppStatus    = "in_progress"|"submitted"|"ai_verified"|"qa_review"|"delivered";
const STATUS_TO_WF: Record<AppStatus,WfStage> = {
  in_progress:"annotate", submitted:"ai_verify", ai_verified:"qa_review",
  qa_review:"qa_review",  delivered:"delivered",
};

function Workspace({ task, onBack }: { task:Task; onBack:()=>void }) {
  const { t: lang } = useLanguage();
  const pa = lang.pages.audio;
  const [segs,       setSegs]      = useState<AnnotSeg[]>(()=>makeAnnotSegs(task));
  const [selectedId, setSelectedId]= useState<string|null>(null);
  const [tab,        setTab]       = useState<WorkspaceTab>("transcript");
  const [appStatus,  setAppStatus] = useState<AppStatus>("in_progress");
  const [isPlaying,  setIsPlaying] = useState(false);
  const [playhead,   setPlayhead]  = useState(0);
  const [showExport, setShowExport]= useState(false);
  const [reviewNote, setReviewNote]= useState("");
  const [saved,      setSaved]     = useState(false);
  const [tutStep,    setTutStep]   = useState<number|null>(null);

  const audioRef = useRef<HTMLAudioElement|null>(null);
  const rafRef   = useRef<number|null>(null);
  const totalMs  = task.durationSec * 1000;
  const currentMs = Math.round(playhead * totalMs);

  // Load real audio file
  useEffect(() => {
    const audio = new Audio(task.audioPath);
    audioRef.current = audio;
    const onTimeUpdate = () => { if(audio.duration) setPlayhead(audio.currentTime/audio.duration); };
    const onEnded = () => { setIsPlaying(false); setPlayhead(1); };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => { audio.pause(); audio.removeEventListener("timeupdate",onTimeUpdate); audio.removeEventListener("ended",onEnded); audio.src=""; };
  }, [task.audioPath]);

  // Smooth playhead via RAF
  useEffect(() => {
    if(isPlaying) {
      const tick = () => { const a=audioRef.current; if(a&&a.duration) setPlayhead(a.currentTime/a.duration); rafRef.current=requestAnimationFrame(tick); };
      rafRef.current=requestAnimationFrame(tick);
    } else { if(rafRef.current) cancelAnimationFrame(rafRef.current); }
    return ()=>{ if(rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying]);

  // Tutorial on first open (per queue)
  useEffect(() => {
    const key = `aud_tut_seen_test_${task.id}`;
    if(!localStorage.getItem(key)) { setTutStep(0); localStorage.setItem(key,"1"); }
  }, [task.id]);

  useEffect(()=>()=>{ audioRef.current?.pause(); },[]);

  useEffect(() => { if (appStatus === "ai_verified") setTab("qc"); }, [appStatus]);

  const seekToMs = useCallback((ms:number) => {
    const a=audioRef.current;
    if(a) a.currentTime=ms/1000;
    setPlayhead(ms/totalMs);
  },[totalMs]);

  const handleTogglePlay = () => {
    const a=audioRef.current; if(!a) return;
    if(isPlaying) { a.pause(); setIsPlaying(false); }
    else { a.play().catch(()=>{}); setIsPlaying(true); }
  };

  const addSegment = (startMs:number,endMs:number) => {
    const seg:AnnotSeg={id:nextId(),startMs,endMs,speaker:"S1",nonSpeech:"NONE",sourceText:"",englishText:"",lowConf:false,needsPass2:false,audioIssue:"NONE",comments:[]};
    setSegs(prev=>[...prev,seg].sort((a,b)=>a.startMs-b.startMs));
    setSelectedId(seg.id);
  };
  const updateSeg = (id:string, patch:Partial<AnnotSeg>) => setSegs(prev=>prev.map(s=>s.id===id?{...s,...patch}:s));
  const deleteSeg = (id:string) => { setSegs(prev=>prev.filter(s=>s.id!==id)); setSelectedId(prev=>prev===id?null:prev); };

  const handleSave = () => {
    try { localStorage.setItem(`audio_ann_test_v1_${task.id}`,JSON.stringify({segs,appStatus})); } catch {}
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  const handleSubmit  = () => { setAppStatus("submitted"); handleSave(); setTimeout(()=>setAppStatus("ai_verified"),2500); };
  const handleApprove = () => setAppStatus("delivered");
  const handleReturn  = () => setAppStatus("in_progress");

  const wfStage  = STATUS_TO_WF[appStatus];
  const readOnly = appStatus==="delivered";

  const STATUS_PILL:Record<AppStatus,string> = {
    in_progress:"bg-blue-950 text-blue-300", submitted:"bg-yellow-950 text-yellow-300",
    ai_verified:"bg-purple-950 text-purple-300", qa_review:"bg-orange-950 text-orange-300",
    delivered:"bg-green-950 text-green-300",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="flex items-center gap-1.5 text-foreground/50 hover:text-foreground text-sm"><ArrowLeft size={15}/> Queues</button>
          <div className="w-px h-5 bg-border"/>
          <span className="font-bold text-sm text-foreground">{langFlag(task.language)} {task.title}</span>
          <span className="text-foreground/40 text-xs">· {task.languageLabel} → English</span>
          <span className={`ml-1 text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_PILL[appStatus]}`}>{appStatus.replace("_"," ")}</span>
          <div className="flex-1"/>
          <button onClick={()=>setTutStep(0)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-foreground/50 hover:text-primary text-xs transition-colors">
            <HelpCircle size={13}/> Tutorial
          </button>
          <button onClick={()=>setShowExport(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-foreground/60 hover:text-foreground text-xs transition-colors">
            <Download size={12}/> Export
          </button>
          {appStatus==="in_progress"&&(
            <button data-aud="aud-submit" onClick={handleSubmit} disabled={segs.length===0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/80 disabled:opacity-40 text-primary-foreground text-xs font-bold transition-colors">
              <Send size={12}/> Submit
            </button>
          )}
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[#5b21b6] to-[#9071f0]"/>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* LEFT */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-[hsl(var(--md-surface-container-low))]">
            <Waveform taskId={task.id} durationSec={task.durationSec} segments={segs} selectedId={selectedId}
              playheadRatio={playhead}
              onSeek={r=>seekToMs(Math.round(r*totalMs))}
              onAddSegment={addSegment}
              onResizeSeg={(id,s,e)=>updateSeg(id,{startMs:s,endMs:e})}/>
            <div data-aud="aud-controls" className="flex items-center gap-3 mt-3">
              <button onClick={()=>seekToMs(Math.max(0,currentMs-2000))} className="text-foreground/40 hover:text-foreground"><SkipBack size={16}/></button>
              <button onClick={handleTogglePlay} className="w-9 h-9 flex items-center justify-center rounded-full bg-primary hover:bg-primary/80 text-white transition-colors">
                {isPlaying?<Pause size={15}/>:<Play size={15}/>}
              </button>
              <button onClick={()=>seekToMs(Math.min(totalMs,currentMs+2000))} className="text-foreground/40 hover:text-foreground"><SkipForward size={16}/></button>
              <span className="text-xs font-mono text-foreground/40">{msToTC(currentMs)} / {msToTC(totalMs)}</span>
              <input type="range" min={0} max={1} step={.001} value={playhead}
                onChange={e=>seekToMs(Math.round(+e.target.value*totalMs))}
                className="flex-1 h-1 accent-primary"/>
              <Volume2 size={14} className="text-foreground/30"/>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-foreground/40">Segments ({segs.length})</span>
              {!readOnly&&(
                <button onClick={()=>addSegment(currentMs,Math.min(totalMs,currentMs+2000))}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground font-bold transition-colors">
                  + Add at Playhead
                </button>
              )}
            </div>
            <div data-aud="aud-table" className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-[hsl(var(--md-surface-container-high))] text-foreground/40">
                  <tr>
                    <th className="px-3 py-2 text-left w-10">#</th>
                    <th className="px-3 py-2 text-left w-24">{pa.colTime}</th>
                    <th className="px-3 py-2 text-left w-20">{pa.colSpeaker}</th>
                    <th className="px-3 py-2 text-left">{pa.colSource}</th>
                    <th className="px-3 py-2 text-left">{pa.colEnglish}</th>
                    <th className="px-3 py-2 text-left w-28">{pa.colIssue}</th>
                    {!readOnly&&<th className="px-3 py-2 text-center w-12">Del</th>}
                  </tr>
                </thead>
                <tbody>
                  {segs.map((seg,i)=>{
                    const active=seg.id===selectedId, playing=currentMs>=seg.startMs&&currentMs<=seg.endMs, spkC=SPEAKER_COLORS[seg.speaker]??"#94a3b8";
                    return (
                      <tr key={seg.id} onClick={()=>{setSelectedId(seg.id);seekToMs(seg.startMs);}}
                        className={`border-t border-border cursor-pointer transition-colors ${active?"bg-primary/10":playing?"bg-[hsl(var(--md-surface-container-high))]":"hover:bg-[hsl(var(--md-surface-container-low))]"}`}>
                        <td className="px-3 py-2 text-foreground/30 font-mono">{i+1}</td>
                        <td className="px-3 py-2 font-mono text-[10px]" onClick={e=>e.stopPropagation()}>
                          {readOnly ? (
                            <><div className="text-foreground/40">{msToTC(seg.startMs)}</div><div className="text-foreground/40">{msToTC(seg.endMs)}</div></>
                          ) : (<>
                            <input key={seg.startMs} defaultValue={msToTC(seg.startMs)}
                              className="bg-transparent text-foreground/50 focus:text-primary focus:outline-none border-b border-transparent focus:border-primary/50 w-[7ch]"
                              onBlur={e=>{const ms=parseTC(e.target.value);if(ms!=null&&ms<seg.endMs-200)updateSeg(seg.id,{startMs:ms});}}
                              onKeyDown={e=>{if(e.key==='Enter'){const ms=parseTC((e.target as HTMLInputElement).value);if(ms!=null&&ms<seg.endMs-200)updateSeg(seg.id,{startMs:ms});(e.target as HTMLInputElement).blur();}}}/>
                            <input key={"e"+seg.endMs} defaultValue={msToTC(seg.endMs)}
                              className="bg-transparent text-foreground/50 focus:text-primary focus:outline-none border-b border-transparent focus:border-primary/50 w-[7ch] mt-0.5 block"
                              onBlur={e=>{const ms=parseTC(e.target.value);if(ms!=null&&ms>seg.startMs+200)updateSeg(seg.id,{endMs:ms});}}
                              onKeyDown={e=>{if(e.key==='Enter'){const ms=parseTC((e.target as HTMLInputElement).value);if(ms!=null&&ms>seg.startMs+200)updateSeg(seg.id,{endMs:ms});(e.target as HTMLInputElement).blur();}}}/>
                          </>)}
                        </td>
                        <td data-aud={i===0?"aud-speaker-0":undefined} className="px-3 py-2" onClick={e=>e.stopPropagation()}>
                          {readOnly
                            ? <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{color:spkC,background:spkC+"22"}}>{seg.speaker}</span>
                            : <select value={seg.speaker} onChange={e=>updateSeg(seg.id,{speaker:e.target.value})}
                                className="bg-[hsl(var(--md-surface-container-high))] border border-border rounded px-1 py-0.5 text-xs w-full" style={{color:spkC}}>
                                {["S1","S2","OVERLAP","UNK"].map(s=><option key={s}>{s}</option>)}
                              </select>
                          }
                        </td>
                        <td className="px-3 py-2 min-w-[130px]" onClick={e=>e.stopPropagation()}>
                          {readOnly ? <span className="text-foreground/70">{seg.sourceText}</span>
                            : <textarea value={seg.sourceText} rows={2} onChange={e=>updateSeg(seg.id,{sourceText:e.target.value})}
                                className="w-full bg-transparent text-foreground/80 text-sm resize-none focus:outline-none placeholder-foreground/20" placeholder="Source text…"/>}
                        </td>
                        <td className="px-3 py-2 min-w-[130px]" onClick={e=>e.stopPropagation()}>
                          {readOnly ? <span className="text-foreground/70">{seg.englishText}</span>
                            : <textarea value={seg.englishText} rows={2} onChange={e=>updateSeg(seg.id,{englishText:e.target.value})}
                                className="w-full bg-transparent text-foreground/80 text-sm resize-none focus:outline-none placeholder-foreground/20" placeholder="English translation…"/>}
                        </td>
                        <td className="px-3 py-2" onClick={e=>e.stopPropagation()}>
                          {readOnly ? <span className={`text-xs ${seg.audioIssue!=="NONE"?"text-amber-400":"text-foreground/30"}`}>{seg.audioIssue}</span>
                            : <select value={seg.audioIssue} onChange={e=>updateSeg(seg.id,{audioIssue:e.target.value})}
                                className={`bg-[hsl(var(--md-surface-container-high))] border border-border rounded px-1 py-0.5 text-xs w-full ${seg.audioIssue!=="NONE"?"text-amber-400":"text-foreground/40"}`}>
                                {["NONE","CLIPPING","BACKGROUND_NOISE","DROP_OUT","DISTORTION"].map(v=><option key={v}>{v}</option>)}
                              </select>
                          }
                        </td>
                        {!readOnly&&<td className="px-3 py-2 text-center" onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>deleteSeg(seg.id)} className="text-foreground/20 hover:text-red-400">✕</button>
                        </td>}
                      </tr>
                    );
                  })}
                  {segs.length===0&&<tr><td colSpan={7} className="text-center py-10 text-foreground/30">Shift+drag on waveform or click "+ Add at Playhead"</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="w-full lg:w-80 flex flex-col shrink-0">
          <div className="flex border-b border-border bg-[hsl(var(--md-surface-container-low))] shrink-0">
            {(["transcript","translation","qc"] as WorkspaceTab[]).map(t=>(
              <button key={t} data-aud={`aud-tab-${t}`} onClick={()=>setTab(t)}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${tab===t?"border-primary text-primary":"border-transparent text-foreground/30 hover:text-foreground/60"}`}>
                {t==="transcript"?"Transcript":t==="translation"?"Translation":"QC"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
            <div className="bg-[hsl(var(--md-surface-container-low))] border border-border rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/30 mb-3">Pipeline Status</p>
              <WorkflowStepper current={wfStage}/>
            </div>

            {tab==="transcript"&&(
              <div className="flex flex-col gap-2">
                <div className="text-xs text-foreground/40 font-bold uppercase tracking-widest pb-1 border-b border-border">{task.languageLabel} Transcript</div>
                {segs.map(seg=>{ const col=SPEAKER_COLORS[seg.speaker]??"#94a3b8"; return (
                  <div key={seg.id}
                    role="button" tabIndex={0}
                    aria-label={`Transcript segment ${seg.speaker} at ${msToTC(seg.startMs)}`}
                    onClick={()=>{setSelectedId(seg.id);seekToMs(seg.startMs);}}
                    onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setSelectedId(seg.id); seekToMs(seg.startMs); } }}
                    className={`rounded-xl border transition-colors cursor-pointer ${seg.id===selectedId?"border-primary bg-primary/5":"border-border bg-[hsl(var(--md-surface-container-low))]"}`}>
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{color:col,background:col+"22"}}>{seg.speaker}</span>
                      <span className="text-xs font-mono text-foreground/30">{msToTC(seg.startMs)}</span>
                    </div>
                    <div className="px-3 py-2">
                      <textarea value={seg.sourceText} rows={2} readOnly={readOnly}
                        onChange={e=>updateSeg(seg.id,{sourceText:e.target.value})} onClick={e=>e.stopPropagation()}
                        className="w-full bg-transparent text-base text-foreground/80 resize-none focus:outline-none placeholder-foreground/20"
                        placeholder={`Transcribe ${task.languageLabel}…`}/>
                    </div>
                  </div>
                );})}
              </div>
            )}

            {tab==="translation"&&(
              <div className="flex flex-col gap-2">
                <div className="text-xs text-foreground/40 font-bold uppercase tracking-widest pb-1 border-b border-border">English Translation</div>
                {segs.map(seg=>{ const col=SPEAKER_COLORS[seg.speaker]??"#94a3b8"; return (
                  <div key={seg.id}
                    role="button" tabIndex={0}
                    aria-label={`Translation segment ${seg.speaker} at ${msToTC(seg.startMs)}`}
                    onClick={()=>{setSelectedId(seg.id);seekToMs(seg.startMs);}}
                    onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setSelectedId(seg.id); seekToMs(seg.startMs); } }}
                    className={`rounded-xl border transition-colors cursor-pointer ${seg.id===selectedId?"border-primary bg-primary/5":"border-border bg-[hsl(var(--md-surface-container-low))]"}`}>
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{color:col,background:col+"22"}}>{seg.speaker}</span>
                      {seg.sourceText&&<span className="text-xs text-foreground/30 italic truncate max-w-[140px]">"{seg.sourceText.slice(0,20)}{seg.sourceText.length>20?"…":""}"</span>}
                    </div>
                    <div className="px-3 py-2">
                      <textarea value={seg.englishText} rows={2} readOnly={readOnly}
                        onChange={e=>updateSeg(seg.id,{englishText:e.target.value})} onClick={e=>e.stopPropagation()}
                        className="w-full bg-transparent text-base text-foreground/80 resize-none focus:outline-none placeholder-foreground/20"
                        placeholder="English translation…"/>
                    </div>
                  </div>
                );})}
              </div>
            )}

            {tab==="qc"&&(
              <div className="flex flex-col gap-4">
                <div className="text-xs font-bold uppercase tracking-widest text-foreground/40 pb-1 border-b border-border">Quality Control</div>
                <div className="grid grid-cols-2 gap-2">
                  {[{label:"Total Segs",val:segs.length},{label:"Source Filled",val:segs.filter(s=>s.sourceText.trim()).length},
                    {label:"Eng Filled",val:segs.filter(s=>s.englishText.trim()).length},{label:"Flagged",val:segs.filter(s=>s.audioIssue!=="NONE").length}
                  ].map(m=>(
                    <div key={m.label} className="bg-[hsl(var(--md-surface-container-high))] rounded-xl p-3 text-center border border-border">
                      <div className="text-2xl font-black text-primary">{m.val}</div>
                      <div className="text-[10px] text-foreground/40 mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-foreground/40 font-bold uppercase tracking-widest block mb-1.5">Review Notes</label>
                  <textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value)} rows={3} readOnly={readOnly}
                    placeholder="Add reviewer feedback…"
                    className="w-full bg-[hsl(var(--md-surface-container-high))] border border-border rounded-xl px-3 py-2 text-sm text-foreground/80 resize-none focus:outline-none focus:border-primary placeholder-foreground/20"/>
                </div>
                {appStatus==="ai_verified"&&(
                  <div className="flex gap-2">
                    <button onClick={handleApprove} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-900 hover:bg-green-800 text-green-100 text-sm font-bold"><CheckCircle size={14}/> Approve</button>
                    <button onClick={handleReturn}  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-900/60 hover:bg-red-800/60 text-red-200 text-sm font-bold"><XCircle size={14}/> Return</button>
                  </div>
                )}
                {appStatus==="submitted"&&<div className="text-center py-3 rounded-xl bg-yellow-900/30 text-yellow-300 text-xs font-semibold animate-pulse">🤖 AI verification in progress…</div>}
                {appStatus==="delivered"&&<div className="text-center py-3 rounded-xl bg-green-900/30 text-green-400 text-sm font-bold">✓ Delivered</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showExport&&<ExportModal task={task} segs={segs} status={appStatus} onClose={()=>setShowExport(false)}/>}
      </AnimatePresence>

      {tutStep!==null&&tutStep<AUDIO_TUTORIAL.length&&(
        <AudioTutorial step={AUDIO_TUTORIAL[tutStep]} total={AUDIO_TUTORIAL.length} stepIdx={tutStep}
          onNext={()=>setTutStep(s=>(s??0)+1>=AUDIO_TUTORIAL.length?null:(s??0)+1)}
          onSkip={()=>setTutStep(null)}/>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function AudioAnnotationTest() {
  const [activeTask, setActiveTask] = useState<Task|null>(null);
  return activeTask
    ? <Workspace task={activeTask} onBack={()=>setActiveTask(null)}/>
    : <TaskQueue onSelect={setActiveTask}/>;
}
