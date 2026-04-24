/**
 * LiDAR 3D Annotation — TEST variant that runs on real-world KITTI data.
 *
 * This page is deliberately a sibling of LidarAnnotation.tsx (not a refactor
 * of it) so the production page is untouched. The differences are:
 *
 *   • Loads /public/lidar-sample/ (velodyne.bin, label.txt, calib.txt, image.png)
 *   • Removes the "Overlay" view toggle
 *   • "Camera" button is now a picture-in-picture overlay (top-left) with the
 *     actual RGB scene image — the main canvas keeps showing the LiDAR cloud
 *   • "AI Verify" runs advancedScoring against the KITTI ground truth and
 *     reports precision/recall/F1, mean IoU, localisation & heading error and
 *     a 0–100 composite score with a letter grade
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import {
  Box,
  MousePointer2,
  Trash2,
  RotateCcw,
  Eye,
  EyeOff,
  Car,
  Bike,
  PersonStanding,
  ChevronRight,
  Layers,
  Tag,
  ArrowLeft,
  Camera,
  Maximize2,
  Minimize2,
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileEdit,
  ClipboardCheck,
  PackageCheck,
  ThumbsUp,
  ThumbsDown,
  BarChart2,
  HelpCircle,
} from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import { ThemeToggle } from "@/components/ThemeToggle";

import {
  loadRealSample,
  GTObjectVelo,
  PointCloud,
} from "@/components/lidar-test/kittiParser";
import { RealPointCloud } from "@/components/lidar-test/RealPointCloud";
import { ScoringPanel } from "@/components/lidar-test/ScoringPanel";
import {
  PredBoxVelo,
  ScoreReport,
  scoreAnnotations,
} from "@/components/lidar-test/advancedScoring";
import GuidedTutorial, { TUTORIAL_STEPS } from "@/components/GuidedTutorial";
import { CanvasErrorBoundary } from "@/components/CanvasErrorBoundary";

// ────────────────────────────────────────────────────────────────────────────
//  WebGL detection helper
// ────────────────────────────────────────────────────────────────────────────

function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Types + constants
// ────────────────────────────────────────────────────────────────────────────

interface AnnoBox {
  id: string;
  center: [number, number, number]; // Velodyne frame (x=fwd, y=left, z=up)
  size: [number, number, number];   // length, width, height
  yaw: number;                       // around velodyne Z
  label: "Car" | "Pedestrian" | "Cyclist";
  color: string;
  visible: boolean;
  source: "human" | "gt";
}

type ToolMode = "select" | "bbox";

const LABELS: { name: AnnoBox["label"]; color: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { name: "Car",        color: "#5ac8fa", icon: Car },
  { name: "Pedestrian", color: "#ff3aa5", icon: PersonStanding },
  { name: "Cyclist",    color: "#a78bfa", icon: Bike },
];

const LABEL_COLOR: Record<string, string> = Object.fromEntries(
  LABELS.map((l) => [l.name, l.color])
);

const DEFAULT_SIZES: Record<AnnoBox["label"], [number, number, number]> = {
  Car:        [4.2, 1.7, 1.55],
  Pedestrian: [0.8, 0.6, 1.75],
  Cyclist:    [1.7, 0.5, 1.7],
};

const GT_COLOR = "#f5d742"; // ground truth gets a distinct gold stroke

// Velodyne → three.js basis matrix (three = (-velo.y, velo.z, -velo.x))
const VELO_TO_THREE_MATRIX = (() => {
  const m = new THREE.Matrix4();
  m.set(
    0, -1, 0, 0,
    0,  0, 1, 0,
    -1, 0, 0, 0,
    0,  0, 0, 1
  );
  return m;
})();

// ────────────────────────────────────────────────────────────────────────────
//  3-D bounding box rendered in VELODYNE coordinates
// ────────────────────────────────────────────────────────────────────────────

function VeloBox3D({
  center,
  size,
  yaw,
  color,
  label,
  selected,
  dashed = false,
  opacity = 0.12,
  onClick,
}: {
  center: [number, number, number];
  size: [number, number, number];
  yaw: number;
  color: string;
  label: string;
  selected?: boolean;
  dashed?: boolean;
  opacity?: number;
  onClick?: () => void;
}) {
  // In Velodyne frame: rotate around z (up).
  return (
    <group
      position={center}
      rotation={[0, 0, yaw]}
      onClick={(e) => {
        if (!onClick) return;
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh>
        {/* geometry args: length (x), width (y), height (z) */}
        <boxGeometry args={size} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? opacity * 1.8 : opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
        <lineBasicMaterial
          color={selected ? "#ffffff" : color}
          linewidth={2}
          transparent={dashed}
          opacity={dashed ? 0.6 : 1}
        />
      </lineSegments>
      <Html
        position={[0, 0, size[2] / 2 + 0.25]}
        center
        distanceFactor={18}
        style={{ pointerEvents: "none", zIndex: 1 }}
        zIndexRange={[1, 0]}
      >
        <div
          className="px-2 py-0.5 rounded text-sm font-bold whitespace-nowrap"
          style={{ background: color, color: "#000", opacity: 0.92 }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

/** Invisible clickable plane at z=0 (Velodyne ground) for placing new boxes. */
function VeloGroundPlane({
  active,
  onPlace,
}: {
  active: boolean;
  onPlace: (p: [number, number, number]) => void;
}) {
  return (
    <mesh
      rotation={[0, 0, 0]}
      position={[0, 0, 0]}
      visible={false}
      onClick={(e) => {
        if (!active) return;
        e.stopPropagation();
        // e.point is in world (three.js) space. Convert to this mesh's local
        // frame — which, thanks to the enclosing <group>, is Velodyne.
        const local = e.object.worldToLocal(e.point.clone());
        onPlace([local.x, local.y, local.z]);
      }}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//  Page
// ────────────────────────────────────────────────────────────────────────────

type Stage = "annotating" | "ai_verify" | "qa_review" | "delivered";

export default function LidarAnnotationTest() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloud, setCloud] = useState<PointCloud | null>(null);
  const [gt, setGt] = useState<GTObjectVelo[]>([]);
  const [imageUrl, setImageUrl] = useState<string>("");

  const [bboxes, setBboxes] = useState<AnnoBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>("select");
  const [activeLabel, setActiveLabel] = useState(LABELS[0]);
  const [showPoints, setShowPoints] = useState(true);
  const [showGT, setShowGT] = useState(false);
  const [cameraPIP, setCameraPIP] = useState<"hidden" | "small" | "expanded">("hidden");

  const [stage, setStage] = useState<Stage>("annotating");
  const [report, setReport] = useState<ScoreReport | null>(null);
  const [running, setRunning] = useState(false);
  // QA overrides: rowIndex → "approved" | "rejected"
  const [qaOverrides, setQaOverrides] = useState<Record<number, "approved" | "rejected">>({});
  // Guided tutorial
  const [tutorialStep, setTutorialStep] = useState<number | null>(0);

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadRealSample(2);
        if (cancelled) return;
        setCloud(data.cloud);
        setGt(data.gt);
        setImageUrl(data.imageUrl);

        // Seed 2 starter annotations so the scene isn't blank on load.
        // Use approximate positions from the first Car and first Pedestrian in GT,
        // offset slightly so they don't perfectly match (encouraging the user to refine).
        const starters: AnnoBox[] = [];
        const firstCar = data.gt.find((g) => g.label === "Car");
        if (firstCar) {
          starters.push({
            id: "starter-car",
            // x/y offset slightly so it doesn't perfectly match GT (user must refine).
            // z comes from the GT — the sensor is above the ground, so z=0 is NOT the floor.
            center: [firstCar.center[0] + 0.6, firstCar.center[1] - 0.4, firstCar.center[2]],
            size: DEFAULT_SIZES["Car"],
            yaw: firstCar.yaw,
            label: "Car",
            color: LABEL_COLOR["Car"],
            visible: true,
            source: "human",
          });
        }
        const firstPed = data.gt.find((g) => g.label === "Pedestrian");
        if (firstPed) {
          starters.push({
            id: "starter-ped",
            center: [firstPed.center[0], firstPed.center[1] + 0.3, firstPed.center[2]],
            size: DEFAULT_SIZES["Pedestrian"],
            yaw: firstPed.yaw,
            label: "Pedestrian",
            color: LABEL_COLOR["Pedestrian"],
            visible: true,
            source: "human",
          });
        }
        setBboxes(starters);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Tutorial helpers — MUST be declared first (used in dependency arrays below) ──
  const advanceTutorial = useCallback(() => {
    setTutorialStep((prev) => {
      if (prev === null) return null;
      if (prev >= TUTORIAL_STEPS.length - 1) return null;
      return prev + 1;
    });
  }, []);

  const skipTutorial = useCallback(() => setTutorialStep(null), []);

  const restartTutorial = useCallback(() => {
    setTutorialStep(0);
  }, []);

  // Wrapper passed to <GuidedTutorial onAdvance=…>.
  // Handles two edge cases where clicking Next without the expected interaction
  // would leave the user stuck:
  //
  //   "select-box"   → user skipped clicking an annotation; auto-select the first
  //                    one so the properties panel is visible for the next step.
  //   "place-box"    → user clicked Next without placing a box; starter annotations
  //                    are already present so just advance normally.
  const handleTutorialAdvance = useCallback(() => {
    if (tutorialStep !== null) {
      const stepId = TUTORIAL_STEPS[tutorialStep]?.id;
      if (stepId === "select-box" && bboxes.length > 0 && !selectedId) {
        setSelectedId(bboxes[0].id);
      }
    }
    advanceTutorial();
  }, [tutorialStep, bboxes, selectedId, advanceTutorial]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSetTool = useCallback(
    (t: ToolMode) => {
      setTool(t);
      if (tutorialStep !== null) {
        const stepId = TUTORIAL_STEPS[tutorialStep]?.id;
        if (stepId === "select-tool" && t === "select") advanceTutorial();
        if (stepId === "bbox-tool"   && t === "bbox")   advanceTutorial();
      }
    },
    [tutorialStep, advanceTutorial]
  );

  const handleSetLabel = useCallback(
    (label: typeof LABELS[0]) => {
      setActiveLabel(label);
      if (tutorialStep !== null && TUTORIAL_STEPS[tutorialStep]?.id === "label-class")
        advanceTutorial();
    },
    [tutorialStep, advanceTutorial]
  );

  const handleSelectBox = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (tutorialStep !== null && TUTORIAL_STEPS[tutorialStep]?.id === "select-box")
        advanceTutorial();
    },
    [tutorialStep, advanceTutorial]
  );

  const sliderInteracted = React.useRef(false);
  const handleSliderChange = useCallback(() => {
    if (
      !sliderInteracted.current &&
      tutorialStep !== null &&
      TUTORIAL_STEPS[tutorialStep]?.id === "edit-properties"
    ) {
      sliderInteracted.current = true;
      advanceTutorial();
    }
  }, [tutorialStep, advanceTutorial]);

  const addBox = useCallback(
    (p: [number, number, number]) => {
      const dims = DEFAULT_SIZES[activeLabel.name];
      const box: AnnoBox = {
        id: `anno-${Date.now()}`,
        center: [p[0], p[1], dims[2] / 2],
        size: dims,
        yaw: 0,
        label: activeLabel.name,
        color: activeLabel.color,
        visible: true,
        source: "human",
      };
      setBboxes((prev) => [...prev, box]);
      setSelectedId(box.id);
      setTool("select");
      if (tutorialStep !== null && TUTORIAL_STEPS[tutorialStep]?.id === "place-box")
        advanceTutorial();
    },
    [activeLabel, tutorialStep, advanceTutorial]
  );

  const deleteBox = useCallback(
    (id: string) => {
      setBboxes((prev) => prev.filter((b) => b.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId]
  );

  const toggleVis = useCallback((id: string) => {
    setBboxes((prev) =>
      prev.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b))
    );
  }, []);

  const reset = useCallback(() => {
    setBboxes([]);
    setSelectedId(null);
    setTool("select");
    setReport(null);
    setStage("annotating");
  }, []);

  const selectedBox = bboxes.find((b) => b.id === selectedId) ?? null;

  const runAIVerify = useCallback(() => {
    setRunning(true);
    // Defer to next tick so the UI shows the "Scoring…" state.
    setTimeout(() => {
      const preds: PredBoxVelo[] = bboxes.map((b) => ({
        id: b.id,
        label: b.label,
        center: b.center,
        size: b.size,
        yaw: b.yaw,
      }));
      const r = scoreAnnotations(preds, gt);
      setReport(r);
      setShowGT(true);
      setRunning(false);
    }, 50);
  }, [bboxes, gt]);

  // ── Derived for rendering ────────────────────────────────────────────────
  const displayNames = useMemo(() => {
    const counts: Record<string, number> = {};
    const idx: Record<string, number> = {};
    bboxes.forEach((b) => (counts[b.label] = (counts[b.label] || 0) + 1));
    const names: Record<string, string> = {};
    bboxes.forEach((b) => {
      idx[b.label] = (idx[b.label] || 0) + 1;
      names[b.id] =
        counts[b.label] > 1 ? `${b.label} ${idx[b.label]}` : b.label;
    });
    return names;
  }, [bboxes]);

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {tutorialStep !== null && (
        <GuidedTutorial
          currentStep={tutorialStep}
          onAdvance={handleTutorialAdvance}
          onSkip={skipTutorial}
        />
      )}
      {/* Left Toolbar */}
      <div className="flex flex-col w-14 items-center py-4 gap-3 border-r border-border bg-card">
        <ToolButton
          icon={<MousePointer2 size={18} />}
          active={tool === "select"}
          onClick={() => handleSetTool("select")}
          tooltip="Select"
          dataTutorial="select-tool"
        />
        <ToolButton
          icon={<Box size={18} />}
          active={tool === "bbox"}
          onClick={() => handleSetTool("bbox")}
          tooltip="Place 3D box"
          dataTutorial="bbox-tool"
        />
        <div className="w-8 h-px my-1 bg-border" />
        <ToolButton
          icon={showPoints ? <Eye size={18} /> : <EyeOff size={18} />}
          active={false}
          onClick={() => setShowPoints((v) => !v)}
          tooltip="Toggle points"
        />
        <ToolButton
          icon={<RotateCcw size={18} />}
          active={false}
          onClick={reset}
          tooltip="Reset"
        />
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative" data-tutorial="canvas-area">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 border-b border-border bg-card/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-muted rounded-full transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </button>
            <span
              className="text-sm font-bold tracking-wide text-white cursor-pointer hover:text-white/80 transition-colors font-headline shrink-0"
              onClick={() => navigate("/use-cases")}
            >
              TP.ai <span style={{ color: "#9071f0" }}>Data</span>Studio
            </span>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="text-foreground/80 text-sm">
              LiDAR 3D Annotation
            </span>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground text-sm font-mono">
              kitti_000134.bin
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle — Camera only (no LiDAR button, no Overlay) */}
            <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5 bg-background/60">
              <ViewToggleButton
                icon={<Camera size={13} />}
                label="Camera"
                active={cameraPIP !== "hidden"}
                onClick={() =>
                  setCameraPIP((v) => (v === "hidden" ? "small" : "hidden"))
                }
              />
            </div>

            <ThemeToggle />
            <button
              onClick={restartTutorial}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Restart tutorial"
            >
              <HelpCircle size={16} />
            </button>
            <Badge variant="outline" className="text-sm border-primary/50 text-primary">
              {bboxes.length} annotations
            </Badge>
            <Badge variant="outline" className="text-sm border-border text-muted-foreground">
              {cloud ? cloud.count.toLocaleString() : "—"} pts
            </Badge>
          </div>
        </div>

        {/* Tool hint */}
        {tool === "bbox" && (
          <div
            className="absolute top-14 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: activeLabel.color, color: "#000" }}
          >
            Click on the ground to place a {activeLabel.name} box
          </div>
        )}

        {/* Camera picture-in-picture (top-left) */}
        {cameraPIP !== "hidden" && imageUrl && (
          <div
            className={`absolute z-20 border border-border rounded-lg overflow-hidden shadow-xl bg-card transition-all ${
              cameraPIP === "expanded"
                ? "top-16 left-4 w-[560px]"
                : "top-16 left-4 w-80"
            }`}
          >
            <div className="flex items-center justify-between px-2 py-1 text-sm bg-card/90 border-b border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Camera size={12} />
                <span>RGB camera · scene_000134</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                  onClick={() =>
                    setCameraPIP((v) => (v === "small" ? "expanded" : "small"))
                  }
                  title={cameraPIP === "small" ? "Expand" : "Shrink"}
                >
                  {cameraPIP === "small" ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                </button>
                <button
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                  onClick={() => setCameraPIP("hidden")}
                  title="Close"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
            <img src={imageUrl} alt="Scene" className="w-full block" />
          </div>
        )}

        {/* Loading / error overlays */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-30">
            <div className="text-muted-foreground text-sm flex items-center gap-2">
              <Sparkles size={14} className="animate-pulse" />
              Loading real KITTI scene…
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-30">
            <div className="px-4 py-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm max-w-md text-center">
              Failed to load sample: {error}
            </div>
          </div>
        )}

        {!isWebGLSupported() && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background gap-4 z-30">
            <div className="text-4xl">⚠️</div>
            <p className="text-foreground font-semibold text-base">3D view unavailable</p>
            <p className="text-muted-foreground text-sm max-w-xs text-center leading-relaxed">
              Your browser does not support WebGL, which is required to render
              the 3D point cloud. Please open this page in Chrome, Edge, or
              Firefox with hardware acceleration enabled.
            </p>
          </div>
        )}
        <CanvasErrorBoundary>
        <Canvas style={{ background: "#000000" }} gl={{ antialias: true }}>
          {/* After the Velodyne→three.js group matrix, the world is Y-up as
              usual. Place the camera behind (+z in three = behind ego) and
              slightly above, looking toward origin. */}
          <PerspectiveCamera makeDefault position={[0, 18, 28]} fov={55} />
          <OrbitControls enableDamping dampingFactor={0.1} maxPolarAngle={Math.PI / 2.05} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[8, 14, 10]} intensity={0.8} />

          {/* Everything inside this group is in VELODYNE frame (x=fwd, y=left, z=up). */}
          <group matrixAutoUpdate={false} matrix={VELO_TO_THREE_MATRIX}>
            {/* Ego vehicle marker */}
            <mesh position={[0, 0, 0.8]}>
              <boxGeometry args={[4.0, 1.8, 1.5]} />
              <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.35} />
            </mesh>

            {cloud && showPoints && (
              <RealPointCloud cloud={cloud} pointSize={0.045} maxRange={70} />
            )}

            {/* Human annotations */}
            {bboxes.map((b) =>
              b.visible ? (
                <VeloBox3D
                  key={b.id}
                  center={b.center}
                  size={b.size}
                  yaw={b.yaw}
                  color={b.color}
                  label={displayNames[b.id] || b.label}
                  selected={selectedId === b.id}
                  opacity={0.14}
                  onClick={() => {
                    if (tool === "select") handleSelectBox(b.id);
                  }}
                />
              ) : null
            )}

            {/* Ground truth overlay (after verify, or manually toggled) */}
            {showGT &&
              gt.map((g) => (
                <VeloBox3D
                  key={g.id}
                  center={g.center}
                  size={g.size}
                  yaw={g.yaw}
                  color={GT_COLOR}
                  label={`GT · ${g.label}`}
                  dashed
                  opacity={0.05}
                />
              ))}

            <VeloGroundPlane active={tool === "bbox"} onPlace={addBox} />
          </group>
        </Canvas>
        </CanvasErrorBoundary>
      </div>

      {/* Right Panel */}
      <div className="w-80 flex flex-col border-l border-border overflow-y-auto bg-card">
        {/* Stage stepper */}
        <div className="border-b border-border">
          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Workflow
            </span>
          </div>
          <div className="px-3 pt-2 pb-3">
            <Stepper stage={stage} />
          </div>

          {stage === "annotating" && (
            <div className="px-3 pb-3 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Place bounding boxes around every Car, Pedestrian and Cyclist
                you can see in the point cloud. When you're done, submit for
                AI verification.
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Annotations placed</span>
                <span className="font-mono text-foreground">{bboxes.length}</span>
              </div>
              <button
                className="w-full bg-primary text-primary-foreground text-sm font-semibold rounded-md py-1.5 disabled:opacity-50"
                disabled={bboxes.length === 0}
                onClick={() => setStage("ai_verify")}
              >
                Submit for AI Verify
              </button>
            </div>
          )}

          {stage === "ai_verify" && (
            <ScoringPanel
              report={report}
              onRun={runAIVerify}
              running={running}
              numPreds={bboxes.length}
              numGT={gt.length}
            />
          )}

          {/* AI Verify navigation */}
          {stage === "ai_verify" && report && (
            <div className="px-3 pb-3 flex gap-2">
              <button
                className="flex-1 text-sm border border-border rounded-md py-1.5 hover:bg-muted"
                onClick={() => setStage("annotating")}
              >
                Back
              </button>
              <button
                className="flex-1 text-sm bg-primary text-primary-foreground rounded-md py-1.5"
                onClick={() => {
                  setQaOverrides({});
                  setStage("qa_review");
                }}
              >
                QA Review →
              </button>
            </div>
          )}

          {/* QA Review stage */}
          {stage === "qa_review" && report && (
            <QAReviewPanel
              report={report}
              overrides={qaOverrides}
              onOverride={(idx, decision) =>
                setQaOverrides((prev) => ({ ...prev, [idx]: decision }))
              }
              onBack={() => setStage("ai_verify")}
              onDeliver={() => setStage("delivered")}
            />
          )}

          {/* Delivered */}
          {stage === "delivered" && (
            <div className="px-3 pb-3 flex flex-col gap-3">
              <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                <CheckCircle2 className="text-green-500" size={18} />
                <div className="text-sm leading-tight">
                  <div className="font-semibold text-foreground">Delivered</div>
                  <div className="text-muted-foreground">
                    Scene 000134 annotation approved.
                  </div>
                </div>
              </div>
              <button
                className="w-full text-sm border border-border rounded-md py-1.5 hover:bg-muted"
                onClick={reset}
              >
                Start over
              </button>
            </div>
          )}
        </div>

        {/* Label selector */}
        <div className="p-4 border-b border-border" data-tutorial="label-grid">
          <div className="flex items-center gap-2 mb-3">
            <Tag size={14} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Label Class
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LABELS.map((label) => {
              const Icon = label.icon;
              const isActive = activeLabel.name === label.name;
              return (
                <button
                  key={label.name}
                  onClick={() => handleSetLabel(label)}
                  className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm font-medium transition-all border justify-center"
                  style={{
                    background: isActive ? label.color + "22" : "transparent",
                    borderColor: isActive ? label.color : "hsl(0, 0%, 13%)",
                    color: isActive ? label.color : "hsl(350, 20%, 80%)",
                  }}
                >
                  <Icon size={13} />
                  {label.name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Annotations list */}
        <div className="p-4 border-b border-border" data-tutorial="annotations-list">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={14} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Annotations
            </span>
          </div>
          <div className="space-y-2">
            {bboxes.map((b) => (
              <div
                key={b.id}
                onClick={() => handleSelectBox(b.id)}
                className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all border"
                style={{
                  background:
                    selectedId === b.id ? "hsl(0, 0%, 12%)" : "transparent",
                  borderColor:
                    selectedId === b.id ? b.color + "66" : "hsl(0, 0%, 13%)",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: b.color }}
                  />
                  <span className="text-sm text-foreground/90">
                    {displayNames[b.id] || b.label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVis(b.id);
                    }}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    {b.visible ? (
                      <Eye size={12} className="text-muted-foreground" />
                    ) : (
                      <EyeOff size={12} className="text-muted-foreground/50" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBox(b.id);
                    }}
                    className="p-1 rounded hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2
                      size={12}
                      className="text-muted-foreground hover:text-destructive"
                    />
                  </button>
                </div>
              </div>
            ))}
            {bboxes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No annotations yet. Pick a label and the 3D box tool, then click
                the scene.
              </p>
            )}
          </div>
        </div>

        {/* Selected box properties */}
        {selectedBox && (
          <div className="p-4" data-tutorial="properties-panel">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Properties
            </span>
            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Label</span>
                <span
                  style={{ color: selectedBox.color }}
                  className="font-semibold"
                >
                  {selectedBox.label}
                </span>
              </div>
              {(["Forward (x)", "Left (y)", "Up (z)"] as const).map((dim, idx) => (
                <div key={dim}>
                  <div className="flex justify-between mb-1">
                    <span>{dim}</span>
                    <span className="text-foreground/80 font-mono">
                      {selectedBox.center[idx].toFixed(1)}m
                    </span>
                  </div>
                  <Slider
                    min={-60}
                    max={60}
                    step={0.1}
                    value={[selectedBox.center[idx]]}
                    onValueChange={(val) => {
                      handleSliderChange();
                      setBboxes((prev) =>
                        prev.map((b) => {
                          if (b.id !== selectedBox.id) return b;
                          const c = [...b.center] as [number, number, number];
                          c[idx] = val[0];
                          return { ...b, center: c };
                        })
                      );
                    }}
                    className="[&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-muted [&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:border-primary [&_[data-radix-slider-thumb]]:bg-background"
                  />
                </div>
              ))}
              {(["Length", "Width", "Height"] as const).map((dim, idx) => (
                <div key={dim}>
                  <div className="flex justify-between mb-1">
                    <span>{dim}</span>
                    <span className="text-foreground/80 font-mono">
                      {selectedBox.size[idx].toFixed(1)}m
                    </span>
                  </div>
                  <Slider
                    min={0.2}
                    max={8}
                    step={0.1}
                    value={[selectedBox.size[idx]]}
                    onValueChange={(val) => {
                      handleSliderChange();
                      setBboxes((prev) =>
                        prev.map((b) => {
                          if (b.id !== selectedBox.id) return b;
                          const s = [...b.size] as [number, number, number];
                          s[idx] = val[0];
                          return { ...b, size: s };
                        })
                      );
                    }}
                    className="[&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-muted [&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:border-primary [&_[data-radix-slider-thumb]]:bg-background"
                  />
                </div>
              ))}
              <div>
                <div className="flex justify-between mb-1">
                  <span>Yaw</span>
                  <span className="text-foreground/80 font-mono">
                    {((selectedBox.yaw * 180) / Math.PI).toFixed(1)}°
                  </span>
                </div>
                <Slider
                  min={-180}
                  max={180}
                  step={1}
                  value={[Number(((selectedBox.yaw * 180) / Math.PI).toFixed(1))]}
                  onValueChange={(val) => {
                    handleSliderChange();
                    setBboxes((prev) =>
                      prev.map((b) =>
                        b.id === selectedBox.id
                          ? { ...b, yaw: (val[0] * Math.PI) / 180 }
                          : b
                      )
                    );
                  }}
                  className="[&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-muted [&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:border-primary [&_[data-radix-slider-thumb]]:bg-background"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//  Small presentational helpers
// ────────────────────────────────────────────────────────────────────────────

const STAGE_ORDER: Stage[] = ["annotating", "ai_verify", "qa_review", "delivered"];
const STAGE_META: Record<Stage, { label: string; Icon: React.ComponentType<{ size?: number }> }> = {
  annotating: { label: "Annotate",  Icon: FileEdit },
  ai_verify:  { label: "AI Verify", Icon: Sparkles },
  qa_review:  { label: "QA Review", Icon: ClipboardCheck },
  delivered:  { label: "Delivered", Icon: PackageCheck },
};

function Stepper({ stage }: { stage: Stage }) {
  const currentIdx = STAGE_ORDER.indexOf(stage);
  return (
    <div className="flex items-center justify-between">
      {STAGE_ORDER.map((s, i) => {
        const { label, Icon } = STAGE_META[s];
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center flex-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors"
                style={{
                  borderColor:
                    isDone || isCurrent ? "hsl(var(--primary))" : "hsl(0,0%,22%)",
                  background:
                    isCurrent ? "hsl(var(--primary) / 0.15)" :
                    isDone    ? "hsl(var(--primary) / 0.85)" : "transparent",
                  color:
                    isCurrent ? "hsl(var(--primary))" :
                    isDone    ? "#fff" : "hsl(0,0%,55%)",
                }}
              >
                <Icon size={14} />
              </div>
              <span
                className="mt-1 text-sm font-medium whitespace-nowrap"
                style={{
                  color:
                    isCurrent ? "hsl(var(--primary))" :
                    isDone    ? "hsl(0,0%,85%)" : "hsl(0,0%,55%)",
                }}
              >
                {label}
              </span>
            </div>
            {i < STAGE_ORDER.length - 1 && (
              <div
                className="h-px flex-1 mx-1 -translate-y-3"
                style={{
                  background:
                    i < currentIdx ? "hsl(var(--primary))" : "hsl(0,0%,22%)",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//  QA Review panel
// ────────────────────────────────────────────────────────────────────────────

interface QAReviewPanelProps {
  report: ScoreReport;
  overrides: Record<number, "approved" | "rejected">;
  onOverride: (idx: number, decision: "approved" | "rejected") => void;
  onBack: () => void;
  onDeliver: () => void;
}

function QAReviewPanel({ report, overrides, onOverride, onBack, onDeliver }: QAReviewPanelProps) {
  // Only show rows that need attention (non-matches), plus a summary of passed ones.
  const flaggedRows = report.rows
    .map((r, i) => ({ ...r, idx: i }))
    .filter((r) => r.status !== "true_positive");

  const passedCount = report.rows.filter((r) => r.status === "true_positive").length;
  const reviewedCount = flaggedRows.filter((r) => overrides[r.idx] !== undefined).length;
  const allReviewed = reviewedCount === flaggedRows.length;

  const approvedCount = flaggedRows.filter((r) => overrides[r.idx] === "approved").length;
  const rejectedCount = flaggedRows.filter((r) => overrides[r.idx] === "rejected").length;

  const statusMeta = (status: ScoreReport["rows"][number]["status"]) => {
    switch (status) {
      case "false_positive": return { Icon: AlertTriangle, color: "#f59e0b", text: "Extra box" };
      case "false_negative": return { Icon: XCircle,       color: "#ef4444", text: "Missed" };
      case "wrong_class":    return { Icon: AlertTriangle, color: "#a78bfa", text: "Wrong class" };
      default:               return { Icon: CheckCircle2,  color: "#22c55e", text: "Match" };
    }
  };

  return (
    <div className="px-3 pb-3 flex flex-col gap-3">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-md border border-border p-2 text-center">
          <div className="text-muted-foreground uppercase tracking-wider text-sm">Passed</div>
          <div className="font-bold text-green-400 mt-0.5">{passedCount}</div>
        </div>
        <div className="rounded-md border border-border p-2 text-center">
          <div className="text-muted-foreground uppercase tracking-wider text-sm">Flagged</div>
          <div className="font-bold text-yellow-400 mt-0.5">{flaggedRows.length}</div>
        </div>
        <div className="rounded-md border border-border p-2 text-center">
          <div className="text-muted-foreground uppercase tracking-wider text-sm">Reviewed</div>
          <div className="font-bold text-primary mt-0.5">{reviewedCount}/{flaggedRows.length}</div>
        </div>
      </div>

      {flaggedRows.length === 0 ? (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/5 text-sm text-green-400">
          <CheckCircle2 size={14} />
          No issues to review — all boxes matched.
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
          {flaggedRows.map((row) => {
            const { Icon, color, text } = statusMeta(row.status);
            const label = row.gt?.label ?? row.pred?.label ?? "—";
            const override = overrides[row.idx];
            return (
              <div
                key={row.idx}
                className="rounded-lg border border-border p-2.5 flex flex-col gap-2"
                style={{ borderLeftColor: color, borderLeftWidth: 3 }}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={13} style={{ color }} />
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </div>
                  <span
                    className="text-sm px-1.5 py-0.5 rounded border font-medium"
                    style={{ color, borderColor: color + "55", background: color + "12", fontSize: "0.7rem" }}
                  >
                    {text}
                  </span>
                </div>

                {/* Detail */}
                <div className="text-sm text-muted-foreground space-y-0.5">
                  {row.status === "false_positive" && (
                    <span>Box has no matching GT object (IoU {(row.iou3D * 100).toFixed(0)}%)</span>
                  )}
                  {row.status === "false_negative" && (
                    <span>GT object not annotated by reviewer</span>
                  )}
                  {row.status === "wrong_class" && (
                    <span>
                      Predicted <b>{row.pred?.label}</b>, GT is <b>{row.gt?.label}</b>
                    </span>
                  )}
                  {row.status === "low_iou" && (
                    <span>IoU {(row.iou3D * 100).toFixed(0)}% — below threshold</span>
                  )}
                </div>

                {/* Override buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onOverride(row.idx, "approved")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-sm font-medium border transition-colors ${
                      override === "approved"
                        ? "bg-green-500/20 border-green-500/50 text-green-400"
                        : "border-border text-muted-foreground hover:border-green-500/50 hover:text-green-400"
                    }`}
                  >
                    <ThumbsUp size={12} /> Accept
                  </button>
                  <button
                    onClick={() => onOverride(row.idx, "rejected")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-sm font-medium border transition-colors ${
                      override === "rejected"
                        ? "bg-red-500/20 border-red-500/50 text-red-400"
                        : "border-border text-muted-foreground hover:border-red-500/50 hover:text-red-400"
                    }`}
                  >
                    <ThumbsDown size={12} /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QA summary if any reviewed */}
      {(approvedCount > 0 || rejectedCount > 0) && (
        <div className="flex gap-3 text-sm px-1">
          <span className="text-green-400 flex items-center gap-1">
            <ThumbsUp size={11} /> {approvedCount} accepted
          </span>
          <span className="text-red-400 flex items-center gap-1">
            <ThumbsDown size={11} /> {rejectedCount} rejected
          </span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2">
        <button
          className="flex-1 text-sm border border-border rounded-md py-1.5 hover:bg-muted"
          onClick={onBack}
        >
          ← Back
        </button>
        <button
          className="flex-1 text-sm bg-primary text-primary-foreground rounded-md py-1.5 disabled:opacity-50"
          disabled={!allReviewed && flaggedRows.length > 0}
          onClick={onDeliver}
          title={!allReviewed && flaggedRows.length > 0 ? "Review all flagged items first" : undefined}
        >
          Approve & Deliver
        </button>
      </div>
      {!allReviewed && flaggedRows.length > 0 && (
        <p className="text-sm text-muted-foreground text-center -mt-1">
          Accept or reject all {flaggedRows.length} flagged items to continue.
        </p>
      )}
    </div>
  );
}

function ToolButton({
  icon, active, onClick, tooltip, dataTutorial,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tooltip: string;
  dataTutorial?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      data-tutorial={dataTutorial}
      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all border ${
        active
          ? "bg-primary/15 border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {icon}
    </button>
  );
}

function ViewToggleButton({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
