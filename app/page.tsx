"use client";

import { useEffect, useState } from "react";
import { SkyScene } from "@/components/SkyScene";
import { ControlsBar } from "@/components/ControlsBar";
import { StarInfoPanel } from "@/components/StarInfoPanel";
import { Constellation, StarRecord, StarSelection } from "@/lib/types";
import { initAudio, isRunning, playForStar, stopAudio } from "@/audio/engine";

export default function Page() {
  const [stars, setStars] = useState<StarRecord[]>([]);
  const [constellations, setConstellations] = useState<Constellation[]>([]);
  const [selection, setSelection] = useState<StarSelection>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showConstellations, setShowConstellations] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [starsRes, constRes] = await Promise.all([
          fetch("/data/stars.json"),
          fetch("/data/constellations.json")
        ]);
        if (!starsRes.ok || !constRes.ok) throw new Error("Failed to load data");
        const starsData = (await starsRes.json()) as StarRecord[];
        const constellationsData = (await constRes.json()) as Constellation[];
        setStars(starsData);
        setConstellations(constellationsData);
      } catch (err) {
        console.error(err);
        setError("Could not load star data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handlePlay = async () => {
    if (!selection) return;
    await initAudio();
    await playForStar(selection.star, Math.random());
    setPlaying(true);
  };

  const handleStop = () => {
    stopAudio();
    setPlaying(false);
  };

  const handleReseed = async () => {
    if (!selection) return;
    await playForStar(selection.star, Math.random());
    setPlaying(true);
  };

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">Stellar Symphony</h1>
        <p className="text-gray-400 mt-4">Loading stars...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">Stellar Symphony</h1>
        <p className="text-red-300 mt-4">{error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-4">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Static WebGL Audio</p>
          <h1 className="text-3xl font-bold">Stellar Symphony</h1>
          <p className="text-gray-400">
            Explore a curated sky sphere, focus on stars, and hear their ambient signatures.
          </p>
        </div>
      </header>

      <SkyScene
        stars={stars}
        constellations={constellations}
        onSelect={setSelection}
        showConstellations={showConstellations}
      />

      <div className="grid md:grid-cols-[1fr,320px] gap-4 items-start">
        <ControlsBar
          showConstellations={showConstellations}
          onToggleConstellations={() => setShowConstellations((v) => !v)}
          onReset={() => setSelection(undefined)}
          constellations={constellations}
        />
        <StarInfoPanel
          star={selection?.star}
          isPlaying={playing}
          onPlay={handlePlay}
          onStop={handleStop}
          onReseed={handleReseed}
          onClose={() => {
            setSelection(undefined);
            setPlaying(false);
            stopAudio();
          }}
        />
      </div>
    </main>
  );
}
