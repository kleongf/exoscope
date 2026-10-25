import { describe, expect, it } from "vitest";
import fixture from "../../../dev/trappist1.fixture.json";
import {
  bandRadii,
  dateFromJd,
  jdFromDate,
  keplerPeriodDays,
  keplerSemiMajorAxisAu,
  normalizeDeg,
  orbitModel,
  orbitPath,
  positionAt,
  positionSigmaRad,
  sceneScale,
  sigma,
  solveKepler,
  spreadArc,
  type Elements,
} from "./maths";
import type { OrbitPlanet, OrbitSystem, Quantity } from "./types";

const system = fixture as OrbitSystem;
const starMass = system.star.mass.value ?? 0;

function q(value: number | null, err: number | null = null): Quantity {
  return {
    value,
    unit: "",
    errHi: err,
    errLo: err === null ? null : -err,
    limit: null,
    source: null,
  };
}

function planet(overrides: Partial<OrbitPlanet>): OrbitPlanet {
  const base = system.planets[3];
  if (base === undefined) throw new Error("fixture missing planet e");
  return { ...base, ...overrides };
}

function keplerian(p: OrbitPlanet): Elements {
  const m = orbitModel(p, starMass, 0.1);
  if (m.kind !== "keplerian") throw new Error(`${p.name} should be keplerian`);
  return m.elements;
}

describe("normalizeDeg", () => {
  it("wraps archive ω values outside [0, 360)", () => {
    expect(normalizeDeg(-8.73)).toBeCloseTo(351.27, 10);
    expect(normalizeDeg(368.81)).toBeCloseTo(8.81, 10);
    expect(normalizeDeg(720)).toBe(0);
  });
});

describe("solveKepler", () => {
  it.each([0, 0.01, 0.3, 0.7, 0.95])("satisfies M = E − e sin E for e = %s", (e) => {
    for (const m of [0.1, 1, 2.5, Math.PI, 5.9]) {
      const ecc = solveKepler(m, e);
      expect(ecc - e * Math.sin(ecc)).toBeCloseTo(m, 9);
    }
  });
});

describe("positionAt", () => {
  it("puts every TRAPPIST-1 planet in front of the star (+y) at its transit epoch", () => {
    for (const p of system.planets) {
      const el = keplerian(p);
      const pos = positionAt(el, el.transitJd);
      expect(Math.abs(pos.x)).toBeLessThan(1e-9);
      expect(pos.y).toBeGreaterThan(0);
    }
  });

  it("repeats after exactly one archive period", () => {
    for (const p of system.planets) {
      const el = keplerian(p);
      const t = el.transitJd + 123.456;
      const a = positionAt(el, t);
      const b = positionAt(el, t + el.periodDays);
      expect(b.x).toBeCloseTo(a.x, 9);
      expect(b.y).toBeCloseTo(a.y, 9);
    }
  });

  it("stays on the drawn ellipse for an eccentric orbit", () => {
    const el: Elements = { a: 1, e: 0.4, omegaRad: 1.1, periodDays: 10, transitJd: 0 };
    const path = orbitPath(el, 2048);
    const pos = positionAt(el, 3.3);
    const nearest = Math.min(...path.map(([x, y]) => Math.hypot(x - pos.x, y - pos.y)));
    expect(nearest).toBeLessThan(0.005);
  });
});

describe("Kepler's third law", () => {
  it("reproduces the archive periods of TRAPPIST-1 from a and M★ within 0.5%", () => {
    for (const p of system.planets) {
      const a = p.semiMajorAxis.value ?? 0;
      const per = p.period.value ?? 0;
      expect(Math.abs(keplerPeriodDays(a, starMass) / per - 1)).toBeLessThan(0.005);
    }
  });

  it("round-trips between period and semi-major axis", () => {
    expect(keplerSemiMajorAxisAu(keplerPeriodDays(0.03, 0.09), 0.09)).toBeCloseTo(0.03, 12);
  });
});

describe("orbitModel", () => {
  it("draws a planet with no eccentricity as circular and says so", () => {
    const m = orbitModel(planet({ eccentricity: q(null) }), starMass, 0.1);
    expect(m.kind).toBe("keplerian");
    if (m.kind === "keplerian") {
      expect(m.elements.e).toBe(0);
      expect(m.assumed).toEqual(["circular"]);
    }
  });

  it("flags an assumed ω only when the orbit is eccentric", () => {
    const m = orbitModel(planet({ periastronArg: q(null) }), starMass, 0.1);
    expect(m.kind === "keplerian" && m.assumed).toEqual(["periastron"]);
  });

  it("is schematic, never invented, when the transit epoch is missing", () => {
    const m = orbitModel(planet({ transitEpoch: q(null) }), starMass, 0.1);
    expect(m).toMatchObject({
      kind: "schematic",
      radiusMethod: "archive",
      missing: ["transit epoch"],
    });
  });

  it("derives a schematic radius from Kepler III when a is missing", () => {
    const m = orbitModel(planet({ semiMajorAxis: q(null) }), starMass, 0.1);
    expect(m).toMatchObject({ kind: "schematic", radiusMethod: "kepler3" });
  });

  it("falls back to a labelled placeholder when neither a nor period exists", () => {
    const m = orbitModel(planet({ semiMajorAxis: q(null), period: q(null) }), starMass, 0.1);
    expect(m).toMatchObject({ kind: "schematic", radiusMethod: "placeholder", radiusAu: 0.1 });
    expect(m.kind === "schematic" && m.missing).toEqual(["semi-major axis", "period"]);
  });
});

describe("positionSigmaRad", () => {
  it("grows with orbits since the epoch as hypot(σT0, N·σP)", () => {
    const p = planet({ period: q(10, 0.001), transitEpoch: q(0, 0.01) });
    const el = keplerian(p);
    const at = (n: number) => positionSigmaRad(p, el, n * 10) ?? Number.NaN;
    expect(at(0)).toBeCloseTo((2 * Math.PI * 0.01) / 10, 12);
    expect(at(100)).toBeCloseTo((2 * Math.PI * Math.hypot(0.01, 0.1)) / 10, 12);
    expect(at(1000)).toBeGreaterThan(at(100));
  });

  it("is unknown when either error is missing", () => {
    const p = planet({ period: q(10, null), transitEpoch: q(0, 0.01) });
    expect(positionSigmaRad(p, keplerian(p), 50)).toBeNull();
  });
});

describe("spreadArc", () => {
  it("is centred on the predicted position and widens with time since the epoch", () => {
    const p = planet({ period: q(10, 0.001), transitEpoch: q(0, 0.01) });
    const el = keplerian(p);
    const width = (arc: [number, number][]) => {
      const [x0, y0] = arc[0] ?? [0, 0];
      const [x1, y1] = arc.at(-1) ?? [0, 0];
      return Math.hypot(x1 - x0, y1 - y0);
    };
    const near = spreadArc(p, el, 100) ?? [];
    const far = spreadArc(p, el, 10_000) ?? [];
    const mid = near[24] ?? [Number.NaN, Number.NaN];
    const pos = positionAt(el, 100);
    expect(near).toHaveLength(49);
    expect(mid[0]).toBeCloseTo(pos.x, 12);
    expect(mid[1]).toBeCloseTo(pos.y, 12);
    expect(width(far)).toBeGreaterThan(width(near));
  });
});

describe("helpers", () => {
  it("averages asymmetric errors and keeps missing errors missing", () => {
    expect(sigma({ ...q(1), errHi: 0.3, errLo: -0.1 })).toBeCloseTo(0.2, 12);
    expect(sigma(q(1))).toBeNull();
  });

  it("clamps the inner band edge at zero", () => {
    expect(bandRadii(0.02, 0.0025)).toEqual({ inner: 0.0175, outer: 0.0225 });
    expect(bandRadii(0.001, 0.01).inner).toBe(0);
  });

  it("scales the widest orbit to the scene extent", () => {
    expect(sceneScale(0.06, 6)).toBeCloseTo(100, 10);
    expect(sceneScale(0)).toBe(1);
  });

  it("converts between dates and Julian days", () => {
    const d = new Date("2026-10-25T12:00:00Z");
    expect(jdFromDate(d)).toBeCloseTo(2461339.0, 6);
    expect(dateFromJd(jdFromDate(d)).getTime()).toBe(d.getTime());
  });
});
