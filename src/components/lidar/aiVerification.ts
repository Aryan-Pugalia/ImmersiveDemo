// Predetermined AI-verified bounding boxes for the canonical scene.
// These are the "ground truth" the AI would have produced; the UI compares
// them against the annotator's boxes to compute IoU / confidence — no ML
// actually runs, they're just predetermined values tuned to the SCENE_OBJECTS
// layout in sceneBuilder.ts.
export interface AIBox {
  id: string;                              // stable id
  sceneRefId: string;                      // which SCENE_OBJECTS entry this corresponds to
  label: "Car" | "Pedestrian" | "Cyclist" | "Vegetation";
  position: [number, number, number];      // box center (world)
  size:     [number, number, number];      // length × height × width
  rotation: number;                        // around Y (radians)
  confidence: number;                      // 0..1, predetermined
}

export const AI_BOXES: AIBox[] = [
  {
    id: "ai-car-1",
    sceneRefId: "car-1",
    label: "Car",
    position: [6, 0.82, 3],
    size: [4.55, 1.65, 1.95],
    rotation: 0,
    confidence: 0.97,
  },
  {
    id: "ai-car-2",
    sceneRefId: "car-2",
    label: "Car",
    position: [-9, 0.95, -4],
    size: [4.7, 1.9, 2.0],
    rotation: 0.22,
    confidence: 0.93,
  },
  {
    id: "ai-car-3",
    sceneRefId: "car-3",
    label: "Car",
    position: [14, 0.82, 11],
    size: [4.5, 1.65, 1.95],
    rotation: Math.PI / 2,
    confidence: 0.91,
  },
  {
    id: "ai-ped-1",
    sceneRefId: "ped-1",
    label: "Pedestrian",
    position: [-2, 0.9, 8],
    size: [0.65, 1.8, 0.5],
    rotation: 0,
    confidence: 0.88,
  },
  {
    id: "ai-ped-2",
    sceneRefId: "ped-2",
    label: "Pedestrian",
    position: [3.5, 0.9, -9],
    size: [0.65, 1.8, 0.5],
    rotation: 1.2,
    confidence: 0.62, // intentionally low → routes to QA
  },
  {
    id: "ai-tree-1",
    sceneRefId: "tree-1",
    label: "Vegetation",
    position: [-15, 2.1, 10],
    size: [3.0, 4.2, 3.0],
    rotation: 0,
    confidence: 0.84,
  },
  {
    id: "ai-tree-2",
    sceneRefId: "tree-2",
    label: "Vegetation",
    position: [16, 2.1, -12],
    size: [3.0, 4.2, 3.0],
    rotation: 0,
    confidence: 0.79,
  },
];

// ─── IoU (axis-aligned 3D, ignoring rotation for demo simplicity) ───────────
export function iou3D(
  aPos: [number, number, number], aSize: [number, number, number],
  bPos: [number, number, number], bSize: [number, number, number]
): number {
  const aMin = [aPos[0] - aSize[0] / 2, aPos[1] - aSize[1] / 2, aPos[2] - aSize[2] / 2];
  const aMax = [aPos[0] + aSize[0] / 2, aPos[1] + aSize[1] / 2, aPos[2] + aSize[2] / 2];
  const bMin = [bPos[0] - bSize[0] / 2, bPos[1] - bSize[1] / 2, bPos[2] - bSize[2] / 2];
  const bMax = [bPos[0] + bSize[0] / 2, bPos[1] + bSize[1] / 2, bPos[2] + bSize[2] / 2];

  const ix = Math.max(0, Math.min(aMax[0], bMax[0]) - Math.max(aMin[0], bMin[0]));
  const iy = Math.max(0, Math.min(aMax[1], bMax[1]) - Math.max(aMin[1], bMin[1]));
  const iz = Math.max(0, Math.min(aMax[2], bMax[2]) - Math.max(aMin[2], bMin[2]));
  const inter = ix * iy * iz;

  const volA = aSize[0] * aSize[1] * aSize[2];
  const volB = bSize[0] * bSize[1] * bSize[2];
  const uni = volA + volB - inter;
  return uni > 0 ? inter / uni : 0;
}

export interface ComparisonRow {
  aiBox: AIBox;
  humanBoxId: string | null;
  humanLabel: string | null;
  iou: number;
  confidence: number;
  status: "match" | "low_iou" | "missed" | "low_conf";
}

export interface HumanBoxLite {
  id: string;
  label: string;
  position: [number, number, number];
  size: [number, number, number];
}

/**
 * Match every AI box to its best-overlapping human box; classify status.
 */
export function compareAnnotations(humanBoxes: HumanBoxLite[]): ComparisonRow[] {
  return AI_BOXES.map<ComparisonRow>((ai) => {
    let best: { box: HumanBoxLite; iou: number } | null = null;
    for (const hb of humanBoxes) {
      if (hb.label !== ai.label) continue;
      const i = iou3D(ai.position, ai.size, hb.position, hb.size);
      if (!best || i > best.iou) best = { box: hb, iou: i };
    }

    const iou = best?.iou ?? 0;
    let status: ComparisonRow["status"];
    if (!best || iou < 0.05) status = "missed";
    else if (iou < 0.50) status = "low_iou";
    else if (ai.confidence < 0.75) status = "low_conf";
    else status = "match";

    return {
      aiBox: ai,
      humanBoxId: best?.box.id ?? null,
      humanLabel: best?.box.label ?? null,
      iou,
      confidence: ai.confidence,
      status,
    };
  });
}
