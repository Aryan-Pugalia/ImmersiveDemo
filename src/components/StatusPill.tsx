import { CheckCircle, Clock, FileText, Send } from "lucide-react";

export type WorkflowStage = "annotating" | "review" | "audit" | "delivered";

const STAGES: { id: WorkflowStage; label: string; Icon: typeof FileText }[] = [
  { id: "annotating", label: "Annotating", Icon: FileText },
  { id: "review",     label: "Review",     Icon: Clock },
  { id: "audit",      label: "Audit",      Icon: CheckCircle },
  { id: "delivered",  label: "Delivered",  Icon: Send },
];

export function documentStatusToStage(status: string): WorkflowStage {
  if (status === "complete")     return "review";
  if (status === "in_progress")  return "annotating";
  return "annotating";
}

interface StatusPillProps {
  stage?: WorkflowStage;
  /** Accepts InvoiceDocument status strings and maps them automatically */
  documentStatus?: string;
  size?: "sm" | "md";
}

export function StatusPill({ stage, documentStatus, size = "sm" }: StatusPillProps) {
  const active: WorkflowStage =
    stage ?? (documentStatus ? documentStatusToStage(documentStatus) : "annotating");
  const activeIdx = STAGES.findIndex((s) => s.id === active);

  return (
    <div className={`flex items-center ${size === "md" ? "gap-1" : "gap-0.5"}`}>
      {STAGES.map((s, idx) => {
        const isDone    = idx < activeIdx;
        const isCurrent = idx === activeIdx;
        const { Icon } = s;

        return (
          <div key={s.id} className="flex items-center gap-0.5">
            <div
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 border transition-colors ${
                size === "md" ? "text-sm" : "text-sm"
              } font-medium ${
                isDone
                  ? "bg-green-500/15 text-green-400 border-green-500/25"
                  : isCurrent
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-muted/20 text-muted-foreground/35 border-border/15"
              }`}
            >
              <Icon className={`h-2.5 w-2.5 ${!isDone && !isCurrent ? "opacity-30" : ""}`} />
              <span className={!isDone && !isCurrent ? "opacity-40" : ""}>{s.label}</span>
            </div>
            {idx < STAGES.length - 1 && (
              <div className={`h-px w-2 ${isDone ? "bg-green-500/30" : "bg-border/20"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
