import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type {
  AnnotationCategory,
  TumorType,
  TumorStage,
} from "@/types/annotation";

interface TumorClassificationDialogProps {
  open: boolean;
  onSubmit: (data: {
    label: string;
    category: AnnotationCategory;
    tumorType?: TumorType;
    tumorStage?: TumorStage;
    confidence: number;
    notes: string;
    annotatorName?: string;
  }) => void;
  onCancel: () => void;
}

const TUMOR_TYPES: { value: TumorType; label: string; desc: string }[] = [
  { value: "benign", label: "Benign", desc: "Non-cancerous growth" },
  { value: "malignant", label: "Malignant", desc: "Cancerous, invasive" },
  { value: "metastatic", label: "Metastatic", desc: "Spread from another site" },
  { value: "cystic", label: "Cystic", desc: "Fluid-filled sac" },
  { value: "necrotic", label: "Necrotic", desc: "Dead tissue present" },
  { value: "calcified", label: "Calcified", desc: "Calcium deposits visible" },
  { value: "unknown", label: "Unknown", desc: "Unable to determine" },
];

const STAGES: { value: TumorStage; label: string; desc: string }[] = [
  { value: "I", label: "Stage I", desc: "Localized, small" },
  { value: "II", label: "Stage II", desc: "Localized, larger" },
  { value: "III", label: "Stage III", desc: "Regional spread" },
  { value: "IV", label: "Stage IV", desc: "Distant metastasis" },
  { value: "uncertain", label: "Uncertain", desc: "Cannot determine from imaging" },
];

const CATEGORIES: { value: AnnotationCategory; label: string }[] = [
  { value: "tumor", label: "🎯 Tumor" },
  { value: "lesion", label: "⚠️ Lesion" },
  { value: "anomaly", label: "🔍 Anomaly" },
  { value: "normal", label: "✅ Normal" },
  { value: "other", label: "📌 Other" },
];

function confidenceColor(v: number) {
  if (v >= 80) return "text-green-400";
  if (v >= 50) return "text-yellow-400";
  return "text-red-400";
}

export function TumorClassificationDialog({
  open,
  onSubmit,
  onCancel,
}: TumorClassificationDialogProps) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<AnnotationCategory>("tumor");
  const [tumorType, setTumorType] = useState<TumorType>("unknown");
  const [tumorStage, setTumorStage] = useState<TumorStage>("uncertain");
  const [confidence, setConfidence] = useState(70);
  const [notes, setNotes] = useState("");
  const [annotatorName, setAnnotatorName] = useState("");

  const isTumor = category === "tumor";

  const handleSubmit = () => {
    onSubmit({
      label: label || (isTumor ? `Tumor (${tumorType})` : category),
      category,
      tumorType: isTumor ? tumorType : undefined,
      tumorStage: isTumor ? tumorStage : undefined,
      confidence,
      notes,
      annotatorName: annotatorName || undefined,
    });
    // Reset
    setLabel("");
    setCategory("tumor");
    setTumorType("unknown");
    setTumorStage("uncertain");
    setConfidence(70);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Classify Region</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <Badge
                  key={c.value}
                  variant={category === c.value ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => setCategory(c.value)}
                >
                  {c.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={isTumor ? "e.g. Right lung nodule" : "e.g. Region of interest"}
              className="h-8 text-sm"
            />
          </div>

          {/* Tumor-specific fields */}
          {isTumor && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tumor Type</Label>
                <Select value={tumorType} onValueChange={(v) => setTumorType(v as TumorType)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TUMOR_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="font-medium">{t.label}</span>
                        <span className="text-muted-foreground ml-1">— {t.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Stage</Label>
                <Select value={tumorStage} onValueChange={(v) => setTumorStage(v as TumorStage)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="font-medium">{s.label}</span>
                        <span className="text-muted-foreground ml-1">— {s.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Confidence */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Annotation Confidence:{" "}
              <span className={`font-bold ${confidenceColor(confidence)}`}>{confidence}%</span>
            </Label>
            <Slider
              value={[confidence]}
              onValueChange={(v) => setConfidence(v[0])}
              min={0}
              max={100}
              step={5}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Low</span>
              <span>Moderate</span>
              <span>High</span>
            </div>
          </div>

          {/* Annotator */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Annotator Name (optional)</Label>
            <Input
              value={annotatorName}
              onChange={(e) => setAnnotatorName(e.target.value)}
              placeholder="e.g. Dr. Smith"
              className="h-8 text-sm"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional observations, differential diagnoses, etc."
              className="text-sm min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            Save Annotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
