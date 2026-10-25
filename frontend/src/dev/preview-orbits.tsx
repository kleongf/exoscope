/**
 * Dev-only preview of the honesty-layers System view with the TRAPPIST-1 Snapshot, until the
 * scene is wired to /turn. Open /?preview=orbits on the dev server; never part of a build.
 */
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OrbitScene, PlanetCard, type OrbitSystem } from "@/features/scene/orbits";
import fixture from "./trappist1.fixture.json";

const SYSTEM = fixture as OrbitSystem;

export function PreviewOrbits() {
  const params = new URLSearchParams(window.location.search);
  const [selected, setSelected] = useState<string | null>(params.get("planet"));
  return (
    <TooltipProvider>
      <div className="dark relative h-screen w-screen bg-[#05060a] text-foreground">
        <OrbitScene system={SYSTEM} selectedPlanet={selected} onSelectPlanet={setSelected} />
        <div className="absolute top-3 right-3">
          <PlanetCard
            system={SYSTEM}
            planetName={selected}
            onClose={() => {
              setSelected(null);
            }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
