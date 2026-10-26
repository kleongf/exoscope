import { Telescope, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { provenanceTone } from "@/lib/palette";
import { useExoStore } from "@/store/store";
import { projectTurnController } from "@/features/voice/turnController";
import { SampleList } from "@/features/catalog/SampleList";
import { ComparisonList } from "./ComparisonList";
import { ExplorerSection } from "./ExplorerSection";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { ProjectWebSources } from "./ProjectWebSources";
import { ReportList } from "./ReportList";

/** The left panel: the current Project and everything it has gathered, grouped by kind. */
export function ProjectExplorer() {
  const systems = useExoStore((state) => state.loadedSystems);
  const current = useExoStore((state) => state.system);
  const busy = useExoStore((state) => state.status !== "idle");
  const projectError = useExoStore((state) => state.projectError);
  return (
    <aside aria-label="Project explorer" className="flex min-h-0 flex-col bg-card">
      <header className="flex items-center gap-2 px-4 py-3">
        <Telescope className="size-4" />
        <h2 className="text-sm font-semibold">ExoScope</h2>
      </header>
      <Separator />
      <div className="px-2 py-2">
        <ProjectSwitcher />
        {projectError && (
          <p role="alert" className="mt-1 flex gap-1.5 px-2 text-xs text-destructive">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            {projectError}
          </p>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ExplorerSection
          title="Systems opened"
          count={systems.length}
          empty="Systems you open appear here."
        >
          {systems.map((system) => (
            <Button
              key={system.hostname}
              variant={current?.hostname === system.hostname ? "secondary" : "ghost"}
              className="mb-1 w-full justify-between"
              disabled={busy}
              data-testid="system-item"
              onClick={() => {
                void projectTurnController.submit({ text: `Open ${system.hostname}` });
              }}
            >
              {system.hostname}
              <Badge
                variant="outline"
                className={`text-[10px] ${provenanceTone(system.provenance.mode)}`}
              >
                {system.provenance.mode === "live" ? "Live" : "Cached"}
              </Badge>
            </Button>
          ))}
        </ExplorerSection>
        <SampleList />
        <ComparisonList />
        <ProjectWebSources />
        <ReportList />
      </ScrollArea>
    </aside>
  );
}
