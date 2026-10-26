import { ChartScatter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { comparisonTitle } from "@/features/compare/adapt";
import { useExoStore } from "@/store/store";
import { ExplorerSection } from "./ExplorerSection";

/** The Project's comparisons; clicking one reopens its chart and table in the drawer. */
export function ComparisonList() {
  const comparisons = useExoStore((s) => s.comparisons);
  const active = useExoStore((s) => s.activeComparisonId);
  const open = useExoStore((s) => s.openComparison);
  return (
    <ExplorerSection title="Comparisons" count={comparisons.length} empty="None yet">
      {comparisons.map(({ id, comparison }) => (
        <Button
          key={id}
          variant={id === active ? "secondary" : "ghost"}
          className="mb-1 h-auto w-full justify-start gap-2 py-1.5 text-left text-xs whitespace-normal"
          data-testid="comparison-item"
          onClick={() => {
            open(id);
          }}
        >
          <ChartScatter className="size-3.5 shrink-0" />
          {comparisonTitle(comparison)}
        </Button>
      ))}
    </ExplorerSection>
  );
}
