import { useNavigate } from "react-router-dom";
import { useInvoiceAnnotation } from "@/context/InvoiceAnnotationContext";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/StatusPill";
import { FileText, CheckCircle, Clock, AlertCircle, ArrowRight, BarChart2 } from "lucide-react";

export default function InvoiceDashboard() {
  const { documents } = useInvoiceAnnotation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const p = t.pages.invoice;

  const statusConfig = {
    not_started: { label: p.statusNotStarted, variant: "outline" as const, icon: AlertCircle },
    in_progress: { label: p.statusInProgress, variant: "secondary" as const, icon: Clock },
    complete:    { label: p.statusComplete,   variant: "default" as const,  icon: CheckCircle },
  };

  const total = documents.length;
  const complete = documents.filter((d) => d.status === "complete").length;
  const inProgress = documents.filter((d) => d.status === "in_progress").length;
  const pending = documents.filter((d) => d.status === "not_started").length;
  const totalAnnotations = documents.reduce((s, d) => s + d.annotations.length, 0);

  const stats = [
    { label: p.totalDocs,  value: total,      icon: FileText,    color: "text-primary" },
    { label: p.annotated,  value: complete,   icon: CheckCircle, color: "text-green-500" },
    { label: p.inProgress, value: inProgress, icon: Clock,       color: "text-amber-500" },
    { label: p.pending,    value: pending,    icon: AlertCircle, color: "text-muted-foreground" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{p.dashTitle}</h1>
        <p className="text-muted-foreground mt-1">{p.dashSubtitle}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total annotations */}
      <Card>
        <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{p.totalAnnotations}</p>
            <p className="text-3xl font-bold">{totalAnnotations}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/qa-report/invoice-labeler")} className="gap-1.5">
              <BarChart2 className="h-4 w-4" /> {t.nav.qaReport}
            </Button>
            <Button variant="outline" onClick={() => navigate("review")}>
              {p.reviewAll} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Document list */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{p.documents}</h2>
        <div className="grid gap-3">
          {documents.map((doc) => {
            const cfg = statusConfig[doc.status];
            const StatusIcon = cfg.icon;
            return (
              <Card
                key={doc.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`annotate/${doc.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {doc.type} · {doc.annotations.length}{" "}
                        {doc.annotations.length !== 1 ? t.tools.annotations_plural : t.tools.annotations}
                      </p>
                      <div className="mt-1.5">
                        <StatusPill documentStatus={doc.status} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={cfg.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
