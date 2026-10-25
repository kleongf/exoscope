import { ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useExoStore } from "@/store/store";
import { InterpretationChip } from "./InterpretationChip";
import { sampleTitle } from "./sampleView";

/** The Project's Samples with their Interpretation chips; clicking one reopens its table. */
export function SampleList() {
  const samples = useExoStore((s) => s.samples);
  const active = useExoStore((s) => (s.drawerView === "sample" ? s.activeSampleId : null));
  const open = useExoStore((s) => s.openSample);
  return (
    <section className="border-t px-3 py-3" aria-label="Samples">
      <h3 className="mb-2 px-1 text-xs font-medium text-muted-foreground">Samples</h3>
      {samples.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">None yet</p>
      ) : (
        samples.map(({ id, sample }) => (
          <div key={id} className="mb-2" data-testid="sample-item">
            <Button
              variant={id === active ? "secondary" : "ghost"}
              className="h-auto w-full justify-between gap-2 py-1.5 text-left text-xs whitespace-normal"
              onClick={() => {
                open(id);
              }}
            >
              <span className="flex items-start gap-2">
                <ListFilter className="mt-0.5 size-3.5 shrink-0" />
                {sampleTitle(sample)}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {sample.matched.toLocaleString()}
              </Badge>
            </Button>
            {sample.interpretations.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1 px-1">
                {sample.interpretations.map((interpretation) => (
                  <InterpretationChip
                    key={interpretation.term}
                    interpretation={interpretation}
                    sample={sample}
                  />
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );
}
