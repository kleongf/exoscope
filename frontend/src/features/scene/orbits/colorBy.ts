/** Colour planets by one archive property. Missing values get a neutral grey, never a ramp colour. */
import type { PlanetLayout } from "./layout";
import type { OrbitPlanet, Quantity } from "./types";

export type ColorProperty = "none" | "insolation" | "radius" | "equilibrium_temperature";

export const COLOR_OPTIONS: { value: ColorProperty; label: string }[] = [
  { value: "none", label: "Fixed" },
  { value: "insolation", label: "Insolation" },
  { value: "radius", label: "Radius" },
  { value: "equilibrium_temperature", label: "Eq. temp." },
];

export const MISSING_COLOR = "#6b7280";
/** Sequential ramp, low → high (cool → warm). */
const RAMP = ["#3b82f6", "#22d3ee", "#a3e635", "#facc15", "#f97316"];

const PICK: Record<Exclude<ColorProperty, "none">, (p: OrbitPlanet) => Quantity> = {
  insolation: (p) => p.insolation,
  radius: (p) => p.radius,
  equilibrium_temperature: (p) => p.eqTemp,
};

export interface ColorLegend {
  label: string;
  unit: string;
  min: number;
  max: number;
  missing: number;
  ramp: readonly string[];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Colour at t ∈ [0, 1] along the ramp. */
export function rampColor(t: number): string {
  const x = Math.min(Math.max(t, 0), 1) * (RAMP.length - 1);
  const i = Math.min(Math.floor(x), RAMP.length - 2);
  const a = hexToRgb(RAMP[i] ?? "#000000");
  const b = hexToRgb(RAMP[i + 1] ?? "#000000");
  const mix = a.map((c, k) => Math.round(c + ((b[k] ?? c) - c) * (x - i)));
  return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function colorize(
  planets: PlanetLayout[],
  property: ColorProperty,
): { planets: PlanetLayout[]; legend: ColorLegend | null } {
  if (property === "none") return { planets, legend: null };
  const pick = PICK[property];
  const values = planets.map((item) => pick(item.planet).value);
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0) {
    return { planets: planets.map((item) => ({ ...item, color: MISSING_COLOR })), legend: null };
  }
  const min = Math.min(...known);
  const max = Math.max(...known);
  const recolored = planets.map((item, i) => {
    const v = values[i] ?? null;
    const color =
      v === null ? MISSING_COLOR : rampColor(max === min ? 0.5 : (v - min) / (max - min));
    return { ...item, color };
  });
  const label = COLOR_OPTIONS.find((o) => o.value === property)?.label ?? property;
  const unit = planets.map((item) => pick(item.planet).unit).find((u) => u !== "") ?? "";
  return {
    planets: recolored,
    legend: { label, unit, min, max, missing: values.length - known.length, ramp: RAMP },
  };
}
