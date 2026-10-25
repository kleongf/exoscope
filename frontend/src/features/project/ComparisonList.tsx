import { ChartScatter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { comparisonTitle } from "@/features/compare/adapt";
import { useExoStore } from "@/store/store";

/** The Project's comparisons; clicking one reopens its chart and table in the drawer. */
export function ComparisonList() {
  const comparisons = useExoStore((s) => s.comparisons);
  const active = useExoStore((s) => s.activeComparisonId);
  const open = useExoStore((s) => s.openComparison);
  return (
    <section className="border-t px-3 py-3" aria-label="Comparisons">
      <h3 className="mb-2 px-1 text-xs font-medium text-muted-foreground">Comparisons</h3>
      {comparisons.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">None yet</p>
      ) : (
        comparisons.map(({ id, comparison }) => (
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
        ))
      )}
    </section>
  );
}
