// PROTOTYPE (throwaway) · Variant C "Cards / board": every item is a card with a tiny preview
// of what it holds. Projects switch as tabs across the top of the panel.
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KIND_VERB, type ProjectItem, type StubState } from "./PROTOTYPE-data";
import { EmptyProjectHint, KIND_ICON, MiniChart, StubNote } from "./PROTOTYPE-shared";

function Preview({ item }: { item: ProjectItem }): ReactNode {
  switch (item.kind) {
    case "comparison":
      return (
        <div>
          <MiniChart points={item.points} className="h-10 w-full" />
          <p className="text-[10px] text-muted-foreground">
            {item.y} vs {item.x} · {String(item.points.length)} plotted
          </p>
        </div>
      );
    case "sample":
      return (
        <div className="flex flex-wrap gap-1">
          {item.chips.map((c) => (
            <Badge key={c.term} variant="outline" className="text-[10px]">
              “{c.term}” → {c.as}
            </Badge>
          ))}
          <span className="w-full text-[10px] text-muted-foreground">
            {item.matched.toLocaleString()} matched · {String(item.excluded)} excluded
          </span>
        </div>
      );
    case "system":
      return (
        <div className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-amber-300" />
          {Array.from({ length: item.planets }, (_, i) => (
            <span key={i} className="size-1.5 rounded-full bg-sky-300/80" />
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground">{item.provenance}</span>
        </div>
      );
    case "source":
      return (
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="flex size-4 items-center justify-center rounded bg-zinc-700 text-[9px] font-bold text-foreground uppercase">
            {item.domain[0]}
          </span>
          {item.domain}
        </p>
      );
    case "report":
      return (
        <p className="text-[10px] text-muted-foreground">
          {String(item.includes.length)} items · opens in a new tab
        </p>
      );
  }
}

function Card({ item, stub }: { item: ProjectItem; stub: StubState }) {
  const Icon = KIND_ICON[item.kind];
  const active = stub.reopened?.id === item.id;
  return (
    <button
      type="button"
      onClick={() => {
        stub.reopen(item);
      }}
      className={`mb-2 w-full rounded-lg border bg-background/40 p-2 text-left hover:border-sky-400/50 ${active ? "border-sky-400 ring-1 ring-sky-400/60" : ""}`}
    >
      <span className="mb-1 flex items-center gap-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3" /> {KIND_VERB[item.kind]} · {item.at}
      </span>
      <span className="mb-1.5 block text-xs leading-snug font-medium">{item.title}</span>
      <Preview item={item} />
    </button>
  );
}

function ProjectTabs({ stub }: { stub: StubState }) {
  return (
    <div className="flex items-end gap-0.5 overflow-x-auto border-b px-2 pt-2" role="tablist">
      {stub.projects.map((p) => {
        const selected = p.id === stub.active.id;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              stub.switchTo(p.id);
            }}
            className={`max-w-32 shrink-0 truncate rounded-t-md px-2 py-1.5 text-xs ${selected ? "border border-b-card bg-card font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            {p.name}
          </button>
        );
      })}
      <button
        type="button"
        aria-label="New Project"
        onClick={stub.create}
        className="mb-1 rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function VariantC({ stub }: { stub: StubState }) {
  // Newest first: the board reads like a pinboard of what the Project has collected.
  const items = [...stub.active.items].reverse();
  return (
    <aside aria-label="Project explorer" className="flex min-h-0 flex-col bg-zinc-950/40">
      <ProjectTabs stub={stub} />
      <div className="flex items-baseline justify-between px-3 pt-2 pb-1">
        <h2 className="truncate text-sm font-semibold">{stub.active.name}</h2>
        <span className="text-[10px] text-muted-foreground">{items.length} cards</span>
      </div>
      <StubNote />
      <ScrollArea className="min-h-0 flex-1 px-3">
        {items.length === 0 ? <EmptyProjectHint /> : null}
        {items.map((item) => (
          <Card key={item.id} item={item} stub={stub} />
        ))}
      </ScrollArea>
    </aside>
  );
}
VariantC.label = "Cards / board";
