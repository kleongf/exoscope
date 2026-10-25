/** R3F building blocks for the honesty-layers System view. Orbital (x, y) maps to scene (x, 0, y). */
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ComponentRef, type RefObject } from "react";
import { DoubleSide } from "three";
import { assumptionAnchors, EARTH_LABEL, NODES_LABEL, type LabelRegistry } from "./labels";
import { bandRadii, orbitPath, sigma, spreadArc } from "./maths";
import type { PlanetLayout } from "./layout";

type Vec3 = [number, number, number];

export function Star({ radius }: { radius: number }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial color="#ff7a3d" />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 2.2, 32, 32]} />
        <meshBasicMaterial color="#ff5a1f" transparent opacity={0.18} />
      </mesh>
      <pointLight intensity={6} distance={0} decay={0} />
    </group>
  );
}

function circlePoints(radius: number, segments = 160): Vec3[] {
  return Array.from({ length: segments + 1 }, (_, k): Vec3 => {
    const t = (2 * Math.PI * k) / segments;
    return [radius * Math.cos(t), 0, radius * Math.sin(t)];
  });
}

/** The orbit itself: a Keplerian ellipse, or a dashed circle when the orbit is schematic. */
export function OrbitLine({
  item,
  scale,
  selected,
}: {
  item: PlanetLayout;
  scale: number;
  selected: boolean;
}) {
  const { model, color } = item;
  const points = useMemo((): Vec3[] => {
    if (model.kind === "schematic") return circlePoints(model.radiusAu * scale);
    return orbitPath(model.elements).map(([x, y]): Vec3 => [x * scale, 0, y * scale]);
  }, [model, scale]);
  return (
    <Line
      points={points}
      color={color}
      lineWidth={selected ? 2.2 : 1}
      transparent
      opacity={selected ? 0.95 : 0.4}
      dashed={model.kind === "schematic"}
      dashSize={0.15}
      gapSize={0.12}
    />
  );
}

/** ±1σ band in semi-major axis. Drawn as a ring: these orbits are nearly circular. */
export function OrbitBand({ item, scale }: { item: PlanetLayout; scale: number }) {
  const a = item.planet.semiMajorAxis.value;
  const s = sigma(item.planet.semiMajorAxis);
  if (item.model.kind !== "keplerian" || a === null || s === null) return null;
  const { inner, outer } = bandRadii(a, s);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[inner * scale, outer * scale, 160]} />
      <meshBasicMaterial color={item.color} transparent opacity={0.22} side={DoubleSide} />
    </mesh>
  );
}

function toScene(arc: [number, number][], scale: number): number[] {
  return arc.flatMap(([x, y]) => [x * scale, 0.001, y * scale]);
}

/**
 * ±2σ arc of where the planet could be after propagating its transit epoch to now. The arc is
 * recomputed every frame from the simulation clock so it stays centred on the moving planet.
 */
export function PositionSpread({
  item,
  scale,
  jd,
  jdRef,
}: {
  item: PlanetLayout;
  scale: number;
  /** Throttled clock, used for the first render. */
  jd: number;
  jdRef: RefObject<number>;
}) {
  const { model, planet, color } = item;
  const lineRef = useRef<ComponentRef<typeof Line>>(null);
  const initial = useMemo((): Vec3[] | null => {
    if (model.kind !== "keplerian") return null;
    const arc = spreadArc(planet, model.elements, jd);
    return arc === null ? null : arc.map(([x, y]): Vec3 => [x * scale, 0.001, y * scale]);
    // Only the first render uses this; useFrame keeps it current afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, planet, scale]);
  useFrame(() => {
    if (model.kind !== "keplerian" || lineRef.current === null) return;
    const arc = spreadArc(planet, model.elements, jdRef.current);
    if (arc !== null) lineRef.current.geometry.setPositions(toScene(arc, scale));
  });
  if (initial === null) return null;
  return (
    <Line ref={lineRef} points={initial} color={color} lineWidth={9} transparent opacity={0.6} />
  );
}

/** The line of nodes we had to assume (Ω is unknown) and the direction of Earth. */
export function AssumptionLines({ extent, labels }: { extent: number; labels: LabelRegistry }) {
  const reach = extent + 0.8;
  useEffect(() => {
    const { nodes, earth } = assumptionAnchors(extent);
    labels.setWorld(NODES_LABEL, nodes);
    labels.setWorld(EARTH_LABEL, earth);
    return () => {
      labels.setWorld(NODES_LABEL, null);
      labels.setWorld(EARTH_LABEL, null);
    };
  }, [extent, labels]);
  return (
    <>
      <Line
        points={[
          [-reach, 0, 0],
          [reach, 0, 0],
        ]}
        color="#94a3b8"
        dashed
        dashSize={0.1}
        gapSize={0.1}
        lineWidth={1}
      />
      <Line
        points={[
          [0, 0, 0],
          [0, 0, extent + 0.4],
        ]}
        color="#93c5fd"
        dashed
        dashSize={0.12}
        gapSize={0.08}
        lineWidth={1.2}
      />
    </>
  );
}

/** Moves every DOM label to its anchor once per frame. Mount it last inside the Canvas. */
export function LabelProjector({ labels }: { labels: LabelRegistry }) {
  useFrame(({ camera, size }) => {
    labels.project(camera, size.width, size.height);
  });
  return null;
}
