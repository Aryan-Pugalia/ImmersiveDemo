import * as THREE from "three";

// ─── Scene object schema ────────────────────────────────────────────────────
export type SceneObjectType =
  | "car"
  | "pedestrian"
  | "tree"
  | "building"
  | "road"
  | "sign";

export interface SceneObject {
  id: string;
  type: SceneObjectType;
  position: [number, number, number];
  rotation: number;
  size?: [number, number, number];
  color?: string;
  variant?: "sedan" | "suv" | "truck";
}

// ─── The canonical urban-street scene ───────────────────────────────────────
export const SCENE_OBJECTS: SceneObject[] = [
  // Road & surroundings
  { id: "road",      type: "road",     position: [0, 0, 0],   rotation: 0,   size: [60, 0, 60] },

  // Cars (3 vehicles, varied positions + orientations)
  { id: "car-1",     type: "car",      position: [6, 0, 3],    rotation: 0,        color: "#c0c0c8", variant: "sedan" },
  { id: "car-2",     type: "car",      position: [-9, 0, -4],  rotation: 0.22,     color: "#4a3a2a", variant: "suv"   },
  { id: "car-3",     type: "car",      position: [14, 0, 11],  rotation: Math.PI/2,color: "#1a3a5c", variant: "sedan" },

  // Pedestrians
  { id: "ped-1",     type: "pedestrian", position: [-2, 0, 8],  rotation: 0,   color: "#e9a67a" },
  { id: "ped-2",     type: "pedestrian", position: [3.5, 0, -9],rotation: 1.2, color: "#d9b38c" },

  // Trees
  { id: "tree-1",    type: "tree",     position: [-15, 0, 10],  rotation: 0 },
  { id: "tree-2",    type: "tree",     position: [16, 0, -12],  rotation: 0 },
  { id: "tree-3",    type: "tree",     position: [-12, 0, -15], rotation: 0 },
  { id: "tree-4",    type: "tree",     position: [20, 0, 7],    rotation: 0 },

  // Buildings (stay back from road)
  { id: "bldg-1",    type: "building", position: [-26, 0, 2],  rotation: 0,    size: [10, 14, 16], color: "#9c8f80" },
  { id: "bldg-2",    type: "building", position: [26, 0, -6],  rotation: 0.08, size: [12, 18, 14], color: "#7e7066" },

  // Sign
  { id: "sign-1",    type: "sign",     position: [9, 0, -2],   rotation: 0 },
];

// ─── Builders (all return a THREE.Group centred at world origin) ────────────

export function buildCar(color = "#c0c0c8", variant: "sedan" | "suv" | "truck" = "sedan"): THREE.Group {
  const g = new THREE.Group();
  const bodyMat  = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.65 });
  const glassMat = new THREE.MeshStandardMaterial({ color: "#0d1520", roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.85 });
  const tyreMat  = new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.9 });
  const rimMat   = new THREE.MeshStandardMaterial({ color: "#555", roughness: 0.3, metalness: 0.8 });

  // Dimensions per variant
  const D = variant === "suv"
    ? { len: 4.6, wid: 1.9, lowH: 0.85, cabH: 0.95, cabLen: 3.1 }
    : variant === "truck"
    ? { len: 5.2, wid: 2.0, lowH: 0.95, cabH: 1.05, cabLen: 2.4 }
    : { len: 4.4, wid: 1.8, lowH: 0.65, cabH: 0.75, cabLen: 2.6 };

  // Lower body (chassis + side panels)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(D.len, D.lowH, D.wid),
    bodyMat
  );
  body.position.y = 0.3 + D.lowH / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  // Cabin (tapered upper volume)
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(D.cabLen, D.cabH, D.wid * 0.92),
    bodyMat
  );
  cabin.position.set(-0.1, 0.3 + D.lowH + D.cabH / 2, 0);
  cabin.castShadow = true;
  g.add(cabin);

  // Windshield (front)
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(D.wid * 0.85, D.cabH * 0.9), glassMat);
  ws.position.set(-0.1 + D.cabLen / 2 + 0.02, 0.3 + D.lowH + D.cabH / 2, 0);
  ws.rotation.y = Math.PI / 2;
  ws.rotation.z = -0.15;
  g.add(ws);

  // Rear window
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(D.wid * 0.85, D.cabH * 0.9), glassMat);
  rw.position.set(-0.1 - D.cabLen / 2 - 0.02, 0.3 + D.lowH + D.cabH / 2, 0);
  rw.rotation.y = -Math.PI / 2;
  rw.rotation.z = -0.15;
  g.add(rw);

  // Side windows (both sides)
  for (const side of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(D.cabLen * 0.9, D.cabH * 0.75), glassMat);
    sw.position.set(-0.1, 0.3 + D.lowH + D.cabH / 2, (D.wid / 2) * side * 0.92 + 0.01 * side);
    sw.rotation.y = side > 0 ? 0 : Math.PI;
    g.add(sw);
  }

  // Headlights / taillights
  const hlMat = new THREE.MeshStandardMaterial({ color: "#fffbe6", emissive: "#ffd88a", emissiveIntensity: 0.4 });
  const tlMat = new THREE.MeshStandardMaterial({ color: "#ff3030", emissive: "#aa0010", emissiveIntensity: 0.3 });
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.35), hlMat);
    hl.position.set(D.len / 2 + 0.01, 0.3 + D.lowH / 2 + 0.1, side * (D.wid / 2 - 0.25));
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.3), tlMat);
    tl.position.set(-D.len / 2 - 0.01, 0.3 + D.lowH / 2 + 0.1, side * (D.wid / 2 - 0.22));
    g.add(tl);
  }

  // Wheels (tyre + rim)
  const wheelPositions: [number, number][] = [
    [ D.len / 2 - 0.7,  D.wid / 2 - 0.05],
    [ D.len / 2 - 0.7, -D.wid / 2 + 0.05],
    [-D.len / 2 + 0.7,  D.wid / 2 - 0.05],
    [-D.len / 2 + 0.7, -D.wid / 2 + 0.05],
  ];
  for (const [x, z] of wheelPositions) {
    const tyreGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 20);
    const tyre = new THREE.Mesh(tyreGeom, tyreMat);
    tyre.position.set(x, 0.38, z);
    tyre.rotation.x = Math.PI / 2;
    tyre.castShadow = true;
    g.add(tyre);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.29, 12), rimMat);
    rim.position.set(x, 0.38, z);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
  }

  return g;
}

export function buildPedestrian(color = "#e9a67a"): THREE.Group {
  const g = new THREE.Group();
  const skinMat   = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const shirtMat  = new THREE.MeshStandardMaterial({ color: "#3d5a80", roughness: 0.85 });
  const trouseMat = new THREE.MeshStandardMaterial({ color: "#1c2b3a", roughness: 0.85 });
  const shoeMat   = new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.8 });

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), skinMat);
  head.position.y = 1.67; head.castShadow = true; g.add(head);

  // Torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.55, 4, 12), shirtMat);
  torso.position.y = 1.2; torso.castShadow = true; g.add(torso);

  // Arms
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.5, 4, 8), shirtMat);
    arm.position.set(side * 0.26, 1.2, 0);
    arm.castShadow = true;
    g.add(arm);
  }

  // Legs (trousers)
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.6, 4, 8), trouseMat);
    leg.position.set(side * 0.1, 0.48, 0);
    leg.castShadow = true;
    g.add(leg);

    // Shoe
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.27), shoeMat);
    shoe.position.set(side * 0.1, 0.08, 0.03);
    shoe.castShadow = true;
    g.add(shoe);
  }

  return g;
}

export function buildTree(): THREE.Group {
  const g = new THREE.Group();

  // Trunk (slight taper)
  const trunkGeom = new THREE.CylinderGeometry(0.18, 0.28, 2.6, 14);
  const trunkMat  = new THREE.MeshStandardMaterial({ color: "#5d4037", roughness: 0.95 });
  const trunk     = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 1.3;
  trunk.castShadow = true;
  g.add(trunk);

  // Foliage — multiple overlapping icosahedra for natural silhouette
  const foliageMat = new THREE.MeshStandardMaterial({ color: "#3e7a3a", roughness: 0.85 });
  const foliagePositions: [number, number, number, number][] = [
    // [x, y, z, radius]
    [ 0,    3.2, 0,    1.5 ],
    [ 0.7,  3.6, 0.3,  1.1 ],
    [-0.6,  3.4, 0.4,  1.0 ],
    [ 0.2,  4.1, -0.5, 0.9 ],
    [-0.3,  3.0, -0.5, 1.0 ],
  ];
  for (const [x, y, z, r] of foliagePositions) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), foliageMat);
    f.position.set(x, y, z);
    f.castShadow = true;
    g.add(f);
  }

  return g;
}

export function buildBuilding(size: [number, number, number], color = "#a89888"): THREE.Group {
  const g = new THREE.Group();
  const [w, h, d] = size;

  const bodyMat   = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const roofMat   = new THREE.MeshStandardMaterial({ color: "#5a4e45", roughness: 0.95 });
  const winMat    = new THREE.MeshStandardMaterial({
    color: "#4a6f91", roughness: 0.15, metalness: 0.85,
    emissive: "#1a3a55", emissiveIntensity: 0.45,
  });
  const ledgeMat  = new THREE.MeshStandardMaterial({ color: "#c7b99b", roughness: 0.8 });

  // Main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  body.position.y = h / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  // Roof cap
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.03, 0.4, d * 1.03), roofMat);
  roof.position.y = h + 0.2;
  g.add(roof);

  // Window grid — front & back (Z faces) and left & right (X faces)
  const winW = 0.9, winH = 1.15;
  const floorH = 2.1;
  const rows = Math.max(1, Math.floor((h - 2) / floorH));
  const colsFront = Math.max(1, Math.floor((w - 2) / 1.6));
  const colsSide  = Math.max(1, Math.floor((d - 2) / 1.6));

  for (let r = 0; r < rows; r++) {
    const y = 1.4 + r * floorH;

    // Front/back windows
    for (let c = 0; c < colsFront; c++) {
      const x = (c - (colsFront - 1) / 2) * 1.6;

      const wF = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), winMat);
      wF.position.set(x, y, d / 2 + 0.02);
      g.add(wF);

      const wB = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), winMat);
      wB.position.set(x, y, -d / 2 - 0.02);
      wB.rotation.y = Math.PI;
      g.add(wB);
    }

    // Side windows
    for (let c = 0; c < colsSide; c++) {
      const z = (c - (colsSide - 1) / 2) * 1.6;

      const wR = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), winMat);
      wR.position.set(w / 2 + 0.02, y, z);
      wR.rotation.y = Math.PI / 2;
      g.add(wR);

      const wL = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), winMat);
      wL.position.set(-w / 2 - 0.02, y, z);
      wL.rotation.y = -Math.PI / 2;
      g.add(wL);
    }

    // Horizontal floor ledge
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.15, d * 1.01), ledgeMat);
    ledge.position.y = y - winH / 2 - 0.3;
    g.add(ledge);
  }

  return g;
}

export function buildRoad(size: [number, number, number]): THREE.Group {
  const g = new THREE.Group();
  const [w, , d] = size;

  // Asphalt
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: "#1f1f22", roughness: 0.95 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  g.add(road);

  // Sidewalks (parallel to road, offset on Z)
  const swMat = new THREE.MeshStandardMaterial({ color: "#7e7a72", roughness: 0.92 });
  for (const zOff of [-7, 7]) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.5), swMat);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(0, 0.045, zOff);
    sw.receiveShadow = true;
    g.add(sw);
  }

  // Dashed centre lane line
  const lineMat = new THREE.MeshStandardMaterial({
    color: "#f5f5d4", emissive: "#707056", emissiveIntensity: 0.15,
  });
  for (let x = -w / 2 + 2; x < w / 2 - 2; x += 5) {
    const ln = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.18), lineMat);
    ln.rotation.x = -Math.PI / 2;
    ln.position.set(x, 0.025, 0);
    g.add(ln);
  }

  // Continuous edge lines
  for (const zOff of [-3.2, 3.2]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(w - 1, 0.14), lineMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 0.025, zOff);
    g.add(edge);
  }

  // Stop line (perpendicular)
  const stop = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 6.4), lineMat);
  stop.rotation.x = -Math.PI / 2;
  stop.position.set(-8, 0.025, 0);
  g.add(stop);

  return g;
}

export function buildSign(): THREE.Group {
  const g = new THREE.Group();
  const poleMat  = new THREE.MeshStandardMaterial({ color: "#888", metalness: 0.8, roughness: 0.35 });
  const signMat  = new THREE.MeshStandardMaterial({ color: "#d33", roughness: 0.5, emissive: "#551111", emissiveIntensity: 0.2 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 10), poleMat);
  pole.position.y = 1.2;
  pole.castShadow = true;
  g.add(pole);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.08), signMat);
  panel.position.y = 2.2;
  panel.castShadow = true;
  g.add(panel);

  return g;
}

// ─── Unified builder ────────────────────────────────────────────────────────
export function buildSceneObject(obj: SceneObject): THREE.Group {
  let g: THREE.Group;
  switch (obj.type) {
    case "car":         g = buildCar(obj.color, obj.variant);           break;
    case "pedestrian":  g = buildPedestrian(obj.color);                  break;
    case "tree":        g = buildTree();                                 break;
    case "building":    g = buildBuilding(obj.size ?? [8, 12, 10], obj.color); break;
    case "road":        g = buildRoad(obj.size ?? [60, 0, 60]);          break;
    case "sign":        g = buildSign();                                 break;
    default:            g = new THREE.Group();
  }
  g.position.set(...obj.position);
  g.rotation.y = obj.rotation;
  g.userData.sceneId   = obj.id;
  g.userData.sceneType = obj.type;
  return g;
}
