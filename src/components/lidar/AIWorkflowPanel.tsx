import React, { useMemo } from "react";
import {
  FileEdit,
  Sparkles,
  ClipboardCheck,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Play,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AI_BOXES,
  AIBox,
  ComparisonRow,
  compareAnnotations,
  HumanBoxLite,
} from "./aiVerification";

export type WorkflowStage = "annotating" | "ai_verify" | "qa_review" | "delivered";

const STAGES: {
  id: WorkflowStage;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: "annotating",  label: "Annotate",    Icon: FileEdit },
  { id: "ai_verify",   label: "AI Verify",   Icon: Sparkles },
  { id: "qa_review",   label: "QA Review",   Icon: ClipboardCheck },
  { id: "delivered",   label: "Delivered",   Icon: PackageCheck },
];

interface Props {
  humanBoxes: HumanBoxLite[];
  stage: WorkflowStage;
  onStageChange: (s: WorkflowStage) => void;
  aiRan: boolean;
  onRunAI: () => void;
  showAIBoxes: boolean;
  onToggleAIBoxes: (v: boolean) => void;
  onOpenQAReport: () => void;
}

export function AIWorkflowPanel({
  humanBoxes,
  stage,
  onStageChange,
  aiRan,
  onRunAI,
  showAIBoxes,
  onToggleAIBoxes,
  onOpenQAReport,
}: Props) {
  const comparison: ComparisonRow[] = useMemo(
    () => (aiRan ? compareAnnotations(humanBoxes) : []),
    [humanBoxes, aiRan]
  );

  const stats = useMemo(() => {
    if (!aiRan) return null;
    const total  = comparison.length;
    const match  = comparison.filter((c) => c.status === "match").length;
    const lowIoU = comparison.filter((c) => c.status === "low_iou").length;
    const missed = comparison.filter((c) => c.status === "missed").length;
    const lowC   = comparison.filter((c) => c.status === "low_conf").length;
    const avgIoU =
      comparison.reduce((a, c) => a + c.iou, 0) / Math.max(1, total);
    const avgConf =
      comparison.reduce((a, c) => a + c.confidence, 0) / Math.max(1, total);
    const needsQA = lowIoU + missed + lowC;
    return { total, match, lowIoU, missed, lowC, avgIoU, avgConf, needsQA };
  }, [comparison, aiRan]);

  const currentStageIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <div className="flex flex-col gap-4 text-sm">
      {/* Stepper */}
      <div className="px-3 pt-3">
        <div className="flex items-center justify-between">
          {STAGES.map((s, i) => {
            const Icon = s.Icon;
            const isDone    = i < currentStageIndex;
            const isCurrent = i === currentStageIndex;
            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors"
                    style={{
                      borderColor:
                        isDone || isCurrent ? "hsl(var(--primary))" : "hsl(0,0%,22%)",
                      background:
                        isCurrent ? "hsl(var(--primary) / 0.15)" :
                        isDone    ? "hsl(var(--primary) / 0.85)" : "transparent",
                      color:
                        isCurrent ? "hsl(var(--primary))" :
                        isDone    ? "#fff" : "hsl(0,0%,55%)",
                    }}
                  >
                    <Icon size={14} />
                  </div>
                  <span
                    className="mt-1 text-sm font-medium whitespace-nowrap"
                    style={{
                      color:
                        isCurrent ? "hsl(var(--primary))" :
                        isDone    ? "hsl(0,0%,85%)" : "hsl(0,0%,55%)",
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div
                    className="h-px flex-1 mx-1 -translate-y-3"
                    style={{
                      background:
                        i < currentStageIndex ? "hsl(var(--primary))" : "hsl(0,0%,22%)",
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Stage-specific content */}
      {stage === "annotating" && (
        <div className="px-3 pb-3 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Draw bounding boxes over all visible objects (cars, pedestrians,
            cyclists, vegetation). When finished, submit for AI verification.
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Annotations placed</span>
              <span className="font-mono text-foreground">{humanBoxes.length}</span>
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={humanBoxes.length === 0}
              onClick={() => onStageChange("ai_verify")}
            >
              Submit for AI Verification
            </Button>
          </div>
        </div>
      )}

      {stage === "ai_verify" && (
        <div className="px-3 pb-3 flex flex-col gap-3">
          {!aiRan ? (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The AI model will generate reference bounding boxes from the
                point cloud and compare them against your annotations.
              </p>
              <Button size="sm" className="w-full gap-2" onClick={onRunAI}>
                <Play size={14} /> Run AI Verification
              </Button>
            </>
          ) : stats ? (
            <>
              {/* Metric tiles */}
              <div className="grid grid-cols-2 gap-2">
                <MetricTile label="Avg IoU"        value={(stats.avgIoU * 100).toFixed(1) + "%"} tone="primary" />
                <MetricTile label="Avg Confidence" value={(stats.avgConf * 100).toFixed(1) + "%"} tone="primary" />
                <MetricTile label="Matches"         value={stats.match + "/" + stats.total}       tone="good" />
                <MetricTile label="Needs QA"        value={String(stats.needsQA)}                  tone={stats.needsQA > 0 ? "warn" : "good"} />
              </div>

              {/* AI overlay toggle */}
              <label className="flex items-center justify-between text-sm px-2 py-2 rounded border border-border">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Eye size={13} /> Show AI boxes
                </span>
                <input
                  type="checkbox"
                  checked={showAIBoxes}
                  onChange={(e) => onToggleAIBoxes(e.target.checked)}
                />
              </label>

              {/* Comparison rows */}
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
                {comparison.map((row) => (
                  <ComparisonRowView key={row.aiBox.id} row={row} />
                ))}
              </div>

              <div className="flex gap-2">
                {stats.needsQA > 0 ? (
                  <Button
                    size="sm"
                    className="flex-1"
                    variant="secondary"
                    onClick={() => onStageChange("qa_review")}
                  >
                    Route to QA ({stats.needsQA})
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => onStageChange("delivered")}
                  >
                    Mark Delivered
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {stage === "qa_review" && stats && (
        <div className="px-3 pb-3 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {stats.needsQA} annotation{stats.needsQA !== 1 ? "s" : ""} flagged
            for QA review. A senior reviewer inspects these before the batch
            is delivered.
          </p>

          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
            {comparison
              .filter((c) => c.status !== "match")
              .map((row) => (
                <ComparisonRowView key={row.aiBox.id} row={row} />
              ))}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-2"
              onClick={onOpenQAReport}
            >
              <BarChart2 size={14} /> QA Report
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onStageChange("delivered")}
            >
              Approve &amp; Deliver
            </Button>
          </div>
        </div>
      )}

      {stage === "delivered" && (
        <div className="px-3 pb-3 flex flex-col gap-3">
          <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
            <CheckCircle2 className="text-green-500" size={18} />
            <div className="text-sm leading-tight">
              <div className="font-semibold text-foreground">Batch delivered</div>
              <div className="text-muted-foreground">
                Annotations signed off and exported to dataset.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-2"
              onClick={onOpenQAReport}
            >
              <BarChart2 size={14} /> QA Report
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={() => onStageChange("annotating")}
            >
              New Scene
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "good" | "warn";
}) {
  const toneColor =
    tone === "good" ? "#22c55e" : tone === "warn" ? "#f59e0b" : "hsl(var(--primary))";
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-sm uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-bold mt-0.5" style={{ color: toneColor }}>
        {value}
      </div>
    </div>
  );
}

function ComparisonRowView({ row }: { row: ComparisonRow }) {
  const { Icon, color, text } =
    row.status === "match"
      ? { Icon: CheckCircle2, color: "#22c55e", text: "Match" }
      : row.status === "low_iou"
      ? { Icon: AlertTriangle, color: "#f59e0b", text: "Low IoU" }
      : row.status === "low_conf"
      ? { Icon: AlertTriangle, color: "#f59e0b", text: "Low conf." }
      : { Icon: XCircle, color: "#ef4444", text: "Missed" };

  return (
    <div className="flex items-center justify-between text-sm px-2 py-1.5 rounded border border-border">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={12} style={{ color }} />
        <span className="truncate text-foreground">{row.aiBox.label}</span>
        <span className="text-muted-foreground/70 font-mono">
          IoU {(row.iou * 100).toFixed(0)}%
        </span>
      </div>
      <Badge
        variant="outline"
        className="text-sm px-1.5 py-0 h-4"
        style={{ color, borderColor: color + "66" }}
      >
        {text}
      </Badge>
    </div>
  );
}
