// PROTOTYPE (issue #5): small R3F building blocks shared by the orbit variants.
/* eslint-disable react-refresh/only-export-components -- PROTOTYPE helpers live beside components */
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import type { Group } from "three";
import {
  AU_PER_REARTH,
  AU_PER_RSUN,
  elementsOf,
  orbitPath,
  positionAt,
  type ProtoPlanet,
} from "./PROTOTYPE_orbits";
import { TRAPPIST1 } from "./PROTOTYPE_trappist1";
import { useProto } from "./PROTOTYPE_store";

/** Scene units per AU. Orbital plane (x, y) maps to scene (x, 0, y); +z points at Earth. */
export const SCALE = 100;
export const STAR_SCALE = 3;

const COLORS: Record<string, string> = {
  b: "#f97316",
  c: "#facc15",
  d: "#a3e635",
  e: "#22d3ee",
  f: "#60a5fa",
  g: "#a78bfa",
  h: "#f472b6",
};

export function planetColor(p: ProtoPlanet): string {
  return COLORS[p.letter] ?? "#e5e7eb";
}

export function starRadiusScene(): number {
  return (TRAPPIST1.star.radius.value ?? 0.12) * AU_PER_RSUN * SCALE * STAR_SCALE;
}

export function Star({ children }: { children?: ReactNode }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[starRadiusScene(), 32, 32]} />
        <meshBasicMaterial color="#ff7a3d" />
      </mesh>
      <mesh>
        <sphereGeometry args={[starRadiusScene() * 2.2, 32, 32]} />
        <meshBasicMaterial color="#ff5a1f" transparent opacity={0.18} />
      </mesh>
      <pointLight intensity={6} distance={0} decay={0} />
      {children}
    </group>
  );
}

export function OrbitLine({
  planet,
  opacity = 0.55,
  dashed = false,
}: {
  planet: ProtoPlanet;
  opacity?: number;
  dashed?: boolean;
}) {
  const selected = useProto((s) => s.selectedId === planet.id);
  const points = useMemo(() => {
    const el = elementsOf(planet);
    return el === null
      ? []
      : orbitPath(el).map(([x, y]): [number, number, number] => [x * SCALE, 0, y * SCALE]);
  }, [planet]);
  if (points.length === 0) return null;
  return (
    <Line
      points={points}
      color={planetColor(planet)}
      lineWidth={selected ? 2.2 : 1}
      transparent
      opacity={selected ? 0.95 : opacity}
      dashed={dashed}
      dashSize={0.15}
      gapSize={0.1}
    />
  );
}

/** A planet that moves along its Keplerian orbit as simulated time advances. */
export function PlanetBody({
  planet,
  showLabel = true,
  children,
}: {
  planet: ProtoPlanet;
  showLabel?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<Group>(null);
  const el = elementsOf(planet);
  const sizeScale = useProto((s) => s.sizeScale);
  const selected = useProto((s) => s.selectedId === planet.id);
  const radius = (planet.radius.value ?? 1) * AU_PER_REARTH * SCALE * sizeScale;

  useFrame(() => {
    if (el === null || ref.current === null) return;
    const pos = positionAt(el, useProto.getState().jd);
    ref.current.position.set(pos.x * SCALE, 0, pos.y * SCALE);
  });

  return (
    <group ref={ref}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          useProto.getState().select(planet.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          useProto.getState().hover(planet.id);
        }}
        onPointerOut={() => {
          useProto.getState().hover(null);
        }}
      >
        <sphereGeometry args={[Math.max(radius, 0.02), 24, 24]} />
        <meshStandardMaterial
          color={planetColor(planet)}
          emissive={planetColor(planet)}
          emissiveIntensity={0.25}
        />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 1.5 + 0.05, radius * 1.5 + 0.09, 48]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
      {showLabel && (
        <Html center position={[0, 0, -(radius + 0.22)]} style={{ pointerEvents: "none" }}>
          <span
            className="font-mono text-[11px] font-semibold"
            style={{ color: planetColor(planet) }}
          >
            {planet.letter}
          </span>
        </Html>
      )}
      {children}
    </group>
  );
}

/** Arrow in the orbital plane pointing toward Earth (+z), i.e. the transit side. */
export function EarthArrow({ label }: { label: ReactNode }) {
  const outer = (TRAPPIST1.planets.at(-1)?.a.value ?? 0.06) * SCALE;
  return (
    <group>
      <Line
        points={[
          [0, 0, outer + 0.4],
          [0, 0, outer + 1.4],
        ]}
        color="#93c5fd"
        lineWidth={1.5}
        dashed
        dashSize={0.12}
        gapSize={0.08}
      />
      <Html center position={[0, 0, outer + 1.75]} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap font-mono text-[10px] text-sky-300">{label}</div>
      </Html>
    </group>
  );
}

export function planetsWithElements(): ProtoPlanet[] {
  return TRAPPIST1.planets.filter((p) => elementsOf(p) !== null);
}
