import { OrbitControls, Html, Line } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { System } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useExoStore } from "@/store/store";
import { PlanetPanel } from "./PlanetPanel";
import { SystemEvidence } from "./SystemEvidence";
import { provenanceLabel } from "./provenance";

// Keep scene labels below the planet card (z-10) and dialogs; drei's default is ~16.7M.
const LABEL_Z: [number, number] = [9, 0];
const COLORS = ["#9ed9de", "#cfb9ed", "#f0ba88", "#a8c99a"];
function SystemScene({ system }: { system: System }) {
  const select = useExoStore((state) => state.selectPlanet);
  const selected = useExoStore((state) => state.focusedPlanetName);
  const planets = system.planets.flatMap((planet) =>
    planet.semi_major_axis.status === "measured" && planet.semi_major_axis.value > 0
      ? [{ planet, distance: planet.semi_major_axis.value }]
      : [],
  );
  const outer = Math.max(...planets.map(({ distance }) => distance), 0.001);
  return (
    <>
      <ambientLight intensity={1.4} />
      <mesh>
        <sphereGeometry args={[0.14, 32, 32]} />
        <meshBasicMaterial color="#ffcf8a" />
      </mesh>
      <Html position={[0, 0.22, 0]} center zIndexRange={LABEL_Z}>
        <span className="rounded bg-black/70 px-1 text-xs text-white">{system.hostname}</span>
      </Html>
      {planets.map(({ planet, distance }, index) => {
        const radius = (distance / outer) * 3;
        const angle = index * 2.4;
        const points = Array.from(
          { length: 97 },
          (_, i) =>
            [
              Math.cos((i / 96) * Math.PI * 2) * radius,
              0,
              Math.sin((i / 96) * Math.PI * 2) * radius,
            ] as [number, number, number],
        );
        return (
          <group key={planet.name}>
            <Line
              points={points}
              color={selected === planet.name ? "#a8c99a" : "#425366"}
              lineWidth={1}
            />
            <group position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}>
              <mesh
                onClick={(event) => {
                  event.stopPropagation();
                  select(planet.name);
                }}
              >
                <sphereGeometry args={[0.055, 20, 20]} />
                <meshStandardMaterial color={COLORS[index % COLORS.length] ?? "#9ed9de"} />
              </mesh>
              <Html position={[0, 0.14, 0]} center zIndexRange={LABEL_Z}>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-auto bg-black/70 px-1 text-xs text-white hover:bg-black hover:text-white"
                  onClick={() => {
                    select(planet.name);
                  }}
                >
                  {planet.name}
                </Button>
              </Html>
            </group>
          </group>
        );
      })}
      <OrbitControls enablePan={false} minDistance={2} maxDistance={12} />
    </>
  );
}

/** One canonical System; this ticket retains the existing illustrative circular scene. */
export function SystemView() {
  const system = useExoStore((state) => state.system);
  return (
    <section className="flex h-full min-h-0 flex-col" aria-labelledby="system-heading">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">System view</p>
          <h1 id="system-heading" className="text-base font-semibold">
            {system?.hostname ?? "Choose your first System"}
          </h1>
        </div>
        {system && <Badge variant="outline">{provenanceLabel(system.provenance)}</Badge>}
      </header>
      <div className="relative min-h-72 flex-1 bg-[#05060a]" data-testid="system-view">
        {system ? (
          <Canvas camera={{ position: [0, 6, 3], fov: 55 }}>
            <SystemScene system={system} />
          </Canvas>
        ) : (
          <div className="grid h-full min-h-72 place-content-center gap-2 p-6 text-center text-white">
            <p>Open a System to explore its planets.</p>
            <p className="text-sm text-white/60">
              Speak or type “Open TRAPPIST-1” to begin your Project.
            </p>
          </div>
        )}
        <PlanetPanel />
      </div>
      <p className="border-t bg-card px-4 py-2 text-xs text-muted-foreground">
        {system
          ? "Circular orbits at relative archive distances · Illustrative positions · Object sizes enlarged, not to scale · Not an N-body simulation"
          : "Archive data and its Live or Snapshot provenance appear when a System loads."}
      </p>
      {system && (
        <div className="max-h-48 overflow-auto">
          <SystemEvidence system={system} />
        </div>
      )}
    </section>
  );
}
