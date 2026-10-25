/** Glides the camera to a focused planet and then follows it along its orbit. */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { Vector3 } from "three";
import type { PlanetLayout } from "./layout";
import { positionAt } from "./maths";

/** Camera distance from a focused planet, in scene units. */
const FOCUS_DISTANCE = 2.2;
/** Glide rate (1/s): remaining distance shrinks by e^(-rate·t) whatever the frame rate. */
const GLIDE_RATE = 4;

/** The part of drei's default OrbitControls this component drives. */
interface Controls {
  target: Vector3;
  update: () => void;
}

function worldPosition(item: PlanetLayout, scale: number, jd: number, out: Vector3): Vector3 {
  const { model } = item;
  if (model.kind === "schematic") return out.set(model.radiusAu * scale, 0, 0);
  const pos = positionAt(model.elements, jd);
  return out.set(pos.x * scale, 0, pos.y * scale);
}

export function CameraFocus({
  item,
  scale,
  jdRef,
}: {
  item: PlanetLayout | null;
  scale: number;
  jdRef: RefObject<number>;
}) {
  const controls = useThree((state) => state.controls) as unknown as Controls | null;
  const camera = useThree((state) => state.camera);
  const gliding = useRef(false);
  const planet = useRef(new Vector3());
  const previous = useRef(new Vector3());
  const desired = useRef(new Vector3());

  useEffect(() => {
    gliding.current = item !== null;
    if (item !== null) worldPosition(item, scale, jdRef.current, previous.current);
  }, [item, scale, jdRef]);

  useFrame((_, seconds) => {
    if (item === null || controls === null) return;
    worldPosition(item, scale, jdRef.current, planet.current);
    // Follow: carry camera and target along with the planet's motion this frame, so the glide
    // still converges when time runs fast.
    const moved = planet.current.clone().sub(previous.current);
    camera.position.add(moved);
    controls.target.add(moved);
    if (gliding.current) {
      const away = camera.position.clone().sub(controls.target).normalize();
      desired.current.copy(planet.current).addScaledVector(away, FOCUS_DISTANCE);
      const step = 1 - Math.exp(-GLIDE_RATE * Math.min(seconds, 0.5));
      camera.position.lerp(desired.current, step);
      controls.target.lerp(planet.current, step);
      if (controls.target.distanceTo(planet.current) < 0.01) gliding.current = false;
    }
    previous.current.copy(planet.current);
    controls.update();
  });
  return null;
}
