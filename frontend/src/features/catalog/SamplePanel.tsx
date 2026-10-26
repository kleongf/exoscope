import { Telescope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

/** Left panel: the current Sample and the Interpretations behind it. */
export function SamplePanel() {
  return (
    <aside aria-label="Sample" className="flex min-h-0 flex-col bg-card">
      <header className="flex items-center gap-2 px-4 py-3">
        <Telescope className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">ExoScope</h2>
      </header>
      <Separator />
      <section className="px-4 py-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Interpretations
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-muted-foreground">
            None yet
          </Badge>
        </div>
      </section>
      <Separator />
      <section className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sample
        </h3>
        <ScrollArea className="min-h-0 flex-1">
          <p className="text-sm text-muted-foreground">No Sample yet.</p>
        </ScrollArea>
      </section>
    </aside>
  );
}
