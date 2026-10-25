import { TooltipProvider } from "@/components/ui/tooltip";
import { SamplePanel } from "@/features/catalog/SamplePanel";
import { CompareDrawer } from "@/features/compare/CompareDrawer";
import { PlanetPanel } from "@/features/scene/PlanetPanel";
import { SystemView } from "@/features/scene/SystemView";
import { ConversationBar } from "@/features/voice/ConversationBar";

/** The research workbench: System view centre, Sample left, planet right, chart drawer below. */
export function App() {
  return (
    <TooltipProvider>
      <div className="grid h-screen grid-rows-[1fr_auto] bg-background text-foreground">
        <div className="grid min-h-0 grid-cols-[18rem_1fr_19rem]">
          <SamplePanel />
          <main className="flex min-h-0 min-w-0 flex-col border-x border-border">
            <div className="relative min-h-0 flex-1 bg-[#05060a]">
              <SystemView />
            </div>
            <CompareDrawer />
          </main>
          <PlanetPanel />
        </div>
        <ConversationBar />
      </div>
    </TooltipProvider>
  );
}
