import { useExoStore } from "@/store/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CompareDrawer } from "@/features/compare/CompareDrawer";
import { ProjectExplorer } from "@/features/project/ProjectExplorer";
import { SystemView } from "@/features/scene/SystemView";
import { TurnPanel } from "@/features/voice/TurnPanel";

export function App() {
  const transition = useExoStore((s) => s.projectTransition);
  return (
    <TooltipProvider>
      <div
        className="grid min-h-dvh grid-cols-1 bg-background text-foreground lg:h-dvh lg:min-h-0 lg:grid-cols-[13rem_minmax(0,1fr)_22rem] xl:grid-cols-[15rem_minmax(0,1fr)_25rem]"
        data-testid="workbench"
        inert={transition}
      >
        <ProjectExplorer />
        <main className="flex min-h-[32rem] min-w-0 flex-col border-y lg:min-h-0 lg:border-x lg:border-y-0">
          <div className="min-h-0 flex-1">
            <SystemView />
          </div>
          <CompareDrawer />
        </main>
        <TurnPanel />
      </div>
    </TooltipProvider>
  );
}
