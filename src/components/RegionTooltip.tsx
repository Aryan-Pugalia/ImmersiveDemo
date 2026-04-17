import { motion, AnimatePresence } from "framer-motion";
import type { SegmentedRegion } from "@/types/segmentation";
import { X } from "lucide-react";

interface RegionTooltipProps {
  region: SegmentedRegion | null;
  position: { x: number; y: number };
  onClose: () => void;
}

export function RegionTooltip({ region, position, onClose }: RegionTooltipProps) {
  return (
    <AnimatePresence>
      {region && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed z-50 w-64 rounded-xl border border-border bg-card shadow-xl p-4"
          style={{
            left: Math.min(position.x + 12, window.innerWidth - 280),
            top: Math.min(position.y - 20, window.innerHeight - 200),
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: region.color }}
            />
            <h4 className="text-sm font-semibold text-foreground">{region.name}</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
            {region.description}
          </p>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Confidence:</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${region.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-foreground">
              {Math.round(region.confidence * 100)}%
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
