import { beforeEach, describe, expect, it } from "vitest";
import type { Comparison, System, TurnResponse } from "@/api/client";
import { useExoStore } from "@/store/store";
import { comparisonTitle, toComparisonView } from "./adapt";

const ref = { label: "Agol et al. 2021", url: null };
const measured = (value: number) =>
  ({
    status: "measured",
    value,
    unit: "Earth radii",
    err_lo: 0.01,
    err_hi: 0.02,
    limit: null,
    reference: ref,
  }) as const;
const missing = { status: "missing", unit: "Earth flux" } as const;

const comparison: Comparison = {
  x: { property: "radius", label: "Planet radius", unit: "Earth radii" },
  y: { property: "insolation", label: "Insolation", unit: "Earth flux" },
  rows: [
    {
      planet: "TRAPPIST-1 e",
      hostname: "TRAPPIST-1",
      x: measured(0.92),
      y: measured(0.646),
      excluded: null,
    },
    {
      planet: "TOI-700 d",
      hostname: "TOI-700",
      x: measured(1.07),
      y: missing,
      excluded: "missing_y",
    },
  ],
  provenance: [
    {
      hostname: "TRAPPIST-1",
      provenance: { mode: "snapshot", source: "NASA", snapshot_date: "2026-10-25" },
    },
  ],
  notes: ["Values may come from different publications."],
};

function system(hostname: string): System {
  const star = { status: "missing", unit: null } as const;
  return {
    hostname,
    star: {
      hostname,
      effective_temperature: star,
      radius: star,
      mass: star,
      luminosity: star,
      distance: star,
      ra: star,
      dec: star,
    },
    planets: [],
    notes: [],
    provenance: { mode: "snapshot", source: "NASA", snapshot_date: "2026-10-25" },
  };
}

function turn(data: NonNullable<TurnResponse["data"]>): TurnResponse {
  return {
    transcript: "Compare",
    reply_text: "Done",
    ui_commands: [],
    data,
    steps: [],
    warnings: [],
  };
}

describe("toComparisonView", () => {
  it("keeps values, uncertainties, sources and missing values exactly", () => {
    const view = toComparisonView(comparison);
    expect(view.x).toEqual({ label: "Planet radius", unit: "Earth radii" });
    expect(view.rows[0]?.x).toEqual({
      status: "measured",
      value: 0.92,
      errLo: 0.01,
      errHi: 0.02,
      limit: null,
      reference: ref,
    });
    expect(view.rows[1]?.y).toEqual({ status: "missing" });
    expect(view.rows[1]?.excluded).toBe("missing_y");
    expect(view.provenance).toEqual(["TRAPPIST-1 · Cached · Snapshot 2026-10-25"]);
  });
  it("titles a comparison by its axes and Systems", () => {
    expect(comparisonTitle(comparison)).toBe("Insolation vs Planet radius · TRAPPIST-1, TOI-700");
  });
});

describe("Project comparisons", () => {
  beforeEach(() => {
    useExoStore.setState(useExoStore.getInitialState());
  });
  it("builds up comparisons, opens the drawer on the newest, and reopens older ones", () => {
    const store = useExoStore.getState();
    store.acceptTurn(turn({ system: null, comparison }));
    store.acceptTurn(turn({ system: null, comparison: { ...comparison, notes: [] } }));
    let state = useExoStore.getState();
    expect(state.comparisons.map((c) => c.id)).toEqual([1, 2]);
    expect(state.activeComparisonId).toBe(2);
    expect(state.drawerOpen).toBe(true);
    state.openComparison(1);
    state = useExoStore.getState();
    expect(state.activeComparisonId).toBe(1);
  });
  it("a turn without a comparison keeps the active one", () => {
    useExoStore.getState().acceptTurn(turn({ system: null, comparison }));
    useExoStore.getState().acceptTurn(turn({ system: null, comparison: null }));
    expect(useExoStore.getState().activeComparisonId).toBe(1);
  });
  it("selecting a planet from another loaded System switches the System view to it", () => {
    useExoStore.setState({
      system: system("TRAPPIST-1"),
      loadedSystems: [system("TRAPPIST-1"), system("TOI-700")],
    });
    useExoStore.getState().selectPlanetIn("TOI-700", "TOI-700 d");
    const state = useExoStore.getState();
    expect(state.system?.hostname).toBe("TOI-700");
    expect(state.focusedPlanetName).toBe("TOI-700 d");
  });
});
