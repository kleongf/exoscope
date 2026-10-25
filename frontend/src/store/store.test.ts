import { describe, expect, it } from "vitest";
import { reduceCommand } from "./store";

describe("reduceCommand", () => {
  it("focuses a planet", () => {
    const next = reduceCommand(
      { focusedPlanetId: null, daysPerSecond: 1 },
      { kind: "focus_planet", planet_id: "TRAPPIST-1 e" },
    );
    expect(next.focusedPlanetId).toBe("TRAPPIST-1 e");
  });
});
