// PROTOTYPE (issue #5) Variant B — "Dual view": top-down orbits above, the edge-on view from
// Earth below (where transits line up). Caveats are inline annotations pinned to the thing
// they qualify, instead of one badge.
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { TRAPPIST1 } from "./PROTOTYPE_trappist1";
import { useProto } from "./PROTOTYPE_store";
import {
  EarthArrow,
  OrbitLine,
  PlanetBody,
  SCALE,
  STAR_SCALE,
  Star,
  planetsWithElements,
} from "./PROTOTYPE_sceneParts";
import { EarthStrip } from "./PROTOTYPE_EarthStrip";
import { TimeControls } from "./PROTOTYPE_TimeControls";

export const VARIANT_B_NAME = "Dual view + inline annotations";

function Note({ position, children }: { position: [number, number, number]; children: ReactNode }) {
  return (
    <Html position={position} style={{ pointerEvents: "none" }}>
      <div className="w-44 border-l-2 border-amber-400/70 bg-black/60 py-0.5 pl-1.5 text-[10px] leading-snug text-amber-100/90">
        {children}
      </div>
    </Html>
  );
}

function Annotations() {
  const sizeScale = useProto((s) => s.sizeScale);
  const h = TRAPPIST1.planets.at(-1);
  const outer = (h?.a.value ?? 0.062) * SCALE;
  const eRef = h?.e.ref?.label ?? "archive";
  return (
    <>
      <Note position={[0.35, 0, -0.35]}>
        Star ×{STAR_SCALE}, planets ×{sizeScale}. Orbit distances are to scale.
      </Note>
      <Note position={[outer * 0.45, 0, -outer * 0.62]}>
        Ellipses from archive e and ω ({eRef}). Ω is unknown, so all orbits are drawn in one plane.
      </Note>
      <Note position={[-outer * 0.95, 0, outer * 0.62]}>
        Positions extrapolated from 2015–16 transit epochs. Keplerian, not N-body.
      </Note>
    </>
  );
}

export function VariantB() {
  const planets = planetsWithElements();
  useEffect(() => {
    useProto.getState().setSizeScale(40);
  }, []);
  return (
    <div className="flex h-full w-full flex-col" data-testid="variant-b">
      <div className="relative min-h-0 flex-[1.7]">
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
          <EarthArrow label="↓ Earth: this system is edge-on from here, see strip below" />
          <Annotations />
          <OrbitControls enableRotate={false} />
        </Canvas>
        <TimeControls className="absolute top-3 left-3" />
        <div className="absolute right-3 bottom-2 text-[10px] text-white/50">
          Top-down (rotated 90° from our view) · Cached · Snapshot {TRAPPIST1.snapshotDate}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <EarthStrip />
      </div>
    </div>
  );
}
