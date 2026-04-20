import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { SCENE_OBJECTS, SceneObject, SceneObjectType, buildSceneObject } from "./sceneBuilder";

// ─── Density per type (points per object) ──────────────────────────────────
const DENSITY: Record<SceneObjectType, number> = {
  road:       14000,
  building:    5200,
  car:         3600,
  tree:        1800,
  pedestrian:   520,
  sign:         240,
};

export interface ScenePointCloud {
  positions: Float32Array;   // xyz triplets
  colors:    Float32Array;   // rgb triplets
  labels:    Uint8Array;     // per-point object index (into SCENE_OBJECTS)
}

// Simple Gaussian noise (Box-Muller)
function gauss(rand: () => number): number {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Seeded PRNG (deterministic so the cloud doesn't jitter between remounts)
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * LiDAR-style height-based color ramp.
 * Low (ground)  → warm orange
 * Mid (cars)    → yellow/green
 * High (trees / buildings top) → cyan / blue
 */
function lidarColor(y: number, out: [number, number, number]) {
  const t = Math.max(0, Math.min(1, y / 14));
  // piecewise ramp
  if (t < 0.25) {
    // orange → yellow
    const k = t / 0.25;
    out[0] = 1.0;
    out[1] = 0.35 + k * 0.55;
    out[2] = 0.05;
  } else if (t < 0.55) {
    // yellow → green
    const k = (t - 0.25) / 0.30;
    out[0] = 1.0 - k * 0.75;
    out[1] = 0.9 + k * 0.1;
    out[2] = 0.05 + k * 0.25;
  } else if (t < 0.80) {
    // green → cyan
    const k = (t - 0.55) / 0.25;
    out[0] = 0.25 - k * 0.25;
    out[1] = 1.0 - k * 0.1;
    out[2] = 0.30 + k * 0.65;
  } else {
    // cyan → blue
    const k = (t - 0.80) / 0.20;
    out[0] = 0.0;
    out[1] = 0.9 - k * 0.6;
    out[2] = 0.95 + k * 0.05;
  }
}

/**
 * Build each scene object into a THREE.Group, then sample points from every
 * mesh on its surface using MeshSurfaceSampler. Points are transformed into
 * world space, jittered with mild Gaussian noise to mimic sensor imprecision,
 * and colored with a height-based LiDAR ramp.
 */
export function generateScenePointCloud(): ScenePointCloud {
  const rand = mulberry32(20260421);

  // Estimate total points first so we can allocate a single typed array
  let total = 0;
  for (const obj of SCENE_OBJECTS) total += DENSITY[obj.type] ?? 1000;

  const positions = new Float32Array(total * 3);
  const colors    = new Float32Array(total * 3);
  const labels    = new Uint8Array(total);

  let cursor = 0;
  const tmpPos    = new THREE.Vector3();
  const tmpNormal = new THREE.Vector3();
  const worldPos  = new THREE.Vector3();
  const rgb: [number, number, number] = [0, 0, 0];

  SCENE_OBJECTS.forEach((obj: SceneObject, objIdx: number) => {
    const group = buildSceneObject(obj);
    group.updateMatrixWorld(true);

    // Collect all meshes in this group with their world matrix
    const meshes: THREE.Mesh[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
    });

    if (meshes.length === 0) return;

    const totalForObj = DENSITY[obj.type] ?? 1000;

    // Distribute samples across meshes proportional to their surface area
    const areas = meshes.map((m) => estimateMeshArea(m));
    const areaSum = areas.reduce((a, b) => a + b, 0) || 1;

    meshes.forEach((mesh, mi) => {
      const share = Math.max(5, Math.floor(totalForObj * (areas[mi] / areaSum)));
      const sampler = new MeshSurfaceSampler(mesh).build();

      for (let i = 0; i < share; i++) {
        if (cursor >= total) return;

        sampler.sample(tmpPos, tmpNormal);
        worldPos.copy(tmpPos).applyMatrix4(mesh.matrixWorld);

        // LiDAR sensor jitter (small Gaussian noise, scaled with distance)
        const dist = worldPos.length();
        const sigma = 0.012 + dist * 0.0015;
        worldPos.x += gauss(rand) * sigma;
        worldPos.y += gauss(rand) * sigma * 0.7;
        worldPos.z += gauss(rand) * sigma;

        const p3 = cursor * 3;
        positions[p3]     = worldPos.x;
        positions[p3 + 1] = worldPos.y;
        positions[p3 + 2] = worldPos.z;

        lidarColor(worldPos.y, rgb);
        // slight per-point brightness variation
        const bv = 0.85 + rand() * 0.25;
        colors[p3]     = Math.min(1, rgb[0] * bv);
        colors[p3 + 1] = Math.min(1, rgb[1] * bv);
        colors[p3 + 2] = Math.min(1, rgb[2] * bv);

        labels[cursor] = objIdx;
        cursor++;
      }
    });

    // Dispose geometries / materials we no longer need (sampling is done)
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

  // If we over-allocated (cursor < total), slice the arrays
  if (cursor < total) {
    return {
      positions: positions.slice(0, cursor * 3),
      colors:    colors.slice(0, cursor * 3),
      labels:    labels.slice(0, cursor),
    };
  }

  return { positions, colors, labels };
}

// Rough surface-area estimate from BufferGeometry position attribute
function estimateMeshArea(mesh: THREE.Mesh): number {
  const geom = mesh.geometry;
  if (!geom) return 1;
  const pos = geom.attributes.position;
  if (!pos) return 1;

  // Cheap proxy: bounding-box surface area × mesh world scale
  if (!geom.boundingBox) geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const s = mesh.scale;
  const sx = size.x * s.x, sy = size.y * s.y, sz = size.z * s.z;
  const area = 2 * (sx * sy + sy * sz + sx * sz);
  return Math.max(0.01, area);
}
