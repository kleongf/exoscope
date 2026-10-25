import { describe, expect, it } from "vitest";
import type { System } from "@/api/client";
import snapshot from "@/test/trappist-1.json";
import { toOrbitSystem } from "./adapter";
import { colorize, MISSING_COLOR, rampColor } from "./colorBy";
import { buildLayout } from "./layout";

const layout = buildLayout(toOrbitSystem(snapshot as System));

describe("colour by property", () => {
  it("leaves fixed colours and no legend for 'none'", () => {
    const { planets, legend } = colorize(layout.planets, "none");
    expect(planets).toBe(layout.planets);
    expect(legend).toBeNull();
  });
  it("maps the hottest and coolest planets to the ramp ends, with units in the legend", () => {
    const { planets, legend } = colorize(layout.planets, "insolation");
    expect(legend).toMatchObject({ label: "Insolation", missing: 0 });
    expect(legend?.unit).not.toBe("");
    expect(planets[0]?.color).toBe(rampColor(1)); // b receives the most flux
    expect(planets[6]?.color).toBe(rampColor(0)); // h the least
  });
  it("greys out planets missing the value and counts them; never treats missing as zero", () => {
    const first = layout.planets[0];
    if (first === undefined) throw new Error("fixture has no planets");
    const missing = {
      ...first,
      planet: { ...first.planet, radius: { ...first.planet.radius, value: null } },
    };
    const { planets, legend } = colorize([missing, ...layout.planets.slice(1)], "radius");
    expect(planets[0]?.color).toBe(MISSING_COLOR);
    expect(legend?.missing).toBe(1);
    expect(legend?.min).toBeGreaterThan(0);
  });
});
