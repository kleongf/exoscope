import { describe, expect, it } from "vitest";
import type { Planet, Quantity, System } from "@/api/client";
import trappist from "@/test/trappist-1.json";
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
