import { Telescope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useExoStore } from "@/store/store";
import { projectTurnController } from "@/features/voice/turnController";
import { SampleList } from "@/features/catalog/SampleList";
import { collectWebSources } from "@/features/websearch/evidence";
import { ProjectHeader } from "./ProjectHeader";
import { ComparisonList } from "./ComparisonList";
import { ProjectGroup } from "./ProjectGroup";
import { ProjectWebSources } from "./ProjectWebSources";

/** Saved evidence accumulates while the System view shows one System. */
export function ProjectExplorer() {
  const systems = useExoStore((state) => state.loadedSystems);
  const current = useExoStore((state) => state.system);
  const busy = useExoStore((state) => state.status !== "idle");
  const sampleCount = useExoStore((state) => state.samples.length);
  const comparisonCount = useExoStore((state) => state.comparisons.length);
  const turns = useExoStore((state) => state.turns);
  const reportCount = useExoStore((state) => state.currentProject?.reports.length ?? 0);
  const webSourceCount = collectWebSources(turns).sources.length;
  return (
    <aside aria-label="Project explorer" className="flex min-h-0 flex-col bg-card">
      <header className="flex items-center gap-2 px-4 py-3">
        <Telescope className="size-4" />
        <h2 className="text-sm font-semibold">ExoScope</h2>
      </header>
      <Separator />
      <ProjectHeader />
      <ScrollArea className="min-h-0 flex-1">
        <ProjectGroup sectionId="systems" label="Systems opened" count={systems.length}>
          <section className="px-3 pb-3" aria-label="Systems opened">
            {systems.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">Systems you open appear here.</p>
            ) : (
              systems.map((system) => (
                <Button
                  key={system.hostname}
                  variant={current?.hostname === system.hostname ? "secondary" : "ghost"}
                  className="mb-1 w-full justify-between"
                  disabled={busy}
                  onClick={() => {
                    void projectTurnController.submit({ text: `Open ${system.hostname}` });
                  }}
                >
                  {system.hostname}
                  <Badge variant="outline" className="text-[10px]">
                    {system.provenance.mode === "live" ? "Live" : "Cached"}
                  </Badge>
                </Button>
              ))
            )}
          </section>
        </ProjectGroup>
        <ProjectGroup sectionId="samples" label="Samples" count={sampleCount}>
          <SampleList compact />
        </ProjectGroup>
        <ProjectGroup sectionId="comparisons" label="Comparisons" count={comparisonCount}>
          <ComparisonList compact />
        </ProjectGroup>
        <ProjectGroup sectionId="webSources" label="Web sources" count={webSourceCount}>
          <ProjectWebSources compact />
        </ProjectGroup>
        <ProjectGroup sectionId="reports" label="Reports" count={reportCount}>
          <section className="px-4 pb-3">
            <p className="text-xs text-muted-foreground">None yet</p>
          </section>
        </ProjectGroup>
      </ScrollArea>
    </aside>
  );
}
