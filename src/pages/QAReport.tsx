import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Printer, CheckCircle, Target, Clock, User, TrendingUp, AlertTriangle, ChevronRight } from "lucide-react";
import { StatusPill, WorkflowStage } from "@/components/StatusPill";

// ─── Mock QA data per use case ──────────────────────────────────────────────
const QA_DATA: Record<
  string,
  {
    title: string;
    overall: number;
    iouScore: number;
    kappaScore: number;
    stage: WorkflowStage;
    annotator: { name: string; accuracy: number; tasks: number; avgTime: string };
    fields: { name: string; accuracy: number; samples: number; issues: number }[];
    summary: string;
  }
> = {
  "invoice-labeler": {
    title: "Invoice Labeler",
    overall: 94.2,
    iouScore: 91.8,
    kappaScore: 0.89,
    stage: "review",
    annotator: { name: "Alex Johnson", accuracy: 96.4, tasks: 1247, avgTime: "42s" },
    fields: [
      { name: "Vendor Name",        accuracy: 98.1, samples: 48, issues: 1 },
      { name: "Invoice Number",     accuracy: 97.3, samples: 48, issues: 1 },
      { name: "Date",               accuracy: 95.8, samples: 48, issues: 2 },
      { name: "Total Amount",       accuracy: 96.2, samples: 48, issues: 2 },
      { name: "Tax",                accuracy: 91.4, samples: 42, issues: 4 },
      { name: "Line Items",         accuracy: 88.7, samples: 38, issues: 4 },
    ],
    summary:
      "4 documents processed, 47 annotations created. All required fields captured. Minor discrepancies in line item amounts flagged for review.",
  },
  "medical-annotation": {
    title: "Medical Image Annotation",
    overall: 91.6,
    iouScore: 87.4,
    kappaScore: 0.84,
    stage: "audit",
    annotator: { name: "Dr. Sarah Chen", accuracy: 93.2, tasks: 342, avgTime: "3m 12s" },
    fields: [
      { name: "Tumor Region",   accuracy: 89.3, samples: 24, issues: 3 },
      { name: "Lesion Area",    accuracy: 92.1, samples: 18, issues: 2 },
      { name: "Normal Tissue",  accuracy: 95.4, samples: 30, issues: 1 },
      { name: "Anomaly",        accuracy: 88.7, samples: 16, issues: 2 },
    ],
    summary:
      "30 scans annotated. IoU ≥ 0.85 on 92% of tumor regions. DICE score 0.88 avg. 3 cases escalated for radiologist review.",
  },
  "lidar-annotation": {
    title: "LiDAR 3D Annotation",
    overall: 96.1,
    iouScore: 94.3,
    kappaScore: 0.93,
    stage: "delivered",
    annotator: { name: "Marcus T.", accuracy: 97.1, tasks: 528, avgTime: "1m 55s" },
    fields: [
      { name: "Vehicle",        accuracy: 98.2, samples: 512, issues: 9 },
      { name: "Pedestrian",     accuracy: 95.7, samples: 284, issues: 12 },
      { name: "Cyclist",        accuracy: 94.3, samples: 156, issues: 9 },
      { name: "Sign / Static",  accuracy: 97.1, samples: 198, issues: 6 },
    ],
    summary:
      "1,150 point cloud frames annotated across 3 scenes. 3D IoU ≥ 0.85 on all vehicle classes. Dataset cleared and delivered.",
  },
  "video-ab-testing": {
    title: "Video A/B Testing",
    overall: 84.1,
    iouScore: 81.6,
    kappaScore: 0.79,
    stage: "audit",
    annotator: { name: "Alex Johnson", accuracy: 88.2, tasks: 1, avgTime: "7m 12s" },
    fields: [
      { name: "Realism / Aesthetics",   accuracy: 90.3, samples: 1, issues: 0 },
      { name: "Temporal Stability",     accuracy: 85.7, samples: 1, issues: 0 },
      { name: "Audio Quality & Sync",   accuracy: 82.4, samples: 1, issues: 1 },
      { name: "Prompt Alignment",       accuracy: 87.1, samples: 1, issues: 0 },
      { name: "Overall Preference",     accuracy: 76.8, samples: 1, issues: 1 },
      { name: "Imperfection Detection", accuracy: 66.7, samples: 6, issues: 2 },
    ],
    summary:
      "1 video pair (GPT-Sora v1 vs Runway Gen-3) evaluated across 5 rubric dimensions + a 6-item imperfection checklist. 4 of 6 hidden flaws detected — bike-curb clip and lip-desync missed. Flagged for expert arbitration on overall preference.",
  },
  "image-ab-testing": {
    title: "Image A/B Testing",
    overall: 87.3,
    iouScore: 84.7,
    kappaScore: 0.81,
    stage: "audit",
    annotator: { name: "Alex Johnson", accuracy: 89.4, tasks: 3, avgTime: "4m 12s" },
    fields: [
      { name: "Realism / Aesthetics", accuracy: 91.2, samples: 3, issues: 0 },
      { name: "Layout / Composition", accuracy: 88.6, samples: 3, issues: 1 },
      { name: "Artifacts / Quality",  accuracy: 93.1, samples: 3, issues: 0 },
      { name: "Prompt Alignment",     accuracy: 85.4, samples: 3, issues: 1 },
      { name: "Overall Preference",   accuracy: 78.9, samples: 3, issues: 1 },
    ],
    summary:
      "3 image pairs evaluated across 5 rating dimensions. 1 human–AI conflict detected on Cyberpunk task (low AI confidence 64%). 2 tasks fully aligned. Routed to QA for arbitration.",
  },
};

// ─── Score dial ─────────────────────────────────────────────────────────────
function ScoreDial({ value, qualityLabel }: { value: number; qualityLabel: string }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = value >= 90 ? "#22c55e" : value >= 75 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center w-28 h-28">
      <svg width="112" height="112" className="-rotate-90" aria-hidden>
        <circle cx="56" cy="56" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="56" cy="56" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold" style={{ color }}>{value}%</p>
        <p className="text-sm text-muted-foreground">{qualityLabel}</p>
      </div>
    </div>
  );
}

// ─── Accuracy bar ────────────────────────────────────────────────────────────
function AccuracyBar({ value }: { value: number }) {
  const color =
    value >= 95 ? "bg-green-500" : value >= 85 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-sm tabular-nums w-10 text-right text-foreground/80">{value}%</span>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function QAReport() {
  const { useCaseId } = useParams<{ useCaseId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const q = t.pages.qaReport;
  const data = QA_DATA[useCaseId ?? ""];

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{q.notFound}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background print:bg-white print:text-black">

      {/* ── Header ── */}
      <header className="dark-surface sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-border/20 print:hidden">
        <div className="flex items-center justify-between px-6 py-3 h-16">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-muted rounded-full transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <span className="text-sm font-bold tracking-wide text-white cursor-pointer hover:text-white/80 transition-colors font-headline shrink-0">
              TP.ai <span style={{ color: "#9071f0" }}>FAB</span>Studio
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-foreground/80">{data.title}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-foreground/60">{q.breadcrumb}</span>
          </div>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> {q.exportPdf}
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
      </header>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 print:px-4 print:py-4 print:space-y-4">

        {/* Title row */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline" className="text-sm text-primary border-primary/30 font-mono">
                {q.badge}
              </Badge>
              <Badge variant="outline" className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("en-GB", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">{data.title}</h1>
            <p className="text-muted-foreground text-base mt-1.5 max-w-xl">{data.summary}</p>
          </div>
          <StatusPill stage={data.stage} size="md" />
        </div>

        {/* ── Metric tiles ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          {/* Dial */}
          <Card className="col-span-2 md:col-span-1">
            <CardContent className="p-4 flex flex-col items-center justify-center min-h-[148px]">
              <ScoreDial value={data.overall} qualityLabel={q.quality} />
              <p className="text-sm text-muted-foreground mt-1">{q.overallQuality}</p>
            </CardContent>
          </Card>

          {/* IoU */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-muted-foreground font-medium">{q.iouScore}</span>
              </div>
              <p className="text-3xl font-bold text-blue-400">{data.iouScore}%</p>
              <p className="text-sm text-muted-foreground mt-1">{q.iouSub}</p>
            </CardContent>
          </Card>

          {/* Kappa */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-muted-foreground font-medium">{q.kappa}</span>
              </div>
              <p className="text-3xl font-bold text-purple-400">{data.kappaScore}</p>
              <p className="text-sm text-muted-foreground mt-1">{q.kappaSub}</p>
            </CardContent>
          </Card>

          {/* Annotator */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-muted-foreground font-medium">{q.annotator}</span>
              </div>
              <p className="text-base font-bold leading-tight">{data.annotator.name}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge
                  variant="outline"
                  className="text-sm text-green-400 border-green-500/30 gap-1"
                >
                  <CheckCircle className="h-2.5 w-2.5" />
                  {data.annotator.accuracy}% {q.acc}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-sm text-muted-foreground border-border/30 gap-1"
                >
                  <Clock className="h-2.5 w-2.5" />
                  {data.annotator.avgTime}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1.5">
                {data.annotator.tasks.toLocaleString()} {q.totalTasks}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Per-field accuracy table ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-400" />
              {q.perField}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">{q.colField}</TableHead>
                  <TableHead>{q.colAccuracy}</TableHead>
                  <TableHead className="w-24 text-center">{q.colSamples}</TableHead>
                  <TableHead className="w-24 text-right pr-6">{q.colIssues}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.fields.map((f) => (
                  <TableRow key={f.name}>
                    <TableCell className="pl-6 font-medium text-sm">{f.name}</TableCell>
                    <TableCell className="w-56">
                      <AccuracyBar value={f.accuracy} />
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {f.samples}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {f.issues > 0 ? (
                        <span className="text-sm text-amber-400 flex items-center justify-end gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {f.issues}
                        </span>
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 ml-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-sm text-muted-foreground text-center pb-4 print:text-black">
          {q.footer(new Date().toISOString().split("T")[0])}
        </p>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .progress-bar-gradient { display: none; }
          body { background: white !important; color: black !important; }
        }
      `}</style>
    </div>
  );
}
