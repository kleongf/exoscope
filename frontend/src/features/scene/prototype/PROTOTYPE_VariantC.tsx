// PROTOTYPE (issue #5) Variant C — "Honesty layers": a tilted 3D view where uncertainty is drawn,
// not written. Orbit bands show ±1σ in a; a smear along each orbit shows ±2σ of where the planet
// could be after propagating the transit epoch to today. Hover a planet for its provenance.
import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import {
  elementsOf,
  orbitsSinceEpoch,
  phaseSigmaRad,
  positionAt,
  sigma,
  type ProtoPlanet,
} from "./PROTOTYPE_orbits";
import { TRAPPIST1 } from "./PROTOTYPE_trappist1";
import { useProto } from "./PROTOTYPE_store";
import {
  OrbitLine,
  PlanetBody,
  SCALE,
  Star,
  planetColor,
  planetsWithElements,
} from "./PROTOTYPE_sceneParts";
import { TimeControls } from "./PROTOTYPE_TimeControls";

export const VARIANT_C_NAME = "Honesty layers";

interface Layers {
  orbitBands: boolean;
  positionSmear: boolean;
  assumptions: boolean;
  trueSize: boolean;
}

function OrbitBand({ planet }: { planet: ProtoPlanet }) {
  const a = planet.a.value;
  const s = sigma(planet.a);
  if (a === null || s === null) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[(a - s) * SCALE, (a + s) * SCALE, 160]} />
      <meshBasicMaterial color={planetColor(planet)} transparent opacity={0.22} side={2} />
    </mesh>
  );
}

function PositionSmear({ planet }: { planet: ProtoPlanet }) {
  const jd = useProto((st) => st.jd);
  const el = elementsOf(planet);
  const sig = phaseSigmaRad(planet, jd);
  if (el === null || sig === null) return null;
  const sigmaDays = (sig / (2 * Math.PI)) * el.periodDays;
  const span = Math.min(2 * sigmaDays, el.periodDays / 2);
  const pts: [number, number, number][] = [];
  for (let k = -24; k <= 24; k += 1) {
    const p = positionAt(el, jd + (k / 24) * span);
    pts.push([p.x * SCALE, 0.001, p.y * SCALE]);
  }
  return <Line points={pts} color={planetColor(planet)} lineWidth={9} transparent opacity={0.6} />;
}

function ProvenanceCallout({ planet }: { planet: ProtoPlanet }) {
  const hovered = useProto((s) => s.hoveredId === planet.id);
  const jd = useProto((s) => s.jd);
  const el = elementsOf(planet);
  if (!hovered || el === null) return null;
  const sig = phaseSigmaRad(planet, jd);
  const fmt = (v: number | null, d = 4) => (v === null ? "missing" : v.toPrecision(d));
  return (
    <Html position={[0.3, 0, 0]} style={{ pointerEvents: "none" }}>
      <div className="w-60 rounded-md border border-white/15 bg-black/85 p-2 text-[10.5px] leading-snug text-white/85">
        <div className="mb-1 font-semibold" style={{ color: planetColor(planet) }}>
          {planet.id}
        </div>
        <div>
          a = {fmt(planet.a.value)} ± {fmt(sigma(planet.a), 2)} AU · {planet.a.ref?.label}
        </div>
        <div>
          P = {fmt(planet.period.value, 7)} d · {planet.period.ref?.label}
        </div>
        <div>
          Epoch {fmt(planet.tranmid.value, 10)} BJD · {planet.tranmid.ref?.label}
        </div>
        <div className="mt-1 text-amber-200/90">
          {Math.round(orbitsSinceEpoch(el, jd)).toLocaleString()} orbits since that epoch → position
          ±{sig === null ? "?" : ((2 * sig * 180) / Math.PI).toFixed(1)}° (2σ), TTVs ignored
        </div>
        <div className="mt-1 text-white/45">
          Cached · Snapshot {TRAPPIST1.snapshotDate} · pscomppars
        </div>
      </div>
    </Html>
  );
}

function Assumptions() {
  const outer = (TRAPPIST1.planets.at(-1)?.a.value ?? 0.062) * SCALE + 0.8;
  return (
    <>
      <Line
        points={[
          [-outer, 0, 0],
          [outer, 0, 0],
        ]}
        color="#94a3b8"
        dashed
        dashSize={0.1}
        gapSize={0.1}
        lineWidth={1}
      />
      <Html position={[outer, 0, 0]} style={{ pointerEvents: "none" }}>
        <div className="w-40 text-[10px] text-slate-300">
          Line of nodes assumed (Ω unknown); all orbits drawn coplanar
        </div>
      </Html>
      <Line
        points={[
          [0, 0, 0],
          [0, 0, outer + 0.8],
        ]}
        color="#93c5fd"
        dashed
        dashSize={0.12}
        gapSize={0.08}
        lineWidth={1.2}
      />
      <Html position={[0, 0, outer + 1.1]} center style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap text-[10px] text-sky-300">
          Earth (system is edge-on, i ≈ 89.8°)
        </div>
      </Html>
    </>
  );
}

function LayerPanel({ layers, onChange }: { layers: Layers; onChange: (l: Layers) => void }) {
  const items: [keyof Layers, string, string][] = [
    ["orbitBands", "Orbit uncertainty", "band = ±1σ in a; most are thinner than the line"],
    ["positionSmear", "Position uncertainty", "±2σ from propagating the epoch to now"],
    ["assumptions", "Assumptions", "line of nodes, Earth direction"],
    ["trueSize", "True sizes", "planets at real scale (tiny!); star stays ×3"],
  ];
  return (
    <div className="absolute top-3 left-3 w-60 rounded-lg border border-white/10 bg-black/75 p-2.5 text-xs text-white/85 backdrop-blur">
      <div className="mb-1.5 font-semibold">Honesty layers</div>
      {items.map(([k, label, hint]) => (
        <label key={k} className="mb-1 flex cursor-pointer gap-2">
          <input
            type="checkbox"
            checked={layers[k]}
            onChange={(e) => {
              onChange({ ...layers, [k]: e.target.checked });
            }}
            className="mt-0.5 accent-sky-400"
          />
          <span>
            {label}
            <span className="block text-[10px] text-white/50">{hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function VariantC() {
  const [layers, setLayers] = useState<Layers>({
    orbitBands: true,
    positionSmear: true,
    assumptions: true,
    trueSize: false,
  });
  const planets = planetsWithElements();
  useEffect(() => {
    useProto.getState().setSizeScale(25); // smaller planets so the position smear shows
  }, []);
  return (
    <div className="relative h-full w-full" data-testid="variant-c">
      <Canvas
        data-testid="system-view"
        camera={{ position: [0, 7.5, 11], fov: 45 }}
        onPointerMissed={() => {
          useProto.getState().select(null);
        }}
      >
        <ambientLight intensity={0.35} />
        <Star />
        {planets.map((p) => (
          <group key={p.id}>
            <OrbitLine planet={p} opacity={0.35} />
            {layers.orbitBands && <OrbitBand planet={p} />}
            {layers.positionSmear && <PositionSmear planet={p} />}
            <PlanetBody planet={p} showLabel>
              <ProvenanceCallout planet={p} />
            </PlanetBody>
          </group>
        ))}
        {layers.assumptions && <Assumptions />}
        <OrbitControls />
      </Canvas>
      <LayerPanel
        layers={layers}
        onChange={(l) => {
          setLayers(l);
          useProto.getState().setSizeScale(l.trueSize ? 1 : 25);
        }}
      />
      <TimeControls className="absolute bottom-3 left-3" />
      <div className="absolute right-3 bottom-3 text-[10px] text-white/50">
        Hover a planet for provenance · Cached · Snapshot {TRAPPIST1.snapshotDate}
      </div>
    </div>
  );
}
