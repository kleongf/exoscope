import { ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useExoStore } from "@/store/store";
import { CompareWorkspace } from "./CompareWorkspace";

function EmptyDrawer() {
  return (
    <div className="grid h-56 grid-cols-2 gap-3 p-3">
      <div className="grid place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        No comparison yet. Try “Compare radius and irradiation.”
      </div>
      <div className="grid place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        The table appears here.
      </div>
    </div>
  );
}

/** Bottom drawer under the System view: the active comparison (placeholders when empty). */
export function CompareDrawer({ children }: { children?: ReactNode }) {
  const open = useExoStore((s) => s.drawerOpen);
  const setOpen = useExoStore((s) => s.setDrawerOpen);
  const hasComparison = useExoStore((s) => s.activeComparisonId !== null);
  const content = children ?? (hasComparison ? <CompareWorkspace /> : <EmptyDrawer />);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border bg-card">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between rounded-none">
          Chart & table
          <ChevronUp
            className={open ? "rotate-180 transition-transform" : "transition-transform"}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>{content}</CollapsibleContent>
    </Collapsible>
  );
}
