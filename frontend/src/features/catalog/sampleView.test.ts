import { describe, expect, it } from "vitest";
import type { Sample, TurnResponse } from "@/api/client";
import { addSample } from "@/store/samples";
import { sampleAxes, sampleCountLine, sampleTitle, toSampleView } from "./sampleView";

const measured = (value: number, limit: "upper" | "lower" | null = null) => ({
  status: "measured" as const,
  value,
  unit: null,
  err_lo: 0.1,
  err_hi: 0.1,
  limit,
  reference: { label: "Paper 2020", url: null },
  note: null,
});

const sample: Sample = {
  filters: [
    { field: "radius", op: "<", value: 2, upper: null },
    { field: "orbital_period", op: "<", value: 10, upper: null },
  ],
  interpretations: [{ term: "small", as: "radius < 2 Earth radii", caveat: null }],
  sort: null,
  limit: 2,
  fields: [
    { name: "radius", label: "Planet radius", unit: "Earth radii" },
    { name: "orbital_period", label: "Orbital period", unit: "day" },
    { name: "discovery_method", label: "Discovery method", unit: null },
  ],
  planets: [
    { name: "A b", hostname: "A", values: { radius: measured(1), orbital_period: measured(3) } },
    {
      name: "B b",
      hostname: "B",
      values: {
        radius: measured(1.5, "upper"),
        orbital_period: { status: "missing", unit: "day" },
      },
    },
  ],
  matched: 1228,
  truncated: true,
  excluded: { count: 37, by_field: { radius: 22 }, reason: "missing" },
  provenance: { mode: "snapshot", source: "NASA", snapshot_date: "2026-10-25" },
  notes: [],
};

describe("Sample view", () => {
  it("plots the filtered fields", () => {
    expect(sampleAxes(sample)).toEqual(["radius", "orbital_period"]);
  });
  it("never plots missing or limit-only values", () => {
    const view = toSampleView(sample);
    expect(view.rows[0]?.excluded).toBeNull();
    expect(view.rows[1]?.excluded).toBe("missing_y");
    expect(view.provenance).toContain("Showing 2 of 1,228 · 37 excluded for missing values");
  });
  it("labels the cached Snapshot and the filters", () => {
    expect(toSampleView(sample).provenance[0]).toBe("Sample · Cached · Snapshot 2026-10-25");
    expect(sampleTitle(sample)).toBe("radius < 2 · orbital_period < 10");
    expect(sampleCountLine({ ...sample, truncated: false })).toMatch(/^1,228 matched/);
  });
});

describe("addSample", () => {
  it("adds the Sample and opens it in the drawer", () => {
    const response = { data: { sample } } as unknown as TurnResponse;
    expect(addSample({ samples: [] }, response)).toMatchObject({
      activeSampleId: 1,
      drawerView: "sample",
      drawerOpen: true,
    });
  });
  it("leaves the drawer alone when the turn has no Sample", () => {
    expect(addSample({ samples: [] }, { data: {} } as unknown as TurnResponse)).toEqual({});
  });
});
