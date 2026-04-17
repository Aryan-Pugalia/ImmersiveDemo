import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ImageUpload } from "@/components/ImageUpload";
import { SampleGallery } from "@/components/SampleGallery";
import { SegmentationCanvas } from "@/components/SegmentationCanvas";
import { ControlsPanel } from "@/components/ControlsPanel";
import { RegionTooltip } from "@/components/RegionTooltip";
import { AnnotationCanvas } from "@/components/AnnotationCanvas";
import { AnnotationToolbar } from "@/components/AnnotationToolbar";
import { AnnotationList } from "@/components/AnnotationList";
import { TumorClassificationDialog } from "@/components/TumorClassificationDialog";
import { useSegmentation } from "@/hooks/useSegmentation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { SegmentedRegion } from "@/types/segmentation";
import type { Annotation, DrawingTool, AnnotationCategory, TumorType, TumorStage } from "@/types/annotation";
import { ArrowLeft, Brain, Scan, Activity, PenTool, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type ViewMode = "ai" | "annotate";

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4", "#f97316"];

export default function MedicalAnnotation() {
  const navigate = useNavigate();
  const { result, loading, error, analyze, setResult } = useSegmentation();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [opacity, setOpacity] = useState(60);
  const [selectedRegion, setSelectedRegion] = useState<SegmentedRegion | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<ViewMode>("annotate");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeTool, setActiveTool] = useState<DrawingTool>("rect");
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [annotationOpacity, setAnnotationOpacity] = useState(60);
  const [pendingBounds, setPendingBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [pendingShape, setPendingShape] = useState<"rect" | "ellipse">("rect");
  const [classifyOpen, setClassifyOpen] = useState(false);

  const handleImageSelected = useCallback(
    (file: File, previewUrl: string) => {
      setImageUrl(previewUrl);
      setImageFile(file);
      setResult(null);
      setSelectedRegion(null);
      setMode("annotate");
    },
    [setResult]
  );

  const handleSampleSelected = useCallback(
    async (url: string) => {
      setImageUrl(url);
      setResult(null);
      setSelectedRegion(null);
      setMode("annotate");
      try {
        const resp = await fetch(url);
        const blob = await resp.blob();
        const file = new File([blob], "sample.jpg", { type: blob.type || "image/jpeg" });
        setImageFile(file);
      } catch {
        setImageFile(null);
      }
    },
    [setResult]
  );

  const handleRegionClick = useCallback(
    (region: SegmentedRegion, x: number, y: number) => {
      setSelectedRegion(region);
      setTooltipPos({ x, y });
    },
    []
  );

  const reset = () => {
    setImageUrl(null);
    setImageFile(null);
    setResult(null);
    setSelectedRegion(null);
    setAnnotations([]);
    setSelectedAnnotation(null);
    setMode("annotate");
  };

  const handleAnnotationDrawn = useCallback(
    (bounds: { x: number; y: number; width: number; height: number }, shape: "rect" | "ellipse") => {
      setPendingBounds(bounds);
      setPendingShape(shape);
      setClassifyOpen(true);
    },
    []
  );

  const handleClassificationSubmit = useCallback(
    (data: {
      label: string;
      category: AnnotationCategory;
      tumorType?: TumorType;
      tumorStage?: TumorStage;
      confidence: number;
      notes: string;
      annotatorName?: string;
    }) => {
      if (!pendingBounds) return;
      const newAnn: Annotation = {
        id: crypto.randomUUID(),
        label: data.label,
        color: COLORS[annotations.length % COLORS.length],
        shape: pendingShape,
        bounds: pendingBounds,
        notes: data.notes,
        category: data.category,
        tumorType: data.tumorType,
        tumorStage: data.tumorStage,
        confidence: data.confidence,
        annotatorName: data.annotatorName,
        createdAt: new Date().toISOString(),
      };
      setAnnotations((prev) => [...prev, newAnn]);
      setSelectedAnnotation(newAnn.id);
      setActiveTool("select");
      setClassifyOpen(false);
      setPendingBounds(null);
    },
    [pendingBounds, pendingShape, annotations.length]
  );

  const handleCancelClassification = useCallback(() => {
    setClassifyOpen(false);
    setPendingBounds(null);
  }, []);

  const handleUpdateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }, []);

  const handleBoundsUpdated = useCallback((id: string, bounds: { x: number; y: number; width: number; height: number }) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, bounds } : a)));
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedAnnotation) return;
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedAnnotation));
    setSelectedAnnotation(null);
  }, [selectedAnnotation]);

  const handleExport = useCallback(() => {
    const data = JSON.stringify(annotations, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medical-annotations.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${annotations.length} annotation(s) downloaded.` });
  }, [annotations]);

  // ─── Landing / Upload view ───────────────────────────────────────────────
  if (!imageUrl) {
    return (
      <div className="min-h-screen bg-background">
        {/* FABStudio Header */}
        <header className="sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-border/20">
          <div className="flex items-center px-6 py-3 h-16 gap-3">
            <button
              onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-muted rounded-full transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </button>
            <span
              className="text-sm font-bold tracking-wide text-primary cursor-pointer hover:text-primary/80 transition-colors font-headline"
              onClick={() => navigate("/use-cases")}
            >
              TP.ai FABStudio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-foreground/80 font-body">Medical Image Annotation</span>
          </div>
          <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
        </header>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 mb-6">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground font-body">
                AI-Powered Medical Imaging
              </span>
            </div>
            <h1 className="font-headline text-4xl sm:text-5xl font-bold text-foreground tracking-tight mb-4 uppercase">
              Medical Image Annotation
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto font-body leading-relaxed">
              Upload a medical scan to annotate tumors and regions of interest, then verify with AI analysis.
            </p>
          </motion.div>

          <div className="space-y-8">
            <ImageUpload onImageSelected={handleImageSelected} />
            <SampleGallery onSampleSelected={handleSampleSelected} />
          </div>

        </div>
      </div>
    );
  }

  // ─── Annotation / Viewer ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* FABStudio Header */}
      <header className="sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-border/20">
        <div className="flex items-center justify-between px-6 py-3 h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-muted rounded-full transition-colors"
              title="Back to capabilities"
            >
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </button>
            <span
              className="text-sm font-bold tracking-wide text-primary cursor-pointer hover:text-primary/80 transition-colors font-headline"
              onClick={() => navigate("/use-cases")}
            >
              TP.ai FABStudio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-foreground/80 font-body">Medical Image Annotation</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-primary/50 text-primary">
              {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
            </Badge>
            <Button variant="ghost" size="sm" onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">
              New Image
            </Button>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Mode switcher + toolbar */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-1 rounded-sm border border-border bg-card p-1">
            <Button
              variant={mode === "annotate" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1 rounded-sm"
              onClick={() => setMode("annotate")}
            >
              <PenTool className="w-3.5 h-3.5" />
              Annotate
            </Button>
            <Button
              variant={mode === "ai" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1 rounded-sm"
              onClick={() => {
                setMode("ai");
                if (!result && !loading && imageFile) {
                  analyze(imageFile);
                }
              }}
            >
              <Brain className="w-3.5 h-3.5" />
              AI Verify
            </Button>
          </div>

          {mode === "annotate" && (
            <AnnotationToolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              onDeleteSelected={handleDeleteSelected}
              onExport={handleExport}
              hasSelection={!!selectedAnnotation}
            />
          )}

          {mode === "ai" && loading && (
            <span className="text-sm text-muted-foreground animate-pulse font-body">Analyzing image…</span>
          )}
          {mode === "ai" && error && (
            <span className="text-sm text-destructive font-body">{error}</span>
          )}
        </div>

        {/* Canvas + side panel */}
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            {mode === "ai" && loading ? (
              <Skeleton className="w-full aspect-[4/3] rounded-sm" />
            ) : mode === "annotate" ? (
              <AnnotationCanvas
                imageUrl={imageUrl}
                annotations={annotations}
                activeTool={activeTool}
                selectedId={selectedAnnotation}
                opacity={annotationOpacity}
                onAnnotationDrawn={handleAnnotationDrawn}
                onAnnotationSelected={setSelectedAnnotation}
                onAnnotationUpdated={handleBoundsUpdated}
              />
            ) : (
              <SegmentationCanvas
                imageUrl={imageUrl}
                regions={result?.regions ?? []}
                overlayVisible={overlayVisible}
                opacity={opacity}
                onRegionClick={handleRegionClick}
              />
            )}
          </div>

          {mode === "ai" && result && (
            <ControlsPanel
              overlayVisible={overlayVisible}
              onToggleOverlay={setOverlayVisible}
              opacity={opacity}
              onOpacityChange={setOpacity}
              regions={result.regions}
              summary={result.summary}
              imageType={result.imageType}
              annotations={annotations}
            />
          )}
          {mode === "annotate" && (
            <AnnotationList
              annotations={annotations}
              selectedId={selectedAnnotation}
              onSelect={setSelectedAnnotation}
              onUpdate={handleUpdateAnnotation}
              opacity={annotationOpacity}
              onOpacityChange={setAnnotationOpacity}
            />
          )}
        </div>
      </div>

      {mode === "ai" && (
        <RegionTooltip
          region={selectedRegion}
          position={tooltipPos}
          onClose={() => setSelectedRegion(null)}
        />
      )}

      <TumorClassificationDialog
        open={classifyOpen}
        onSubmit={handleClassificationSubmit}
        onCancel={handleCancelClassification}
      />
    </div>
  );
}
