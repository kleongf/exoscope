import { describe, expect, it } from "vitest";
import type { System } from "@/api/client";
import { toOrbitSystem } from "@/features/scene/orbits/adapter";
import { buildLayout } from "@/features/scene/orbits/layout";
import { positionAt } from "@/features/scene/orbits/maths";
import trappist from "@/test/trappist-1.json";
import { systemSnapshot, TABLE_RADIUS_M } from "./systemSnapshot";

const system = toOrbitSystem(trappist as System);
const jd = 2_461_339.5;

describe("systemSnapshot", () => {
  it("puts every planet where the System view does, scaled to the table", () => {
    const snap = systemSnapshot(system, jd);
    const layout = buildLayout(system);
    const ratios = snap.planets.map((p) => {
      const item = layout.planets.find((l) => l.planet.name === p.name);
      if (item?.model.kind !== "keplerian") throw new Error(`${p.name} not keplerian`);
      const at = positionAt(item.model.elements, jd);
      return [p.position[0] / at.x, p.position[1] / at.y];
    });
    const [first] = ratios.flat();
    for (const r of ratios.flat()) expect(r).toBeCloseTo(first ?? 0, 6);
  });

  it("fits the widest orbit to the table radius", () => {
    const snap = systemSnapshot(system, jd);
    const widest = Math.max(
      ...snap.planets.flatMap((p) => p.path.map(([x, z]) => Math.hypot(x, z))),
    );
    expect(widest).toBeLessThanOrEqual(TABLE_RADIUS_M + 1e-9);
    expect(widest).toBeGreaterThan(TABLE_RADIUS_M * 0.95);
  });

  it("carries the System view's badge, size factor and provenance", () => {
    const lines = systemSnapshot(system, jd).infoLines;
    expect(lines).toContain("System is edge-on from Earth");
    expect(lines).toContain("Planet sizes ×25, star ×3");
    expect(lines).toContain("Not an N-body simulation");
    expect(
      lines.some((l) => l.startsWith("Cached · Snapshot") || l.startsWith("Live · fetched")),
    ).toBe(true);
  });

  it("leaves out planets without a placeable orbit and counts them", () => {
    const [b, ...rest] = system.planets;
    if (!b) throw new Error("fixture has no planets");
    const missing = { ...b.transitEpoch, value: null };
    const snap = systemSnapshot(
      { ...system, planets: [{ ...b, transitEpoch: missing }, ...rest] },
      jd,
    );
    expect(snap.planets.map((p) => p.name)).not.toContain(b.name);
    expect(snap.infoLines).toContain(`1 planet not shown: orbit unknown (${b.name})`);
  });

  it("states assumed orbital elements instead of hiding them", () => {
    const [b, ...rest] = system.planets;
    if (!b) throw new Error("fixture has no planets");
    const circular = { ...b, eccentricity: { ...b.eccentricity, value: null } };
    const snap = systemSnapshot({ ...system, planets: [circular, ...rest] }, jd);
    expect(snap.infoLines).toContain(`${b.name}: eccentricity missing, drawn circular`);
  });
});
