import { CompareChart } from "@/features/compare/CompareChart";
import { CompareTable } from "@/features/compare/CompareTable";
import { useExoStore } from "@/store/store";
import { selectSamplePlanet } from "./selectSamplePlanet";
import { toSampleView } from "./sampleView";

/** The active Sample as the same linked chart and table used for comparisons. */
export function SampleWorkspace() {
  const saved = useExoStore((s) => s.samples.find((x) => x.id === s.activeSampleId));
  const selected = useExoStore((s) => s.focusedPlanetName);
  if (!saved) return null;
  const view = toSampleView(saved.sample);
  const hostOf = new Map(view.rows.map((r) => [r.planet, r.hostname]));
  const linked = {
    selected,
    onSelectPlanet: (planet: string) => {
      void selectSamplePlanet(hostOf.get(planet) ?? "", planet);
    },
  };
  return (
    <div className="grid h-72 grid-cols-1 gap-3 p-3 md:grid-cols-2" data-testid="sample-workspace">
      <CompareChart comparison={view} {...linked} />
      <CompareTable comparison={view} {...linked} />
    </div>
  );
}
