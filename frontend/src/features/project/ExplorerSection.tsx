import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** One collapsible group in the Project explorer, with its item count. */
export function ExplorerSection(props: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Long lists (e.g. Web sources) start collapsed so they don't crowd the explorer. */
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={props.defaultOpen ?? true} asChild>
      <section className="border-t px-3 py-2" aria-label={props.title}>
        <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown className="size-3.5 transition-transform group-data-[state=closed]:-rotate-90" />
          <h3 className="flex-1 text-left">{props.title}</h3>
          <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
            {props.count}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-1">
          {props.count === 0 ? (
            <p className="px-1 pb-1 text-xs text-muted-foreground">{props.empty}</p>
          ) : (
            props.children
          )}
          {props.footer}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
