"use client";

import { Constellation } from "@/lib/types";
import { useMemo } from "react";

type Props = {
  showConstellations: boolean;
  onToggleConstellations: () => void;
  onReset: () => void;
  constellations?: Constellation[];
};

export function ControlsBar({
  showConstellations,
  onToggleConstellations,
  onReset,
  constellations
}: Props) {
  const constCount = useMemo(() => constellations?.length ?? 0, [constellations]);

  return (
    <div className="panel px-4 py-3 flex items-center gap-3 text-sm">
      <button
        className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 transition"
        onClick={onToggleConstellations}
      >
        {showConstellations ? "Hide" : "Show"} Constellations {constCount ? `(${constCount})` : ""}
      </button>
      <button
        className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 transition"
        onClick={onReset}
      >
        Clear Selection
      </button>
    </div>
  );
}
