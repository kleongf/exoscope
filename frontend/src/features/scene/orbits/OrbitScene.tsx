/**
 * The System view's orbit scene ("honesty layers"): real Keplerian orbits at true relative scale
 * in a tilted 3D view, with uncertainty and assumptions drawn rather than hidden.
 * Time, labels, colouring and camera focus are controlled by the caller (the store);
 * honesty layers are local, manual toggles.
 */
import { OrbitControls } from "@react-three/drei";
import { ArSystemButton } from "@/features/ar/ArSystemButton";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CameraFocus } from "./CameraFocus";
import { colorize, type ColorProperty } from "./colorBy";
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
import { Legend, ViewControls } from "./ViewControls";

/** How often the date readout, spread arcs and hover card catch up with simulated time. */
const READOUT_MS = 200;

export interface OrbitSceneProps {
  system: OrbitSystem;
  /** Canonical `pl_name` of the selected planet, if any. */
  selectedPlanet: string | null;
  onSelectPlanet: (name: string | null) => void;
  /** Planet the camera glides to and follows; null leaves the camera free. */
  cameraFocus: string | null;
  playing: boolean;
  daysPerSecond: number;
  showLabels: boolean;
  colorBy: ColorProperty;
  onPlayingChange: (playing: boolean) => void;
  onSpeedChange: (daysPerSecond: number) => void;
  onShowLabelsChange: (visible: boolean) => void;
  onColorByChange: (property: ColorProperty) => void;
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
  return { jdRef, jd, resetToNow };
}

export function OrbitScene(props: OrbitSceneProps) {
  const { system, selectedPlanet, onSelectPlanet } = props;
  const base = useMemo(() => buildLayout(system), [system]);
  const { planets, legend } = useMemo(
    () => colorize(base.planets, props.colorBy),
    [base, props.colorBy],
  );
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [hovered, setHovered] = useState<string | null>(null);
  const [labels] = useState(() => new LabelRegistry());
  const time = useSimTime();
  const sizes = layers.trueSizes ? TRUE_SIZES : EXAGGERATED;
  const extent = base.maxAu * base.scale;
  const inclination = system.planets[0]?.inclination.value ?? null;
  const focusItem = planets.find((p) => p.planet.name === props.cameraFocus) ?? null;

  return (
    <div className="flex h-full w-full flex-col" data-testid="orbit-scene">
      <div className="relative min-h-0 flex-1">
        <Canvas
          camera={{ position: [0, 8.5, 13], fov: 45 }}
          onPointerMissed={() => {
            onSelectPlanet(null);
          }}
        >
          <ambientLight intensity={0.35} />
          <Clock jdRef={time.jdRef} playing={props.playing} daysPerSecond={props.daysPerSecond} />
          <Star radius={starRadiusScene(system, base.scale, sizes)} />
          {planets.map((item) => (
            <group key={item.planet.name}>
              <OrbitLine
                item={item}
                scale={base.scale}
                selected={item.planet.name === selectedPlanet}
              />
              {layers.orbitBands && <OrbitBand item={item} scale={base.scale} />}
              {layers.positionSpread && (
                <PositionSpread item={item} scale={base.scale} jd={time.jd} jdRef={time.jdRef} />
              )}
              <PlanetBody
                item={item}
                scale={base.scale}
                radius={planetRadiusScene(item.planet, base.scale, sizes)}
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
          <CameraFocus item={focusItem} scale={base.scale} jdRef={time.jdRef} />
          <LabelProjector labels={labels} />
        </Canvas>
        <LabelOverlay
          labels={labels}
          planets={planets}
          showAssumptions={layers.assumptions}
          inclinationDeg={inclination}
          hovered={planets.find((p) => p.planet.name === hovered) ?? null}
          jd={time.jd}
          provenance={system.provenance}
          showLabels={props.showLabels}
          onSelect={onSelectPlanet}
        />
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <LayerPanel layers={layers} onChange={setLayers} />
          <ViewControls
            showLabels={props.showLabels}
            colorBy={props.colorBy}
            onShowLabelsChange={props.onShowLabelsChange}
            onColorByChange={props.onColorByChange}
          />
        </div>
        <div className="absolute bottom-3 left-3 flex flex-col items-start gap-2">
          {legend && <Legend legend={legend} />}
          <TimeControls
            jd={time.jd}
            playing={props.playing}
            daysPerSecond={props.daysPerSecond}
            onPlayingChange={props.onPlayingChange}
            onSpeedChange={props.onSpeedChange}
            onResetToNow={time.resetToNow}
          />
          <ArSystemButton system={system} getJd={() => time.jdRef.current} />
        </div>
      </div>
      {/* Always visible, outside the canvas so no control ever covers it. */}
      <div className="flex justify-end border-t border-white/10 bg-black px-3 py-1.5">
        <CaveatBadge sizes={sizes} provenance={provenanceLabel(system.provenance)} />
      </div>
    </div>
  );
}
