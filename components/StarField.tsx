"use client";

import { useMemo } from "react";
import { AdditiveBlending, Color } from "three";
import { StarRecord } from "@/lib/types";
import { toFloat32Array, selectColorFromMagnitude, raDecToXYZ } from "@/lib/astro";

type Props = {
  stars: StarRecord[];
  radius: number;
  onSelect: (index: number) => void;
  onHover?: (index: number | null) => void;
};

export function StarField({ stars, radius, onSelect, onHover }: Props) {
  const { positions, colors, sizes } = useMemo(() => {
    const pos = [];
    const cols = [];
    const sz = [];
    for (const star of stars) {
      const { x, y, z } = raDecToXYZ(star.ra, star.dec, radius);
      pos.push({ x, y, z });
      const c = new Color(selectColorFromMagnitude(star.mag));
      cols.push({ x: c.r, y: c.g, z: c.b });
      const size = Math.max(1, 3 - star.mag * 0.25);
      sz.push({ x: size, y: 0, z: 0 });
    }
    return {
      positions: toFloat32Array(pos),
      colors: toFloat32Array(cols),
      sizes: new Float32Array(sz.map((v) => v.x))
    };
  }, [stars, radius]);

  return (
    <points
      onPointerDown={(e) => {
        e.stopPropagation();
        if (typeof e.index === "number") onSelect(e.index);
      }}
      onPointerMove={(e) => {
        if (typeof e.index === "number") onHover?.(e.index);
      }}
      onPointerLeave={() => onHover?.(null)}
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
        <bufferAttribute
          attach="attributes-size"
          count={sizes.length}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        uniforms={{}}
        blending={AdditiveBlending}
        vertexColors
      />
    </points>
  );
}

const vertexShader = `
  attribute float size;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  void main() {
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;
    float falloff = 1.0 - smoothstep(0.4, 1.0, r);
    gl_FragColor = vec4(vColor, falloff);
  }
`;
