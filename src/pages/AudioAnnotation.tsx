import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Pause, Download, Save, Send, SkipBack, SkipForward, Repeat, Volume2, CheckCircle, XCircle, Copy, Check } from "lucide-react";

// ─── Web Speech API language map ─────────────────────────────────────────────
const LANG_BCP47: Record<string, string> = {
  zh: "zh-CN", ar: "ar-SA", hi: "hi-IN", ko: "ko-KR", fr: "fr-FR", ja: "ja-JP",
};

// Speak a segment using the browser's built-in TTS
function speakSegment(text: string, lang: string, speaker: string) {
  if (!("speechSynthesis" in window) || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang  = LANG_BCP47[lang] ?? "en-US";
  utter.rate  = speaker === "S2" ? 0.85 : 0.9;
  utter.pitch = speaker === "S2" ? 1.25 : speaker === "OVERLAP" ? 1.1 : 0.95;
  utter.volume = 1;
  // Pick best available voice for the language
  const voices = window.speechSynthesis.getVoices();
  const match  = voices.find(v => v.lang.startsWith(LANG_BCP47[lang]?.slice(0,2) ?? ""));
  if (match) utter.voice = match;
  window.speechSynthesis.speak(utter);
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const LANG_META: Record<string, { flag: string; label: string; rtl?: boolean }> = {
  zh: { flag: "🇨🇳", label: "Chinese" },
  ar: { flag: "🇸🇦", label: "Arabic", rtl: true },
  hi: { flag: "🇮🇳", label: "Hindi" },
  ko: { flag: "🇰🇷", label: "Korean" },
  fr: { flag: "🇫🇷", label: "French" },
  ja: { flag: "🇯🇵", label: "Japanese" },
};

const SPEAKER_COLORS: Record<string, string> = {
  S1:      "#818cf8",
  S2:      "#34d399",
  OVERLAP: "#fb923c",
  UNK:     "#94a3b8",
};

interface RefSeg { startMs: number; endMs: number; speaker: string; text: string; textEn: string; }

interface Task {
  id: string; language: string; title: string; durationSec: number;
  taskType: string; difficulty: "easy" | "medium"; domainTag: string;
  segments: RefSeg[];
}

const TASKS: Task[] = [
  { id:"zh_01", language:"zh", title:"Coffee Order",           durationSec:18, taskType:"both",       difficulty:"easy",   domainTag:"conversational",
    segments:[
      {startMs:500,  endMs:3200,  speaker:"S1", text:"你好，我想要一杯拿铁咖啡。",              textEn:"Hello, I'd like a latte, please."},
      {startMs:3400, endMs:6100,  speaker:"S2", text:"好的，您要大杯还是小杯？",               textEn:"Sure, would you like a large or small?"},
      {startMs:6300, endMs:9000,  speaker:"S1", text:"大杯，谢谢。还有，能加一份燕麦奶吗？",   textEn:"Large, thank you. Also, can you add oat milk?"},
      {startMs:9200, endMs:12000, speaker:"S2", text:"当然可以。请问您的名字是？",              textEn:"Of course. May I have your name?"},
      {startMs:12200,endMs:14500, speaker:"S1", text:"我叫小明。",                           textEn:"My name is Xiao Ming."},
      {startMs:14700,endMs:17800, speaker:"S2", text:"好的，小明，请稍等。",                  textEn:"Alright, Xiao Ming, please wait a moment."},
    ]},
  { id:"zh_02", language:"zh", title:"Taxi Directions",        durationSec:22, taskType:"both",       difficulty:"medium", domainTag:"travel",
    segments:[
      {startMs:600,  endMs:4000,  speaker:"S1", text:"师傅，请到北京路地铁站。",              textEn:"Driver, please take me to Beijing Road subway station."},
      {startMs:4200, endMs:7500,  speaker:"S2", text:"好的，现在很堵，可能要二十分钟。",       textEn:"Alright, traffic is heavy — it might take around twenty minutes."},
      {startMs:7700, endMs:11000, speaker:"S1", text:"没关系，我不着急。请走高速吧。",        textEn:"That's fine, I'm not in a hurry. Please take the expressway."},
      {startMs:11200,endMs:15000, speaker:"S2", text:"好，走高速要加十块钱过路费。",          textEn:"Okay, taking the expressway will add ten yuan in toll fees."},
      {startMs:15200,endMs:21000, speaker:"S1", text:"没问题，我用微信支付可以吗？",          textEn:"No problem. Can I pay with WeChat Pay?"},
    ]},
  { id:"ar_01", language:"ar", title:"Clinic Appointment",     durationSec:20, taskType:"both",       difficulty:"medium", domainTag:"healthcare-lite",
    segments:[
      {startMs:800,  endMs:4500,  speaker:"S1", text:"صباح الخير، أريد حجز موعد مع الدكتور.", textEn:"Good morning, I'd like to book an appointment with the doctor."},
      {startMs:4700, endMs:8000,  speaker:"S2", text:"صباح النور، ما اسمك من فضلك؟",         textEn:"Good morning, what is your name, please?"},
      {startMs:8200, endMs:11500, speaker:"S1", text:"اسمي أحمد حسن، ولدي ألم في الظهر.",    textEn:"My name is Ahmed Hassan, and I have back pain."},
      {startMs:11700,endMs:15000, speaker:"S2", text:"حسناً، يوجد موعد الثلاثاء الساعة الثالثة.", textEn:"Alright, there is an appointment on Tuesday at three o'clock."},
      {startMs:15200,endMs:19000, speaker:"S1", text:"ممتاز، سأكون هناك. شكراً جزيلاً.",     textEn:"Excellent, I'll be there. Thank you very much."},
    ]},
  { id:"ar_02", language:"ar", title:"Market Negotiation",     durationSec:16, taskType:"transcribe", difficulty:"easy",   domainTag:"conversational",
    segments:[
      {startMs:500,  endMs:3800,  speaker:"S1", text:"بكم هذه التمور؟",                     textEn:"How much are these dates?"},
      {startMs:4000, endMs:7200,  speaker:"S2", text:"خمسة وعشرون ريالاً للكيلو.",           textEn:"Twenty-five riyals per kilogram."},
      {startMs:7400, endMs:10500, speaker:"S1", text:"غالي شوي، ممكن تخفض؟",               textEn:"A bit expensive, can you lower it?"},
      {startMs:10700,endMs:15500, speaker:"S2", text:"طيب، عشرون ريالاً لأنك زبون قديم.",   textEn:"Alright, twenty riyals since you're a regular customer."},
    ]},
  { id:"hi_01", language:"hi", title:"Train Booking",          durationSec:19, taskType:"both",       difficulty:"easy",   domainTag:"travel",
    segments:[
      {startMs:700,  endMs:4200,  speaker:"S1", text:"नमस्ते, मुझे दिल्ली से मुंबई की ट्रेन टिकट चाहिए।", textEn:"Hello, I need a train ticket from Delhi to Mumbai."},
      {startMs:4400, endMs:7800,  speaker:"S2", text:"कौन सी तारीख को जाना है आपको?",       textEn:"Which date are you looking to travel?"},
      {startMs:8000, endMs:11500, speaker:"S1", text:"पंद्रह मार्च को, और वापसी अठारह को।", textEn:"March fifteenth, and returning on the eighteenth."},
      {startMs:11700,endMs:15000, speaker:"S2", text:"ठीक है, राजधानी एक्सप्रेस में सीट उपलब्ध है।", textEn:"Alright, seats are available on the Rajdhani Express."},
      {startMs:15200,endMs:18500, speaker:"S1", text:"बढ़िया, AC थर्ड क्लास में बुक कर दीजिए।", textEn:"Great, please book it in AC Third Class."},
    ]},
  { id:"hi_02", language:"hi", title:"Customer Support",       durationSec:17, taskType:"both",       difficulty:"medium", domainTag:"customer_support",
    segments:[
      {startMs:500,  endMs:3900,  speaker:"S1", text:"हेलो, मेरा नेट पैक चार्ज हो गया लेकिन डेटा नहीं मिला।", textEn:"Hello, my data pack was charged but I didn't receive any data."},
      {startMs:4100, endMs:7200,  speaker:"S2", text:"[inaudible] कृपया अपना नंबर बताइए।",  textEn:"[inaudible] Please tell me your number."},
      {startMs:7400, endMs:10600, speaker:"S1", text:"नंबर है नौ-आठ-सात-छह-पाँच-चार-तीन-दो-एक।", textEn:"The number is nine-eight-seven-six-five-four-three-two-one."},
      {startMs:10800,endMs:16500, speaker:"S2", text:"धन्यवाद, हम चौबीस घंटे में समस्या हल करेंगे।", textEn:"Thank you, we will resolve the issue within twenty-four hours."},
    ]},
  { id:"ko_01", language:"ko", title:"Restaurant Reservation",  durationSec:20, taskType:"both",       difficulty:"easy",   domainTag:"conversational",
    segments:[
      {startMs:600,  endMs:4000,  speaker:"S1", text:"안녕하세요, 오늘 저녁 예약 가능한가요?",  textEn:"Hello, is a reservation available for this evening?"},
      {startMs:4200, endMs:7500,  speaker:"S2", text:"네, 몇 분이서 오시나요?",               textEn:"Yes, how many people will be dining?"},
      {startMs:7700, endMs:10800, speaker:"S1", text:"4명이요. 7시에 창가 자리로 부탁드려요.", textEn:"Four people. Please book a window seat at seven o'clock."},
      {startMs:11000,endMs:14500, speaker:"S2", text:"죄송하지만 창가 자리는 이미 예약이 꽉 찼어요.", textEn:"I'm sorry, but window seats are fully booked."},
      {startMs:14700,endMs:19500, speaker:"S1", text:"그럼 안쪽 자리도 괜찮아요. 이름은 김지수예요.", textEn:"Then an interior seat is fine. The name is Kim Ji-su."},
    ]},
  { id:"ko_02", language:"ko", title:"Online Shopping Support", durationSec:18, taskType:"translate",  difficulty:"medium", domainTag:"customer_support",
    segments:[
      {startMs:500,  endMs:4200,  speaker:"S1", text:"주문한 상품이 아직도 안 왔어요. 언제 오나요?", textEn:"My order still hasn't arrived. When is it coming?"},
      {startMs:4400, endMs:8000,  speaker:"S2", text:"주문번호를 알려주시겠어요?",             textEn:"Could you give me your order number?"},
      {startMs:8200, endMs:11500, speaker:"S1", text:"AB-1234-5678이에요.",                  textEn:"It's AB-1234-5678."},
      {startMs:11700,endMs:15200, speaker:"S2", text:"확인해보니 내일 오후에 배송될 예정이에요.", textEn:"I checked and it's scheduled to be delivered tomorrow afternoon."},
      {startMs:15400,endMs:17800, speaker:"S1", text:"감사합니다.",                          textEn:"Thank you."},
    ]},
  { id:"fr_01", language:"fr", title:"Hotel Check-in",          durationSec:21, taskType:"both",       difficulty:"easy",   domainTag:"travel",
    segments:[
      {startMs:600,  endMs:4100,  speaker:"S1", text:"Bonjour, j'ai une réservation au nom de Dupont.",  textEn:"Good morning, I have a reservation under the name Dupont."},
      {startMs:4300, endMs:7800,  speaker:"S2", text:"Bonjour monsieur, un instant s'il vous plaît.",   textEn:"Good morning, sir, one moment please."},
      {startMs:8000, endMs:11500, speaker:"S2", text:"Oui, chambre deux-cent-douze, vue sur jardin.",   textEn:"Yes, room two-twelve, garden view."},
      {startMs:11700,endMs:15200, speaker:"S1", text:"Parfait. Est-ce que le petit-déjeuner est inclus?", textEn:"Perfect. Is breakfast included?"},
      {startMs:15400,endMs:20500, speaker:"S2", text:"Oui, il est servi de sept heures à dix heures.",  textEn:"Yes, it is served from seven to ten o'clock in the restaurant."},
    ]},
  { id:"fr_02", language:"fr", title:"Pharmacy Consultation",   durationSec:17, taskType:"both",       difficulty:"medium", domainTag:"healthcare-lite",
    segments:[
      {startMs:500,  endMs:3900,  speaker:"S1", text:"Bonjour, j'ai mal à la gorge depuis deux jours.", textEn:"Hello, I have had a sore throat for two days."},
      {startMs:4100, endMs:7600,  speaker:"S2", text:"Avez-vous de la fièvre également?",              textEn:"Do you also have a fever?"},
      {startMs:7800, endMs:10800, speaker:"S1", text:"Non, juste la gorge et un peu de fatigue.",      textEn:"No, just the throat and a little fatigue."},
      {startMs:11000,endMs:16500, speaker:"S2", text:"Je vous conseille ce spray et des pastilles.",   textEn:"I recommend this spray and some lozenges. If it doesn't improve, see a doctor."},
    ]},
  { id:"ja_01", language:"ja", title:"Convenience Store",       durationSec:16, taskType:"both",       difficulty:"easy",   domainTag:"conversational",
    segments:[
      {startMs:500,  endMs:3200,  speaker:"S2", text:"いらっしゃいませ。",                             textEn:"Welcome."},
      {startMs:3400, endMs:6900,  speaker:"S1", text:"これとこれをください。あと、レジ袋も一枚。",       textEn:"I'd like these two items, please. Also, one plastic bag."},
      {startMs:7100, endMs:10500, speaker:"S2", text:"合計で五百二十円になります。",                   textEn:"Your total comes to five hundred and twenty yen."},
      {startMs:10700,endMs:13800, speaker:"S1", text:"千円でお願いします。",                          textEn:"Here's one thousand yen."},
      {startMs:14000,endMs:15800, speaker:"S2", text:"四百八十円のお返しです。ありがとうございました。", textEn:"Your change is four hundred and eighty yen. Thank you very much."},
    ]},
  { id:"ja_02", language:"ja", title:"Business Meeting",        durationSec:23, taskType:"both",       difficulty:"medium", domainTag:"customer_support",
    segments:[
      {startMs:700,  endMs:4200,  speaker:"S1",      text:"本日はお時間をいただきありがとうございます。",       textEn:"Thank you very much for your time today."},
      {startMs:4400, endMs:7800,  speaker:"S2",      text:"こちらこそ、よろしくお願いします。",               textEn:"Likewise, thank you for having us."},
      {startMs:8000, endMs:12500, speaker:"OVERLAP", text:"[Crosstalk] 新しいプロジェクトについて / はい、資料を—", textEn:"[Crosstalk] About the new project / Yes, the documents—"},
      {startMs:12700,endMs:17000, speaker:"S1",      text:"失礼しました。先に続けてください。",               textEn:"I apologize, please go ahead."},
      {startMs:17200,endMs:22500, speaker:"S2",      text:"資料をご覧いただけましたか？来月から開始したいと思っています。", textEn:"Have you had a chance to review the documents? We'd like to start next month."},
    ]},
];

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function msToTC(ms: number) {
  const s  = Math.floor(ms / 1000);
  const m  = Math.floor(s / 60);
  const ss = s % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}.${String(cs).padStart(2,"0")}`;
}

function fmtDur(s: number) {
  const m = Math.floor(s / 60), ss = s % 60;
  return m > 0 ? `${m}m ${ss}s` : `${ss}s`;
}

// Deterministic pseudo-random waveform bars seeded from task id
function makeWaveBars(seed: string, count = 80): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return Array.from({ length: count }, (_, i) => {
    h = (h * 1664525 + 1013904223) | 0;
    const base = 0.15 + 0.6 * Math.abs(Math.sin(i * 0.35 + (h & 0xffff) / 65536));
    return Math.min(1, base + 0.05 * ((h >> 16) / 65536));
  });
}

// ─── Waveform SVG ─────────────────────────────────────────────────────────────

function FakeWaveform({ task, segments, selectedId, playheadRatio, onSeek, onAddSegment }: {
  task: Task;
  segments: AnnotSeg[];
  selectedId: string | null;
  playheadRatio: number;
  onSeek: (ratio: number) => void;
  onAddSegment: (startMs: number, endMs: number) => void;
}) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ startX: number } | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const bars = makeWaveBars(task.id);
  const W = 100; // viewBox width in %
  const totalMs = task.durationSec * 1000;

  const xToRatio = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      setDrag({ startX: xToRatio(e.clientX) });
    } else {
      onSeek(xToRatio(e.clientX));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (drag) {
      const endR = xToRatio(e.clientX);
      const startR = drag.startX;
      const lo = Math.min(startR, endR);
      const hi = Math.max(startR, endR);
      if (hi - lo > 0.01) onAddSegment(Math.round(lo * totalMs), Math.round(hi * totalMs));
      setDrag(null);
    }
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="w-full h-20 cursor-crosshair select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={e => setHoverX(xToRatio(e.clientX))}
        onMouseLeave={() => setHoverX(null)}
        onMouseUp={handleMouseUp}
      >
        {/* Background */}
        <rect width="100" height="40" fill="#0f172a" />

        {/* Waveform bars */}
        {bars.map((h, i) => {
          const x   = (i / bars.length) * 100;
          const w   = 100 / bars.length * 0.7;
          const bh  = h * 28;
          const y   = (40 - bh) / 2;
          const pct = (i + 0.5) / bars.length;
          const played = pct <= playheadRatio;
          return (
            <rect key={i} x={x} y={y} width={w} height={bh}
              fill={played ? "#7c3aed" : "#1e293b"} rx="0.3" />
          );
        })}

        {/* Segment regions */}
        {segments.map(seg => {
          const x1 = (seg.startMs / totalMs) * 100;
          const x2 = (seg.endMs   / totalMs) * 100;
          const col = SPEAKER_COLORS[seg.speaker] || "#818cf8";
          const isSelected = seg.id === selectedId;
          return (
            <g key={seg.id}>
              <rect x={x1} y={0} width={x2 - x1} height={40}
                fill={col + (isSelected ? "44" : "1a")}
                stroke={col} strokeWidth={isSelected ? "0.4" : "0.2"}
              />
            </g>
          );
        })}

        {/* Drag selection preview */}
        {drag && hoverX !== null && (
          <rect
            x={Math.min(drag.startX, hoverX) * 100} y={0}
            width={Math.abs(hoverX - drag.startX) * 100} height={40}
            fill="#818cf844" stroke="#818cf8" strokeWidth="0.3"
          />
        )}

        {/* Playhead */}
        <line x1={playheadRatio * 100} y1={0} x2={playheadRatio * 100} y2={40}
          stroke="#a78bfa" strokeWidth="0.5" />

        {/* Hover line */}
        {hoverX !== null && !drag && (
          <line x1={hoverX * 100} y1={0} x2={hoverX * 100} y2={40}
            stroke="#ffffff33" strokeWidth="0.3" strokeDasharray="1" />
        )}
      </svg>

      {/* Timeline ticks */}
      <div className="flex justify-between text-[10px] text-slate-600 px-0 mt-0.5 font-mono">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}>{msToTC(Math.round((i / 6) * totalMs))}</span>
        ))}
      </div>
      <p className="text-[10px] text-slate-600 mt-1 text-center">
        Shift+drag to create a segment · click to seek
      </p>
    </div>
  );
}

// ─── Segment types ────────────────────────────────────────────────────────────

interface AnnotSeg {
  id: string; startMs: number; endMs: number;
  speaker: string; nonSpeech: string;
  sourceText: string; englishText: string;
  lowConf: boolean; needsPass2: boolean; audioIssue: string;
  comments: { by: string; text: string; at: string }[];
}

function makeSegs(task: Task): AnnotSeg[] {
  return task.segments.map((r, i) => ({
    id: `seg_${String(i + 1).padStart(3, "0")}`,
    startMs: r.startMs, endMs: r.endMs,
    speaker: r.speaker, nonSpeech: "NONE",
    sourceText: r.text, englishText: r.textEn,
    lowConf: false, needsPass2: false, audioIssue: "NONE",
    comments: [],
  }));
}

let _ctr = 100;
function nextId() { return `seg_${String(++_ctr).padStart(3, "0")}`; }

// ─── Export modal ─────────────────────────────────────────────────────────────

function ExportModal({ task, segs, status, onClose }: {
  task: Task; segs: AnnotSeg[]; status: string; onClose: () => void;
}) {
  const [fmt, setFmt]     = useState<"json" | "csv">("json");
  const [copied, setCopied] = useState(false);

  const jsonStr = JSON.stringify({
    project: "audio_transcribe_translate_demo",
    taskId: task.id, sourceLanguage: task.language,
    createdAt: new Date().toISOString(), status,
    segments: segs.map(s => ({
      segmentId: s.id, startMs: s.startMs, endMs: s.endMs,
      speaker: s.speaker, nonSpeech: s.nonSpeech,
      sourceText: s.sourceText, englishText: s.englishText,
      flags: { lowConfidence: s.lowConf, needsSecondPass: s.needsPass2, audioIssue: s.audioIssue },
      comments: s.comments,
    })),
    taskLevel: { overallAudioQuality: "good", piiPresent: "none", reviewOutcome: status === "approved" ? "approved" : "pending" },
  }, null, 2);

  const csvRows = [
    "segmentId,startMs,endMs,speaker,sourceText,englishText,audioIssue",
    ...segs.map(s => [s.id, s.startMs, s.endMs, s.speaker,
      `"${s.sourceText.replace(/"/g, '""')}"`,
      `"${s.englishText.replace(/"/g, '""')}"`,
      s.audioIssue].join(",")),
  ].join("\n");

  const content  = fmt === "json" ? jsonStr : csvRows;
  const filename = `${task.id}_annotation.${fmt}`;

  const handleDownload = () => {
    const blob = new Blob([content], { type: fmt === "json" ? "application/json" : "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
        className="bg-[hsl(var(--md-surface-container))] border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-headline font-bold text-foreground">Export Annotations</h2>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors text-xl">✕</button>
        </div>
        <div className="flex flex-col gap-4 p-6 overflow-y-auto flex-1">
          <div className="flex gap-2 text-xs text-foreground/50">
            <span>Task: <strong className="text-foreground">{task.title}</strong></span>
            <span>·</span>
            <span>Lang: <strong className="text-foreground">{LANG_META[task.language]?.label}</strong></span>
            <span>·</span>
            <span>Segs: <strong className="text-foreground">{segs.length}</strong></span>
          </div>
          <div className="flex gap-2">
            {(["json","csv"] as const).map(f => (
              <button key={f} onClick={() => setFmt(f)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-colors ${
                  fmt === f ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--md-surface-container-high))] text-foreground/60 hover:text-foreground"}`}>
                {f}
              </button>
            ))}
          </div>
          <pre className="bg-black/60 border border-border rounded-xl p-4 text-xs text-foreground/70 overflow-auto max-h-52 font-mono">
            {content.slice(0, 2500)}{content.length > 2500 ? "\n\n…(truncated)" : ""}
          </pre>
        </div>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-border">
          <button onClick={handleDownload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-sm transition-colors">
            <Download size={15}/> Download {filename}
          </button>
          <button onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(var(--md-surface-container-high))] text-foreground/80 hover:text-foreground text-sm transition-colors">
            {copied ? <><Check size={14} className="text-green-400"/> Copied!</> : <><Copy size={14}/> Copy</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Task Queue View ──────────────────────────────────────────────────────────

function TaskQueue({ onSelect }: { onSelect: (t: Task) => void }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");

  const langs = ["all", "zh", "ar", "hi", "ko", "fr", "ja"];
  const filtered = filter === "all" ? TASKS : TASKS.filter(t => t.language === filter);

  const DOMAIN_COLOR: Record<string, string> = {
    conversational:   "border-primary/30 text-primary",
    travel:           "border-blue-500/30 text-blue-400",
    "healthcare-lite":"border-green-500/30 text-green-400",
    customer_support: "border-orange-500/30 text-orange-400",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-between px-6 h-14">
          <button onClick={() => navigate("/use-cases")}
            className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors text-sm">
            <ArrowLeft size={16}/> Use Cases
          </button>
          <span className="font-headline font-bold text-foreground text-sm tracking-wide uppercase">
            AUD-401 · Audio Annotation
          </span>
          <div className="w-24" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[#5b21b6] to-[#9071f0]" />
      </div>

      <div className="max-w-5xl mx-auto w-full px-6 py-10">
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
          <h1 className="font-headline font-black text-4xl text-foreground text-center mb-2">
            Select a Task
          </h1>
          <p className="text-foreground/50 text-center text-sm mb-8">
            12 sample tasks · 6 languages · Click any card to open the annotation workspace
          </p>

          {/* Language filter */}
          <div className="flex items-center gap-2 flex-wrap justify-center mb-8">
            {langs.map(l => (
              <button key={l} onClick={() => setFilter(l)}
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors border ${
                  filter === l
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border text-foreground/40 hover:text-foreground hover:border-primary/40"}`}>
                {l === "all" ? "All" : `${LANG_META[l]?.flag} ${LANG_META[l]?.label}`}
              </button>
            ))}
          </div>

          {/* Task grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((task, i) => (
              <motion.div key={task.id}
                initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onSelect(task)}
                className="industrial-card p-5 rounded-[12px] flex flex-col gap-3 cursor-pointer group">
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{LANG_META[task.language]?.flag}</span>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-bold uppercase tracking-widest border rounded-full px-2 py-0.5 ${
                      task.difficulty === "easy"
                        ? "border-green-500/30 text-green-400"
                        : "border-amber-500/30 text-amber-400"}`}>
                      {task.difficulty}
                    </span>
                    <span className="text-xs text-foreground/30 font-mono">{task.id.toUpperCase()}</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-foreground uppercase tracking-wide text-sm mb-1">
                    {task.title}
                  </h3>
                  <p className="text-foreground/50 text-xs">
                    {LANG_META[task.language]?.label} → English · {fmtDur(task.durationSec)} · {task.segments.length} segments
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-xs font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 ${DOMAIN_COLOR[task.domainTag] ?? "border-border text-foreground/40"}`}>
                    {task.domainTag.replace("_"," ")}
                  </span>
                  <span className="text-xs border border-border text-foreground/30 rounded-full px-2 py-0.5 uppercase tracking-wider font-bold">
                    {task.taskType === "both" ? "Transcribe + Translate" : task.taskType}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Annotation Workspace ─────────────────────────────────────────────────────

type WorkspaceTab = "transcript" | "translation" | "qc";
type Status = "in_progress" | "submitted" | "approved" | "returned";

function Workspace({ task, onBack }: { task: Task; onBack: () => void }) {
  const [segs,       setSegs]       = useState<AnnotSeg[]>(() => makeSegs(task));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab,        setTab]        = useState<WorkspaceTab>("transcript");
  const [status,     setStatus]     = useState<Status>("in_progress");
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [playhead,   setPlayhead]   = useState(0); // 0-1 ratio
  const [showExport, setShowExport] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [saved,      setSaved]      = useState(false);
  const rafRef         = useRef<number | null>(null);
  const startRef       = useRef<{ ts: number; base: number } | null>(null);
  const lastSpokenRef  = useRef<string | null>(null); // segmentId last spoken
  const totalMs = task.durationSec * 1000;
  const rtl = !!LANG_META[task.language]?.rtl;

  // Fake playback tick
  useEffect(() => {
    if (isPlaying) {
      startRef.current = { ts: performance.now(), base: playhead };
      const tick = () => {
        if (!startRef.current) return;
        const elapsed = (performance.now() - startRef.current.ts) / 1000;
        const next = startRef.current.base + elapsed / task.durationSec;
        if (next >= 1) { setIsPlaying(false); setPlayhead(1); return; }
        setPlayhead(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Stop any ongoing speech when paused
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      lastSpokenRef.current = null;
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying]);

  // Preload voices and cancel speech on unmount
  useEffect(() => {
    if ("speechSynthesis" in window) {
      // Trigger voice list load (required in some browsers)
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener("voiceschanged", () => window.speechSynthesis.getVoices());
    }
    return () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, []);

  const currentMs = Math.round(playhead * totalMs);

  // ── Speech synthesis: speak each segment as playhead enters it ──────────────
  useEffect(() => {
    if (!isPlaying) return;
    const activeSeg = segs.find(s => currentMs >= s.startMs && currentMs < s.endMs);
    if (!activeSeg) return;
    if (activeSeg.id === lastSpokenRef.current) return; // already speaking this one
    lastSpokenRef.current = activeSeg.id;
    const textToSpeak = activeSeg.sourceText.trim() || activeSeg.englishText.trim();
    speakSegment(textToSpeak, task.language, activeSeg.speaker);
  }, [currentMs, isPlaying, segs, task.language]);

  const seekToMs = useCallback((ms: number) => {
    setPlayhead(ms / totalMs);
    startRef.current = null;
    lastSpokenRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [totalMs]);

  const addSegment = (startMs: number, endMs: number) => {
    const seg: AnnotSeg = {
      id: nextId(), startMs, endMs, speaker: "S1", nonSpeech: "NONE",
      sourceText: "", englishText: "", lowConf: false, needsPass2: false,
      audioIssue: "NONE", comments: [],
    };
    setSegs(prev => [...prev, seg].sort((a, b) => a.startMs - b.startMs));
    setSelectedId(seg.id);
  };

  const updateSeg = (id: string, patch: Partial<AnnotSeg>) =>
    setSegs(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));

  const deleteSeg = (id: string) => {
    setSegs(prev => prev.filter(s => s.id !== id));
    setSelectedId(prev => prev === id ? null : prev);
  };

  const handleSave = () => {
    // Persist to localStorage
    try { localStorage.setItem(`audio_ann_v1_${task.id}`, JSON.stringify({ segs, status })); } catch {}
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const handleSubmit = () => { setStatus("submitted"); handleSave(); };
  const handleApprove = () => setStatus("approved");
  const handleReturn  = () => setStatus("returned");

  const selectedSeg = segs.find(s => s.id === selectedId);

  const STATUS_PILL: Record<Status, string> = {
    in_progress: "bg-blue-950 text-blue-300",
    submitted:   "bg-yellow-950 text-yellow-300",
    approved:    "bg-green-950 text-green-300",
    returned:    "bg-red-950 text-red-300",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-foreground/50 hover:text-foreground transition-colors text-sm">
            <ArrowLeft size={15}/> Tasks
          </button>
          <div className="w-px h-5 bg-border" />
          <span className="text-foreground font-bold text-sm">
            {LANG_META[task.language]?.flag} {task.title}
          </span>
          <span className="text-foreground/40 text-xs">· {LANG_META[task.language]?.label} → English</span>
          <span className={`ml-1 text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_PILL[status]}`}>
            {status.replace("_"," ")}
          </span>
          <div className="flex-1" />
          <button onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-foreground/60 hover:text-foreground text-xs transition-colors">
            <Download size={12}/> Export
          </button>
          <button onClick={handleSave}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              saved ? "border-green-600 text-green-400" : "border-border text-foreground/60 hover:text-foreground"}`}>
            <Save size={12}/>{saved ? " Saved!" : " Save"}
          </button>
          {status === "in_progress" && (
            <button onClick={handleSubmit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground text-xs font-bold transition-colors">
              <Send size={12}/> Submit
            </button>
          )}
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[#5b21b6] to-[#9071f0]" />
      </div>

      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* LEFT: Waveform + Segment Table */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-border">
          {/* Waveform panel */}
          <div className="p-4 border-b border-border bg-[hsl(var(--md-surface-container-low))]">
            <FakeWaveform
              task={task} segments={segs} selectedId={selectedId}
              playheadRatio={playhead}
              onSeek={r => { setPlayhead(r); startRef.current = null; }}
              onAddSegment={addSegment}
            />
            {/* Playback controls */}
            <div className="flex items-center gap-3 mt-3">
              <button onClick={() => seekToMs(Math.max(0, currentMs - 2000))}
                aria-label="Back 2s" className="text-foreground/40 hover:text-foreground transition-colors">
                <SkipBack size={16}/>
              </button>
              <button onClick={() => setIsPlaying(p => !p)} aria-label={isPlaying ? "Pause" : "Play"}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-primary hover:bg-primary/80 text-white transition-colors">
                {isPlaying ? <Pause size={15}/> : <Play size={15}/>}
              </button>
              <button onClick={() => seekToMs(Math.min(totalMs, currentMs + 2000))}
                aria-label="Forward 2s" className="text-foreground/40 hover:text-foreground transition-colors">
                <SkipForward size={16}/>
              </button>
              <span className="text-xs font-mono text-foreground/40">
                {msToTC(currentMs)} / {msToTC(totalMs)}
              </span>
              <input type="range" min={0} max={1} step={0.001} value={playhead}
                onChange={e => { setPlayhead(+e.target.value); startRef.current = null; }}
                className="flex-1 h-1 accent-primary" aria-label="Seek"/>
              <Volume2 size={14} className="text-foreground/30"/>
            </div>
          </div>

          {/* Segment table */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-foreground/40">
                Segments ({segs.length})
              </span>
              <button onClick={() => addSegment(currentMs, Math.min(totalMs, currentMs + 2000))}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground font-bold transition-colors">
                + Add at Playhead
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-[hsl(var(--md-surface-container-high))] text-foreground/40">
                  <tr>
                    <th className="px-3 py-2 text-left w-10">#</th>
                    <th className="px-3 py-2 text-left w-24">Timecode</th>
                    <th className="px-3 py-2 text-left w-20">Speaker</th>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-left">English</th>
                    <th className="px-3 py-2 text-left w-24">Issue</th>
                    <th className="px-3 py-2 text-center w-16">Del</th>
                  </tr>
                </thead>
                <tbody>
                  {segs.map((seg, i) => {
                    const active   = seg.id === selectedId;
                    const playing  = currentMs >= seg.startMs && currentMs <= seg.endMs;
                    const spkColor = SPEAKER_COLORS[seg.speaker] ?? "#94a3b8";
                    return (
                      <tr key={seg.id}
                        onClick={() => { setSelectedId(seg.id); seekToMs(seg.startMs); }}
                        className={`border-t border-border cursor-pointer transition-colors ${
                          active  ? "bg-primary/10" :
                          playing ? "bg-[hsl(var(--md-surface-container-high))]" :
                          "hover:bg-[hsl(var(--md-surface-container-low))]"
                        }`}>
                        <td className="px-3 py-2 text-foreground/30 font-mono">{i+1}</td>
                        <td className="px-3 py-2 font-mono text-foreground/40">
                          <div>{msToTC(seg.startMs)}</div>
                          <div>{msToTC(seg.endMs)}</div>
                        </td>
                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                          <select value={seg.speaker}
                            onChange={e => updateSeg(seg.id, { speaker: e.target.value })}
                            className="bg-[hsl(var(--md-surface-container-high))] border border-border rounded px-1 py-0.5 text-xs w-full"
                            style={{ color: spkColor }}>
                            {["S1","S2","OVERLAP","UNK"].map(s => <option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 min-w-[140px]" onClick={e => e.stopPropagation()}>
                          <textarea value={seg.sourceText} rows={2}
                            dir={rtl ? "rtl" : "ltr"}
                            onChange={e => updateSeg(seg.id, { sourceText: e.target.value })}
                            className="w-full bg-transparent text-foreground/80 text-xs resize-none focus:outline-none placeholder-foreground/20"
                            placeholder="Source text…"/>
                        </td>
                        <td className="px-3 py-2 min-w-[140px]" onClick={e => e.stopPropagation()}>
                          <textarea value={seg.englishText} rows={2}
                            onChange={e => updateSeg(seg.id, { englishText: e.target.value })}
                            className="w-full bg-transparent text-foreground/80 text-xs resize-none focus:outline-none placeholder-foreground/20"
                            placeholder="English translation…"/>
                        </td>
                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                          <select value={seg.audioIssue}
                            onChange={e => updateSeg(seg.id, { audioIssue: e.target.value })}
                            className={`bg-[hsl(var(--md-surface-container-high))] border border-border rounded px-1 py-0.5 text-xs w-full ${
                              seg.audioIssue !== "NONE" ? "text-amber-400" : "text-foreground/40"}`}>
                            {["NONE","CLIPPING","BACKGROUND_NOISE","DROP_OUT","DISTORTION"].map(v => <option key={v}>{v}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                          <button onClick={() => deleteSeg(seg.id)}
                            className="text-foreground/20 hover:text-red-400 transition-colors text-base">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                  {segs.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-foreground/30">
                      Shift+drag on waveform or click "+ Add at Playhead" to create segments.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: Tabs */}
        <div className="w-full lg:w-80 flex flex-col shrink-0">
          {/* Tab bar */}
          <div className="flex border-b border-border bg-[hsl(var(--md-surface-container-low))]">
            {(["transcript","translation","qc"] as WorkspaceTab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${
                  tab === t ? "border-primary text-primary" : "border-transparent text-foreground/30 hover:text-foreground/60"
                }`}>
                {t === "transcript" ? "Transcript" : t === "translation" ? "Translation" : "QC"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Transcript */}
            {tab === "transcript" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs text-foreground/40 font-bold uppercase tracking-widest pb-2 border-b border-border">
                  <span className="material-symbols-outlined text-base">transcribe</span>
                  {LANG_META[task.language]?.label} Transcript
                  {rtl && <span className="bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded text-xs">RTL</span>}
                </div>
                {segs.map(seg => {
                  const col = SPEAKER_COLORS[seg.speaker] ?? "#94a3b8";
                  return (
                    <div key={seg.id} onClick={() => { setSelectedId(seg.id); seekToMs(seg.startMs); }}
                      className={`rounded-xl border transition-colors cursor-pointer ${
                        seg.id === selectedId ? "border-primary bg-primary/5" : "border-border bg-[hsl(var(--md-surface-container-low))]"}`}>
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ color: col, background: col+"22" }}>{seg.speaker}</span>
                        <span className="text-xs font-mono text-foreground/30">{msToTC(seg.startMs)}</span>
                      </div>
                      <div className="px-3 py-2">
                        <textarea dir={rtl ? "rtl" : "ltr"} value={seg.sourceText} rows={2}
                          onChange={e => updateSeg(seg.id, { sourceText: e.target.value })}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-transparent text-sm text-foreground/80 resize-none focus:outline-none placeholder-foreground/20"
                          placeholder={`Transcribe ${LANG_META[task.language]?.label}…`}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Translation */}
            {tab === "translation" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs text-foreground/40 font-bold uppercase tracking-widest pb-2 border-b border-border">
                  <span className="material-symbols-outlined text-base">translate</span>
                  English Translation
                </div>
                {segs.map(seg => {
                  const col = SPEAKER_COLORS[seg.speaker] ?? "#94a3b8";
                  return (
                    <div key={seg.id} onClick={() => { setSelectedId(seg.id); seekToMs(seg.startMs); }}
                      className={`rounded-xl border transition-colors cursor-pointer ${
                        seg.id === selectedId ? "border-primary bg-primary/5" : "border-border bg-[hsl(var(--md-surface-container-low))]"}`}>
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ color: col, background: col+"22" }}>{seg.speaker}</span>
                        {seg.sourceText && (
                          <span className="text-xs text-foreground/30 italic truncate max-w-[150px]">
                            "{seg.sourceText.slice(0,25)}{seg.sourceText.length>25?"…":""}"
                          </span>
                        )}
                      </div>
                      <div className="px-3 py-2">
                        <textarea value={seg.englishText} rows={2}
                          onChange={e => updateSeg(seg.id, { englishText: e.target.value })}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-transparent text-sm text-foreground/80 resize-none focus:outline-none placeholder-foreground/20"
                          placeholder="English translation…"/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* QC */}
            {tab === "qc" && (
              <div className="flex flex-col gap-4">
                <div className="text-xs font-bold uppercase tracking-widest text-foreground/40 pb-2 border-b border-border">
                  Quality Control
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label:"Total Segments",  val: segs.length },
                    { label:"Filled Source",   val: segs.filter(s=>s.sourceText.trim()).length },
                    { label:"Filled English",  val: segs.filter(s=>s.englishText.trim()).length },
                    { label:"Flagged Issues",  val: segs.filter(s=>s.audioIssue!=="NONE").length },
                  ].map(m => (
                    <div key={m.label} className="bg-[hsl(var(--md-surface-container-high))] rounded-xl p-3 text-center border border-border">
                      <div className="text-xl font-black text-primary">{m.val}</div>
                      <div className="text-xs text-foreground/40 mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Review notes */}
                <div>
                  <label className="text-xs text-foreground/40 font-bold uppercase tracking-widest block mb-2">
                    Review Notes
                  </label>
                  <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={4}
                    placeholder="Add reviewer feedback…"
                    className="w-full bg-[hsl(var(--md-surface-container-high))] border border-border rounded-xl px-3 py-2 text-sm text-foreground/80 resize-none focus:outline-none focus:border-primary placeholder-foreground/20"/>
                </div>

                {/* Reviewer actions */}
                {status === "submitted" && (
                  <div className="flex gap-2">
                    <button onClick={handleApprove}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-900 hover:bg-green-800 text-green-100 text-sm font-bold transition-colors">
                      <CheckCircle size={15}/> Approve
                    </button>
                    <button onClick={handleReturn}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-900/60 hover:bg-red-800/60 text-red-200 text-sm font-bold transition-colors">
                      <XCircle size={15}/> Return
                    </button>
                  </div>
                )}
                {status === "approved" && (
                  <div className="text-center py-3 rounded-xl bg-green-900/30 text-green-400 text-sm font-bold">
                    ✓ Task Approved
                  </div>
                )}
                {status === "returned" && (
                  <div className="text-center py-3 rounded-xl bg-red-900/30 text-red-400 text-sm font-bold">
                    ↩ Returned for Rework
                  </div>
                )}
                {status === "in_progress" && (
                  <p className="text-xs text-foreground/30 text-center">
                    Submit the task first to enable QC review.
                  </p>
                )}

                {/* Flags summary */}
                {segs.some(s => s.audioIssue !== "NONE" || s.lowConf || s.needsPass2) && (
                  <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-3">
                    <div className="text-xs font-bold text-amber-400 mb-2">Flagged Segments</div>
                    {segs.filter(s => s.audioIssue !== "NONE" || s.lowConf).map(s => (
                      <div key={s.id} className="text-xs text-foreground/50 flex gap-2">
                        <span className="text-amber-500 font-mono">{s.id}</span>
                        <span>{s.audioIssue !== "NONE" ? s.audioIssue : "Low confidence"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showExport && <ExportModal task={task} segs={segs} status={status} onClose={() => setShowExport(false)}/>}
      </AnimatePresence>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function AudioAnnotation() {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  return activeTask
    ? <Workspace task={activeTask} onBack={() => setActiveTask(null)}/>
    : <TaskQueue onSelect={setActiveTask}/>;
}
