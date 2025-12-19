import { StarRecord } from "./types";

export type Vec3 = { x: number; y: number; z: number };

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function raDecToXYZ(raDeg: number, decDeg: number, radius: number): Vec3 {
  const ra = degToRad(raDeg);
  const dec = degToRad(decDeg);
  const x = radius * Math.cos(dec) * Math.cos(ra);
  const y = radius * Math.sin(dec);
  const z = radius * Math.cos(dec) * Math.sin(ra);
  return { x, y, z };
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function toFloat32Array(vectors: Vec3[]): Float32Array {
  const arr = new Float32Array(vectors.length * 3);
  for (let i = 0; i < vectors.length; i++) {
    const offset = i * 3;
    arr[offset] = vectors[i].x;
    arr[offset + 1] = vectors[i].y;
    arr[offset + 2] = vectors[i].z;
  }
  return arr;
}

export function selectColorFromMagnitude(mag: number): string {
  const t = clamp((mag + 1.46) / 8, 0, 1);
  const base = 0.6 + (1 - t) * 0.4;
  const blue = Math.round(base * 255);
  const white = Math.round(200 + (1 - t) * 55);
  return `rgb(${white},${white},${blue})`;
}

export function annotateStarsWithPosition(stars: StarRecord[], radius: number) {
  return stars.map((star) => ({
    ...star,
    position: raDecToXYZ(star.ra, star.dec, radius)
  }));
}

export function focusFromPosition(pos: Vec3, radius: number, factor = 1.6) {
  const dir = normalize(pos);
  return {
    camera: scale(dir, radius * factor),
    target: pos
  };
}
