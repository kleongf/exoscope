import { FolderOpen, Telescope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useExoStore } from "@/store/store";
import { projectTurnController } from "@/features/voice/turnController";
import { SampleList } from "@/features/catalog/SampleList";
import { ComparisonList } from "./ComparisonList";

/** Current Project shell; persistence and Reports belong to a later ticket. */
export function ProjectExplorer() {
  const systems = useExoStore((state) => state.loadedSystems);
  const current = useExoStore((state) => state.system);
  const busy = useExoStore((state) => state.status !== "idle");
  return (
    <aside aria-label="Project explorer" className="flex min-h-0 flex-col bg-card">
      <header className="flex items-center gap-2 px-4 py-3">
        <Telescope className="size-4" />
        <h2 className="text-sm font-semibold">ExoScope</h2>
      </header>
      <Separator />
      <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium">
        <FolderOpen className="size-4 text-muted-foreground" />
        Project
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <section className="px-3 pb-4">
          <h3 className="mb-2 px-1 text-xs font-medium text-muted-foreground">Systems opened</h3>
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
        <SampleList />
        <ComparisonList />
        {["Web sources", "Reports"].map((label) => (
          <section key={label} className="border-t px-4 py-3">
            <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">None yet</p>
          </section>
        ))}
      </ScrollArea>
    </aside>
  );
}
