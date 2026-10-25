import { describe, expect, it } from "vitest";
import type { Quantity, System } from "@/api/client";
import snapshot from "@/test/trappist-1.json";
import { quantityText } from "./quantity";
import { provenanceLabel } from "./provenance";

// This fixture was built from the repository's real canonical catalog Snapshot parser.
const system = snapshot as System;
describe("canonical archive evidence presentation", () => {
  it("keeps actual asymmetric uncertainties and units attached to the value", () => {
    const planet = system.planets[0];
    if (!planet) throw new Error("Snapshot must contain a planet");
    expect(planet.name).toBe("TRAPPIST-1 b");
    expect(quantityText(planet.radius)).toBe("1.116 −0.012 / +0.014 Earth radii");
    expect(planet.radius.status === "measured" && planet.radius.reference?.label).toBe(
      "Agol et al. 2021",
    );
  });
  it("shows missing values without inventing zero", () => {
    expect(quantityText({ status: "missing", unit: "Earth radii" })).toBe("Missing (Earth radii)");
    expect(quantityText({ status: "missing", unit: null })).toBe("Missing");
  });
  it("preserves measured zero and upper/lower limits", () => {
    const value: Quantity = {
      status: "measured",
      value: 0,
      unit: null,
      limit: "upper",
      err_lo: null,
      err_hi: null,
      reference: null,
    };
    expect(quantityText(value)).toBe("≤ 0");
    expect(quantityText({ ...value, limit: "lower", unit: "day" })).toBe("≥ 0 day");
  });
  it("uses the Snapshot date or Live fetch time from the discriminated provenance", () => {
    expect(provenanceLabel(system.provenance)).toBe("Cached · Snapshot 2026-10-25");
    expect(
      provenanceLabel({ mode: "live", fetched_at: "2026-10-25T22:02:45Z", source: "NASA" }),
    ).toMatch(/^Live · fetched /);
  });
});
