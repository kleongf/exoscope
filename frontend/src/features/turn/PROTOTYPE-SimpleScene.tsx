// PROTOTYPE (prototype/turn-ui): minimal scene. Another prototype owns real orbits.
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { TRAPPIST_1 } from "./PROTOTYPE-data";

const AU_TO_SCENE = 90;

function Planets() {
  return (
    <>
      {TRAPPIST_1.map((p, i) => {
        const r = p.a * AU_TO_SCENE;
        const angle = i * 1.7;
        return (
          <group key={p.id}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[r - 0.01, r + 0.01, 128]} />
              <meshBasicMaterial color="#3a4256" />
            </mesh>
            <mesh position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}>
              <sphereGeometry args={[0.06 * p.radius + 0.04, 24, 24]} />
              <meshBasicMaterial color="#8fb3ff" />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/** Star alone until a System is loaded; then TRAPPIST-1's planets on schematic circles. */
export function SimpleScene({ system, dimmed }: { system: string | null; dimmed?: boolean }) {
  return (
    <Canvas
      data-testid="system-view"
      camera={{ position: [0, 7, 3.5] }}
      style={{ opacity: dimmed ? 0.55 : 1, transition: "opacity 300ms" }}
    >
      <mesh>
        <sphereGeometry args={[system ? 0.35 : 1, 32, 32]} />
        <meshBasicMaterial color="#ff9b54" />
      </mesh>
      {system && <Planets />}
      <OrbitControls />
    </Canvas>
  );
}
