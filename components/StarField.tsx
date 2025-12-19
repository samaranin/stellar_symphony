"use client";

import { useMemo } from "react";
import { Color } from "three";
import { StarRecord } from "@/lib/types";
import { toFloat32Array, selectColorFromMagnitude, raDecToXYZ } from "@/lib/astro";

type Props = {
  stars: StarRecord[];
  radius: number;
  onSelect: (index: number) => void;
};

export function StarField({ stars, radius, onSelect }: Props) {
  const { positions, colors } = useMemo(() => {
    const pos = [];
    const cols = [];
    for (const star of stars) {
      const { x, y, z } = raDecToXYZ(star.ra, star.dec, radius);
      pos.push({ x, y, z });
      const c = new Color(selectColorFromMagnitude(star.mag));
      cols.push({ x: c.r, y: c.g, z: c.b });
    }
    return { positions: toFloat32Array(pos), colors: toFloat32Array(cols) };
  }, [stars, radius]);

  return (
    <points
      onPointerDown={(e) => {
        e.stopPropagation();
        if (typeof e.index === "number") onSelect(e.index);
      }}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={1.6} vertexColors depthWrite={false} sizeAttenuation />
    </points>
  );
}
