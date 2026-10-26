import { useMemo } from "react";
import type { System } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { useExoStore } from "@/store/store";
import { OrbitScene, toOrbitSystem } from "./orbits";
import { PlanetPanel } from "./PlanetPanel";
import { SystemEvidence } from "./SystemEvidence";
import { provenanceTone } from "@/lib/palette";
import { provenanceLabel } from "./provenance";

/** The orbit scene, driven by the store so agent commands and manual controls share one state. */
function ConnectedOrbitScene({ system }: { system: System }) {
  const orbitSystem = useMemo(() => toOrbitSystem(system), [system]);
  const selected = useExoStore((state) => state.focusedPlanetName);
  const cameraFocus = useExoStore((state) => state.cameraFocus);
  const playing = useExoStore((state) => state.playing);
  const daysPerSecond = useExoStore((state) => state.daysPerSecond);
  const showLabels = useExoStore((state) => state.showLabels);
  const colorBy = useExoStore((state) => state.colorBy);
  const select = useExoStore((state) => state.selectPlanet);
  const setPlaying = useExoStore((state) => state.setPlaying);
  const apply = useExoStore((state) => state.applyCommand);
  return (
    <OrbitScene
      system={orbitSystem}
      selectedPlanet={selected}
      onSelectPlanet={select}
      cameraFocus={cameraFocus}
      playing={playing}
      daysPerSecond={daysPerSecond}
      showLabels={showLabels}
      colorBy={colorBy}
      onPlayingChange={setPlaying}
      onSpeedChange={(days_per_second) => {
        apply({ kind: "set_time_scale", days_per_second });
      }}
      onShowLabelsChange={(visible) => {
        apply({ kind: "set_labels", visible });
      }}
      onColorByChange={(property) => {
        apply({ kind: "set_color_by", property });
      }}
    />
  );
}

/** One canonical System at a time, drawn with real orbits and visible honesty layers. */
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
        {system && (
          <Badge variant="outline" className={provenanceTone(system.provenance.mode)}>
            {provenanceLabel(system.provenance)}
          </Badge>
        )}
      </header>
      <div className="relative min-h-96 flex-1 bg-[#05060a]" data-testid="system-view">
        {system ? (
          <ConnectedOrbitScene system={system} />
        ) : (
          <div className="grid h-full min-h-72 place-content-center gap-2 p-6 text-center text-white">
            <p className="text-sm text-white/50">No System open</p>
          </div>
        )}
        <PlanetPanel />
      </div>
      {system && (
        <div className="max-h-48 overflow-auto">
          <SystemEvidence system={system} />
        </div>
      )}
    </section>
  );
}
