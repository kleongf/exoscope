/**
 * View model for the System view's orbits. Built from a loaded System; deliberately not the
 * generated API type so the scene stays independent of the transport shape.
 */

export interface SourceRef {
  label: string;
  url: string | null;
}

/** One archive value. `value: null` means missing in the archive — never treat it as zero. */
export interface Quantity {
  value: number | null;
  unit: string;
  errHi: number | null;
  errLo: number | null;
  limit: "upper" | "lower" | null;
  source: SourceRef | null;
}

export interface OrbitPlanet {
  /** Canonical archive `pl_name`, e.g. "TRAPPIST-1 e". */
  name: string;
  letter: string;
  period: Quantity;
  semiMajorAxis: Quantity;
  eccentricity: Quantity;
  /** Argument of periastron ω, already normalised to [0, 360). */
  periastronArg: Quantity;
  transitEpoch: Quantity;
  inclination: Quantity;
  radius: Quantity;
  mass: Quantity;
  insolation: Quantity;
  eqTemp: Quantity;
}

export interface OrbitStar {
  teff: Quantity;
  radius: Quantity;
  mass: Quantity;
}

export type Provenance =
  { mode: "live"; fetchedAt: string } | { mode: "snapshot"; snapshotDate: string };

export interface OrbitSystem {
  hostname: string;
  star: OrbitStar;
  planets: OrbitPlanet[];
  provenance: Provenance;
}

/** "Live · fetched 14:32" or "Cached · Snapshot 2026-10-25". */
export function provenanceLabel(p: Provenance): string {
  if (p.mode === "snapshot") return `Cached · Snapshot ${p.snapshotDate}`;
  const t = new Date(p.fetchedAt);
  const hhmm = Number.isNaN(t.getTime()) ? p.fetchedAt : t.toTimeString().slice(0, 5);
  return `Live · fetched ${hhmm}`;
}
