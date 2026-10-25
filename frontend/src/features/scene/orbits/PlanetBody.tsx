/** A planet moving along its orbit, with a pick target and selection ring. Labels live in the overlay. */
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { Vector3, type Group } from "three";
import { HOVER_LABEL, type LabelRegistry } from "./labels";
import { positionAt } from "./maths";
import type { PlanetLayout } from "./layout";

/** Bodies smaller than this (scene units) still get a pickable target of this size. */
const MIN_PICK_RADIUS = 0.12;
/** Marker size for a planet whose radius is missing in the archive. */
const UNKNOWN_RADIUS_MARKER = 0.05;

interface PlanetBodyProps {
  item: PlanetLayout;
  scale: number;
  radius: number | null;
  jdRef: RefObject<number>;
  selected: boolean;
  hovered: boolean;
  labels: LabelRegistry;
  onSelect: (name: string) => void;
  onHover: (name: string | null) => void;
}

function placeAt(group: Group, item: PlanetLayout, scale: number, jd: number): void {
  const { model } = item;
  if (model.kind === "schematic") {
    // No phase is known: park it on the +x side of its schematic orbit.
    group.position.set(model.radiusAu * scale, 0, 0);
    return;
  }
  const pos = positionAt(model.elements, jd);
  group.position.set(pos.x * scale, 0, pos.y * scale);
}

export function PlanetBody(props: PlanetBodyProps) {
  const { item, scale, radius, jdRef, selected, hovered, labels, onSelect, onHover } = props;
  const ref = useRef<Group>(null);
  const anchor = useRef(new Vector3());
  const { planet, color } = item;
  const shown = radius ?? UNKNOWN_RADIUS_MARKER;
  const pick = Math.max(shown, MIN_PICK_RADIUS);

  useFrame(() => {
    const group = ref.current;
    if (group === null) return;
    placeAt(group, item, scale, jdRef.current);
    labels.setWorld(
      planet.name,
      anchor.current.copy(group.position).setZ(group.position.z - pick - 0.18),
    );
    if (hovered) labels.setWorld(HOVER_LABEL, group.position);
  });

  useEffect(
    () => () => {
      labels.setWorld(planet.name, null);
    },
    [labels, planet.name],
  );

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[shown, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <mesh
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(planet.name);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(planet.name);
        }}
        onPointerOut={() => {
          onHover(null);
        }}
      >
        <sphereGeometry args={[pick, 12, 12]} />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[pick * 1.4, pick * 1.4 + 0.04, 48]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  );
}
