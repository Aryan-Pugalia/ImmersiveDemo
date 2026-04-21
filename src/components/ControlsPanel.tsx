import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { SegmentedRegion } from "@/types/segmentation";
import type { Annotation } from "@/types/annotation";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Layers,
  AlertTriangle,
  CheckCircle,
  Target,
  Activity,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

interface ControlsPanelProps {
  overlayVisible: boolean;
  onToggleOverlay: (v: boolean) => void;
  opacity: number;
  onOpacityChange: (v: number) => void;
  regions: SegmentedRegion[];
  summary: string;
  imageType: string;
  annotations?: Annotation[];
}

function confidenceColor(v: number) {
  if (v >= 0.8) return "text-green-400";
  if (v >= 0.5) return "text-yellow-400";
  return "text-red-400";
}

function confidenceBg(v: number) {
  if (v >= 0.8) return "bg-green-500";
  if (v >= 0.5) return "bg-yellow-500";
  return "bg-red-500";
}

function severityLabel(region: SegmentedRegion) {
  const name = region.name.toLowerCase();
  if (
    name.includes("tumor") ||
    name.includes("mass") ||
    name.includes("lesion") ||
    name.includes("nodule") ||
    name.includes("carcinoma") ||
    name.includes("malignant")
  ) {
    return { label: "Finding", icon: AlertTriangle, cls: "text-red-400 bg-red-500/10 border-red-500/20" };
  }
  if (name.includes("abnormal") || name.includes("opacity") || name.includes("effusion")) {
    return { label: "Abnormal", icon: AlertTriangle, cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" };
  }
  return { label: "Normal", icon: CheckCircle, cls: "text-green-400 bg-green-500/10 border-green-500/20" };
}

function computeOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  const intersection = (x2 - x1) * (y2 - y1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;
  return union > 0 ? intersection / union : 0;
}

export function ControlsPanel({
  overlayVisible,
  onToggleOverlay,
  opacity,
  onOpacityChange,
  regions,
  summary,
  imageType,
  annotations = [],
}: ControlsPanelProps) {
  const avgConfidence = regions.length
    ? regions.reduce((s, r) => s + r.confidence, 0) / regions.length
    : 0;

  const findings = regions.filter((r) => {
    const s = severityLabel(r);
    return s.label === "Finding" || s.label === "Abnormal";
  });

  // Compare annotations vs AI regions (IoU matching)
  const matchResults = annotations.length > 0 && regions.length > 0
    ? annotations.map((ann) => {
        let bestIoU = 0;
        let bestRegion: SegmentedRegion | null = null;
        regions.forEach((r) => {
          const iou = computeOverlap(ann.bounds, r.bounds);
          if (iou > bestIoU) {
            bestIoU = iou;
            bestRegion = r;
          }
        });
        return { annotation: ann, bestRegion, iou: bestIoU };
      })
    : [];

  const matchedCount = matchResults.filter((m) => m.iou > 0.2).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full lg:w-80 space-y-4"
    >
      {/* Header badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-primary" />
          <Badge variant="secondary" className="text-sm">{imageType}</Badge>
        </div>
        <Badge variant="outline" className="text-sm">
          <Activity className="w-3 h-3 mr-1" />
          {regions.length} region{regions.length !== 1 ? "s" : ""}
        </Badge>
        {findings.length > 0 && (
          <Badge variant="outline" className="text-sm border-red-500/30 text-red-400">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {findings.length} finding{findings.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">AI Analysis Summary</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
        <div className="mt-3 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Avg. confidence:</span>
          <span className={`text-sm font-bold ${confidenceColor(avgConfidence)}`}>
            {Math.round(avgConfidence * 100)}%
          </span>
        </div>
      </div>

      {/* Annotation vs AI Comparison */}
      {annotations.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            {matchedCount === annotations.length ? (
              <ShieldCheck className="w-4 h-4 text-green-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-yellow-400" />
            )}
            Annotation Comparison
          </h3>
          <p className="text-sm text-muted-foreground">
            {matchedCount} of {annotations.length} annotation{annotations.length !== 1 ? "s" : ""} matched
            with AI-detected regions (IoU &gt; 20%)
          </p>
          <div className="space-y-2">
            {matchResults.map((m) => (
              <div
                key={m.annotation.id}
                className={`rounded-lg border p-2 text-sm ${
                  m.iou > 0.5
                    ? "border-green-500/20 bg-green-500/5"
                    : m.iou > 0.2
                    ? "border-yellow-500/20 bg-yellow-500/5"
                    : "border-red-500/20 bg-red-500/5"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-foreground truncate">
                    {m.annotation.label || "Unlabeled"}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 ${
                      m.iou > 0.5
                        ? "text-green-400 border-green-500/30"
                        : m.iou > 0.2
                        ? "text-yellow-400 border-yellow-500/30"
                        : "text-red-400 border-red-500/30"
                    }`}
                  >
                    {m.iou > 0.5 ? "Good match" : m.iou > 0.2 ? "Partial" : "No match"}
                  </Badge>
                </div>
                {m.bestRegion && m.iou > 0.1 && (
                  <p className="text-muted-foreground">
                    ↔ AI: {m.bestRegion.name} ({Math.round(m.iou * 100)}% overlap)
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toggle + Opacity */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm">
            {overlayVisible ? (
              <Eye className="w-4 h-4 text-primary" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
            Overlay
          </Label>
          <Switch checked={overlayVisible} onCheckedChange={onToggleOverlay} />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Opacity: {opacity}%</Label>
          <Slider
            value={[opacity]}
            onValueChange={(v) => onOpacityChange(v[0])}
            min={10}
            max={100}
            step={5}
            disabled={!overlayVisible}
          />
        </div>
      </div>

      {/* Detailed Regions */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Detected Regions</h3>
        <div className="space-y-3">
          {regions.map((region) => {
            const sev = severityLabel(region);
            const SevIcon = sev.icon;
            return (
              <div key={region.name} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: region.color }}
                  />
                  <span className="text-sm font-medium text-foreground flex-1 truncate">
                    {region.name}
                  </span>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${sev.cls}`}>
                    <SevIcon className="w-2.5 h-2.5 mr-0.5" />
                    {sev.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground pl-5 leading-relaxed">
                  {region.description}
                </p>
                <div className="pl-5 flex items-center gap-2">
                  <Progress
                    value={region.confidence * 100}
                    className="h-1.5 flex-1"
                  />
                  <span className={`text-sm font-bold ${confidenceColor(region.confidence)}`}>
                    {Math.round(region.confidence * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
