// PROTOTYPE (issue #5) Variant A — "Orrery + badge": a clean top-down orrery; every caveat is
// collected in one persistent badge; the student controls the size exaggeration directly.
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { TRAPPIST1 } from "./PROTOTYPE_trappist1";
import { useProto } from "./PROTOTYPE_store";
import {
  EarthArrow,
  OrbitLine,
  PlanetBody,
  STAR_SCALE,
  Star,
  planetsWithElements,
} from "./PROTOTYPE_sceneParts";
import { TimeControls } from "./PROTOTYPE_TimeControls";

export const VARIANT_A_NAME = "Orrery + caveat badge";

function CaveatBadge() {
  const sizeScale = useProto((s) => s.sizeScale);
  return (
    <div className="absolute top-3 left-3 max-w-[21rem] rounded-lg border border-amber-400/40 bg-amber-950/70 p-2.5 text-[11px] leading-snug text-amber-100 backdrop-blur">
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-300">
        <TriangleAlert className="size-3.5" /> How to read this view
      </div>
      <ul className="list-disc space-y-0.5 pl-4">
        <li>View rotated: the system is edge-on from Earth (i ≈ 89.8°).</li>
        <li>Positions extrapolated from 2015–16 transit epochs.</li>
        <li>
          Planet sizes ×{sizeScale}, star ×{STAR_SCALE}. Distances to scale.
        </li>
        <li>Keplerian orbits, not an N-body simulation.</li>
      </ul>
    </div>
  );
}

function SizeSlider() {
  const sizeScale = useProto((s) => s.sizeScale);
  return (
    <label className="absolute top-3 right-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1.5 text-xs text-white/80 backdrop-blur">
      Planet size ×{sizeScale}
      <input
        type="range"
        min={1}
        max={150}
        value={sizeScale}
        onChange={(e) => {
          useProto.getState().setSizeScale(Number(e.target.value));
        }}
        className="w-28 accent-amber-400"
      />
      {sizeScale === 1 && <span className="text-amber-300">true scale</span>}
    </label>
  );
}

export function VariantA() {
  const planets = planetsWithElements();
  useEffect(() => {
    useProto.getState().setSizeScale(40);
  }, []);
  return (
    <div className="relative h-full w-full" data-testid="variant-a">
      <Canvas
        data-testid="system-view"
        camera={{ position: [0, 17, 0.01], fov: 45 }}
        onPointerMissed={() => {
          useProto.getState().select(null);
        }}
      >
        <ambientLight intensity={0.35} />
        <Star />
        {planets.map((p) => (
          <group key={p.id}>
            <OrbitLine planet={p} />
            <PlanetBody planet={p} />
          </group>
        ))}
        <EarthArrow label="↓ to Earth" />
        <OrbitControls enableRotate={false} />
      </Canvas>
      <CaveatBadge />
      <SizeSlider />
      <TimeControls className="absolute bottom-3 left-3" />
      <div className="absolute right-3 bottom-3 text-[10px] text-white/50">
        {TRAPPIST1.hostname} · Cached · Snapshot {TRAPPIST1.snapshotDate}
      </div>
    </div>
  );
}
