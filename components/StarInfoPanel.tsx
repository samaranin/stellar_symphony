"use client";

import { StarRecord } from "@/lib/types";

type Props = {
  star?: StarRecord;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onReseed: () => void;
  onClose: () => void;
};

export function StarInfoPanel({ star, isPlaying, onPlay, onStop, onReseed, onClose }: Props) {
  if (!star) {
    return (
      <div className="panel p-4 text-sm space-y-2">
        <p className="text-gray-300">Select a star to view details and play its sound.</p>
      </div>
    );
  }

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Star</p>
          <h2 className="text-lg font-semibold">{star.name ?? star.id}</h2>
          {star.bayer ? <p className="text-gray-400 text-sm">{star.bayer}</p> : null}
        </div>
        <button className="text-gray-400 hover:text-white text-sm" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Info label="Magnitude" value={star.mag.toFixed(2)} />
        {star.spec && <Info label="Spectral" value={star.spec} />}
        {star.temp && <Info label="Temp (K)" value={star.temp.toLocaleString()} />}
        {star.dist && <Info label="Distance (pc)" value={star.dist.toFixed(2)} />}
        <Info label="RA" value={`${star.ra.toFixed(2)}°`} />
        <Info label="Dec" value={`${star.dec.toFixed(2)}°`} />
      </div>

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg bg-accent-500 text-black font-semibold py-2 hover:bg-accent-400 transition"
          onClick={isPlaying ? onStop : onPlay}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-sm transition"
          onClick={onReseed}
        >
          Re-seed
        </button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-lg px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p>{value}</p>
    </div>
  );
}
