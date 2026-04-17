import { Button } from "@/components/ui/button";
import { Square, Circle, MousePointer, Trash2, Download } from "lucide-react";
import type { DrawingTool } from "@/types/annotation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AnnotationToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onDeleteSelected: () => void;
  onExport: () => void;
  hasSelection: boolean;
}

export function AnnotationToolbar({
  activeTool,
  onToolChange,
  onDeleteSelected,
  onExport,
  hasSelection,
}: AnnotationToolbarProps) {
  const tools: { id: DrawingTool; icon: typeof Square; label: string }[] = [
    { id: "select", icon: MousePointer, label: "Select" },
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "ellipse", icon: Circle, label: "Ellipse" },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      {tools.map(({ id, icon: Icon, label }) => (
        <Tooltip key={id}>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === id ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onToolChange(id)}
            >
              <Icon className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{label}</TooltipContent>
        </Tooltip>
      ))}
      <div className="w-px h-6 bg-border mx-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={onDeleteSelected}
            disabled={!hasSelection}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Delete selected</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onExport}>
            <Download className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Export annotations</TooltipContent>
      </Tooltip>
    </div>
  );
}