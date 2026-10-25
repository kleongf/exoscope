// PROTOTYPE (throwaway) · Variant A "Grouped list": today's sections, refined — counts,
// collapsible groups, and the Project switcher as a header dropdown with "New Project".
import { Check, ChevronDown, ChevronRight, FolderOpen, Plus, Telescope } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  KIND_LABEL,
  itemsOf,
  type ItemKind,
  type ProjectItem,
  type StubState,
} from "./PROTOTYPE-data";
import { EmptyProjectHint, KIND_ICON, StubNote } from "./PROTOTYPE-shared";

const ORDER: ItemKind[] = ["system", "sample", "comparison", "source", "report"];

function ProjectDropdown({ stub }: { stub: StubState }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-between px-2 py-1.5">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{stub.active.name}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <p className="px-2 py-1 text-[11px] text-muted-foreground">Projects</p>
        {stub.projects.map((p) => (
          <Button
            key={p.id}
            variant="ghost"
            className="h-auto w-full justify-between py-1.5"
            onClick={() => {
              stub.switchTo(p.id);
            }}
          >
            <span className="text-left">
              <span className="block text-sm">{p.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {p.items.length} items · {p.updated}
              </span>
            </span>
            {p.id === stub.active.id ? <Check className="size-4" /> : null}
          </Button>
        ))}
        <Separator className="my-1" />
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={stub.create}>
          <Plus className="size-4" /> New Project
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function Group({ kind, items, stub }: { kind: ItemKind; items: ProjectItem[]; stub: StubState }) {
  const [open, setOpen] = useState(true);
  const Icon = KIND_ICON[kind];
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t px-3 py-2">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-1 py-1 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          {KIND_LABEL[kind]}
        </span>
        <Badge variant="outline" className="text-[10px]">
          {items.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {items.length === 0 ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">None yet</p>
        ) : null}
        {items.map((item) => (
          <Button
            key={item.id}
            variant={stub.reopened?.id === item.id ? "secondary" : "ghost"}
            className="mt-0.5 h-auto w-full justify-start gap-2 py-1.5 text-left text-xs whitespace-normal"
            onClick={() => {
              stub.reopen(item);
            }}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{item.title}</span>
          </Button>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function VariantA({ stub }: { stub: StubState }) {
  const empty = stub.active.items.length === 0;
  return (
    <aside aria-label="Project explorer" className="flex min-h-0 flex-col bg-card">
      <header className="flex items-center gap-2 px-4 py-3">
        <Telescope className="size-4" />
        <h2 className="text-sm font-semibold">ExoScope</h2>
      </header>
      <Separator />
      <div className="px-2 py-2">
        <ProjectDropdown stub={stub} />
      </div>
      <StubNote />
      <ScrollArea className="min-h-0 flex-1">
        {empty ? (
          <div className="px-3 pb-3">
            <EmptyProjectHint />
          </div>
        ) : null}
        {ORDER.map((kind) => (
          <Group key={kind} kind={kind} items={itemsOf(stub.active, kind)} stub={stub} />
        ))}
      </ScrollArea>
    </aside>
  );
}
VariantA.label = "Grouped list";
