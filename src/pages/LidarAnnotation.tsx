import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Html, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { Badge } from "@/components/ui/badge";
import GuidedTutorial, { TUTORIAL_STEPS } from "@/components/GuidedTutorial";
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
  TreePine,
  ChevronRight,
  Layers,
  Tag,
  HelpCircle,
  Camera,
  Boxes,
  SquareStack,
} from "lucide-react";

import { RealisticScene } from "@/components/lidar/RealisticScene";
import { LidarPointCloud, getScenePointCloud } from "@/components/lidar/LidarPointCloud";
import { AI_BOXES } from "@/components/lidar/aiVerification";
import { AIWorkflowPanel, WorkflowStage } from "@/components/lidar/AIWorkflowPanel";

// --- Types ---
interface BBox3D {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  rotation: number;
  label: string;
  color: string;
  visible: boolean;
  source?: "human" | "ai";
}

type ToolMode = "select" | "bbox" | "move";
type ViewMode = "lidar" | "camera" | "overlay";

const LABELS = [
  { name: "Car", color: "#22d3ee", icon: Car },
  { name: "Pedestrian", color: "#f472b6", icon: PersonStanding },
  { name: "Cyclist", color: "#a78bfa", icon: Bike },
  { name: "Vegetation", color: "#4ade80", icon: TreePine },
];

const LABEL_COLOR: Record<string, string> = Object.fromEntries(
  LABELS.map((l) => [l.name, l.color])
);

// ─── Bounding box 3D (shared between view modes) ─────────────────────────────
function BoundingBox3D({
  bbox,
  selected,
  displayName,
  onClick,
  dashed = false,
}: {
  bbox: BBox3D;
  selected: boolean;
  displayName: string;
  onClick: () => void;
  dashed?: boolean;
}) {
  if (!bbox.visible) return null;
  const color = selected ? "#ffffff" : bbox.color;

  return (
    <group
      position={bbox.position}
      rotation={[0, bbox.rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh>
        <boxGeometry args={bbox.size} />
        <meshBasicMaterial
          color={bbox.color}
          transparent
          opacity={selected ? 0.14 : 0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...bbox.size)]} />
        <lineBasicMaterial
          color={color}
          linewidth={2}
          transparent={dashed}
          opacity={dashed ? 0.65 : 1}
        />
      </lineSegments>
      <Html
        position={[0, bbox.size[1] / 2 + 0.3, 0]}
        center
        distanceFactor={15}
        style={{ pointerEvents: "none", zIndex: 1 }}
        zIndexRange={[1, 0]}
      >
        <div
          className="px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap"
          style={{
            background: bbox.color,
            color: "#000",
            opacity: 0.92,
          }}
        >
          {displayName}
        </div>
      </Html>
    </group>
  );
}

function GroundPlane({
  onPlace,
  active,
}: {
  onPlace: (pos: [number, number, number]) => void;
  active: boolean;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      visible={false}
      onClick={(e) => {
        if (!active) return;
        e.stopPropagation();
        const p = e.point;
        onPlace([p.x, 0.8, p.z]);
      }}
    >
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial />
    </mesh>
  );
}

// Seeded initial human annotations — intentionally slightly imperfect vs AI
const INITIAL_BBOXES: BBox3D[] = [
  { id: "car-1", position: [6, 0.8, 3],     size: [4.4, 1.6, 1.95], rotation: 0,              label: "Car",        color: "#22d3ee", visible: true, source: "human" },
  { id: "car-2", position: [-8.8, 0.95, -4], size: [4.6, 1.85, 2.0], rotation: 0.22,           label: "Car",        color: "#22d3ee", visible: true, source: "human" },
  { id: "car-3", position: [14, 0.82, 11],  size: [4.5, 1.65, 1.95], rotation: Math.PI / 2,   label: "Car",        color: "#22d3ee", visible: true, source: "human" },
  { id: "ped-1", position: [-2, 0.9, 8],    size: [0.6, 1.8, 0.5],   rotation: 0,              label: "Pedestrian", color: "#f472b6", visible: true, source: "human" },
  // ped-2 intentionally missing — will be flagged by AI Verify
  { id: "tree-1", position: [-15, 2.1, 10], size: [3.0, 4.2, 3.0],   rotation: 0,              label: "Vegetation", color: "#4ade80", visible: true, source: "human" },
  { id: "tree-2", position: [16, 2.1, -12], size: [2.6, 4.0, 2.6],   rotation: 0,              label: "Vegetation", color: "#4ade80", visible: true, source: "human" },
];

export default function LidarAnnotation() {
  const navigate = useNavigate();
  const [bboxes, setBboxes] = useState<BBox3D[]>(INITIAL_BBOXES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>("select");
  const [activeLabel, setActiveLabel] = useState(LABELS[0]);
  const [showPoints, setShowPoints] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("lidar");

  // Workflow state
  const [stage, setStage] = useState<WorkflowStage>("annotating");
  const [aiRan, setAiRan] = useState(false);
  const [showAIBoxes, setShowAIBoxes] = useState(true);

  // Tutorial
  const [tutorialStep, setTutorialStep] = useState<number | null>(0);

  // Point cloud count for header
  const pointCount = useMemo(() => {
    try {
      return getScenePointCloud().positions.length / 3;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    if (tutorialStep === null) return;
    const stepId = TUTORIAL_STEPS[tutorialStep]?.id;
    if (stepId === "place-box" && tool !== "bbox") setTool("bbox");
    if (stepId === "edit-properties" && !selectedId && bboxes.length > 0) {
      setSelectedId(bboxes[0].id);
    }
  }, [tutorialStep, tool, selectedId, bboxes]);

  const advanceTutorial = useCallback(() => {
    setTutorialStep((prev) => {
      if (prev === null) return null;
      if (prev >= TUTORIAL_STEPS.length - 1) return null;
      return prev + 1;
    });
  }, []);

  const skipTutorial = useCallback(() => setTutorialStep(null), []);

  const restartTutorial = useCallback(() => {
    setBboxes(INITIAL_BBOXES);
    setSelectedId(null);
    setTool("select");
    setStage("annotating");
    setAiRan(false);
    setTutorialStep(0);
  }, []);

  const handleSetTool = useCallback(
    (newTool: ToolMode) => {
      setTool(newTool);
      if (tutorialStep !== null) {
        const stepId = TUTORIAL_STEPS[tutorialStep]?.id;
        if (stepId === "select-tool" && newTool === "select") advanceTutorial();
        else if (stepId === "bbox-tool" && newTool === "bbox") advanceTutorial();
      }
    },
    [tutorialStep, advanceTutorial]
  );

  const handleSetLabel = useCallback(
    (label: typeof LABELS[0]) => {
      setActiveLabel(label);
      if (tutorialStep !== null && TUTORIAL_STEPS[tutorialStep]?.id === "label-class") {
        advanceTutorial();
      }
    },
    [tutorialStep, advanceTutorial]
  );

  const addBBox = useCallback(
    (pos: [number, number, number]) => {
      const defaultSizes: Record<string, [number, number, number]> = {
        Car: [4.5, 1.6, 2],
        Pedestrian: [0.6, 1.8, 0.5],
        Cyclist: [1.8, 1.7, 0.8],
        Vegetation: [3, 3.5, 3],
      };
      const newBox: BBox3D = {
        id: `bbox-${Date.now()}`,
        position: pos,
        size: defaultSizes[activeLabel.name] || [2, 2, 2],
        rotation: 0,
        label: activeLabel.name,
        color: activeLabel.color,
        visible: true,
        source: "human",
      };
      setBboxes((prev) => [...prev, newBox]);
      setSelectedId(newBox.id);
      setTool("select");
      if (tutorialStep !== null && TUTORIAL_STEPS[tutorialStep]?.id === "place-box") {
        advanceTutorial();
      }
    },
    [activeLabel, tutorialStep, advanceTutorial]
  );

  const handleSelectBBox = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (tutorialStep !== null && TUTORIAL_STEPS[tutorialStep]?.id === "select-box") {
        advanceTutorial();
      }
    },
    [tutorialStep, advanceTutorial]
  );

  const sliderInteracted = useRef(false);
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

  const deleteBBox = useCallback(
    (id: string) => {
      setBboxes((prev) => prev.filter((b) => b.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId]
  );

  const toggleVisibility = useCallback((id: string) => {
    setBboxes((prev) =>
      prev.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b))
    );
  }, []);

  const selectedBBox = bboxes.find((b) => b.id === selectedId);

  const bboxDisplayNames = useMemo(() => {
    const labelCounts: Record<string, number> = {};
    bboxes.forEach((b) => (labelCounts[b.label] = (labelCounts[b.label] || 0) + 1));
    const labelIndexes: Record<string, number> = {};
    const names: Record<string, string> = {};
    bboxes.forEach((b) => {
      labelIndexes[b.label] = (labelIndexes[b.label] || 0) + 1;
      names[b.id] =
        labelCounts[b.label] > 1
          ? `${b.label} ${labelIndexes[b.label]}`
          : b.label;
    });
    return names;
  }, [bboxes]);

  const humanBoxesForAI = useMemo(
    () =>
      bboxes
        .filter((b) => b.source !== "ai")
        .map((b) => ({
          id: b.id,
          label: b.label,
          position: b.position,
          size: b.size,
        })),
    [bboxes]
  );

  const onRunAI = useCallback(() => {
    setAiRan(true);
    setShowAIBoxes(true);
  }, []);

  const onOpenQAReport = useCallback(() => {
    navigate("/qa-report/lidar-annotation");
  }, [navigate]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {tutorialStep !== null && (
        <GuidedTutorial
          currentStep={tutorialStep}
          onAdvance={advanceTutorial}
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
          tooltip="Place 3D Box"
          dataTutorial="bbox-tool"
        />
        <div className="w-8 h-px my-1 bg-border" />
        <ToolButton
          icon={showPoints ? <Eye size={18} /> : <EyeOff size={18} />}
          active={false}
          onClick={() => setShowPoints(!showPoints)}
          tooltip="Toggle Points"
        />
        <ToolButton
          icon={<RotateCcw size={18} />}
          active={false}
          onClick={() => {
            setBboxes(INITIAL_BBOXES);
            setSelectedId(null);
            setTool("select");
            setStage("annotating");
            setAiRan(false);
          }}
          tooltip="Reset"
        />
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative" data-tutorial="canvas-area">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 border-b border-border bg-card/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span
              className="text-white font-bold text-sm tracking-wide cursor-pointer hover:text-white/80 transition-colors"
              onClick={() => navigate("/use-cases")}
            >
              TP.ai <span style={{ color: "#aa00b6" }}>FAB</span>Studio
            </span>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="text-foreground/80 text-sm">LiDAR 3D Annotation</span>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground text-xs">scene_0042.pcd</span>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5 bg-background/60">
              <ViewToggleButton
                icon={<Boxes size={13} />}
                label="LiDAR"
                active={viewMode === "lidar"}
                onClick={() => setViewMode("lidar")}
              />
              <ViewToggleButton
                icon={<Camera size={13} />}
                label="Camera"
                active={viewMode === "camera"}
                onClick={() => setViewMode("camera")}
              />
              <ViewToggleButton
                icon={<SquareStack size={13} />}
                label="Overlay"
                active={viewMode === "overlay"}
                onClick={() => setViewMode("overlay")}
              />
            </div>

            <button
              onClick={restartTutorial}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Restart tutorial"
              data-tutorial="help-button"
            >
              <HelpCircle size={16} />
            </button>
            <Badge
              variant="outline"
              className="text-xs border-primary/50 text-primary"
            >
              {bboxes.length} annotations
            </Badge>
            <Badge
              variant="outline"
              className="text-xs border-border text-muted-foreground"
            >
              {pointCount.toLocaleString()} pts
            </Badge>
          </div>
        </div>

        {/* Tool hint */}
        {tool === "bbox" && (
          <div
            className="absolute top-14 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: activeLabel.color, color: "#000" }}
          >
            Click on ground to place {activeLabel.name} bounding box
          </div>
        )}

        <Canvas
          key={viewMode}
          style={{
            background:
              viewMode === "camera"
                ? "#aac6e0"
                : viewMode === "overlay"
                ? "#101118"
                : "hsl(0, 0%, 7.5%)",
          }}
          gl={{ antialias: true }}
          shadows={viewMode !== "lidar"}
        >
          <PerspectiveCamera makeDefault position={[15, 12, 20]} fov={50} />
          <OrbitControls
            enableDamping
            dampingFactor={0.1}
            maxPolarAngle={Math.PI / 2.1}
          />

          {/* Lighting & scene per view */}
          {viewMode === "lidar" && (
            <>
              <ambientLight intensity={0.3} />
              <directionalLight position={[10, 20, 10]} intensity={0.5} />
              <Grid
                args={[80, 80]}
                cellSize={2}
                cellThickness={0.5}
                cellColor="#1a1a22"
                sectionSize={10}
                sectionThickness={1}
                sectionColor="#2a1a30"
                fadeDistance={60}
                fadeStrength={1}
                position={[0, -0.02, 0]}
              />
              {showPoints && <LidarPointCloud />}
            </>
          )}

          {viewMode === "camera" && <RealisticScene />}

          {viewMode === "overlay" && (
            <>
              <RealisticScene />
              {showPoints && <LidarPointCloud pointSize={0.04} />}
            </>
          )}

          {/* Human annotations */}
          {bboxes.map((bbox) => (
            <BoundingBox3D
              key={bbox.id}
              bbox={bbox}
              selected={bbox.id === selectedId}
              displayName={bboxDisplayNames[bbox.id] || bbox.label}
              onClick={() => {
                if (tool === "select") handleSelectBBox(bbox.id);
              }}
            />
          ))}

          {/* AI verification overlay boxes */}
          {aiRan &&
            showAIBoxes &&
            AI_BOXES.map((ai) => {
              const color = LABEL_COLOR[ai.label] || "#eab308";
              const dashedBox: BBox3D = {
                id: ai.id,
                position: ai.position,
                size: ai.size,
                rotation: ai.rotation,
                label: ai.label,
                color,
                visible: true,
                source: "ai",
              };
              return (
                <BoundingBox3D
                  key={ai.id}
                  bbox={dashedBox}
                  selected={false}
                  displayName={`AI · ${ai.label}`}
                  onClick={() => {}}
                  dashed
                />
              );
            })}

          <GroundPlane onPlace={addBBox} active={tool === "bbox"} />

          {/* Vehicle/sensor origin marker — hide in camera view */}
          {viewMode !== "camera" && (
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
            </mesh>
          )}
        </Canvas>
      </div>

      {/* Right Panel */}
      <div className="w-80 flex flex-col border-l border-border overflow-y-auto bg-card">
        {/* Workflow */}
        <div className="border-b border-border">
          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Workflow
            </span>
          </div>
          <AIWorkflowPanel
            humanBoxes={humanBoxesForAI}
            stage={stage}
            onStageChange={setStage}
            aiRan={aiRan}
            onRunAI={onRunAI}
            showAIBoxes={showAIBoxes}
            onToggleAIBoxes={setShowAIBoxes}
            onOpenQAReport={onOpenQAReport}
          />
        </div>

        {/* Label selector */}
        <div className="p-4 border-b border-border" data-tutorial="label-grid">
          <div className="flex items-center gap-2 mb-3">
            <Tag size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Label Class
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {LABELS.map((label) => {
              const Icon = label.icon;
              const isActive = activeLabel.name === label.name;
              return (
                <button
                  key={label.name}
                  onClick={() => handleSetLabel(label)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border"
                  style={{
                    background: isActive ? label.color + "22" : "transparent",
                    borderColor: isActive ? label.color : "hsl(0, 0%, 13%)",
                    color: isActive ? label.color : "hsl(350, 20%, 80%)",
                  }}
                >
                  <Icon size={14} />
                  {label.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Annotations list */}
        <div className="p-4 border-b border-border" data-tutorial="annotations-list">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Annotations
            </span>
          </div>
          <div className="space-y-2">
            {bboxes.map((bbox) => (
              <div
                key={bbox.id}
                onClick={() => handleSelectBBox(bbox.id)}
                className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all border"
                style={{
                  background:
                    selectedId === bbox.id ? "hsl(0, 0%, 12%)" : "transparent",
                  borderColor:
                    selectedId === bbox.id
                      ? bbox.color + "66"
                      : "hsl(0, 0%, 13%)",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: bbox.color }}
                  />
                  <span className="text-sm text-foreground/90">
                    {bboxDisplayNames[bbox.id] || bbox.label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(bbox.id);
                    }}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    {bbox.visible ? (
                      <Eye size={12} className="text-muted-foreground" />
                    ) : (
                      <EyeOff size={12} className="text-muted-foreground/50" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBBox(bbox.id);
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
              <p className="text-xs text-muted-foreground text-center py-4">
                No annotations yet. Select a label and use the box tool.
              </p>
            )}
          </div>
        </div>

        {/* Selected bbox properties */}
        {selectedBBox && (
          <div className="p-4" data-tutorial="properties-panel">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Properties
            </span>
            <div className="mt-3 space-y-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Label</span>
                <span
                  style={{ color: selectedBBox.color }}
                  className="font-semibold"
                >
                  {selectedBBox.label}
                </span>
              </div>
              {(["X", "Y", "Z"] as const).map((dim, idx) => (
                <div key={dim}>
                  <div className="flex justify-between mb-1">
                    <span>Position {dim}</span>
                    <span className="text-foreground/80 font-mono">
                      {selectedBBox.position[idx].toFixed(1)}m
                    </span>
                  </div>
                  <Slider
                    min={-30}
                    max={30}
                    step={0.1}
                    value={[selectedBBox.position[idx]]}
                    onValueChange={(val) => {
                      handleSliderChange();
                      const newPos = [...selectedBBox.position] as [number, number, number];
                      newPos[idx] = val[0];
                      setBboxes((prev) =>
                        prev.map((b) =>
                          b.id === selectedBBox.id ? { ...b, position: newPos } : b
                        )
                      );
                    }}
                    className="[&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-muted [&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:border-primary [&_[data-radix-slider-thumb]]:bg-background"
                  />
                </div>
              ))}
              {(["Length", "Height", "Width"] as const).map((dim, idx) => (
                <div key={dim}>
                  <div className="flex justify-between mb-1">
                    <span>{dim}</span>
                    <span className="text-foreground/80 font-mono">
                      {selectedBBox.size[idx].toFixed(1)}m
                    </span>
                  </div>
                  <Slider
                    min={0.2}
                    max={12}
                    step={0.1}
                    value={[selectedBBox.size[idx]]}
                    onValueChange={(val) => {
                      handleSliderChange();
                      const newSize = [...selectedBBox.size] as [number, number, number];
                      newSize[idx] = val[0];
                      setBboxes((prev) =>
                        prev.map((b) =>
                          b.id === selectedBBox.id ? { ...b, size: newSize } : b
                        )
                      );
                    }}
                    className="[&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-muted [&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:border-primary [&_[data-radix-slider-thumb]]:bg-background"
                  />
                </div>
              ))}
              <div>
                <div className="flex justify-between mb-1">
                  <span>Rotation</span>
                  <span className="text-foreground/80 font-mono">
                    {((selectedBBox.rotation * 180) / Math.PI).toFixed(1)}°
                  </span>
                </div>
                <Slider
                  min={-180}
                  max={180}
                  step={1}
                  value={[Number(((selectedBBox.rotation * 180) / Math.PI).toFixed(1))]}
                  onValueChange={(val) => {
                    handleSliderChange();
                    setBboxes((prev) =>
                      prev.map((b) =>
                        b.id === selectedBBox.id
                          ? { ...b, rotation: (val[0] * Math.PI) / 180 }
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

// --- Tool Button ---
function ToolButton({
  icon,
  active,
  onClick,
  tooltip,
  dataTutorial,
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
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
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
