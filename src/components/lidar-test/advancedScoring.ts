/**
 * Advanced annotation-vs-ground-truth scoring for the LiDAR (Test) use case.
 *
 * The scorer runs entirely in the browser and combines several metrics that
 * are standard in KITTI-style 3-D object detection benchmarks:
 *
 *   1. Rotated bird's-eye-view (BEV) IoU      — Sutherland–Hodgman clipping
 *   2. 3-D IoU (BEV-IoU weighted by height overlap)
 *   3. Optimal GT ↔ prediction assignment    — Hungarian algorithm
 *   4. Class accuracy, localisation error (centre distance) and heading error
 *   5. Composite "annotation quality" score (0–100) with transparent weights
 *
 * Nothing about this is faked: each number is actually computed from the user's
 * boxes and the file-loaded KITTI ground truth.
 */

import type { GTObjectVelo, KittiClass } from "./kittiParser";

export interface PredBoxVelo {
  id: string;
  label: string;
  /** Centre in Velodyne frame. */
  center: [number, number, number];
  /** length, width, height. */
  size: [number, number, number];
  /** Yaw around Velodyne Z (radians). */
  yaw: number;
}

export interface MatchRow {
  gt: GTObjectVelo | null;
  pred: PredBoxVelo | null;
  bevIoU: number;
  iou3D: number;
  centerDistance: number;   // metres, XY only
  headingError: number;     // radians in [0, π/2]
  labelMatch: boolean;
  status: "true_positive" | "false_positive" | "false_negative" | "wrong_class";
}

export interface ScoreReport {
  rows: MatchRow[];
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  wrongClass: number;
  precision: number;
  recall: number;
  f1: number;
  meanBevIoU: number;
  meanIoU3D: number;
  meanCenterError: number;  // metres, over true positives
  meanHeadingError: number; // degrees, over true positives
  /** 0..100 composite. */
  score: number;
  /** Human-readable grade: S / A / B / C / D. */
  grade: "S" | "A" | "B" | "C" | "D";
}

// ────────────────────────────────────────────────────────────────────────────
//  Geometry: rotated rectangle intersection (BEV plane = Velodyne X/Y)
// ────────────────────────────────────────────────────────────────────────────

type V2 = [number, number];

function boxCornersBEV(box: { center: [number, number, number]; size: [number, number, number]; yaw: number }): V2[] {
  const [cx, cy] = box.center;
  const l = box.size[0] / 2;
  const w = box.size[1] / 2;
  const cos = Math.cos(box.yaw);
  const sin = Math.sin(box.yaw);
  // Local corners: (+l,+w), (+l,-w), (-l,-w), (-l,+w) — CCW when yaw=0.
  const local: V2[] = [
    [ l,  w],
    [ l, -w],
    [-l, -w],
    [-l,  w],
  ];
  return local.map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
}

function polygonArea(poly: V2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Sutherland–Hodgman clipping. Both polygons must be convex and CCW-ish. */
function polygonClip(subject: V2[], clip: V2[]): V2[] {
  let output = subject.slice();
  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) break;
    const input = output;
    output = [];
    const A = clip[i];
    const B = clip[(i + 1) % clip.length];
    const edge: V2 = [B[0] - A[0], B[1] - A[1]];
    const inside = (p: V2) =>
      edge[0] * (p[1] - A[1]) - edge[1] * (p[0] - A[0]) >= 0;
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) output.push(intersect(prev, cur, A, B));
        output.push(cur);
      } else if (inside(prev)) {
        output.push(intersect(prev, cur, A, B));
      }
    }
  }
  return output;
}

function intersect(p1: V2, p2: V2, p3: V2, p4: V2): V2 {
  const x1 = p1[0], y1 = p1[1];
  const x2 = p2[0], y2 = p2[1];
  const x3 = p3[0], y3 = p3[1];
  const x4 = p4[0], y4 = p4[1];
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-12) return p2;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

/** Ensure CCW polygon (positive signed area). */
function ccw(poly: V2[]): V2[] {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return s < 0 ? poly.slice().reverse() : poly;
}

function bevIoU(
  a: { center: [number, number, number]; size: [number, number, number]; yaw: number },
  b: { center: [number, number, number]; size: [number, number, number]; yaw: number }
): number {
  const A = ccw(boxCornersBEV(a));
  const B = ccw(boxCornersBEV(b));
  const inter = polygonArea(polygonClip(A, B));
  const areaA = a.size[0] * a.size[1];
  const areaB = b.size[0] * b.size[1];
  const uni = areaA + areaB - inter;
  return uni > 0 ? inter / uni : 0;
}

function heightOverlap(
  a: { center: [number, number, number]; size: [number, number, number] },
  b: { center: [number, number, number]; size: [number, number, number] }
): number {
  const a1 = a.center[2] - a.size[2] / 2;
  const a2 = a.center[2] + a.size[2] / 2;
  const b1 = b.center[2] - b.size[2] / 2;
  const b2 = b.center[2] + b.size[2] / 2;
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

function iou3D(
  a: { center: [number, number, number]; size: [number, number, number]; yaw: number },
  b: { center: [number, number, number]; size: [number, number, number]; yaw: number }
): number {
  const bev = bevIoU(a, b);
  if (bev <= 0) return 0;
  const areaA = a.size[0] * a.size[1];
  const areaB = b.size[0] * b.size[1];
  const bevInter = (bev * (areaA + areaB)) / (1 + bev);
  const hOv = heightOverlap(a, b);
  const inter = bevInter * hOv;
  const volA = a.size[0] * a.size[1] * a.size[2];
  const volB = b.size[0] * b.size[1] * b.size[2];
  const uni = volA + volB - inter;
  return uni > 0 ? Math.max(0, Math.min(1, inter / uni)) : 0;
}

// ────────────────────────────────────────────────────────────────────────────
//  Hungarian assignment (square cost matrix, O(n³))
// ────────────────────────────────────────────────────────────────────────────

function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  if (n === 0) return [];
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const result = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j] !== 0) result[p[j] - 1] = j - 1;
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
//  Public scorer
// ────────────────────────────────────────────────────────────────────────────

function normaliseLabel(raw: string): KittiClass {
  // Our UI uses "Vegetation"; KITTI doesn't. Otherwise names line up, except
  // we fold Van/Truck into Car so the demo stays merciful.
  if (raw === "Car" || raw === "Van" || raw === "Truck") return "Car";
  if (raw === "Pedestrian" || raw === "Person_sitting") return "Pedestrian";
  if (raw === "Cyclist") return "Cyclist";
  return raw as KittiClass;
}

const IOU_MATCH_THRESHOLD = 0.25; // 3-D IoU over which a prediction counts

/**
 * Match predicted boxes to ground-truth boxes using Hungarian assignment on
 * a 3-D IoU cost matrix, then produce detailed per-row metrics and an overall
 * 0–100 score with a letter grade.
 */
export function scoreAnnotations(
  preds: PredBoxVelo[],
  gts: GTObjectVelo[]
): ScoreReport {
  const n = Math.max(preds.length, gts.length);

  // Build cost matrix: negative IoU so that minimisation maximises IoU.
  // Heavy penalty if labels mismatch so Hungarian prefers same-class pairs.
  const LARGE = 1e6;
  const cost: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      const pred = preds[i];
      const gt = gts[j];
      if (!pred || !gt) {
        row.push(0); // padding — assignment is free
        continue;
      }
      const labelsSame = normaliseLabel(pred.label) === normaliseLabel(gt.label);
      const iou = iou3D(pred, gt);
      row.push((labelsSame ? 0 : LARGE) - iou);
    }
    cost.push(row);
  }

  const assign = hungarian(cost);
  const rows: MatchRow[] = [];

  const gtTaken = new Set<number>();
  const predTaken = new Set<number>();

  for (let i = 0; i < n; i++) {
    const j = assign[i];
    const pred = preds[i];
    const gt = j >= 0 ? gts[j] : undefined;
    if (!pred || !gt) continue;

    const iou = iou3D(pred, gt);
    const bev = bevIoU(pred, gt);
    const labelsSame = normaliseLabel(pred.label) === normaliseLabel(gt.label);
    const dx = pred.center[0] - gt.center[0];
    const dy = pred.center[1] - gt.center[1];
    const centerDistance = Math.sqrt(dx * dx + dy * dy);
    const rawHeading = Math.abs(((pred.yaw - gt.yaw + Math.PI) % (2 * Math.PI)) - Math.PI);
    const headingError = Math.min(rawHeading, Math.PI - rawHeading); // cars are symmetric

    let status: MatchRow["status"];
    if (!labelsSame) status = "wrong_class";
    else if (iou >= IOU_MATCH_THRESHOLD) status = "true_positive";
    else status = "false_positive"; // pred exists but doesn't fit any GT well

    if (status === "true_positive" || status === "wrong_class") {
      gtTaken.add(j);
    }
    predTaken.add(i);

    rows.push({
      gt, pred, bevIoU: bev, iou3D: iou, centerDistance,
      headingError, labelMatch: labelsSame, status,
    });
  }

  // Unmatched predictions → false positives
  preds.forEach((pred, i) => {
    if (predTaken.has(i)) return;
    rows.push({
      gt: null, pred, bevIoU: 0, iou3D: 0, centerDistance: NaN,
      headingError: NaN, labelMatch: false, status: "false_positive",
    });
  });

  // Unmatched ground truth → false negatives (missed)
  gts.forEach((gt, j) => {
    if (gtTaken.has(j)) return;
    rows.push({
      gt, pred: null, bevIoU: 0, iou3D: 0, centerDistance: NaN,
      headingError: NaN, labelMatch: false, status: "false_negative",
    });
  });

  // Aggregate
  const truePositives = rows.filter((r) => r.status === "true_positive").length;
  const falsePositives = rows.filter((r) => r.status === "false_positive").length;
  const falseNegatives = rows.filter((r) => r.status === "false_negative").length;
  const wrongClass = rows.filter((r) => r.status === "wrong_class").length;

  const precisionDen = truePositives + falsePositives + wrongClass;
  const recallDen = truePositives + falseNegatives + wrongClass;
  const precision = precisionDen > 0 ? truePositives / precisionDen : 0;
  const recall = recallDen > 0 ? truePositives / recallDen : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const tpRows = rows.filter((r) => r.status === "true_positive");
  const meanBevIoU = tpRows.length ? tpRows.reduce((a, r) => a + r.bevIoU, 0) / tpRows.length : 0;
  const meanIoU3D = tpRows.length ? tpRows.reduce((a, r) => a + r.iou3D, 0) / tpRows.length : 0;
  const meanCenterError = tpRows.length
    ? tpRows.reduce((a, r) => a + r.centerDistance, 0) / tpRows.length
    : 0;
  const meanHeadingError = tpRows.length
    ? ((tpRows.reduce((a, r) => a + r.headingError, 0) / tpRows.length) * 180) / Math.PI
    : 0;

  // Composite score: transparent weighted combination.
  //   - F1 (detection quality)          50 pts
  //   - 3-D IoU on matches              25 pts
  //   - Localisation (decays at 1m)     15 pts
  //   - Heading (decays at 30°)         10 pts
  const locPart = tpRows.length ? Math.exp(-meanCenterError) : 0;        // 1 at 0 m, ~0.37 at 1 m
  const headPart = tpRows.length ? Math.exp(-meanHeadingError / 30) : 0; // 1 at 0°, ~0.37 at 30°
  const score = Math.round(
    f1 * 50 + meanIoU3D * 25 + locPart * 15 + headPart * 10
  );

  const grade: ScoreReport["grade"] =
    score >= 90 ? "S" :
    score >= 75 ? "A" :
    score >= 60 ? "B" :
    score >= 40 ? "C" : "D";

  return {
    rows,
    truePositives, falsePositives, falseNegatives, wrongClass,
    precision, recall, f1,
    meanBevIoU, meanIoU3D, meanCenterError, meanHeadingError,
    score, grade,
  };
}
