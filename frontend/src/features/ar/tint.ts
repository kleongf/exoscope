import type { Quantity } from "@/api/client";

/** Cool-to-hot ramp in kelvin. A temperature scale, deliberately not Earth-like blues and greens. */
const RAMP: [number, [number, number, number]][] = [
  [100, [126, 148, 186]],
  [250, [176, 184, 196]],
  [400, [214, 180, 138]],
  [700, [214, 128, 78]],
  [1200, [192, 70, 48]],
  [2000, [236, 196, 96]],
];
const MISSING_GREY = "#9aa0a6";

export interface Tint {
  color: string;
  /** What the colour is based on, shown on the model. */
  basis: string;
}

function hex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function rampAt(kelvin: number): [number, number, number] {
  const first = RAMP[0]?.[1] ?? [0, 0, 0];
  const index = RAMP.findIndex(([t]) => kelvin <= t);
  if (index <= 0) return index === 0 ? first : (RAMP.at(-1)?.[1] ?? first);
  const [t0, c0] = RAMP[index - 1] ?? [0, first];
  const [t1, c1] = RAMP[index] ?? [0, first];
  const f = (kelvin - t0) / (t1 - t0);
  return [0, 1, 2].map((i) => (c0[i] ?? 0) + f * ((c1[i] ?? 0) - (c0[i] ?? 0))) as [
    number,
    number,
    number,
  ];
}

/** Schematic colour from equilibrium temperature. It encodes a number, not an appearance. */
export function planetTint(equilibriumTemperature: Quantity): Tint {
  if (equilibriumTemperature.status === "missing") {
    return {
      color: MISSING_GREY,
      basis: "Schematic: neutral grey (equilibrium temperature missing), not a photograph",
    };
  }
  return {
    color: hex(rampAt(equilibriumTemperature.value)),
    basis: "Schematic: colour from equilibrium temperature, not a photograph",
  };
}
