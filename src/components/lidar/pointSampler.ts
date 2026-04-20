import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { SCENE_OBJECTS, SceneObject, SceneObjectType, buildSceneObject } from "./sceneBuilder";

// ─── Density per type (points per object) ──────────────────────────────────
// Road is handled separately via a concentric-ring generator — not sampled.
const DENSITY: Record<SceneObjectType, number> = {
  road:           0,     // handled by generateGroundRings()
  building:    5800,
  car:         3600,
  tree:        1600,
  pedestrian:   500,
  sign:         220,
};

// Sensor model — Velodyne-ish 32-beam puck at ~1.75 m above ground
const SENSOR = {
  height:       1.75,
  minBeamDeg:   1.2,     // degrees below horizontal — near edge of laser skirt
  maxBeamDeg:  26.0,     // steep, hits ground close to sensor
  beams:         42,
  maxRadius:     55,     // points further than this fade away (atmospheric / range limit)
};

export interface ScenePointCloud {
  positions: Float32Array;
  colors:    Float32Array;
  labels:    Uint8Array;   // per-point object index (255 = ground/ring)
}

// ─── RNG + noise ───────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rand: () => number): number {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── LiDAR warm color ramp (orange → red by distance) ──────────────────────
function warmColor(distance: number, out: [number, number, number]) {
  const t = Math.min(1, distance / 45);
  // Close: bright yellow-orange.  Mid: orange.  Far: deep red.
  const r = 1.0;
  const g = 0.70 - t * 0.55;    // 0.70 → 0.15
  const b = 0.08 - t * 0.06;    // 0.08 → 0.02
  out[0] = r; out[1] = Math.max(0.05, g); out[2] = Math.max(0.01, b);
}

// Ground-truth AABB footprints used for ring occlusion
interface Footprint {
  minX: number; maxX: number; minZ: number; maxZ: number;
}
function objectFootprints(): Footprint[] {
  // Approximate ground footprints so ring points stop inside objects (casts shadow)
  const pads: Partial<Record<SceneObjectType, [number, number]>> = {
    car: [2.3, 1.1],
    pedestrian: [0.35, 0.35],
    tree: [1.6, 1.6],
    building: [0, 0],   // taken from size
    sign: [0.25, 0.25],
  };

  const fps: Footprint[] = [];
  for (const obj of SCENE_OBJECTS) {
    if (obj.type === "road") continue;
    const [px, , pz] = obj.position;

    let hx: number, hz: number;
    if (obj.type === "building" && obj.size) {
      hx = obj.size[0] / 2 + 0.2;
      hz = obj.size[2] / 2 + 0.2;
    } else {
      const p = pads[obj.type] ?? [1, 1];
      hx = p[0]; hz = p[1];
    }
    fps.push({ minX: px - hx, maxX: px + hx, minZ: pz - hz, maxZ: pz + hz });
  }
  // Ego vehicle footprint (at origin)
  fps.push({ minX: -1.2, maxX: 1.2, minZ: -2.4, maxZ: 2.4 });
  return fps;
}

function insideAnyFootprint(x: number, z: number, fps: Footprint[]): boolean {
  for (const f of fps) {
    if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) return true;
  }
  return false;
}

// ─── Concentric ground rings (the classic LiDAR look) ──────────────────────
function pushGroundRings(
  positions: number[],
  colors:    number[],
  labels:    number[],
  rand:      () => number,
  footprints: Footprint[],
) {
  const rgb: [number, number, number] = [0, 0, 0];

  for (let b = 0; b < SENSOR.beams; b++) {
    // Each beam has a fixed angle below horizontal → hits ground at a fixed radius
    const t = b / (SENSOR.beams - 1);
    // Non-linear distribution so rings cluster near the sensor (like real beams)
    const k = Math.pow(1 - t, 1.6);
    const deg = SENSOR.minBeamDeg + (1 - k) * (SENSOR.maxBeamDeg - SENSOR.minBeamDeg);
    const r = SENSOR.height / Math.tan((deg * Math.PI) / 180);
    if (r > SENSOR.maxRadius) continue;

    // Angular resolution: more points for big rings (longer circumference)
    const circ = 2 * Math.PI * r;
    const stepDeg = 0.35;                       // horizontal angular resolution
    const n = Math.max(120, Math.floor((360 / stepDeg)));
    const jitterR = 0.06 + r * 0.006;           // range noise grows with distance
    const jitterY = 0.012;

    for (let i = 0; i < n; i++) {
      const theta = (i / n) * Math.PI * 2 + b * 0.018;
      const rr = r + gauss(rand) * jitterR;
      const x = Math.cos(theta) * rr;
      const z = Math.sin(theta) * rr;

      // Occlude inside object footprints (creates shadows behind objects)
      if (insideAnyFootprint(x, z, footprints)) continue;

      // Small inner dead-zone beneath the sensor
      if (Math.hypot(x, z) < 1.6) continue;

      const y = 0.02 + gauss(rand) * jitterY;
      warmColor(Math.hypot(x, z), rgb);

      // Slight per-point brightness variation
      const bv = 0.85 + rand() * 0.3;
      positions.push(x, y, z);
      colors.push(
        Math.min(1, rgb[0] * bv),
        Math.min(1, rgb[1] * bv),
        Math.min(1, rgb[2] * bv),
      );
      labels.push(255);
    }
  }
}

/**
 * Build each scene object into a THREE.Group, sample points from every mesh,
 * then overlay the concentric ground ring pattern. Final result: warm-orange
 * LiDAR-style point cloud with visible scan rings and object shadows.
 */
export function generateScenePointCloud(): ScenePointCloud {
  const rand = mulberry32(20260421);
  const footprints = objectFootprints();

  const positions: number[] = [];
  const colors:    number[] = [];
  const labels:    number[] = [];

  // 1) Concentric ground rings first (so objects render on top)
  pushGroundRings(positions, colors, labels, rand, footprints);

  // 2) Sample each non-road scene object
  const tmpPos    = new THREE.Vector3();
  const tmpNormal = new THREE.Vector3();
  const worldPos  = new THREE.Vector3();
  const rgb: [number, number, number] = [0, 0, 0];

  SCENE_OBJECTS.forEach((obj: SceneObject, objIdx: number) => {
    if (obj.type === "road") return;

    const group = buildSceneObject(obj);
    group.updateMatrixWorld(true);

    const meshes: THREE.Mesh[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
    });
    if (meshes.length === 0) return;

    const totalForObj = DENSITY[obj.type] ?? 1000;
    const areas = meshes.map(estimateMeshArea);
    const areaSum = areas.reduce((a, b) => a + b, 0) || 1;

    meshes.forEach((mesh, mi) => {
      const share = Math.max(5, Math.floor(totalForObj * (areas[mi] / areaSum)));
      const sampler = new MeshSurfaceSampler(mesh).build();

      for (let i = 0; i < share; i++) {
        sampler.sample(tmpPos, tmpNormal);
        worldPos.copy(tmpPos).applyMatrix4(mesh.matrixWorld);

        const dist = Math.hypot(worldPos.x, worldPos.z);
        if (dist > SENSOR.maxRadius) continue;

        const sigma = 0.015 + dist * 0.0018;
        worldPos.x += gauss(rand) * sigma;
        worldPos.y += gauss(rand) * sigma * 0.7;
        worldPos.z += gauss(rand) * sigma;

        warmColor(dist + worldPos.y * 0.15, rgb);
        // Pedestrians/trees get a touch of yellow boost for visibility
        if (obj.type === "pedestrian" || obj.type === "sign") {
          rgb[1] = Math.min(1, rgb[1] + 0.25);
        }
        const bv = 0.9 + rand() * 0.25;

        positions.push(worldPos.x, worldPos.y, worldPos.z);
        colors.push(
          Math.min(1, rgb[0] * bv),
          Math.min(1, rgb[1] * bv),
          Math.min(1, rgb[2] * bv),
        );
        labels.push(objIdx);
      }
    });

    // Dispose — sampling is one-shot
    group.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      }
    });
  });

  return {
    positions: new Float32Array(positions),
    colors:    new Float32Array(colors),
    labels:    new Uint8Array(labels),
  };
}

function estimateMeshArea(mesh: THREE.Mesh): number {
  const geom = mesh.geometry;
  if (!geom) return 1;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const s = mesh.scale;
  const sx = size.x * s.x, sy = size.y * s.y, sz = size.z * s.z;
  const area = 2 * (sx * sy + sy * sz + sx * sz);
  return Math.max(0.01, area);
}
