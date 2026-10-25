/** A System view overlay that folds down to a header chip so it never has to cover the scene. */
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** Below this viewport size the panels start folded, leaving the orbits visible. */
const ROOMY = { width: 1280, height: 900 };

function startsOpen(): boolean {
  if (typeof window === "undefined") return true;
  return window.innerWidth >= ROOMY.width && window.innerHeight >= ROOMY.height;
}

export function OverlayPanel({ title, children }: { title: string; children: ReactNode }) {
  // Component state: each panel remembers its own choice for the session.
  const [open, setOpen] = useState(startsOpen);
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="w-64 rounded-lg border border-white/10 bg-black/75 text-xs text-white/85 backdrop-blur data-[state=closed]:w-auto"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className="w-full justify-between gap-2 px-3 py-1.5 font-semibold text-white/90 hover:bg-white/10 hover:text-white"
          aria-label={`${open ? "Hide" : "Show"} ${title.toLowerCase()}`}
        >
          {title}
          <Icon aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}
