"use client";

import { useMemo } from "react";
import { LineSegments, LineBasicMaterial } from "three";
import { Constellation, StarRecord } from "@/lib/types";
import { raDecToXYZ } from "@/lib/astro";

type Props = {
  stars: StarRecord[];
  constellations: Constellation[];
  radius: number;
};

export function ConstellationLines({ stars, constellations, radius }: Props) {
  const starMap = useMemo(() => new Map(stars.map((s) => [s.id, s])), [stars]);

  const positions = useMemo(() => {
    const coords: number[] = [];
    for (const constellation of constellations) {
      for (const [a, b] of constellation.edges) {
        const sa = starMap.get(a);
        const sb = starMap.get(b);
        if (!sa || !sb) continue;
        const pa = raDecToXYZ(sa.ra, sa.dec, radius * 1.001);
        const pb = raDecToXYZ(sb.ra, sb.dec, radius * 1.001);
        coords.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      }
    }
    return new Float32Array(coords);
  }, [constellations, starMap, radius]);

  if (!positions.length) return null;

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#6dd6ff" transparent opacity={0.6} />
    </lineSegments>
  );
}
