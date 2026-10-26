import { beforeEach, describe, expect, it } from "vitest";
import type {
  Comparison,
  Project,
  Sample,
  System,
  TurnResponse,
  WebSearchResult,
} from "../api/client";
import { useExoStore } from "./store";

const missing = { status: "missing", unit: null } as const;
function system(hostname: string): System {
  return {
    hostname,
    star: {
      hostname,
      effective_temperature: missing,
      radius: missing,
      mass: missing,
      luminosity: missing,
      distance: missing,
      ra: missing,
      dec: missing,
    },
    planets: [],
    notes: [],
    provenance: { mode: "snapshot", source: "pscomppars", snapshot_date: "2026-10-25" },
  };
}
const comparison: Comparison = {
  x: { property: "radius", label: "Radius", unit: "R_earth" },
  y: { property: "insolation", label: "Insolation", unit: "S_earth" },
  rows: [],
  provenance: [],
  notes: [],
};
const sample: Sample = {
  filters: [{ field: "radius", op: "<", value: 2 }],
  interpretations: [{ term: "small", as: "radius < 2 Earth radii" }],
  sort: null,
  limit: 50,
  fields: [],
  planets: [],
  matched: 12,
  truncated: false,
  excluded: { count: 0, by_field: {}, reason: "" },
  provenance: { mode: "snapshot", source: "pscomppars", snapshot_date: "2026-10-25" },
  notes: [],
};
const at = "2026-10-25T15:00:00Z";
const webSearch: WebSearchResult = {
  status: "ok",
  query: "TRAPPIST-1 water",
  grounded_text: "",
  sources: [
    {
      id: "s0",
      kind: "web_source",
      title: "Page",
      url: "https://a.org/1",
      retrieved_at: at,
      domain: "a.org",
    },
  ],
};
const empty: Project = {
  format: "exoscope.project",
  version: 1,
  id: "p-0000000b",
  name: "Hot Jupiters",
  created_at: at,
  updated_at: at,
  next_seq: 1,
};
const built: Project = {
  ...empty,
  id: "p-0000000a",
  name: "Rocky worlds",
  current_system: "TOI-700",
  turns: [
    {
      id: "turn-1",
      at,
      transcript: "Open TRAPPIST-1",
      reply_text: "Loaded.",
      steps: [{ name: "load_system", status: "completed", detail: "Loaded.", elapsed_ms: 900 }],
      web_search: webSearch,
    },
  ],
  systems: [
    { id: "sys-2", turn_id: "turn-1", opened_at: at, system: system("TRAPPIST-1") },
    { id: "sys-6", turn_id: "turn-5", opened_at: at, system: system("TOI-700") },
  ],
  comparisons: [{ id: "cmp-4", turn_id: "turn-3", made_at: at, comparison }],
  samples: [{ id: "smp-7", turn_id: "turn-7", ran_at: at, sample }],
};

beforeEach(() => {
  useExoStore.getState().openProject(empty);
});

describe("Projects", () => {
  it("opening a Project restores its Systems, comparisons, Samples and chat", () => {
    useExoStore.getState().openProject(built);
    const s = useExoStore.getState();
    expect(s.project?.id).toBe("p-0000000a");
    expect(s.loadedSystems.map((x) => x.hostname)).toEqual(["TRAPPIST-1", "TOI-700"]);
    expect(s.system?.hostname).toBe("TOI-700");
    expect(s.comparisons.map((c) => c.comparison)).toEqual([comparison]);
    expect(s.samples.map((x) => x.sample.interpretations[0]?.term)).toEqual(["small"]);
    expect(s.turns.map((t) => [t.question, t.reply, t.steps[0]?.name])).toEqual([
      ["Open TRAPPIST-1", "Loaded.", "load_system"],
    ]);
    expect(s.turns[0]?.webSearch).toEqual(webSearch);
    expect(s.drawerOpen).toBe(false);
  });

  it("switching to an empty Project leaves nothing from the previous one", () => {
    useExoStore.getState().openProject(built);
    useExoStore.getState().openProject(empty);
    const s = useExoStore.getState();
    expect([s.loadedSystems, s.comparisons, s.samples, s.turns]).toEqual([[], [], [], []]);
    expect(s.system).toBeNull();
    expect(s.project?.name).toBe("Hot Jupiters");
  });

  it("a turn's saved Project replaces the one in the store", () => {
    useExoStore.getState().beginTurn("Open TRAPPIST-1");
    const response: TurnResponse = {
      transcript: "Open TRAPPIST-1",
      reply_text: "ok",
      project: built,
    };
    useExoStore.getState().acceptTurn(response);
    expect(useExoStore.getState().project?.updated_at).toBe(built.updated_at);
  });

  it("a turn that was not saved keeps the Project and shows the warning", () => {
    const warning = "This turn was not saved to the Project: disk full";
    useExoStore.getState().beginTurn("Open TRAPPIST-1");
    useExoStore.getState().acceptTurn({ transcript: "x", reply_text: "", warnings: [warning] });
    expect(useExoStore.getState().project?.id).toBe(empty.id);
    expect(useExoStore.getState().warnings).toEqual([warning]);
  });

  it("a Project that can't be opened is reported, not shown as empty", () => {
    useExoStore.getState().openProject(built);
    useExoStore.getState().failProject("Project 'p-0000beef' could not be read: damaged.");
    const s = useExoStore.getState();
    expect(s.projectError).toContain("p-0000beef");
    expect(s.project?.id).toBe("p-0000000a");
  });
});
