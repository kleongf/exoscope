import type { Dispatch, SetStateAction } from "react";
import type { ReportInclude } from "@/api/client";
import { Button } from "@/components/ui/button";
import { comparisonTitle } from "@/features/compare/adapt";
import { sampleTitle } from "@/features/catalog/sampleView";
import { useExoStore } from "@/store/store";

function toggle<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
export function ScopePicker({
  include,
  setInclude,
}: {
  include: ReportInclude;
  setInclude: Dispatch<SetStateAction<ReportInclude>>;
}) {
  const { project, status } = useExoStore((s) => s);
  const systems = project?.systems ?? [];
  const comparisons = project?.comparisons ?? [];
  const samples = project?.samples ?? [];
  const sources = project?.web_sources ?? [];
  return (
    <div className="max-h-72 space-y-3 overflow-auto" aria-label="Report scope">
      <section>
        <h4 className="text-xs font-medium">Systems</h4>
        {systems.map(({ id, system }) => (
          <Button
            key={system.hostname}
            type="button"
            disabled={status !== "idle"}
            variant={include.systems.includes(id) ? "secondary" : "ghost"}
            className="h-auto w-full justify-start whitespace-normal text-left text-xs"
            aria-label={`Include System ${system.hostname}`}
            aria-pressed={include.systems.includes(id)}
            onClick={() => {
              setInclude((s) => ({ ...s, systems: toggle(s.systems, id) }));
            }}
          >
            {system.hostname}
          </Button>
        ))}
      </section>
      <section>
        <h4 className="text-xs font-medium">Comparisons</h4>
        {comparisons.map(({ id, comparison }) => (
          <Button
            key={id}
            type="button"
            disabled={status !== "idle"}
            variant={include.comparisons.includes(id) ? "secondary" : "ghost"}
            className="h-auto w-full justify-start whitespace-normal text-left text-xs"
            aria-label={`Include comparison ${id}`}
            aria-pressed={include.comparisons.includes(id)}
            onClick={() => {
              setInclude((s) => ({ ...s, comparisons: toggle(s.comparisons, id) }));
            }}
          >
            {comparisonTitle(comparison)}
          </Button>
        ))}
      </section>
      <section>
        <h4 className="text-xs font-medium">Samples</h4>
        {samples.map(({ id, sample }) => (
          <Button
            key={id}
            type="button"
            disabled={status !== "idle"}
            variant={include.samples.includes(id) ? "secondary" : "ghost"}
            className="h-auto w-full justify-start whitespace-normal text-left text-xs"
            aria-label={`Include Sample ${id}`}
            aria-pressed={include.samples.includes(id)}
            onClick={() => {
              setInclude((s) => ({ ...s, samples: toggle(s.samples, id) }));
            }}
          >
            {sampleTitle(sample)}
          </Button>
        ))}
      </section>
      <section>
        <h4 className="text-xs font-medium">Web sources</h4>
        {sources.map((source) => (
          <Button
            key={source.id}
            type="button"
            disabled={status !== "idle"}
            variant={include.web_sources.includes(source.id) ? "secondary" : "ghost"}
            className="h-auto w-full justify-start whitespace-normal text-left text-xs"
            aria-label={`Include Web source ${source.title}`}
            aria-pressed={include.web_sources.includes(source.id)}
            onClick={() => {
              setInclude((s) => ({ ...s, web_sources: toggle(s.web_sources, source.id) }));
            }}
          >
            {source.title}
          </Button>
        ))}
      </section>
    </div>
  );
}
