"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import { Constellation, StarRecord, StarSelection } from "@/lib/types";
import { StarField } from "./StarField";
import { ConstellationLines } from "./ConstellationLines";
import { focusFromPosition, raDecToXYZ } from "@/lib/astro";
import { Vector3 } from "three";

type Props = {
  stars: StarRecord[];
  constellations: Constellation[];
  onSelect: (selection: StarSelection | undefined) => void;
  showConstellations: boolean;
};

const RADIUS = 100;

export function SkyScene({ stars, constellations, onSelect, showConstellations }: Props) {
  const [focus, setFocus] = useState<Vector3 | null>(new Vector3(0, 0, RADIUS * 0.6));
  const [target, setTarget] = useState<Vector3 | null>(new Vector3(0, 0, 0));
  const [animating, setAnimating] = useState(false);
  const controlsRef = useRef<any>(null);
  const [hoverPos, setHoverPos] = useState<Vector3 | null>(null);
  const [webglSupported, setWebglSupported] = useState(true);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    setWebglSupported(Boolean(gl));
  }, []);

  const handleSelect = (index: number) => {
    const star = stars[index];
    if (!star) return;
    onSelect({ star, index });
    const pos = raDecToXYZ(star.ra, star.dec, RADIUS);
    const focusPos = focusFromPosition(pos, RADIUS, 0.9);
    setFocus(new Vector3(focusPos.camera.x, focusPos.camera.y, focusPos.camera.z));
    setTarget(new Vector3(focusPos.target.x, focusPos.target.y, focusPos.target.z));
    setAnimating(true);
  };

  const handleHover = (index: number | null) => {
    if (index === null) {
      setHoverPos(null);
      return;
    }
    const star = stars[index];
    if (!star) return;
    const pos = raDecToXYZ(star.ra, star.dec, RADIUS * 1.002);
    setHoverPos(new Vector3(pos.x, pos.y, pos.z));
  };

  const resetCamera = () => {
    setFocus(new Vector3(0, 0, RADIUS * 0.6));
    setTarget(new Vector3(0, 0, 0));
    setAnimating(true);
  };

  if (!webglSupported) {
    return (
      <div className="relative h-[65vh] md:h-screen w-full panel flex items-center justify-center">
        <p className="text-sm text-gray-300">WebGL is not supported on this device.</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 0, RADIUS * 0.6], fov: 70 }}>
        <color attach="background" args={["#05060a"]} />
        <ambientLight intensity={0.4} />
        <Suspense fallback={null}>
          <StarField stars={stars} radius={RADIUS} onSelect={handleSelect} onHover={handleHover} />
          {showConstellations ? (
            <ConstellationLines stars={stars} constellations={constellations} radius={RADIUS} />
          ) : null}
          {hoverPos ? <HoverMarker position={hoverPos} /> : null}
        </Suspense>
        <FocusController
          focus={focus}
          target={target}
          controlsRef={controlsRef}
          animating={animating}
          onFinish={() => setAnimating(false)}
          reducedMotion={prefersReducedMotion}
        />
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom
          zoomSpeed={0.8}
          enableDamping
          dampingFactor={0.08}
          minDistance={RADIUS * 0.15}
          maxDistance={RADIUS * 1.2}
        />
      </Canvas>
      {!stars.length ? (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm pointer-events-none">
          Loading sky...
        </div>
      ) : null}
      <button
        className="absolute bottom-4 right-4 bg-white/10 hover:bg-white/20 text-sm px-3 py-2 rounded-lg"
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
  controlsRef,
  animating,
  onFinish,
  reducedMotion
}: {
  focus: Vector3 | null;
  target: Vector3 | null;
  controlsRef: any;
  animating: boolean;
  onFinish: () => void;
  reducedMotion: boolean;
}) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!animating || !focus || !target) return;

    const lerpFactor = reducedMotion ? 1 : Math.min(delta * 2, 1);
    camera.position.lerp(focus, lerpFactor);
    if (controlsRef?.current) {
      controlsRef.current.target.lerp(target, lerpFactor);
      controlsRef.current.update();
    }

    const camDone = camera.position.distanceTo(focus) < 0.1;
    const tgtDone = controlsRef?.current
      ? controlsRef.current.target.distanceTo(target) < 0.1
      : true;
    if (camDone && tgtDone) {
      onFinish();
    }
  });
  return null;
}

function HoverMarker({ position }: { position: Vector3 }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.9, 12, 12]} />
      <meshBasicMaterial color="#9bf6ff" transparent opacity={0.8} />
    </mesh>
  );
}

function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefers(media.matches);
    const listener = (event: MediaQueryListEvent) => setPrefers(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  return prefers;
}
