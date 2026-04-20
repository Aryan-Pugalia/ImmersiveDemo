import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import { Canvas, useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid, Html, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
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
  Move,
  ZoomIn,
  ZoomOut,
  HelpCircle,
} from "lucide-react";

// --- Types ---
interface BBox3D {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  rotation: number;
  label: string;
  color: string;
  visible: boolean;
}

type ToolMode = "select" | "bbox" | "move";

const LABELS = [
  { name: "Car", color: "#22d3ee", icon: Car },
  { name: "Pedestrian", color: "#f472b6", icon: PersonStanding },
  { name: "Cyclist", color: "#a78bfa", icon: Bike },
  { name: "Vegetation", color: "#4ade80", icon: TreePine },
];

// --- Generate synthetic LiDAR point cloud ---
function generatePointCloud(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const rng = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  };
  const rand = rng(42);

  for (let i = 0; i < count * 0.4; i++) {
    const idx = i * 3;
    positions[idx] = (rand() - 0.5) * 60;
    positions[idx + 1] = (rand() - 0.5) * 0.15;
    positions[idx + 2] = (rand() - 0.5) * 60;
  }

  const carStart = Math.floor(count * 0.4);
  for (let i = 0; i < count * 0.08; i++) {
    const idx = (carStart + i) * 3;
    positions[idx] = 5 + (rand() - 0.5) * 4.5;
    positions[idx + 1] = rand() * 1.6;
    positions[idx + 2] = 3 + (rand() - 0.5) * 2;
  }

  const car2Start = Math.floor(count * 0.48);
  for (let i = 0; i < count * 0.07; i++) {
    const idx = (car2Start + i) * 3;
    positions[idx] = -8 + (rand() - 0.5) * 4;
    positions[idx + 1] = rand() * 1.5;
    positions[idx + 2] = -5 + (rand() - 0.5) * 2;
  }

  const pedStart = Math.floor(count * 0.55);
  for (let i = 0; i < count * 0.03; i++) {
    const idx = (pedStart + i) * 3;
    positions[idx] = -2 + (rand() - 0.5) * 0.6;
    positions[idx + 1] = rand() * 1.8;
    positions[idx + 2] = 8 + (rand() - 0.5) * 0.5;
  }

  const cycStart = Math.floor(count * 0.58);
  for (let i = 0; i < count * 0.03; i++) {
    const idx = (cycStart + i) * 3;
    positions[idx] = 12 + (rand() - 0.5) * 1.5;
    positions[idx + 1] = rand() * 1.7;
    positions[idx + 2] = -2 + (rand() - 0.5) * 0.8;
  }

  const treePositions = [
    [-15, 10],
    [15, -12],
    [-10, -15],
    [20, 8],
  ];
  let treeStart = Math.floor(count * 0.61);
  for (const [tx, tz] of treePositions) {
    for (let i = 0; i < count * 0.04; i++) {
      if (treeStart + i >= count) break;
      const idx = (treeStart + i) * 3;
      const r = rand() * 1.5;
      const a = rand() * Math.PI * 2;
      positions[idx] = tx + Math.cos(a) * r;
      positions[idx + 1] = rand() * 4;
      positions[idx + 2] = tz + Math.sin(a) * r;
    }
    treeStart += Math.floor(count * 0.04);
  }

  for (let i = treeStart; i < count; i++) {
    const idx = i * 3;
    positions[idx] = (rand() - 0.5) * 50;
    positions[idx + 1] = rand() * 0.5;
    positions[idx + 2] = (rand() - 0.5) * 50;
  }

  return positions;
}

function generateColors(positions: Float32Array): Float32Array {
  const count = positions.length / 3;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = positions[i * 3 + 1];
    const t = Math.min(y / 4, 1);
    colors[i * 3] = t * 0.8 + 0.1;
    colors[i * 3 + 1] = 0.6 + t * 0.4;
    colors[i * 3 + 2] = 1 - t * 0.7;
  }
  return colors;
}

function BoundingBox3D({
  bbox,
  selected,
  displayName,
  onClick,
}: {
  bbox: BBox3D;
  selected: boolean;
  displayName: string;
  onClick: () => void;
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
          opacity={selected ? 0.15 : 0.08}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry
          args={[new THREE.BoxGeometry(...bbox.size)]}
        />
        <lineBasicMaterial color={color} linewidth={2} />
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
            opacity: 0.9,
          }}
        >
          {displayName}
        </div>
      </Html>
    </group>
  );
}

function PointCloud({ positions, colors }: { positions: Float32Array; colors: Float32Array }) {
  const ref = useRef<THREE.Points>(null);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors sizeAttenuation />
    </points>
  );
}

function GroundPlane({
  onPlace,
  active,
}: {
  onPlace: (pos: [number, number, number]) => void;
  active: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh
      ref={meshRef}
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

const INITIAL_BBOXES: BBox3D[] = [
  {
    id: "car-1",
    position: [5, 0.8, 3],
    size: [4.5, 1.6, 2],
    rotation: 0,
    label: "Car",
    color: "#22d3ee",
    visible: true,
  },
  {
    id: "car-2",
    position: [-8, 0.75, -5],
    size: [4, 1.5, 2],
    rotation: 0.3,
    label: "Car",
    color: "#22d3ee",
    visible: true,
  },
  {
    id: "ped-1",
    position: [-2, 0.9, 8],
    size: [0.6, 1.8, 0.5],
    rotation: 0,
    label: "Pedestrian",
    color: "#f472b6",
    visible: true,
  },
];

export default function LidarAnnotation() {
  const navigate = useNavigate();
  const [bboxes, setBboxes] = useState<BBox3D[]>(INITIAL_BBOXES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>("select");
  const [activeLabel, setActiveLabel] = useState(LABELS[0]);
  const [showPoints, setShowPoints] = useState(true);

  // Tutorial always starts on page load
  const [tutorialStep, setTutorialStep] = useState<number | null>(0);

  const pointData = useMemo(() => {
    const positions = generatePointCloud(12000);
    const colors = generateColors(positions);
    return { positions, colors };
  }, []);

  useEffect(() => {
    if (tutorialStep === null) return;

    const stepId = TUTORIAL_STEPS[tutorialStep]?.id;

    if (stepId === "place-box" && tool !== "bbox") {
      setTool("bbox");
    }

    if (stepId === "edit-properties" && !selectedId && bboxes.length > 0) {
      setSelectedId(bboxes[0].id);
    }
  }, [tutorialStep, tool, selectedId, bboxes]);

  const advanceTutorial = useCallback(() => {
    setTutorialStep((prev) => {
      if (prev === null) return null;
      if (prev >= TUTORIAL_STEPS.length - 1) {
        // Last step done — just dismiss
        return null;
      }
      return prev + 1;
    });
  }, []);

  const skipTutorial = useCallback(() => {
    setTutorialStep(null);
  }, []);

  const restartTutorial = useCallback(() => {
    setBboxes(INITIAL_BBOXES);
    setSelectedId(null);
    setTool("select");
    setTutorialStep(0);
  }, []);

  // Tutorial step: "select-tool" — advance when user clicks select
  const handleSetTool = useCallback(
    (newTool: ToolMode) => {
      setTool(newTool);
      if (tutorialStep !== null) {
        const stepId = TUTORIAL_STEPS[tutorialStep]?.id;
        if (stepId === "select-tool" && newTool === "select") {
          advanceTutorial();
        } else if (stepId === "bbox-tool" && newTool === "bbox") {
          advanceTutorial();
        }
      }
    },
    [tutorialStep, advanceTutorial]
  );

  // Tutorial step: "label-class" — advance when user clicks a label
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
      };
      setBboxes((prev) => [...prev, newBox]);
      setSelectedId(newBox.id);
      setTool("select");

      // Advance tutorial on box placement
      if (tutorialStep !== null && TUTORIAL_STEPS[tutorialStep]?.id === "place-box") {
        advanceTutorial();
      }
    },
    [activeLabel, tutorialStep, advanceTutorial]
  );

  // Tutorial step: "select-box" — advance when user selects an annotation
  const handleSelectBBox = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (tutorialStep !== null && TUTORIAL_STEPS[tutorialStep]?.id === "select-box") {
        advanceTutorial();
      }
    },
    [tutorialStep, advanceTutorial]
  );

  // Track slider interaction for tutorial
  const sliderInteracted = useRef(false);
  const handleSliderChange = useCallback(() => {
    if (!sliderInteracted.current && tutorialStep !== null && TUTORIAL_STEPS[tutorialStep]?.id === "edit-properties") {
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

  // Compute display names with numbering for duplicate labels
  const bboxDisplayNames = useMemo(() => {
    const labelCounts: Record<string, number> = {};
    bboxes.forEach((b) => {
      labelCounts[b.label] = (labelCounts[b.label] || 0) + 1;
    });
    const labelIndexes: Record<string, number> = {};
    const names: Record<string, string> = {};
    bboxes.forEach((b) => {
      labelIndexes[b.label] = (labelIndexes[b.label] || 0) + 1;
      names[b.id] = labelCounts[b.label] > 1
        ? `${b.label} ${labelIndexes[b.label]}`
        : b.label;
    });
    return names;
  }, [bboxes]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Tutorial overlay */}
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
            <span className="text-foreground/80 text-sm">
              LiDAR 3D Annotation
            </span>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground text-xs">
              scene_0042.pcd
            </span>
          </div>
          <div className="flex items-center gap-2">
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
              12,194 pts
            </Badge>
          </div>
        </div>

        {/* Tool hint */}
        {tool === "bbox" && (
          <div
            className="absolute top-14 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: activeLabel.color,
              color: "#000",
            }}
          >
            Click on ground to place {activeLabel.name} bounding box
          </div>
        )}

        <Canvas
          style={{ background: "hsl(0, 0%, 7.5%)" }}
          gl={{ antialias: true }}
        >
          <PerspectiveCamera makeDefault position={[15, 12, 20]} fov={50} />
          <OrbitControls
            enableDamping
            dampingFactor={0.1}
            maxPolarAngle={Math.PI / 2.1}
          />
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

          {showPoints && (
            <PointCloud
              positions={pointData.positions}
              colors={pointData.colors}
            />
          )}

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

          <GroundPlane onPlace={addBBox} active={tool === "bbox"} />

          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
          </mesh>
        </Canvas>
      </div>

      {/* Right Panel */}
      <div className="w-72 flex flex-col border-l border-border overflow-y-auto bg-card">
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
        <div className="p-4 flex-1" data-tutorial="annotations-list">
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
                    selectedId === bbox.id ? bbox.color + "66" : "hsl(0, 0%, 13%)",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: bbox.color }}
                  />
                  <span className="text-sm text-foreground/90">{bboxDisplayNames[bbox.id] || bbox.label}</span>
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
                    <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
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
          <div className="p-4 border-t border-border" data-tutorial="properties-panel">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Properties
            </span>
            <div className="mt-3 space-y-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Label</span>
                <span style={{ color: selectedBBox.color }} className="font-semibold">
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
