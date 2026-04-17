import { useState } from "react";
import type { Annotation, TumorType, TumorStage, AnnotationCategory } from "@/types/annotation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Check, X, Target, AlertTriangle, Search, CheckCircle, Pin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4", "#f97316"];

const CATEGORY_ICONS: Record<AnnotationCategory, typeof Target> = {
  tumor: Target,
  lesion: AlertTriangle,
  anomaly: Search,
  normal: CheckCircle,
  other: Pin,
};

const CATEGORY_LABELS: Record<AnnotationCategory, string> = {
  tumor: "Tumor",
  lesion: "Lesion",
  anomaly: "Anomaly",
  normal: "Normal",
  other: "Other",
};

function confidenceBadge(v: number) {
  if (v >= 80) return "bg-green-500/20 text-green-400 border-green-500/30";
  if (v >= 50) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

interface AnnotationListProps {
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<Annotation>) => void;
  opacity: number;
  onOpacityChange: (v: number) => void;
}

export function AnnotationList({
  annotations,
  selectedId,
  onSelect,
  onUpdate,
  opacity,
  onOpacityChange,
}: AnnotationListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editConfidence, setEditConfidence] = useState(70);
  const [editTumorType, setEditTumorType] = useState<TumorType>("unknown");
  const [editTumorStage, setEditTumorStage] = useState<TumorStage>("uncertain");

  const startEdit = (ann: Annotation) => {
    setEditingId(ann.id);
    setEditLabel(ann.label);
    setEditNotes(ann.notes);
    setEditConfidence(ann.confidence);
    setEditTumorType(ann.tumorType ?? "unknown");
    setEditTumorStage(ann.tumorStage ?? "uncertain");
  };

  const saveEdit = (id: string, category: AnnotationCategory) => {
    const updates: Partial<Annotation> = {
      label: editLabel,
      notes: editNotes,
      confidence: editConfidence,
    };
    if (category === "tumor") {
      updates.tumorType = editTumorType;
      updates.tumorStage = editTumorStage;
    }
    onUpdate(id, updates);
    setEditingId(null);
  };

  const tumorCount = annotations.filter((a) => a.category === "tumor").length;

  return (
    <div className="w-full lg:w-80 space-y-4">
      {/* Stats */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Overlay Opacity: {opacity}%</Label>
          {tumorCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">
              {tumorCount} tumor{tumorCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Slider
          value={[opacity]}
          onValueChange={(v) => onOpacityChange(v[0])}
          min={10}
          max={100}
          step={5}
        />
      </div>

      {/* Annotations list */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Annotations ({annotations.length})
        </h3>
        {annotations.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Draw a bounding box or ellipse on the image to annotate a region. You'll be prompted to classify it.
          </p>
        )}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          <AnimatePresence>
            {annotations.map((ann) => {
              const CatIcon = CATEGORY_ICONS[ann.category];
              return (
                <motion.div
                  key={ann.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedId === ann.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                  onClick={() => onSelect(ann.id)}
                >
                  {editingId === ann.id ? (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Label"
                        className="h-7 text-xs"
                        autoFocus
                      />
                      {ann.category === "tumor" && (
                        <>
                          <Select value={editTumorType} onValueChange={(v) => setEditTumorType(v as TumorType)}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Tumor type" />
                            </SelectTrigger>
                            <SelectContent>
                              {["benign","malignant","metastatic","cystic","necrotic","calcified","unknown"].map((t) => (
                                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={editTumorStage} onValueChange={(v) => setEditTumorStage(v as TumorStage)}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Stage" />
                            </SelectTrigger>
                            <SelectContent>
                              {["I","II","III","IV","uncertain"].map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">Stage {s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Confidence: {editConfidence}%</Label>
                        <Slider
                          value={[editConfidence]}
                          onValueChange={(v) => setEditConfidence(v[0])}
                          min={0} max={100} step={5}
                        />
                      </div>
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Clinical notes"
                        className="text-xs min-h-[50px]"
                      />
                      <div className="flex gap-1 flex-wrap">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            className={`w-5 h-5 rounded-sm border-2 ${
                              ann.color === c ? "border-foreground" : "border-transparent"
                            }`}
                            style={{ backgroundColor: c }}
                            onClick={() => onUpdate(ann.id, { color: c })}
                          />
                        ))}
                      </div>
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setEditingId(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                        <Button size="sm" className="h-6 px-2" onClick={() => saveEdit(ann.id, ann.category)}>
                          <Check className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: ann.color }}
                        />
                        <CatIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-foreground flex-1 truncate">
                          {ann.label || "Unlabeled"}
                        </span>
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${confidenceBadge(ann.confidence)}`}>
                          {ann.confidence}%
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(ann);
                          }}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </div>
                      {ann.category === "tumor" && ann.tumorType && (
                        <div className="flex gap-1 ml-5">
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">
                            {ann.tumorType}
                          </Badge>
                          {ann.tumorStage && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                              Stage {ann.tumorStage}
                            </Badge>
                          )}
                        </div>
                      )}
                      {ann.annotatorName && (
                        <p className="text-[10px] text-muted-foreground ml-5">
                          by {ann.annotatorName}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
