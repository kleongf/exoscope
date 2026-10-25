import { useExoStore } from "@/store/store";
import { toComparisonView } from "./adapt";
import { CompareChart } from "./CompareChart";
import { CompareTable } from "./CompareTable";

/** The active Project comparison as a linked chart and table; null when there is none. */
export function CompareWorkspace() {
  const saved = useExoStore((s) => s.comparisons.find((c) => c.id === s.activeComparisonId));
  const selected = useExoStore((s) => s.focusedPlanetName);
  const selectPlanetIn = useExoStore((s) => s.selectPlanetIn);
  if (!saved) return null;
  const comparison = toComparisonView(saved.comparison);
  const hostOf = new Map(comparison.rows.map((r) => [r.planet, r.hostname]));
  const linked = {
    selected,
    onSelectPlanet: (planet: string) => {
      selectPlanetIn(hostOf.get(planet) ?? "", planet);
    },
  };
  return (
    <div className="grid h-72 grid-cols-1 gap-3 p-3 md:grid-cols-2" data-testid="compare-workspace">
      <CompareChart comparison={comparison} {...linked} />
      <CompareTable comparison={comparison} {...linked} />
    </div>
  );
}
