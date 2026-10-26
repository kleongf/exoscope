/**
 * Property hues and provenance tones. The colours themselves live once, as theme tokens in
 * index.css; this file maps domain keys onto those tokens (and resolves them for Plotly).
 */

export type Hue =
  | "radius"
  | "mass"
  | "period"
  | "orbit"
  | "insolation"
  | "temperature"
  | "distance"
  | "shape"
  | "other";

const HUES: Partial<Record<string, Hue>> = {
  radius: "radius",
  mass: "mass",
  orbital_period: "period",
  semi_major_axis: "orbit",
  insolation: "insolation",
  equilibrium_temperature: "temperature",
  effective_temperature: "temperature",
  distance: "distance",
  eccentricity: "shape",
  inclination: "shape",
  argument_of_periastron: "shape",
  transit_midpoint: "period",
};

/** The hue for an archive property key (e.g. "orbital_period"); unknown keys stay neutral. */
export function hueOf(property: string | null | undefined): Hue {
  return (property ? HUES[property] : undefined) ?? "other";
}

/** CSS colour for a property, for an inline `style={{ color }}`. */
export function propertyColor(property: string | null | undefined): string {
  return `var(--color-prop-${hueOf(property)})`;
}

/** Tailwind classes for Live vs Cached badges. */
export function provenanceTone(mode: "live" | "snapshot"): string {
  return mode === "live"
    ? "border-prov-live/50 bg-prov-live/10 text-prov-live"
    : "border-prov-cached/50 bg-prov-cached/10 text-prov-cached";
}

/** Resolve a theme token to a concrete colour for libraries that can't use CSS variables. */
export function tokenColor(token: string, fallback = "#94a3b8"): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`);
  return value.trim() || fallback;
}

/** Plotly-ready colour for a property hue. */
export function propertyHex(property: string | null | undefined): string {
  return tokenColor(`prop-${hueOf(property)}`);
}
