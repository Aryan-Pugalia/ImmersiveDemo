import React, { useRef, useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useInvoiceAnnotation } from "@/context/InvoiceAnnotationContext";
import { LABELS, LabelType, Annotation, BoundingBox, getLabelConfig } from "@/types/invoice-annotation";
import { mockInvoiceContent } from "@/data/invoice-mock-documents";
import { InvoiceRenderer } from "@/components/InvoiceRenderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MousePointer, Square, Trash2, Undo2, ZoomIn, ZoomOut, ArrowLeft, Save } from "lucide-react";

const CANVAS_W = 540;
const CANVAS_H = 440;

type Tool = "select" | "draw";
const confidenceLevels = ["low", "medium", "high"] as const;

export default function InvoiceAnnotateWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getDocument, addAnnotation, updateAnnotation, deleteAnnotation, setDocumentStatus } = useInvoiceAnnotation();
  const doc = getDocument(id!);
  const invoiceData = mockInvoiceContent[id!];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("draw");
  const [activeLabel, setActiveLabel] = useState<LabelType>("vendor_name");
  const [zoom, setZoom] = useState(1);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<BoundingBox | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<string[]>([]);

  const drawAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !doc) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    doc.annotations.forEach((ann) => {
      const cfg = getLabelConfig(ann.label);
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = selectedAnnotation === ann.id ? 3 : 2;
      ctx.setLineDash(selectedAnnotation === ann.id ? [6, 3] : []);
      ctx.strokeRect(ann.box.x, ann.box.y, ann.box.width, ann.box.height);

      ctx.fillStyle = cfg.color;
      ctx.globalAlpha = 0.1;
      ctx.fillRect(ann.box.x, ann.box.y, ann.box.width, ann.box.height);
      ctx.globalAlpha = 1;

      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = cfg.color;
      ctx.fillText(cfg.name, ann.box.x + 3, ann.box.y - 4);
    });

    if (currentBox) {
      const cfg = getLabelConfig(activeLabel);
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
      ctx.setLineDash([]);
    }
  }, [doc, currentBox, activeLabel, selectedAnnotation]);

  useEffect(() => { drawAnnotations(); }, [drawAnnotations]);

  const getCanvasPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool !== "draw") {
      const pos = getCanvasPos(e);
      const found = doc?.annotations.find(
        (a) => pos.x >= a.box.x && pos.x <= a.box.x + a.box.width && pos.y >= a.box.y && pos.y <= a.box.y + a.box.height
      );
      setSelectedAnnotation(found?.id || null);
      return;
    }
    const pos = getCanvasPos(e);
    setDrawing(true);
    setStartPos(pos);
    setCurrentBox(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !startPos) return;
    const pos = getCanvasPos(e);
    setCurrentBox({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
    });
  };

  const handleMouseUp = () => {
    if (!drawing || !currentBox || !id) return;
    if (currentBox.width > 10 && currentBox.height > 10) {
      const ann: Annotation = {
        id: `ann-${Date.now()}`,
        label: activeLabel,
        box: currentBox,
        value: "",
        confidence: "medium",
      };
      addAnnotation(id, ann);
      setUndoStack((prev) => [...prev, ann.id]);
      setSelectedAnnotation(ann.id);
    }
    setDrawing(false);
    setStartPos(null);
    setCurrentBox(null);
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || !id) return;
    const lastId = undoStack[undoStack.length - 1];
    deleteAnnotation(id, lastId);
    setUndoStack((prev) => prev.slice(0, -1));
    setSelectedAnnotation(null);
  };

  const handleMarkComplete = () => {
    if (id) setDocumentStatus(id, "complete");
    navigate("..");
  };

  if (!doc || !invoiceData) {
    return <div className="p-8 text-muted-foreground">Document not found.</div>;
  }

  const selectedAnn = doc.annotations.find((a) => a.id === selectedAnnotation);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("..")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{doc.name}</h1>
            <p className="text-xs text-muted-foreground">{doc.annotations.length} annotations</p>
          </div>
        </div>
        <Button onClick={handleMarkComplete} className="gap-2">
          <Save className="h-4 w-4" /> Mark Complete
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Left: Canvas + Toolbar */}
        <div className="space-y-3">
          {/* Toolbar */}
          <Card>
            <CardContent className="p-3 flex items-center gap-2 flex-wrap">
              <Button variant={tool === "select" ? "default" : "outline"} size="sm" onClick={() => setTool("select")} className="gap-1">
                <MousePointer className="h-3.5 w-3.5" /> Select
              </Button>
              <Button variant={tool === "draw" ? "default" : "outline"} size="sm" onClick={() => setTool("draw")} className="gap-1">
                <Square className="h-3.5 w-3.5" /> Draw
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
              <Button variant="outline" size="sm" onClick={handleUndo} disabled={undoStack.length === 0} className="gap-1">
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </Button>
              {selectedAnnotation && (
                <Button variant="destructive" size="sm" onClick={() => { deleteAnnotation(id!, selectedAnnotation); setSelectedAnnotation(null); }} className="gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              )}
              <div className="w-px h-6 bg-border mx-1" />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(z + 0.25, 2))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>

          {/* Canvas area */}
          <Card className="overflow-auto">
            <CardContent className="p-4">
              <div className="relative inline-block" style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
                <InvoiceRenderer data={invoiceData} width={CANVAS_W} height={CANVAS_H} />
                <canvas
                  ref={canvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  className="absolute inset-0"
                  style={{ cursor: tool === "draw" ? "crosshair" : "default" }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => { setDrawing(false); setCurrentBox(null); }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Annotations Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Annotations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-52">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[130px]">Label</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="w-[90px]">Confidence</TableHead>
                      <TableHead className="w-[60px]">Coords</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doc.annotations.map((ann) => {
                      const cfg = getLabelConfig(ann.label);
                      return (
                        <TableRow
                          key={ann.id}
                          className={selectedAnnotation === ann.id ? "bg-muted" : "cursor-pointer"}
                          onClick={() => setSelectedAnnotation(ann.id)}
                        >
                          <TableCell>
                            <Badge style={{ backgroundColor: cfg.color, color: "#fff" }} className="text-[10px]">{cfg.name}</Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={ann.value}
                              onChange={(e) => updateAnnotation(id!, ann.id, { value: e.target.value })}
                              className="h-7 text-xs"
                              placeholder="Enter extracted value…"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell className="text-xs capitalize">{ann.confidence}</TableCell>
                          <TableCell className="text-[10px] text-muted-foreground">
                            {Math.round(ann.box.x)},{Math.round(ann.box.y)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteAnnotation(id!, ann.id); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {doc.annotations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-6">
                          No annotations yet. Select a label and draw on the document.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right: Label Panel + Properties */}
        <div className="space-y-4">
          {/* Label selector */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Field Labels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {LABELS.map((label) => (
                <button
                  key={label.id}
                  onClick={() => { setActiveLabel(label.id); setTool("draw"); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    activeLabel === label.id ? "bg-muted ring-2 ring-ring" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                  <span className="flex-1 text-left">{label.name}</span>
                  {label.required && <span className="text-[10px] text-destructive font-medium">REQ</span>}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Selected annotation properties */}
          {selectedAnn && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Annotation Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Label</label>
                  <p className="text-sm font-medium">{getLabelConfig(selectedAnn.label).name}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Extracted Value</label>
                  <Input
                    value={selectedAnn.value}
                    onChange={(e) => updateAnnotation(id!, selectedAnn.id, { value: e.target.value })}
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Confidence: {selectedAnn.confidence}</label>
                  <Slider
                    min={0}
                    max={2}
                    step={1}
                    value={[confidenceLevels.indexOf(selectedAnn.confidence)]}
                    onValueChange={([v]) => updateAnnotation(id!, selectedAnn.id, { confidence: confidenceLevels[v] })}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Low</span><span>Medium</span><span>High</span>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Box: ({Math.round(selectedAnn.box.x)}, {Math.round(selectedAnn.box.y)}) {Math.round(selectedAnn.box.width)}×{Math.round(selectedAnn.box.height)}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
