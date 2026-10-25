// PROTOTYPE (throwaway): stub Project data for the Project explorer variants (#15).
// In memory only. Comparison points for TRAPPIST-1 are the archive Snapshot values; everything
// else (TOI-700 points, titles, times) is illustrative stub data, labelled as such in the UI.
import { useState } from "react";

export type ItemKind = "system" | "sample" | "comparison" | "source" | "report";

interface Base {
  id: string;
  kind: ItemKind;
  title: string;
  /** Minutes since the Project started, for ordering and the timeline. */
  at: string;
}
export interface SystemItem extends Base {
  kind: "system";
  provenance: string;
  planets: number;
}
export interface SampleItem extends Base {
  kind: "sample";
  provenance: string;
  matched: number;
  excluded: number;
  chips: { term: string; as: string }[];
}
export interface ComparisonItem extends Base {
  kind: "comparison";
  x: string;
  y: string;
  points: [number, number][];
  excluded: number;
}
export interface SourceItem extends Base {
  kind: "source";
  domain: string;
}
export interface ReportItem extends Base {
  kind: "report";
  includes: string[];
}
export type ProjectItem = SystemItem | SampleItem | ComparisonItem | SourceItem | ReportItem;

export interface StubProject {
  id: string;
  name: string;
  updated: string;
  items: ProjectItem[];
}

export const KIND_LABEL: Record<ItemKind, string> = {
  system: "Systems opened",
  sample: "Samples",
  comparison: "Comparisons",
  source: "Web sources",
  report: "Reports",
};

export const KIND_VERB: Record<ItemKind, string> = {
  system: "Opened",
  sample: "Searched",
  comparison: "Compared",
  source: "Cited",
  report: "Wrote report",
};

const TRAPPIST: StubProject = {
  id: "p1",
  name: "TRAPPIST-1 habitability",
  updated: "Today 14:30",
  items: [
    { id: "s1", kind: "system", title: "TRAPPIST-1", at: "14:02", provenance: "Live", planets: 7 },
    {
      id: "c1",
      kind: "comparison",
      title: "Insolation vs Planet radius · TRAPPIST-1",
      at: "14:05",
      x: "Radius (R⊕)",
      y: "Insolation (S⊕)",
      excluded: 0,
      points: [
        [1.116, 4.153],
        [1.097, 2.214],
        [0.788, 1.115],
        [0.92, 0.646],
        [1.045, 0.373],
        [1.129, 0.252],
        [0.755, 0.144],
      ],
    },
    {
      id: "w1",
      kind: "source",
      title: "Thermal emission from TRAPPIST-1 b with JWST",
      at: "14:08",
      domain: "nature.com",
    },
    {
      id: "w2",
      kind: "source",
      title: "JWST phase curves: no thick atmosphere around TRAPPIST-1 b and c",
      at: "14:08",
      domain: "astrobiology.com",
    },
    {
      id: "m1",
      kind: "sample",
      title: "Small planets with short periods",
      at: "14:12",
      provenance: "Live",
      matched: 1228,
      excluded: 37,
      chips: [
        { term: "small", as: "radius < 2 R⊕" },
        { term: "short period", as: "period < 10 d" },
      ],
    },
    { id: "s2", kind: "system", title: "TOI-700", at: "14:21", provenance: "Cached", planets: 4 },
    {
      id: "c2",
      kind: "comparison",
      title: "Insolation vs Planet radius · TOI-700",
      at: "14:23",
      x: "Radius (R⊕)",
      y: "Insolation (S⊕)",
      excluded: 1,
      points: [
        [0.91, 5.0],
        [2.6, 3.7],
        [1.07, 0.86],
      ],
    },
    {
      id: "w3",
      kind: "source",
      title: "TOI-700 d: TESS's first Earth-size habitable-zone planet",
      at: "14:25",
      domain: "science.nasa.gov",
    },
    {
      id: "r1",
      kind: "report",
      title: "TRAPPIST-1 radius comparison",
      at: "14:30",
      includes: ["c1", "s1", "w1", "w2"],
    },
  ],
};

const EMPTY: StubProject = { id: "p2", name: "New Project", updated: "Just now", items: [] };

export function itemsOf(project: StubProject, kind: ItemKind): ProjectItem[] {
  return project.items.filter((item) => item.kind === kind);
}

/** Shared in-memory state so every variant shows the same Projects. */
export function useStubProjects() {
  const [projects, setProjects] = useState<StubProject[]>([TRAPPIST, EMPTY]);
  const [activeId, setActiveId] = useState(TRAPPIST.id);
  const [reopened, setReopened] = useState<ProjectItem | null>(null);
  const active = projects.find((p) => p.id === activeId) ?? TRAPPIST;
  return {
    projects,
    active,
    reopened,
    switchTo: (id: string) => {
      setActiveId(id);
      setReopened(null);
    },
    create: () => {
      const id = `p${String(projects.length + 1)}`;
      const name = `Untitled Project ${String(projects.length)}`;
      setProjects([...projects, { id, name, updated: "Just now", items: [] }]);
      setActiveId(id);
      setReopened(null);
    },
    reopen: (item: ProjectItem | null) => {
      setReopened(item);
    },
  };
}

export type StubState = ReturnType<typeof useStubProjects>;
