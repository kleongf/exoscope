import { describe, expect, it } from "vitest";
import { trappist1RadiusVsInsolation } from "@/dev/trappist1-comparison";
import { axisTitle, countRows, formatValue, shortName } from "./format";
import type { ValueView } from "./types";

const measured = (value: number, errLo: number | null, errHi: number | null): ValueView => ({
  status: "measured",
  value,
  errLo,
  errHi,
  limit: null,
  reference: null,
});

describe("formatValue", () => {
  it("shows missing as missing, never zero", () => {
    expect(formatValue({ status: "missing" })).toBe("missing");
  });
  it("collapses symmetric errors and keeps asymmetric ones", () => {
    expect(formatValue(measured(0.646, 0.025, 0.025))).toBe("0.646 ± 0.025");
    expect(formatValue(measured(1.116, 0.012, 0.014))).toBe("1.116 +0.014/−0.012");
    expect(formatValue(measured(3, null, null))).toBe("3");
  });
  it("shows limits as inequalities", () => {
    expect(formatValue({ ...measured(1.2, null, null), limit: "upper" } as ValueView)).toBe(
      "< 1.2",
    );
  });
});

describe("comparison helpers", () => {
  it("labels axes with units and counts plotted vs excluded rows", () => {
    expect(axisTitle(trappist1RadiusVsInsolation.x)).toBe("Planet radius (Earth radii)");
    expect(countRows(trappist1RadiusVsInsolation)).toEqual({ plotted: 7, excluded: 0 });
    expect(shortName("TRAPPIST-1 e", "TRAPPIST-1")).toBe("e");
  });
});
