import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

/** The System view: exactly one System in 3D. Placeholder star for now. */
export function SystemView() {
  return (
    <Canvas data-testid="system-view" camera={{ position: [0, 4, 8] }}>
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 0, 0]} intensity={50} />
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#ff9b54" />
      </mesh>
      <OrbitControls />
    </Canvas>
  );
}
