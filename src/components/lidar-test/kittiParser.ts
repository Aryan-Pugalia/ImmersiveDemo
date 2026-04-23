/**
 * KITTI-format parser for the LiDAR Annotation (Test) use case.
 *
 * This module loads real-world LiDAR data from /public/lidar-sample/:
 *   - velodyne.bin : dense point cloud (Float32 quadruples: x, y, z, intensity)
 *   - label.txt    : ground-truth objects in KITTI camera-rect frame
 *   - calib.txt    : intrinsics + velo->cam / cam->rect extrinsics
 *
 * All geometry is finally expressed in the Velodyne frame (x=forward, y=left,
 * z=up). The React/three.js scene then maps Velodyne → three.js axes in one
 * place (see toThreeCoords) so downstream code can forget about the gymnastics.
 */

export interface PointCloud {
  /** Flat Float32Array [x0,y0,z0, x1,y1,z1, ...] in Velodyne frame. */
  positions: Float32Array;
  /** Parallel Float32Array of intensities in 0..1. */
  intensity: Float32Array;
  /** Number of points. */
  count: number;
}

export interface CalibMatrices {
  /** 3x3 rectification matrix (row-major). */
  R0_rect: number[];
  /** 3x4 velo→cam matrix (row-major, 12 numbers). */
  Tr_velo_to_cam: number[];
}

export type KittiClass =
  | "Car"
  | "Van"
  | "Truck"
  | "Pedestrian"
  | "Person_sitting"
  | "Cyclist"
  | "Tram"
  | "Misc"
  | "DontCare";

export interface KittiLabel {
  /** Original class from the label file. */
  type: KittiClass;
  /** 0..1 — how truncated the object is. */
  truncated: number;
  /** 0=visible, 1=partly, 2=largely, 3=unknown. */
  occluded: number;
  /** Observation angle (camera frame). */
  alpha: number;
  /** 2-D bbox in the image plane: [x1, y1, x2, y2]. */
  bbox2D: [number, number, number, number];
  /** Physical dimensions (metres): height, width, length. */
  dimensions: { h: number; w: number; l: number };
  /** Location of the bottom-centre of the object in *camera-rect* frame. */
  locationCam: [number, number, number];
  /** Rotation around camera Y axis (radians). */
  rotation_y: number;
}

/** Ground-truth object, already transformed into the Velodyne frame. */
export interface GTObjectVelo {
  id: string;
  label: KittiClass;
  /** Box centre (Velodyne frame, metres). */
  center: [number, number, number];
  /** length (along heading), width (across), height (up) in metres. */
  size: [number, number, number];
  /** Yaw around Velodyne Z axis, radians. 0 = heading along +x. */
  yaw: number;
  bbox2D: [number, number, number, number];
  occluded: number;
  truncated: number;
}

// ────────────────────────────────────────────────────────────────────────────
//  .bin point cloud
// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse a KITTI Velodyne .bin file (little-endian Float32, 4 floats per point).
 * Optionally decimate (step) to keep browser WebGL happy on lower-end machines.
 */
export function parseVelodyneBin(
  buffer: ArrayBuffer,
  step: number = 1
): PointCloud {
  const f = new Float32Array(buffer);
  const totalPoints = Math.floor(f.length / 4);
  const kept = Math.ceil(totalPoints / step);
  const positions = new Float32Array(kept * 3);
  const intensity = new Float32Array(kept);

  let j = 0;
  for (let i = 0; i < totalPoints; i += step) {
    const base = i * 4;
    positions[j * 3 + 0] = f[base + 0]; // x (forward)
    positions[j * 3 + 1] = f[base + 1]; // y (left)
    positions[j * 3 + 2] = f[base + 2]; // z (up)
    intensity[j] = f[base + 3];
    j++;
  }
  return { positions, intensity, count: j };
}

// ────────────────────────────────────────────────────────────────────────────
//  calib.txt
// ────────────────────────────────────────────────────────────────────────────

function parseNumberRow(line: string, key: string): number[] | null {
  const prefix = key + ":";
  if (!line.startsWith(prefix)) return null;
  return line
    .slice(prefix.length)
    .trim()
    .split(/\s+/)
    .map((s) => parseFloat(s))
    .filter((x) => !Number.isNaN(x));
}

export function parseCalib(text: string): CalibMatrices {
  const lines = text.split(/\r?\n/).filter(Boolean);
  let R0_rect: number[] | null = null;
  let Tr: number[] | null = null;
  for (const ln of lines) {
    R0_rect = R0_rect ?? parseNumberRow(ln, "R0_rect");
    Tr = Tr ?? parseNumberRow(ln, "Tr_velo_to_cam");
  }
  return {
    R0_rect: R0_rect ?? [1, 0, 0, 0, 1, 0, 0, 0, 1],
    Tr_velo_to_cam: Tr ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  Linear algebra helpers (small, readable, no deps)
// ────────────────────────────────────────────────────────────────────────────

function mat3Invert(m: number[]): number[] {
  // row-major 3x3
  const [a, b, c, d, e, f, g, h, i] = m;
  const A =  e * i - f * h;
  const B = -(d * i - f * g);
  const C =  d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const inv = 1 / det;
  return [
    A * inv, -(b * i - c * h) * inv,  (b * f - c * e) * inv,
    B * inv,  (a * i - c * g) * inv, -(a * f - c * d) * inv,
    C * inv, -(a * h - b * g) * inv,  (a * e - b * d) * inv,
  ];
}

function mat3MulVec(m: number[], v: [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Invert a 3x4 [R | t] rigid-ish transform. Assumes R is well-conditioned. */
function invertRt(Rt: number[]): { Rinv: number[]; tinv: [number, number, number] } {
  const R = [Rt[0], Rt[1], Rt[2], Rt[4], Rt[5], Rt[6], Rt[8], Rt[9], Rt[10]];
  const t: [number, number, number] = [Rt[3], Rt[7], Rt[11]];
  const Rinv = mat3Invert(R);
  const neg = mat3MulVec(Rinv, t);
  return { Rinv, tinv: [-neg[0], -neg[1], -neg[2]] };
}

// ────────────────────────────────────────────────────────────────────────────
//  label.txt
// ────────────────────────────────────────────────────────────────────────────

export function parseLabelTxt(text: string): KittiLabel[] {
  const out: KittiLabel[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const p = line.split(/\s+/);
    if (p.length < 15) continue;
    out.push({
      type: p[0] as KittiClass,
      truncated: parseFloat(p[1]),
      occluded: parseInt(p[2], 10),
      alpha: parseFloat(p[3]),
      bbox2D: [parseFloat(p[4]), parseFloat(p[5]), parseFloat(p[6]), parseFloat(p[7])],
      dimensions: {
        h: parseFloat(p[8]),
        w: parseFloat(p[9]),
        l: parseFloat(p[10]),
      },
      locationCam: [parseFloat(p[11]), parseFloat(p[12]), parseFloat(p[13])],
      rotation_y: parseFloat(p[14]),
    });
  }
  return out;
}

/**
 * Transform a KITTI label (camera-rect frame) into a Velodyne-frame ground
 * truth object, with centre (not bottom) and yaw-around-Z.
 */
export function labelToVelodyne(
  label: KittiLabel,
  calib: CalibMatrices,
  index: number
): GTObjectVelo {
  // p_cam_rect = R0_rect @ (Tr_velo_to_cam @ [p_velo; 1])
  // ⇒ p_velo = Tr^{-1} @ R0^{-1} @ p_cam_rect
  const R0inv = mat3Invert(calib.R0_rect);
  const { Rinv, tinv } = invertRt(calib.Tr_velo_to_cam);

  // KITTI's location is the *bottom* centre of the object in cam-rect.
  // Box centre in cam-rect: subtract h/2 on camera-Y (which points DOWN).
  const cx = label.locationCam[0];
  const cy = label.locationCam[1] - label.dimensions.h / 2;
  const cz = label.locationCam[2];

  const p_unrect = mat3MulVec(R0inv, [cx, cy, cz]);
  const p_velo_raw = mat3MulVec(Rinv, p_unrect);
  const p_velo: [number, number, number] = [
    p_velo_raw[0] + tinv[0],
    p_velo_raw[1] + tinv[1],
    p_velo_raw[2] + tinv[2],
  ];

  // rotation_y is around the camera Y axis (pointing down). In velodyne the
  // heading sits around Z (up). Standard KITTI convention: yaw = -rot_y - π/2.
  const yaw = -label.rotation_y - Math.PI / 2;

  return {
    id: `gt-${index}`,
    label: label.type,
    center: p_velo,
    size: [label.dimensions.l, label.dimensions.w, label.dimensions.h],
    yaw,
    bbox2D: label.bbox2D,
    occluded: label.occluded,
    truncated: label.truncated,
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  Fetch helpers for the bundled sample
// ────────────────────────────────────────────────────────────────────────────

const SAMPLE_BASE = "/lidar-sample";

export async function loadRealSample(step: number = 2): Promise<{
  cloud: PointCloud;
  labels: KittiLabel[];
  gt: GTObjectVelo[];
  imageUrl: string;
}> {
  const [binRes, labelRes, calibRes] = await Promise.all([
    fetch(`${SAMPLE_BASE}/velodyne.bin`),
    fetch(`${SAMPLE_BASE}/label.txt`),
    fetch(`${SAMPLE_BASE}/calib.txt`),
  ]);
  if (!binRes.ok) throw new Error("velodyne.bin missing");
  if (!labelRes.ok) throw new Error("label.txt missing");
  if (!calibRes.ok) throw new Error("calib.txt missing");

  const [binBuf, labelText, calibText] = await Promise.all([
    binRes.arrayBuffer(),
    labelRes.text(),
    calibRes.text(),
  ]);

  const cloud = parseVelodyneBin(binBuf, step);
  const labels = parseLabelTxt(labelText);
  const calib = parseCalib(calibText);
  const gt = labels
    .filter((l) => l.type !== "DontCare")
    .map((l, i) => labelToVelodyne(l, calib, i));

  return { cloud, labels, gt, imageUrl: `${SAMPLE_BASE}/image.png` };
}

// ────────────────────────────────────────────────────────────────────────────
//  Frame mapping helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Velodyne (x=fwd, y=left, z=up) → three.js (x=right, y=up, z=back).
 * We use:   three = ( -velo.y,  velo.z,  -velo.x ).
 */
export function toThree(v: [number, number, number]): [number, number, number] {
  return [-v[1], v[2], -v[0]];
}

/**
 * Same rotation mapping: a yaw around Velodyne Z becomes a yaw around three.js Y.
 * Sign is negated because the chirality of the axis mapping flips handedness.
 */
export function yawVeloToThree(yaw: number): number {
  return -yaw;
}
