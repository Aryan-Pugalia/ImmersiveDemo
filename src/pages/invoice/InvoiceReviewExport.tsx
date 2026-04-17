import { useInvoiceAnnotation } from "@/context/InvoiceAnnotationContext";
import { LABELS, getLabelConfig } from "@/types/invoice-annotation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, AlertTriangle, CheckCircle } from "lucide-react";

export default function InvoiceReviewExport() {
  const { documents } = useInvoiceAnnotation();

  const requiredLabels = LABELS.filter((l) => l.required);

  const handleExport = () => {
    const data = documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      status: doc.status,
      annotations: doc.annotations.map((a) => ({
        label: a.label,
        value: a.value,
        confidence: a.confidence,
        boundingBox: a.box,
      })),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "annotations-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review & Export</h1>
          <p className="text-sm text-muted-foreground">Validate annotations and export structured data</p>
        </div>
        <Button onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" /> Export JSON
        </Button>
      </div>

      {documents.map((doc) => {
        const missingRequired = requiredLabels.filter(
          (rl) => !doc.annotations.some((a) => a.label === rl.id && a.value.trim())
        );
        const isValid = missingRequired.length === 0 && doc.annotations.length > 0;

        return (
          <Card key={doc.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{doc.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {isValid ? (
                    <Badge className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Valid</Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Incomplete</Badge>
                  )}
                </div>
              </div>
              {missingRequired.length > 0 && (
                <p className="text-xs text-destructive mt-1">
                  Missing: {missingRequired.map((r) => r.name).join(", ")}
                </p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Bounding Box</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doc.annotations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">No annotations</TableCell>
                    </TableRow>
                  ) : (
                    doc.annotations.map((ann) => {
                      const cfg = getLabelConfig(ann.label);
                      return (
                        <TableRow key={ann.id}>
                          <TableCell>
                            <Badge style={{ backgroundColor: cfg.color, color: "#fff" }} className="text-[10px]">{cfg.name}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{ann.value || <span className="text-muted-foreground italic">empty</span>}</TableCell>
                          <TableCell className="capitalize">{ann.confidence}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            ({Math.round(ann.box.x)}, {Math.round(ann.box.y)}) {Math.round(ann.box.width)}×{Math.round(ann.box.height)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
