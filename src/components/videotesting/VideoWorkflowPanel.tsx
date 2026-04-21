import React, { useMemo } from "react";
import {
  ClipboardEdit,
  Sparkles,
  ShieldCheck,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  BarChart2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  BadgeCheck,
  Swords,
  ThumbsDown,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  VIDEO_TASKS,
  RATING_DIMS,
  RatingDimKey,
  RatingValue,
  VideoRatings,
  TaskQAResult,
  computeQAResults,
  EMPTY_RATINGS,
} from "./vidData";

// ─── Types ───────────────────────────────────────────────────────────────────
export type WorkflowStage = "evaluate" | "ai_review" | "qa_review" | "delivered";

const STAGES: {
  id: WorkflowStage;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: "evaluate",  label: "Evaluate",  Icon: ClipboardEdit },
  { id: "ai_review", label: "AI Review", Icon: Sparkles },
  { id: "qa_review", label: "QA Review", Icon: ShieldCheck },
  { id: "delivered", label: "Delivered", Icon: PackageCheck },
];

interface Props {
  currentTaskId: string;
  taskIndex: number;
  totalTasks: number;
  onNextTask: () => void;
  allRatings: Record<string, VideoRatings>;
  stage: WorkflowStage;
  onStageChange: (s: WorkflowStage) => void;
  aiRan: boolean;
  onRunAI: () => void;
  onRatingChange: (
    taskId: string,
    key: RatingDimKey | "strength" | "confidence" | "rationale",
    value: unknown
  ) => void;
  onOpenQAReport: () => void;
}

export function VideoWorkflowPanel({
  currentTaskId,
  taskIndex,
  totalTasks,
  onNextTask,
  allRatings,
  stage,
  onStageChange,
  aiRan,
  onRunAI,
  onRatingChange,
  onOpenQAReport,
}: Props) {
  const currentStageIndex = STAGES.findIndex((s) => s.id === stage);

  const qaResults: TaskQAResult[] = useMemo(
    () => (aiRan ? computeQAResults(allRatings) : []),
    [allRatings, aiRan]
  );

  const stats = useMemo(() => {
    if (!aiRan || qaResults.length === 0) return null;
    const total = qaResults.length;
    const matches = qaResults.filter((r) => r.status === "match").length;
    const needsQA = qaResults.filter(
      (r) => r.status !== "match" && r.status !== "incomplete"
    ).length;
    const conflicts = qaResults.filter((r) => r.status === "conflict").length;
    const avgAgreement =
      qaResults.reduce((a, r) => a + r.agreementScore, 0) / total;
    const avgAIConf =
      VIDEO_TASKS.reduce((a, t) => a + t.aiVerdict.confidence, 0) / total;
    return { total, matches, needsQA, conflicts, avgAgreement, avgAIConf };
  }, [qaResults, aiRan]);

  const currentRatings = allRatings[currentTaskId] ?? EMPTY_RATINGS;

  const completedCount = Object.values(allRatings).filter(
    (r) =>
      r.realism !== null &&
      r.temporal_stability !== null &&
      r.audio_sync !== null &&
      r.prompt_alignment !== null &&
      r.overall !== null
  ).length;

  return (
    <div className="flex flex-col gap-0">
      {/* Stepper */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center justify-between">
          {STAGES.map((s, i) => {
            const Icon = s.Icon;
            const isDone = i < currentStageIndex;
            const isCurrent = i === currentStageIndex;
            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors"
                    style={{
                      borderColor:
                        isDone || isCurrent ? "hsl(var(--primary))" : "hsl(0,0%,22%)",
                      background: isCurrent
                        ? "hsl(var(--primary) / 0.15)"
                        : isDone
                        ? "hsl(var(--primary) / 0.85)"
                        : "transparent",
                      color: isCurrent
                        ? "hsl(var(--primary))"
                        : isDone
                        ? "#fff"
                        : "hsl(0,0%,55%)",
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <span
                    className="mt-1.5 text-sm font-semibold whitespace-nowrap"
                    style={{
                      color: isCurrent
                        ? "hsl(var(--primary))"
                        : isDone
                        ? "hsl(0,0%,85%)"
                        : "hsl(0,0%,55%)",
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div
                    className="h-px flex-1 mx-1 -translate-y-4"
                    style={{
                      background:
                        i < currentStageIndex
                          ? "hsl(var(--primary))"
                          : "hsl(0,0%,22%)",
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* EVALUATE */}
      {stage === "evaluate" && (
        <div className="px-4 pb-5 pt-4 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Rate each video pair across 5 dimensions. Watch frame-by-frame for
            temporal artifacts and A/V sync issues.{" "}
            <span className="text-foreground/70 font-medium">
              {completedCount}/{VIDEO_TASKS.length} tasks complete.
            </span>
          </p>

          {/* Progress bar */}
          <div className="flex gap-1.5">
            {VIDEO_TASKS.map((t) => {
              const r = allRatings[t.id];
              const done =
                r &&
                r.realism &&
                r.temporal_stability &&
                r.audio_sync &&
                r.prompt_alignment &&
                r.overall;
              const active = t.id === currentTaskId;
              return (
                <div
                  key={t.id}
                  className="h-2 flex-1 rounded-full transition-colors"
                  style={{
                    background: done
                      ? "hsl(var(--primary))"
                      : active
                      ? "hsl(var(--primary) / 0.35)"
                      : "hsl(0,0%,18%)",
                  }}
                />
              );
            })}
          </div>

          <RatingForm
            ratings={currentRatings}
            onChange={(key, val) => onRatingChange(currentTaskId, key, val)}
          />

          {taskIndex < totalTasks - 1 ? (
            <Button
              className="w-full h-10 text-sm gap-2"
              disabled={
                !currentRatings.realism ||
                !currentRatings.temporal_stability ||
                !currentRatings.audio_sync ||
                !currentRatings.prompt_alignment ||
                !currentRatings.overall
              }
              onClick={onNextTask}
            >
              Next Task
              <ChevronRight size={16} />
            </Button>
          ) : (
            <Button
              className="w-full h-10 text-sm"
              disabled={completedCount < totalTasks}
              onClick={() => onStageChange("ai_review")}
            >
              Submit All for AI Review
              {completedCount < totalTasks && (
                <span className="ml-2 text-sm opacity-70">
                  ({totalTasks - completedCount} remaining)
                </span>
              )}
            </Button>
          )}
        </div>
      )}

      {/* AI REVIEW */}
      {stage === "ai_review" && (
        <div className="px-4 pb-5 pt-4 flex flex-col gap-4">
          {!aiRan ? (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The AI reviewer will analyse each video pair against the prompt
                and your ratings, producing a reference verdict, confidence
                score, and detected imperfections.
              </p>
              <Button className="w-full h-10 gap-2 text-sm" onClick={onRunAI}>
                <Play size={16} /> Run AI Analysis
              </Button>
            </>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <MetricTile label="Agreement" value={(stats.avgAgreement * 100).toFixed(0) + "%"} tone="primary" />
                <MetricTile label="AI Avg Conf." value={(stats.avgAIConf * 100).toFixed(0) + "%"} tone="primary" />
                <MetricTile label="Matches" value={`${stats.matches}/${stats.total}`} tone="good" />
                <MetricTile label="Needs QA" value={String(stats.needsQA)} tone={stats.needsQA > 0 ? "warn" : "good"} />
              </div>

              <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-0.5">
                {qaResults.map((r) => (
                  <AIVerdictCard key={r.task.id} result={r} />
                ))}
              </div>

              {stats.needsQA > 0 ? (
                <Button
                  className="w-full h-10 text-sm"
                  variant="secondary"
                  onClick={() => onStageChange("qa_review")}
                >
                  Route to QA ({stats.needsQA}{" "}
                  {stats.needsQA === 1 ? "task" : "tasks"})
                </Button>
              ) : (
                <Button
                  className="w-full h-10 text-sm"
                  onClick={() => onStageChange("delivered")}
                >
                  All Clear — Mark Delivered
                </Button>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* QA REVIEW */}
      {stage === "qa_review" && stats && (
        <QAReviewPanel
          qaResults={qaResults}
          stats={stats}
          onOpenQAReport={onOpenQAReport}
          onDeliver={() => onStageChange("delivered")}
        />
      )}

      {/* DELIVERED */}
      {stage === "delivered" && (
        <div className="px-4 pb-5 pt-4 flex flex-col gap-4">
          <div className="flex items-center gap-3 p-4 rounded-lg border border-green-500/30 bg-green-500/5">
            <CheckCircle2 className="text-green-500 shrink-0" size={22} />
            <div>
              <div className="font-semibold text-foreground text-base">
                Batch delivered
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                All {VIDEO_TASKS.length} video pairs reviewed, approved, and
                exported to the preference dataset.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2 text-sm" onClick={onOpenQAReport}>
              <BarChart2 size={16} /> QA Report
            </Button>
            <Button variant="secondary" className="flex-1 text-sm" onClick={() => onStageChange("evaluate")}>
              New Batch
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Rating Form ───────────────────────────────────────────────────────────
function RatingForm({
  ratings,
  onChange,
}: {
  ratings: VideoRatings;
  onChange: (
    key: RatingDimKey | "strength" | "confidence" | "rationale",
    val: unknown
  ) => void;
}) {
  const sections = ["video", "audio", "alignment", "overall"] as const;
  const sectionLabels: Record<string, string> = {
    video: "Video Quality",
    audio: "Audio & Sync",
    alignment: "Prompt Alignment",
    overall: "Overall",
  };

  return (
    <div className="flex flex-col gap-2.5">
      {sections.map((section) => {
        const dims = RATING_DIMS.filter((d) => d.section === section);
        if (dims.length === 0) return null;
        return (
          <div key={section} className="rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 bg-surface-raised/60 border-b border-border">
              <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                {sectionLabels[section]}
              </span>
            </div>
            <div className="divide-y divide-border/50">
              {dims.map((dim) => (
                <RatingRow
                  key={dim.key}
                  dim={dim}
                  value={ratings[dim.key]}
                  onChange={(v) => onChange(dim.key, v)}
                />
              ))}
            </div>

            {section === "overall" &&
              ratings.overall &&
              ratings.overall !== "TIE" && (
                <div className="px-3 pb-3 pt-2 border-t border-border/50">
                  <p className="text-sm text-muted-foreground mb-2">
                    How strong is the preference?{" "}
                    <span className="text-muted-foreground/60">(optional)</span>
                  </p>
                  <div className="flex gap-2">
                    {(["SLIGHTLY", "MUCH"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          onChange(
                            "strength",
                            ratings.strength === s ? null : s
                          )
                        }
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium border transition-all ${
                          ratings.strength === s
                            ? "bg-primary/20 border-primary/50 text-primary"
                            : "border-border bg-surface-raised text-muted-foreground hover:border-muted-foreground/40"
                        }`}
                      >
                        {s === "SLIGHTLY" ? "Slightly better" : "Much better"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>
        );
      })}

      {/* Confidence */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Confidence{" "}
          <span className="normal-case tracking-normal font-normal text-muted-foreground/60">
            (optional)
          </span>
        </span>
        <div className="flex gap-2">
          {(["LOW", "MEDIUM", "HIGH"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() =>
                onChange("confidence", ratings.confidence === c ? null : c)
              }
              className={`flex-1 px-2 py-2 rounded text-sm font-semibold border transition-all ${
                ratings.confidence === c
                  ? c === "LOW"
                    ? "bg-red-700/60 border-red-600 text-white"
                    : c === "MEDIUM"
                    ? "bg-amber-700/60 border-amber-600 text-white"
                    : "bg-green-700/60 border-green-600 text-white"
                  : "border-border bg-surface-raised text-muted-foreground hover:border-muted-foreground/40"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Rationale */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground block">
          Rationale{" "}
          <span className="normal-case tracking-normal font-normal text-muted-foreground/60">
            (optional)
          </span>
        </label>
        <textarea
          value={ratings.rationale}
          onChange={(e) => onChange("rationale", e.target.value)}
          placeholder="Describe key differences, artifacts noticed, sync issues, etc."
          rows={2}
          className="w-full border border-border rounded p-2 text-sm text-foreground placeholder-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
          style={{ background: "hsl(0,0%,9%)" }}
        />
      </div>
    </div>
  );
}

function RatingRow({
  dim,
  value,
  onChange,
}: {
  dim: { key: RatingDimKey; label: string; description: string };
  value: RatingValue | null;
  onChange: (v: RatingValue) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="flex-1 min-w-0 leading-snug">
        <div className="text-sm text-foreground/90">{dim.label}</div>
        <div className="text-sm text-muted-foreground mt-0.5 leading-tight">
          {dim.description}
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {(["A", "TIE", "B"] as const).map((v) => {
          const isSelected = value === v;
          const bg = v === "A" ? "#6366f1" : v === "B" ? "#7c3aed" : "#92400e";
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={`w-9 h-8 rounded text-sm font-bold border transition-all ${
                isSelected
                  ? "text-white border-transparent shadow-sm"
                  : "text-muted-foreground border-border bg-surface-raised hover:border-muted-foreground/40"
              }`}
              style={isSelected ? { background: bg, borderColor: bg } : {}}
            >
              {v === "A" ? "A" : v === "B" ? "B" : "="}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI Verdict Card ────────────────────────────────────────────────────────
function AIVerdictCard({ result }: { result: TaskQAResult }) {
  const [open, setOpen] = React.useState(false);

  const statusConfig = {
    match:              { Icon: CheckCircle2, color: "#22c55e", label: "Match" },
    conflict:           { Icon: Swords,       color: "#ef4444", label: "Conflict" },
    low_ai_conf:        { Icon: AlertTriangle, color: "#f59e0b", label: "Low AI Conf." },
    low_annotator_conf: { Icon: ThumbsDown,   color: "#f59e0b", label: "Low Conf." },
    incomplete:         { Icon: XCircle,      color: "#6b7280", label: "Incomplete" },
  }[result.status];

  const { Icon, color, label } = statusConfig;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-surface-raised/40 transition-colors"
      >
        <Icon size={16} style={{ color }} className="shrink-0" />
        <span className="flex-1 text-sm font-medium text-foreground truncate">
          Task {result.task.taskNumber}: {result.task.promptLabel}
        </span>
        <Badge
          variant="outline"
          className="text-sm px-2 py-0.5 shrink-0 font-semibold"
          style={{ color, borderColor: color + "55" }}
        >
          {label}
        </Badge>
        {open ? (
          <ChevronUp size={14} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-border/50 space-y-3 text-sm">
          <div className="pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">AI recommends</span>
              <span className="font-semibold text-foreground">
                {result.aiWinner === "TIE" ? "Tie" : `Video ${result.aiWinner}`}
                <span className="ml-2 text-muted-foreground font-normal text-sm">
                  ({(result.aiConfidence * 100).toFixed(0)}% conf.)
                </span>
              </span>
            </div>
            {result.humanOverall && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Your choice</span>
                <span className="font-semibold text-foreground">
                  {result.humanOverall === "TIE"
                    ? "Tie"
                    : `Video ${result.humanOverall}`}
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-muted-foreground text-sm">AI Confidence</span>
              <span
                className="text-sm font-semibold"
                style={{
                  color: result.aiConfidence >= 0.75 ? "#22c55e" : "#f59e0b",
                }}
              >
                {(result.aiConfidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${result.aiConfidence * 100}%`,
                  background:
                    result.aiConfidence >= 0.75 ? "#22c55e" : "#f59e0b",
                }}
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-primary/30 pl-2.5">
            {result.task.aiVerdict.reasoning}
          </p>

          {result.flagReasons.length > 0 && (
            <div className="flex flex-col gap-1">
              {result.flagReasons.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-amber-400/90 text-sm">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── QA Review Panel ────────────────────────────────────────────────────────
function QAReviewPanel({
  qaResults,
  stats,
  onOpenQAReport,
  onDeliver,
}: {
  qaResults: TaskQAResult[];
  stats: {
    total: number;
    matches: number;
    needsQA: number;
    conflicts: number;
    avgAgreement: number;
    avgAIConf: number;
  };
  onOpenQAReport: () => void;
  onDeliver: () => void;
}) {
  const [arbitrationNotes, setArbitrationNotes] = React.useState<Record<string, string>>({});
  const [resolutions, setResolutions] = React.useState<Record<string, "human" | "ai" | "expert" | null>>({});
  const [detectedImperfections, setDetectedImperfections] = React.useState<
    Record<string, string[]>
  >({});

  const flagged = qaResults.filter(
    (r) => r.status !== "match" && r.status !== "incomplete"
  );
  const allResolved = flagged.every((r) => resolutions[r.task.id] != null);

  return (
    <div className="px-4 pb-5 pt-4 flex flex-col gap-4">
      {/* Summary banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/5">
        <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm leading-snug space-y-0.5">
          <span className="font-semibold text-amber-300">
            {stats.needsQA}{" "}
            {stats.needsQA === 1 ? "task" : "tasks"} flagged for QA.
          </span>
          {stats.conflicts > 0 && (
            <span className="text-muted-foreground">
              {" "}
              {stats.conflicts} human–AI conflict
              {stats.conflicts > 1 ? "s" : ""} detected.
            </span>
          )}
          <p className="text-muted-foreground">
            Resolve each item and log detected imperfections before approving.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <SmallStat label="Flagged"   value={String(stats.needsQA)}                          color="#f59e0b" />
        <SmallStat label="Conflicts" value={String(stats.conflicts)}                         color="#ef4444" />
        <SmallStat label="Agreement" value={(stats.avgAgreement * 100).toFixed(0) + "%"}     color="hsl(var(--primary))" />
      </div>

      <div className="flex flex-col gap-3 max-h-[28rem] overflow-y-auto pr-0.5">
        {flagged.map((result) => (
          <QAResolutionCard
            key={result.task.id}
            result={result}
            resolution={resolutions[result.task.id] ?? null}
            onResolve={(v) =>
              setResolutions((prev) => ({ ...prev, [result.task.id]: v }))
            }
            note={arbitrationNotes[result.task.id] ?? ""}
            onNoteChange={(n) =>
              setArbitrationNotes((prev) => ({ ...prev, [result.task.id]: n }))
            }
            imperfections={detectedImperfections[result.task.id] ?? []}
            onImperfectionsChange={(list) =>
              setDetectedImperfections((prev) => ({
                ...prev,
                [result.task.id]: list,
              }))
            }
          />
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 gap-2 text-sm" onClick={onOpenQAReport}>
          <BarChart2 size={16} /> QA Report
        </Button>
        <Button
          className="flex-1 text-sm"
          disabled={!allResolved}
          onClick={onDeliver}
          title={!allResolved ? "Resolve all flagged tasks first" : ""}
        >
          Approve &amp; Deliver
        </Button>
      </div>
    </div>
  );
}

// Catalogue of known intentional imperfections for the scene (QA reference checklist)
const IMPERFECTION_CATALOGUE = [
  { id: "wheel_clip",      label: "Bike wheel clips through curb" },
  { id: "footstep_echo",   label: "Footstep sound continues after stop" },
  { id: "hand_desync",     label: "Hand raises out of sync" },
  { id: "exposure",        label: "Cyclist exposure inconsistency" },
  { id: "briefcase_grav",  label: "Briefcase defies gravity briefly" },
  { id: "lip_mismatch",    label: "Lip movement doesn't match mutter" },
];

function QAResolutionCard({
  result,
  resolution,
  onResolve,
  note,
  onNoteChange,
  imperfections,
  onImperfectionsChange,
}: {
  result: TaskQAResult;
  resolution: "human" | "ai" | "expert" | null;
  onResolve: (v: "human" | "ai" | "expert") => void;
  note: string;
  onNoteChange: (n: string) => void;
  imperfections: string[];
  onImperfectionsChange: (list: string[]) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);

  const statusIcon =
    {
      conflict:            { Icon: Swords,        color: "#ef4444" },
      low_ai_conf:         { Icon: AlertTriangle, color: "#f59e0b" },
      low_annotator_conf:  { Icon: ThumbsDown,    color: "#f59e0b" },
      match:               { Icon: CheckCircle2,  color: "#22c55e" },
      incomplete:          { Icon: XCircle,       color: "#6b7280" },
    }[result.status] ?? { Icon: AlertTriangle, color: "#f59e0b" };

  function toggleImperfection(id: string) {
    if (imperfections.includes(id)) {
      onImperfectionsChange(imperfections.filter((x) => x !== id));
    } else {
      onImperfectionsChange([...imperfections, id]);
    }
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: resolution ? "#22c55e44" : "#f59e0b44" }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2.5 w-full px-3 py-3 text-left hover:bg-surface-raised/30 transition-colors"
        style={{ background: resolution ? "#22c55e08" : "transparent" }}
      >
        <statusIcon.Icon size={16} style={{ color: statusIcon.color }} className="shrink-0" />
        <span className="flex-1 text-sm font-semibold text-foreground truncate">
          Task {result.task.taskNumber}: {result.task.promptLabel}
        </span>
        {resolution && <BadgeCheck size={16} className="text-green-500 shrink-0" />}
        {expanded ? (
          <ChevronUp size={14} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3.5 border-t border-border/40 space-y-3 text-sm">
          {/* Issue summary */}
          <div className="pt-3 space-y-1.5">
            {result.flagReasons.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-amber-400/90 text-sm">
                <AlertTriangle size={12} className="shrink-0" />
                <span>{r}</span>
              </div>
            ))}
          </div>

          {/* Human vs AI */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-2.5 space-y-1">
              <div className="text-sm uppercase tracking-widest text-indigo-400 font-bold">
                Human
              </div>
              <div className="font-bold text-base text-foreground">
                {result.humanOverall === "TIE"
                  ? "Tie"
                  : result.humanOverall
                  ? `Video ${result.humanOverall}`
                  : "—"}
              </div>
              {result.humanRatings?.confidence && (
                <div
                  className={`text-sm font-medium ${
                    result.humanRatings.confidence === "LOW"
                      ? "text-red-400"
                      : result.humanRatings.confidence === "MEDIUM"
                      ? "text-amber-400"
                      : "text-green-400"
                  }`}
                >
                  {result.humanRatings.confidence} confidence
                </div>
              )}
            </div>
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-2.5 space-y-1">
              <div className="text-sm uppercase tracking-widest text-purple-400 font-bold">
                AI Model
              </div>
              <div className="font-bold text-base text-foreground">
                {result.aiWinner === "TIE" ? "Tie" : `Video ${result.aiWinner}`}
              </div>
              <div
                className={`text-sm font-medium ${
                  result.aiConfidence >= 0.75 ? "text-green-400" : "text-amber-400"
                }`}
              >
                {(result.aiConfidence * 100).toFixed(0)}% confidence
              </div>
            </div>
          </div>

          {/* Imperfection checklist */}
          <div>
            <label className="text-sm uppercase tracking-widest text-muted-foreground font-bold block mb-2 flex items-center gap-1.5">
              <Film size={12} /> Detected imperfections
            </label>
            <div className="grid grid-cols-1 gap-1">
              {IMPERFECTION_CATALOGUE.map((imp) => {
                const checked = imperfections.includes(imp.id);
                return (
                  <button
                    key={imp.id}
                    type="button"
                    onClick={() => toggleImperfection(imp.id)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded border text-sm text-left transition-all ${
                      checked
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                        : "border-border bg-surface-raised text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        checked
                          ? "border-amber-400 bg-amber-400/20"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {checked && (
                        <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1">{imp.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground/70 mt-1.5">
              Tick every intentional flaw you detected in either video.
            </p>
          </div>

          {/* Arbitration note */}
          <div>
            <label className="text-sm uppercase tracking-widest text-muted-foreground font-bold block mb-1.5">
              Reviewer note
            </label>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Add arbitration note…"
              rows={2}
              className="w-full border border-border rounded-lg p-2.5 text-sm text-foreground placeholder-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
              style={{ background: "hsl(0,0%,9%)" }}
            />
          </div>

          {/* Resolution */}
          <div>
            <label className="text-sm uppercase tracking-widest text-muted-foreground font-bold block mb-2">
              Resolution
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "human" as const, label: "Accept Human" },
                  { id: "ai"    as const, label: "Accept AI" },
                  { id: "expert" as const, label: "Expert Review" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onResolve(id)}
                  className={`px-2 py-2 rounded-lg text-sm font-semibold border transition-all leading-tight ${
                    resolution === id
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "border-border text-muted-foreground hover:border-muted-foreground/50 bg-surface-raised"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tiles ────────────────────────────────────────────────────────────────
function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "good" | "warn";
}) {
  const color =
    tone === "good" ? "#22c55e" : tone === "warn" ? "#f59e0b" : "hsl(var(--primary))";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div className="text-xl font-bold mt-1" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function SmallStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5 text-center">
      <div className="text-sm text-muted-foreground font-medium">{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
