import { describe, expect, it } from "vitest";
import type { Planet, Quantity, System } from "@/api/client";
import trappist from "@/test/trappist-1.json";
import {
  comparisonLabelLines,
  comparisonRadii,
  earthComparisonUnavailable,
} from "./earthComparison";
import { arLabelLines } from "./label";
import { planetTint } from "./tint";

const kelvin = (value: number): Quantity => ({
  status: "measured",
  value,
  unit: "K",
  err_lo: null,
  err_hi: null,
  limit: null,
  reference: null,
});

describe("planetTint", () => {
  it("runs cool to hot", () => {
    expect(planetTint(kelvin(100)).color).toBe("#7e94ba");
    expect(planetTint(kelvin(5000)).color).toBe("#ecc460");
    expect(planetTint(kelvin(250)).color).not.toBe(planetTint(kelvin(700)).color);
  });

  it("says so when the temperature is missing", () => {
    const tint = planetTint({ status: "missing", unit: "K" });
    expect(tint.color).toBe("#9aa0a6");
    expect(tint.basis).toContain("equilibrium temperature missing");
  });
});

describe("arLabelLines", () => {
  const system = trappist as System;
  const planet = (name: string) => system.planets.find((p) => p.name === name) as Planet;

  it("carries the name, radius with unit and uncertainty, and the schematic note", () => {
    const lines = arLabelLines(planet("TRAPPIST-1 b"), system);
    expect(lines[0]).toBe("TRAPPIST-1 b");
    expect(lines).toContain("Radius: 1.116 −0.012 / +0.014 Earth radii");
    expect(lines).toContain("Schematic: colour from equilibrium temperature, not a photograph");
  });

  it("shows a missing radius as missing", () => {
    const unmeasured: Planet = {
      ...planet("TRAPPIST-1 e"),
      radius: { status: "missing", unit: "Earth radii" },
    };
    expect(arLabelLines(unmeasured, system)).toContain("Radius: Missing (Earth radii)");
  });
});

describe("Earth radius comparison", () => {
  const system = trappist as System;
  const planet = (name: string) => system.planets.find((p) => p.name === name) as Planet;

  it("preserves the catalogued planet-to-Earth radius ratio", () => {
    const selected = planet("TRAPPIST-1 e");
    if (selected.radius.status === "missing") throw new Error("fixture radius is missing");
    const radii = comparisonRadii(selected.radius);
    expect(radii.planet / radii.earth).toBeCloseTo(0.92);
    expect((radii.lower ?? 0) / radii.earth).toBeCloseTo(0.908);
    expect((radii.upper ?? 0) / radii.earth).toBeCloseTo(0.933);
  });

  it("labels both bodies with honest provenance and uncertainty", () => {
    const labels = comparisonLabelLines(planet("TRAPPIST-1 e"));
    expect(labels.earth).toContain("Standard reference value · not archive data");
    expect(labels.planet).toContain("Radius: 0.92 −0.012 / +0.013 Earth radii");
    expect(labels.planet).toContain("±1σ range: 0.908–0.933 Earth radii");
    expect(labels.planet).toContain("Source paper: Agol et al. 2021");
  });

  it("provides a larger +1σ radius for the exported uncertainty shell", () => {
    const selected = planet("TRAPPIST-1 e");
    if (selected.radius.status === "missing") throw new Error("fixture radius is missing");
    const radii = comparisonRadii(selected.radius);
    expect(radii.upper).not.toBeNull();
    expect(radii.upper ?? 0).toBeGreaterThan(radii.planet);
  });

  it("blocks missing radii instead of inventing a size", () => {
    const missing: Quantity = { status: "missing", unit: "Earth radii" };
    expect(earthComparisonUnavailable(missing)).toBe("Radius missing in the archive");
  });
});
