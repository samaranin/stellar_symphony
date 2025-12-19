"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useState } from "react";
import { Constellation, StarRecord, StarSelection } from "@/lib/types";
import { StarField } from "./StarField";
import { ConstellationLines } from "./ConstellationLines";
import { normalize, scale, raDecToXYZ } from "@/lib/astro";
import { Vector3 } from "three";

type Props = {
  stars: StarRecord[];
  constellations: Constellation[];
  onSelect: (selection: StarSelection | undefined) => void;
  showConstellations: boolean;
};

const RADIUS = 100;

export function SkyScene({ stars, constellations, onSelect, showConstellations }: Props) {
  const [focus, setFocus] = useState<Vector3 | null>(null);
  const [target, setTarget] = useState<Vector3 | null>(null);
  const controlsRef = useRef<any>(null);

  const handleSelect = (index: number) => {
    const star = stars[index];
    if (!star) return;
    onSelect({ star, index });
    const pos = raDecToXYZ(star.ra, star.dec, RADIUS);
    const dir = normalize(pos);
    const camPos = scale(dir, RADIUS * 1.6);
    setFocus(new Vector3(camPos.x, camPos.y, camPos.z));
    setTarget(new Vector3(pos.x, pos.y, pos.z));
  };

  const resetCamera = () => {
    setFocus(new Vector3(0, 0, RADIUS * 2));
    setTarget(new Vector3(0, 0, 0));
  };

  return (
    <div className="relative h-[65vh] md:h-screen w-full">
      <Canvas camera={{ position: [0, 0, RADIUS * 2], fov: 55 }}>
        <color attach="background" args={["#05060a"]} />
        <ambientLight intensity={0.4} />
        <Suspense fallback={null}>
          <StarField stars={stars} radius={RADIUS} onSelect={handleSelect} />
          {showConstellations ? (
            <ConstellationLines stars={stars} constellations={constellations} radius={RADIUS} />
          ) : null}
        </Suspense>
        <FocusController focus={focus} target={target} controlsRef={controlsRef} />
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minDistance={RADIUS * 1.05}
          maxDistance={RADIUS * 3}
        />
      </Canvas>
      <button
        className="absolute bottom-3 right-3 bg-white/10 hover:bg-white/20 text-sm px-3 py-2 rounded-lg"
        onClick={resetCamera}
      >
        Reset View
      </button>
    </div>
  );
}

function FocusController({
  focus,
  target,
  controlsRef
}: {
  focus: Vector3 | null;
  target: Vector3 | null;
  controlsRef: any;
}) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (focus) {
      camera.position.lerp(focus, Math.min(delta * 2, 1));
    }
    if (controlsRef?.current && target) {
      controlsRef.current.target.lerp(target, Math.min(delta * 2, 1));
      controlsRef.current.update();
    }
  });
  return null;
}
