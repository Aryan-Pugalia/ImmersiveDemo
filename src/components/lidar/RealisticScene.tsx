import React, { useMemo } from "react";
import * as THREE from "three";
import { Environment } from "@react-three/drei";
import { SCENE_OBJECTS, buildSceneObject } from "./sceneBuilder";

/**
 * Photorealistic rendering of the same scene used for LiDAR sampling.
 * Uses HDR environment lighting, soft shadows, and PBR materials.
 * Because it reuses the canonical SCENE_OBJECTS, any bounding box drawn
 * in world-space will project correctly here too.
 */
export function RealisticScene() {
  const groups = useMemo(
    () => SCENE_OBJECTS.map((obj) => ({ id: obj.id, group: buildSceneObject(obj) })),
    []
  );

  return (
    <>
      {/* Sky-ish fog + environment */}
      <color attach="background" args={["#aac6e0"]} />
      <fog attach="fog" args={["#b6ccdf", 40, 110]} />

      {/* Sun + fill */}
      <directionalLight
        position={[18, 26, 12]}
        intensity={1.55}
        color="#fff5e2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-bias={-0.0002}
      />
      <hemisphereLight args={["#cfe1ff", "#443322", 0.55]} />
      <ambientLight intensity={0.18} />

      <Environment preset="city" />

      {/* Scene meshes */}
      {groups.map(({ id, group }) => (
        <primitive key={id} object={group} />
      ))}
    </>
  );
}
