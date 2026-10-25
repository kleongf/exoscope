import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CompareChart } from "@/features/compare/CompareChart";
import { CompareDrawer } from "@/features/compare/CompareDrawer";
import { CompareTable } from "@/features/compare/CompareTable";
import type { ComparisonView } from "@/features/compare/types";
import { useExoStore } from "@/store/store";
import { trappist1RadiusVsInsolation } from "./trappist1-comparison";

/** Clearly-labelled simulation so the excluded path can be exercised; never real data. */
function withMissingRadius(c: ComparisonView, planet: string): ComparisonView {
  return {
    ...c,
    rows: c.rows.map((r) =>
      r.planet === planet ? { ...r, x: { status: "missing" }, excluded: "missing_x" } : r,
    ),
  };
}

/** DEV-only preview (?preview=compare): the comparison chart and table with linked selection. */
export function PreviewCompare() {
  const [selected, setSelected] = useState<string | null>(null);
  const [simulateMissing, setSimulateMissing] = useState(false);
  const setDrawerOpen = useExoStore((s) => s.setDrawerOpen);
  useEffect(() => {
    setDrawerOpen(true);
  }, [setDrawerOpen]);

  const comparison = simulateMissing
    ? withMissingRadius(trappist1RadiusVsInsolation, "TRAPPIST-1 d")
    : trappist1RadiusVsInsolation;
  const linked = { selected, onSelectPlanet: setSelected };

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <header className="flex items-center gap-4 border-b border-border px-4 py-2 text-sm">
          <strong>DEV preview · Compare</strong>
          <span className="text-muted-foreground" data-testid="selected-planet">
            Selected: {selected ?? "none"}
          </span>
          <label className="ml-auto flex items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              checked={simulateMissing}
              onChange={(e) => {
                setSimulateMissing(e.target.checked);
              }}
            />
            Simulate a missing radius for TRAPPIST-1 d
          </label>
        </header>
        <div className="flex-1" />
        <CompareDrawer>
          <div className="grid h-80 grid-cols-2 gap-3 p-3">
            <CompareChart comparison={comparison} {...linked} />
            <CompareTable comparison={comparison} {...linked} />
          </div>
        </CompareDrawer>
      </div>
    </TooltipProvider>
  );
}
