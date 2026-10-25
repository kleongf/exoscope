/**
 * The System view's orbit scene ("honesty layers"): real Keplerian orbits at true relative scale
 * in a tilted 3D view, with uncertainty and assumptions drawn rather than hidden.
 */
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CaveatBadge, LayerPanel, TimeControls } from "./Controls";
import { DEFAULT_LAYERS, type Layers } from "./layers";
import { buildLayout, EXAGGERATED, planetRadiusScene, starRadiusScene, TRUE_SIZES } from "./layout";
import { jdFromDate } from "./maths";
import { LabelOverlay } from "./LabelOverlay";
import { LabelRegistry } from "./labels";
import { PlanetBody } from "./PlanetBody";
import {
  AssumptionLines,
  LabelProjector,
  OrbitBand,
  OrbitLine,
  PositionSpread,
  Star,
} from "./SceneParts";
import { provenanceLabel, type OrbitSystem } from "./types";

/** How often the date readout, spread arcs and hover card catch up with simulated time. */
const READOUT_MS = 200;

export interface OrbitSceneProps {
  system: OrbitSystem;
  /** Canonical `pl_name` of the selected planet, if any. */
  selectedPlanet: string | null;
  onSelectPlanet: (name: string | null) => void;
}

/** Advances simulated time inside the render loop. */
function Clock({
  jdRef,
  playing,
  daysPerSecond,
}: {
  jdRef: RefObject<number>;
  playing: boolean;
  daysPerSecond: number;
}) {
  useFrame((_, delta) => {
    if (playing) jdRef.current += delta * daysPerSecond;
  });
  return null;
}

function useSimTime() {
  const [start] = useState(() => jdFromDate(new Date()));
  const jdRef = useRef(start);
  const [jd, setJd] = useState(start);
  const [playing, setPlaying] = useState(true);
  const [daysPerSecond, setDaysPerSecond] = useState(0.5);
  useEffect(() => {
    const id = window.setInterval(() => {
      setJd(jdRef.current);
    }, READOUT_MS);
    return () => {
      window.clearInterval(id);
    };
  }, []);
  const resetToNow = () => {
    jdRef.current = jdFromDate(new Date());
    setJd(jdRef.current);
  };
  return { jdRef, jd, playing, setPlaying, daysPerSecond, setDaysPerSecond, resetToNow };
}

export function OrbitScene({ system, selectedPlanet, onSelectPlanet }: OrbitSceneProps) {
  const layout = useMemo(() => buildLayout(system), [system]);
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [hovered, setHovered] = useState<string | null>(null);
  const [labels] = useState(() => new LabelRegistry());
  const time = useSimTime();
  const sizes = layers.trueSizes ? TRUE_SIZES : EXAGGERATED;
  const extent = layout.maxAu * layout.scale;
  const inclination = system.planets[0]?.inclination.value ?? null;

  return (
    <div className="relative h-full w-full" data-testid="orbit-scene">
      <Canvas
        data-testid="system-view"
        camera={{ position: [0, 8.5, 13], fov: 45 }}
        onPointerMissed={() => {
          onSelectPlanet(null);
        }}
      >
        <ambientLight intensity={0.35} />
        <Clock jdRef={time.jdRef} playing={time.playing} daysPerSecond={time.daysPerSecond} />
        <Star radius={starRadiusScene(system, layout.scale, sizes)} />
        {layout.planets.map((item) => (
          <group key={item.planet.name}>
            <OrbitLine
              item={item}
              scale={layout.scale}
              selected={item.planet.name === selectedPlanet}
            />
            {layers.orbitBands && <OrbitBand item={item} scale={layout.scale} />}
            {layers.positionSpread && (
              <PositionSpread item={item} scale={layout.scale} jd={time.jd} jdRef={time.jdRef} />
            )}
            <PlanetBody
              item={item}
              scale={layout.scale}
              radius={planetRadiusScene(item.planet, layout.scale, sizes)}
              jdRef={time.jdRef}
              selected={item.planet.name === selectedPlanet}
              hovered={item.planet.name === hovered}
              labels={labels}
              onSelect={onSelectPlanet}
              onHover={setHovered}
            />
          </group>
        ))}
        {layers.assumptions && <AssumptionLines extent={extent} labels={labels} />}
        <OrbitControls makeDefault />
        <LabelProjector labels={labels} />
      </Canvas>
      <LabelOverlay
        labels={labels}
        planets={layout.planets}
        showAssumptions={layers.assumptions}
        inclinationDeg={inclination}
        hovered={layout.planets.find((p) => p.planet.name === hovered) ?? null}
        jd={time.jd}
        provenance={system.provenance}
      />
      <div className="absolute top-3 left-3">
        <LayerPanel layers={layers} onChange={setLayers} />
      </div>
      <div className="absolute bottom-3 left-3">
        <TimeControls
          jd={time.jd}
          playing={time.playing}
          daysPerSecond={time.daysPerSecond}
          onPlayingChange={time.setPlaying}
          onSpeedChange={time.setDaysPerSecond}
          onResetToNow={time.resetToNow}
        />
      </div>
      <div className="absolute right-3 bottom-3">
        <CaveatBadge sizes={sizes} provenance={provenanceLabel(system.provenance)} />
      </div>
    </div>
  );
}
