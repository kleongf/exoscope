// PROTOTYPE (throwaway) · Variant B "Timeline": the Project is the story of what the student
// did, in order, filterable by type. Switching Projects goes through a Projects home list.
import { ArrowLeft, LayoutList, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { KIND_VERB, type ItemKind, type ProjectItem, type StubState } from "./PROTOTYPE-data";
import { EmptyProjectHint, KIND_ICON, StubNote } from "./PROTOTYPE-shared";

const FILTERS: { key: ItemKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "system", label: "Systems" },
  { key: "sample", label: "Samples" },
  { key: "comparison", label: "Compare" },
  { key: "source", label: "Sources" },
  { key: "report", label: "Reports" },
];

function detail(item: ProjectItem): string {
  switch (item.kind) {
    case "system":
      return `${String(item.planets)} planets · ${item.provenance}`;
    case "sample":
      return `${item.matched.toLocaleString()} matched · ${String(item.excluded)} excluded · ${item.provenance}`;
    case "comparison":
      return `${String(item.points.length)} plotted · ${String(item.excluded)} excluded`;
    case "source":
      return item.domain;
    case "report":
      return `${String(item.includes.length)} items included`;
  }
}

function lastStep(p: StubState["projects"][number]): string {
  const last = p.items.at(-1);
  return last ? `Last: ${KIND_VERB[last.kind].toLowerCase()} ${last.title}` : "Empty";
}

function ProjectsHome({ stub, onOpen }: { stub: StubState; onOpen: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold">Your Projects</h2>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1"
          onClick={() => {
            stub.create();
            onOpen();
          }}
        >
          <Plus className="size-3.5" /> New
        </Button>
      </div>
      <StubNote />
      <ScrollArea className="min-h-0 flex-1 px-3">
        {stub.projects.map((p) => (
          <button
            key={p.id}
            type="button"
            className="mb-2 w-full rounded-lg border bg-background/40 px-3 py-2 text-left hover:border-sky-400/50"
            onClick={() => {
              stub.switchTo(p.id);
              onOpen();
            }}
          >
            <span className="block text-sm font-medium">{p.name}</span>
            <span className="block text-[11px] text-muted-foreground">{lastStep(p)}</span>
            <span className="block text-[11px] text-muted-foreground">Updated {p.updated}</span>
          </button>
        ))}
      </ScrollArea>
    </div>
  );
}

function Entry({ item, stub }: { item: ProjectItem; stub: StubState }) {
  const Icon = KIND_ICON[item.kind];
  const active = stub.reopened?.id === item.id;
  return (
    <li className="relative pb-3 pl-6">
      <span className="absolute top-1 left-0 flex size-4 items-center justify-center rounded-full bg-zinc-800 ring-2 ring-card">
        <Icon className="size-2.5 text-sky-300" />
      </span>
      <button
        type="button"
        onClick={() => {
          stub.reopen(item);
        }}
        className={`w-full rounded-md px-2 py-1 text-left text-xs hover:bg-muted ${active ? "bg-muted ring-1 ring-sky-400/60" : ""}`}
      >
        <span className="block text-[10px] text-muted-foreground">
          {item.at} · {KIND_VERB[item.kind]}
        </span>
        <span className="block font-medium">{item.title}</span>
        <span className="block text-[11px] text-muted-foreground">{detail(item)}</span>
      </button>
    </li>
  );
}

function Timeline({ stub, onHome }: { stub: StubState; onHome: () => void }) {
  const [filter, setFilter] = useState<ItemKind | "all">("all");
  const items = stub.active.items.filter((i) => filter === "all" || i.kind === filter);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Button
        variant="ghost"
        size="sm"
        className="mx-2 mt-2 justify-start gap-1 text-xs"
        onClick={onHome}
      >
        <ArrowLeft className="size-3.5" /> All Projects
      </Button>
      <h2 className="px-4 pt-1 text-sm font-semibold">{stub.active.name}</h2>
      <p className="px-4 pb-2 text-[11px] text-muted-foreground">
        {stub.active.items.length} steps · {stub.active.updated}
      </p>
      <StubNote />
      <div className="flex flex-wrap gap-1 px-3 pb-2">
        {FILTERS.map((f) => (
          <Badge
            key={f.key}
            asChild
            variant={filter === f.key ? "default" : "outline"}
            className="cursor-pointer text-[10px]"
          >
            <button
              type="button"
              onClick={() => {
                setFilter(f.key);
              }}
            >
              {f.label}
            </button>
          </Badge>
        ))}
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1 px-3 pt-3">
        {stub.active.items.length === 0 ? <EmptyProjectHint /> : null}
        <ol className="relative ml-2 border-l border-zinc-700 pl-0">
          {items.map((item) => (
            <Entry key={item.id} item={item} stub={stub} />
          ))}
        </ol>
      </ScrollArea>
    </div>
  );
}

export function VariantB({ stub }: { stub: StubState }) {
  const [home, setHome] = useState(false);
  return (
    <aside aria-label="Project explorer" className="flex min-h-0 flex-col bg-card">
      <header className="flex items-center gap-2 px-4 py-3">
        <LayoutList className="size-4" />
        <h2 className="text-sm font-semibold">ExoScope</h2>
      </header>
      <Separator />
      {home ? (
        <ProjectsHome
          stub={stub}
          onOpen={() => {
            setHome(false);
          }}
        />
      ) : (
        <Timeline
          stub={stub}
          onHome={() => {
            setHome(true);
          }}
        />
      )}
    </aside>
  );
}
VariantB.label = "Timeline";
