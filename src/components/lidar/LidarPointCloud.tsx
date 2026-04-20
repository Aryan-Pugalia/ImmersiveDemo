import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { generateScenePointCloud } from "./pointSampler";

let _cached: ReturnType<typeof generateScenePointCloud> | null = null;

export function getScenePointCloud() {
  if (!_cached) _cached = generateScenePointCloud();
  return _cached;
}

interface Props {
  pointSize?: number;
}

/**
 * Dense, realistic LiDAR-style point cloud sampled directly from the canonical
 * scene meshes. Caches the result so remounting (or toggling view modes) is free.
 */
export function LidarPointCloud({ pointSize = 0.055 }: Props) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors } = useMemo(() => getScenePointCloud(), []);

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
      <pointsMaterial
        size={pointSize}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.95}
        depthWrite={false}
      />
    </points>
  );
}
