import React, { useMemo } from "react";
import { PointCloud } from "./kittiParser";

interface Props {
  cloud: PointCloud;
  pointSize?: number;
  /** Clip points farther than this (metres, in Velodyne frame). */
  maxRange?: number;
}

/**
 * Renders a parsed KITTI Velodyne point cloud directly from typed arrays.
 * The component is **frame-neutral**: it emits positions in Velodyne
 * coordinates (x=fwd, y=left, z=up). The parent is expected to wrap it in a
 * <group> that maps Velodyne → three.js (see the Velodyne matrix in the page).
 *
 * Colours combine an intensity read-out with a height ramp so the road
 * surface, cars, and poles are all visually distinguishable.
 */
export function RealPointCloud({ cloud, pointSize = 0.04, maxRange = 70 }: Props) {
  const { positions, colors } = useMemo(() => {
    const out = new Float32Array(cloud.count * 3);
    const col = new Float32Array(cloud.count * 3);
    let k = 0;
    const maxR2 = maxRange * maxRange;
    for (let i = 0; i < cloud.count; i++) {
      const x = cloud.positions[i * 3 + 0];
      const y = cloud.positions[i * 3 + 1];
      const z = cloud.positions[i * 3 + 2];
      // Drop points that are underneath the sensor (floor noise) or far away.
      if (z < -2.5 || z > 4) continue;
      if (x * x + y * y > maxR2) continue;

      out[k * 3 + 0] = x;
      out[k * 3 + 1] = y;
      out[k * 3 + 2] = z;

      const intensity = cloud.intensity[i];
      // Height-biased palette: blue low, cyan mid, yellow/white high.
      const h = Math.min(1, Math.max(0, (z + 2) / 4));
      const r = 0.15 + 0.85 * Math.pow(h, 1.6) + intensity * 0.15;
      const g = 0.3 + 0.7 * h + intensity * 0.1;
      const b = 1.0 - 0.75 * h + intensity * 0.05;
      col[k * 3 + 0] = Math.min(1, r);
      col[k * 3 + 1] = Math.min(1, g);
      col[k * 3 + 2] = Math.min(1, b);
      k++;
    }
    return {
      positions: out.subarray(0, k * 3),
      colors: col.subarray(0, k * 3),
    };
  }, [cloud]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
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
