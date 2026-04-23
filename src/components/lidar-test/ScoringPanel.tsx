import React from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Target,
  Play,
  Sparkles,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ScoreReport } from "./advancedScoring";

interface Props {
  report: ScoreReport | null;
  onRun: () => void;
  running: boolean;
  numPreds: number;
  numGT: number;
}

const GRADE_COLOR: Record<string, string> = {
  S: "#22c55e",
  A: "#4ade80",
  B: "#eab308",
  C: "#f97316",
  D: "#ef4444",
};

export function ScoringPanel({ report, onRun, running, numPreds, numGT }: Props) {
  if (!report) {
    return (
      <div className="px-3 pb-3 flex flex-col gap-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          The verifier compares your boxes against ground-truth labels from the
          real KITTI scene (frame <span className="font-mono">000134</span>). It
          uses rotated BEV IoU, 3-D IoU, Hungarian assignment, and per-object
          localisation + heading error to produce a detection-quality score.
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border border-border p-2">
            <div className="text-muted-foreground uppercase tracking-wider">Your boxes</div>
            <div className="text-foreground font-mono mt-0.5">{numPreds}</div>
          </div>
          <div className="rounded-md border border-border p-2">
            <div className="text-muted-foreground uppercase tracking-wider">GT objects</div>
            <div className="text-foreground font-mono mt-0.5">{numGT}</div>
          </div>
        </div>
        <Button size="sm" className="w-full gap-2" disabled={running || numPreds === 0} onClick={onRun}>
          <Play size={14} /> {running ? "Scoring…" : "Run AI Verify"}
        </Button>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 flex flex-col gap-3">
      {/* Hero score */}
      <div className="rounded-lg border border-border p-3 flex items-center gap-3 bg-background/40">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black"
          style={{
            border: `2px solid ${GRADE_COLOR[report.grade]}`,
            color: GRADE_COLOR[report.grade],
            background: GRADE_COLOR[report.grade] + "14",
          }}
        >
          {report.grade}
        </div>
        <div className="flex-1">
          <div className="text-sm text-muted-foreground uppercase tracking-wider">
            Annotation Score
          </div>
          <div
            className="text-3xl font-black leading-none"
            style={{ color: GRADE_COLOR[report.grade] }}
          >
            {report.score}
            <span className="text-sm font-semibold text-muted-foreground ml-1">/100</span>
          </div>
        </div>
        <Sparkles size={18} style={{ color: GRADE_COLOR[report.grade] }} />
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Precision" value={(report.precision * 100).toFixed(1) + "%"} />
        <Metric label="Recall"    value={(report.recall    * 100).toFixed(1) + "%"} />
        <Metric label="F1"        value={(report.f1        * 100).toFixed(1) + "%"} />
        <Metric label="Mean 3-D IoU" value={(report.meanIoU3D * 100).toFixed(1) + "%"} />
        <Metric label="Mean BEV IoU" value={(report.meanBevIoU * 100).toFixed(1) + "%"} />
        <Metric label="Centre err" value={report.meanCenterError.toFixed(2) + "m"} />
        <Metric label="Heading err" value={report.meanHeadingError.toFixed(1) + "°"} />
        <Metric label="Matches" value={`${report.truePositives}/${numGT}`} />
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <CountBadge
          Icon={CheckCircle2}
          color="#22c55e"
          label="True positives"
          value={report.truePositives}
        />
        <CountBadge
          Icon={XCircle}
          color="#ef4444"
          label="Missed"
          value={report.falseNegatives}
        />
        <CountBadge
          Icon={AlertTriangle}
          color="#f59e0b"
          label="False positives"
          value={report.falsePositives}
        />
        <CountBadge
          Icon={Target}
          color="#a78bfa"
          label="Wrong class"
          value={report.wrongClass}
        />
      </div>

      {/* Per-row detail */}
      <div className="max-h-56 overflow-y-auto flex flex-col gap-1.5">
        {report.rows.map((row, i) => {
          const { status } = row;
          const {
            Icon,
            color,
            text,
          } = status === "true_positive"
            ? { Icon: CheckCircle2, color: "#22c55e", text: "Match" }
            : status === "false_positive"
            ? { Icon: AlertTriangle, color: "#f59e0b", text: "Extra" }
            : status === "false_negative"
            ? { Icon: XCircle, color: "#ef4444", text: "Missed" }
            : { Icon: Target, color: "#a78bfa", text: "Wrong class" };
          const labelText =
            row.gt?.label ?? row.pred?.label ?? "—";
          return (
            <div
              key={i}
              className="flex items-center justify-between text-sm px-2 py-1.5 rounded border border-border"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon size={12} style={{ color }} />
                <span className="truncate text-foreground">{labelText}</span>
                <span className="text-muted-foreground/70 font-mono text-sm">
                  IoU {(row.iou3D * 100).toFixed(0)}%
                </span>
                {!Number.isNaN(row.centerDistance) && row.status === "true_positive" && (
                  <span className="text-muted-foreground/70 font-mono text-sm">
                    Δ{row.centerDistance.toFixed(1)}m
                  </span>
                )}
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
        })}
      </div>

      <Button size="sm" variant="outline" className="w-full gap-2" onClick={onRun}>
        <BarChart2 size={14} /> Re-run scoring
      </Button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-sm uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-bold mt-0.5 text-foreground">{value}</div>
    </div>
  );
}

function CountBadge({
  Icon,
  color,
  label,
  value,
}: {
  Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-md px-2 py-1.5 border"
      style={{ borderColor: color + "55", background: color + "0d" }}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={12} style={{ color }} />
        <span className="text-sm">{label}</span>
      </div>
      <span className="font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}
