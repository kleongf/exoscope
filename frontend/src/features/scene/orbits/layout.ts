/** Turns an OrbitSystem into what the scene draws: one entry per planet plus the scene scale. */
import { AU_PER_REARTH, AU_PER_RSUN, orbitModel, sceneScale, type OrbitModel } from "./maths";
import type { OrbitPlanet, OrbitSystem } from "./types";

const PALETTE = ["#f97316", "#facc15", "#a3e635", "#22d3ee", "#60a5fa", "#a78bfa", "#f472b6"];

/** How much bodies are enlarged so they are visible next to orbits at true scale. */
export const EXAGGERATED = { planet: 25, star: 3 } as const;
export const TRUE_SIZES = { planet: 1, star: 1 } as const;
export type SizeFactors = typeof EXAGGERATED | typeof TRUE_SIZES;

export interface PlanetLayout {
  planet: OrbitPlanet;
  model: OrbitModel;
  color: string;
}

export interface SystemLayout {
  /** Scene units per AU. */
  scale: number;
  /** Radius of the widest orbit, AU. */
  maxAu: number;
  planets: PlanetLayout[];
}

function radiusAu(m: OrbitModel): number {
  return m.kind === "keplerian" ? m.elements.a * (1 + m.elements.e) : m.radiusAu;
}

export function buildLayout(system: OrbitSystem): SystemLayout {
  const known = system.planets
    .map((p) => p.semiMajorAxis.value)
    .filter((a): a is number => a !== null);
  // Planets with no usable distance go just outside the known ones, clearly labelled.
  const placeholderAu = (known.length > 0 ? Math.max(...known) : 0.05) * 1.25;
  const starMass = system.star.mass.value;
  const planets = system.planets.map((planet, i) => ({
    planet,
    model: orbitModel(planet, starMass, placeholderAu),
    color: PALETTE[i % PALETTE.length] ?? "#e5e7eb",
  }));
  const maxAu = Math.max(...planets.map((p) => radiusAu(p.model)), 0);
  return { scale: sceneScale(maxAu), maxAu, planets };
}

/** Planet radius in scene units; null when the archive has no radius. */
export function planetRadiusScene(p: OrbitPlanet, scale: number, f: SizeFactors): number | null {
  const r = p.radius.value;
  return r === null ? null : r * AU_PER_REARTH * scale * f.planet;
}

export function starRadiusScene(system: OrbitSystem, scale: number, f: SizeFactors): number {
  return (system.star.radius.value ?? 0.1) * AU_PER_RSUN * scale * f.star;
}

/** The badge's size wording; shared with the AR model so both say the same thing. */
export function sizeText(f: SizeFactors): string {
  return f.planet === 1
    ? "True sizes"
    : `Planet sizes ×${String(f.planet)}, star ×${String(f.star)}`;
}

/** Everything the System view is not, in badge order (provenance is added by the caller). */
export function caveatParts(f: SizeFactors): string[] {
  return [
    "System is edge-on from Earth",
    "Positions extrapolated from transit epochs",
    sizeText(f),
    "Not an N-body simulation",
  ];
}
