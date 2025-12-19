"use client";

import { useEffect, useState } from "react";
import { SkyScene } from "@/components/SkyScene";
import { ControlsBar } from "@/components/ControlsBar";
import { StarInfoPanel } from "@/components/StarInfoPanel";
import { Constellation, StarRecord, StarSelection } from "@/lib/types";
import { initAudio, playForStar, setVolume, stopAudio } from "@/audio/engine";

export default function Page() {
  const [stars, setStars] = useState<StarRecord[]>([]);
  const [constellations, setConstellations] = useState<Constellation[]>([]);
  const [selection, setSelection] = useState<StarSelection>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showConstellations, setShowConstellations] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.8);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("showConstellations") : null;
    if (stored) setShowConstellations(stored === "true");

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("showConstellations", String(showConstellations));
    }
  }, [showConstellations]);

  const handlePlay = async () => {
    if (!selection) return;
    await initAudio();
    setVolume(volume);
    await playForStar(selection.star, Math.random());
    setPlaying(true);
  };

  const handleStop = () => {
    stopAudio();
    setPlaying(false);
  };

  const handleReseed = async () => {
    if (!selection) return;
    setVolume(volume);
    await playForStar(selection.star, Math.random());
    setPlaying(true);
  };

  const handleVolume = (value: number) => {
    setVolumeState(value);
    setVolume(value);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <h1 className="text-2xl font-semibold">Stellar Symphony</h1>
        <p className="text-gray-400 mt-4">Loading stars...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <h1 className="text-2xl font-semibold">Stellar Symphony</h1>
        <p className="text-red-300 mt-4">{error}</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <SkyScene
        stars={stars}
        constellations={constellations}
        onSelect={setSelection}
        showConstellations={showConstellations}
      />

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute top-4 left-4 max-w-xl space-y-3">
          <header className="panel px-4 py-3 space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Static WebGL Audio</p>
            <h1 className="text-2xl font-bold">Stellar Symphony</h1>
            <p className="text-gray-300 text-sm">
              Explore the sky from within, focus on stars, and hear their ambient signatures.
            </p>
          </header>
          <ControlsBar
            showConstellations={showConstellations}
            onToggleConstellations={() => setShowConstellations((v) => !v)}
            onReset={() => {
              setSelection(undefined);
              setPlaying(false);
              stopAudio();
            }}
            constellations={constellations}
          />
        </div>

        <div className="pointer-events-auto absolute top-4 right-4 w-full max-w-sm">
          <StarInfoPanel
            star={selection?.star}
            isPlaying={playing}
            volume={volume}
            onPlay={handlePlay}
            onStop={handleStop}
            onReseed={handleReseed}
            onVolumeChange={handleVolume}
            onClose={() => {
              setSelection(undefined);
              setPlaying(false);
              stopAudio();
            }}
          />
        </div>
      </div>
    </main>
  );
}
