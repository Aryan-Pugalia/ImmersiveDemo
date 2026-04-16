import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight } from "lucide-react";

export interface TutorialStep {
  id: string;
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
  action: string;
  waitForInteraction: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "select-tool",
    target: "select-tool",
    title: "Select Tool",
    description:
      "The Select tool lets you click on existing bounding boxes to inspect and edit their properties. It's your primary navigation tool.",
    position: "right",
    action: "Click the Select button to continue",
    waitForInteraction: true,
  },
  {
    id: "bbox-tool",
    target: "bbox-tool",
    title: "Place 3D Box Tool",
    description:
      "This tool switches to placement mode. Once active, you can click anywhere on the ground to create a new bounding box annotation.",
    position: "right",
    action: "Click the Box button to continue",
    waitForInteraction: true,
  },
  {
    id: "label-class",
    target: "label-grid",
    title: "Choose a Label Class",
    description:
      "Before placing a box, choose the object type you want to annotate. Each class has a distinct color so you can tell annotations apart at a glance.",
    position: "left",
    action: "Click any label to continue",
    waitForInteraction: true,
  },
  {
    id: "place-box",
    target: "canvas-area",
    title: "Place a Bounding Box",
    description:
      "With the Box tool active and a label selected, click anywhere on the 3D ground plane to create an annotation. The box will appear at the click position with the default size for that label.",
    position: "top",
    action: "Click on the ground in the 3D view to place a box",
    waitForInteraction: true,
  },
  {
    id: "select-box",
    target: "annotations-list",
    title: "Select an Annotation",
    description:
      "You can select any annotation from this list or by clicking directly on a box in the 3D view. The selected annotation will be highlighted and its properties will appear below.",
    position: "left",
    action: "Click on any annotation in the list to continue",
    waitForInteraction: true,
  },
  {
    id: "edit-properties",
    target: "properties-panel",
    title: "Edit Properties",
    description:
      "Use these sliders to fine-tune the position, size, and rotation of the selected bounding box. Changes are applied in real-time so you can see the result immediately in the 3D view.",
    position: "left",
    action: "Drag any slider to adjust a property",
    waitForInteraction: true,
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface GuidedTutorialProps {
  currentStep: number;
  onAdvance: () => void;
  onSkip: () => void;
}

export default function GuidedTutorial({
  currentStep,
  onAdvance,
  onSkip,
}: GuidedTutorialProps) {
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const rafRef = useRef<number>(0);

  const step = TUTORIAL_STEPS[currentStep];

  const updateRect = useCallback(() => {
    if (!step || !step.target) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(`[data-tutorial="${step.target}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const padding = 6;
      setSpotlightRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    } else {
      setSpotlightRect(null);
    }
  }, [step]);

  useEffect(() => {
    const tick = () => {
      updateRect();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateRect]);

  if (!step) return null;

  const getTooltipStyle = (): React.CSSProperties => {
    if (!spotlightRect) return {};
    const gap = 16;
    switch (step.position) {
      case "right":
        return {
          position: "fixed",
          top: spotlightRect.top,
          left: spotlightRect.left + spotlightRect.width + gap,
          maxWidth: 320,
        };
      case "left":
        return {
          position: "fixed",
          top: spotlightRect.top,
          right: window.innerWidth - spotlightRect.left + gap,
          maxWidth: 320,
        };
      case "top":
        return {
          position: "fixed",
          bottom: window.innerHeight - spotlightRect.top + gap,
          left: spotlightRect.left,
          maxWidth: 360,
        };
      case "bottom":
        return {
          position: "fixed",
          top: spotlightRect.top + spotlightRect.height + gap,
          left: spotlightRect.left,
          maxWidth: 360,
        };
    }
  };

  // Four-panel overlay so clicks pass through the spotlight hole
  return (
    <>
      {spotlightRect ? (
        <>
          <div className="fixed z-[100] bg-black/65" style={{ top: 0, left: 0, right: 0, height: Math.max(0, spotlightRect.top) }} />
          <div className="fixed z-[100] bg-black/65" style={{ top: spotlightRect.top + spotlightRect.height, left: 0, right: 0, bottom: 0 }} />
          <div className="fixed z-[100] bg-black/65" style={{ top: spotlightRect.top, left: 0, width: Math.max(0, spotlightRect.left), height: spotlightRect.height }} />
          <div className="fixed z-[100] bg-black/65" style={{ top: spotlightRect.top, left: spotlightRect.left + spotlightRect.width, right: 0, height: spotlightRect.height }} />
        </>
      ) : (
        <div className="fixed inset-0 z-[100] bg-black/65" />
      )}

      {spotlightRect && (
        <div
          className="fixed z-[101] rounded-lg border-2 border-primary animate-pulse pointer-events-none"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
            transition: "all 0.3s ease-in-out",
          }}
        />
      )}

      <div
        className="fixed z-[103] animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
        style={getTooltipStyle()}
      >
        <div className="bg-card border border-border rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-primary">
              Step {currentStep + 1} of {TUTORIAL_STEPS.length}
            </span>
            <button
              onClick={onSkip}
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
              title="Skip tutorial"
            >
              <X size={14} />
            </button>
          </div>

          <h3 className="text-sm font-bold text-foreground mb-1">{step.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            {step.description}
          </p>

          {step.action && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
              <ChevronRight size={12} className="text-primary shrink-0" />
              <span className="text-xs font-medium text-primary">{step.action}</span>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onAdvance}
              className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              Next
            </button>
            <button
              onClick={onSkip}
              className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Skip tutorial
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
