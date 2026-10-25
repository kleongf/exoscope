/**
 * Pure Keplerian orbit maths for the System view. No DOM, no React.
 *
 * Frame: the orbital plane is (x, y), with x along the (assumed) line of nodes and +y pointing
 * at Earth, so a planet transits when it crosses +y. Every system is drawn coplanar because the
 * archive has no longitude of the ascending node (Ω).
 */
import type { OrbitPlanet, Quantity } from "./types";

const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
export const AU_PER_RSUN = 0.00465047;
export const AU_PER_REARTH = 4.26352e-5;
const JD_UNIX_EPOCH = 2440587.5;
const MS_PER_DAY = 86_400_000;

export interface Elements {
  a: number; // AU
  e: number;
  omegaRad: number; // argument of periastron
  periodDays: number;
  transitJd: number;
}

/** Elements that were not in the archive and had to be assumed to draw the orbit. */
export type Assumption = "circular" | "periastron";

export interface KeplerianOrbit {
  kind: "keplerian";
  elements: Elements;
  assumed: Assumption[];
}

/** Drawn without a computed position because an essential element is missing. */
export interface SchematicOrbit {
  kind: "schematic";
  radiusAu: number;
  radiusMethod: "archive" | "kepler3" | "placeholder";
  missing: string[];
}

export type OrbitModel = KeplerianOrbit | SchematicOrbit;

export interface OrbitPoint {
  x: number; // AU
  y: number; // AU
  trueAnomaly: number; // rad
}

export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Symmetric 1σ from the archive's asymmetric errors; null when either is missing. */
export function sigma(q: Quantity): number | null {
  if (q.errHi === null || q.errLo === null) return null;
  return (Math.abs(q.errHi) + Math.abs(q.errLo)) / 2;
}

/** Kepler's third law: period in days from a (AU) and stellar mass (M☉). */
export function keplerPeriodDays(aAu: number, starMassSun: number): number {
  return Math.sqrt(aAu ** 3 / starMassSun) * 365.25;
}

/** Kepler's third law inverted: a (AU) from period (days) and stellar mass (M☉). */
export function keplerSemiMajorAxisAu(periodDays: number, starMassSun: number): number {
  return Math.cbrt((periodDays / 365.25) ** 2 * starMassSun);
}

function missingEssentials(p: OrbitPlanet): string[] {
  const missing: string[] = [];
  if (p.semiMajorAxis.value === null) missing.push("semi-major axis");
  if (p.period.value === null) missing.push("period");
  if (p.transitEpoch.value === null) missing.push("transit epoch");
  return missing;
}

function schematicRadius(
  p: OrbitPlanet,
  starMassSun: number | null,
  placeholderAu: number,
): Pick<SchematicOrbit, "radiusAu" | "radiusMethod"> {
  if (p.semiMajorAxis.value !== null) {
    return { radiusAu: p.semiMajorAxis.value, radiusMethod: "archive" };
  }
  if (p.period.value !== null && starMassSun !== null) {
    return {
      radiusAu: keplerSemiMajorAxisAu(p.period.value, starMassSun),
      radiusMethod: "kepler3",
    };
  }
  return { radiusAu: placeholderAu, radiusMethod: "placeholder" };
}

/**
 * How a planet can honestly be drawn. Keplerian needs a, period and a transit epoch; a missing
 * eccentricity is drawn circular and a missing ω is assumed, both reported in `assumed`.
 */
export function orbitModel(
  p: OrbitPlanet,
  starMassSun: number | null,
  placeholderAu: number,
): OrbitModel {
  const a = p.semiMajorAxis.value;
  const per = p.period.value;
  const t0 = p.transitEpoch.value;
  if (a === null || per === null || t0 === null) {
    return {
      kind: "schematic",
      missing: missingEssentials(p),
      ...schematicRadius(p, starMassSun, placeholderAu),
    };
  }
  const e = p.eccentricity.value;
  const w = p.periastronArg.value;
  return {
    kind: "keplerian",
    elements: {
      a,
      e: e ?? 0,
      omegaRad: normalizeDeg(w ?? 90) * DEG,
      periodDays: per,
      transitJd: t0,
    },
    assumed: assumptionsFor(e, w),
  };
}

function assumptionsFor(e: number | null, w: number | null): Assumption[] {
  if (e === null) return ["circular"];
  return w === null && e > 0 ? ["periastron"] : [];
}

/** Solve M = E − e·sin E for the eccentric anomaly E (Newton's method). */
export function solveKepler(meanAnomaly: number, e: number): number {
  let ecc = e < 0.8 ? meanAnomaly : Math.PI;
  for (let i = 0; i < 30; i += 1) {
    const step = (ecc - e * Math.sin(ecc) - meanAnomaly) / (1 - e * Math.cos(ecc));
    ecc -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return ecc;
}

/** At transit the planet crosses +y, so its true anomaly is 90° − ω. */
export function meanAnomalyAtTransit(el: Elements): number {
  const nu = Math.PI / 2 - el.omegaRad;
  const ecc = 2 * Math.atan(Math.sqrt((1 - el.e) / (1 + el.e)) * Math.tan(nu / 2));
  return ecc - el.e * Math.sin(ecc);
}

export function positionAt(el: Elements, jd: number): OrbitPoint {
  const m = meanAnomalyAtTransit(el) + (TWO_PI / el.periodDays) * (jd - el.transitJd);
  const ecc = solveKepler(((m % TWO_PI) + TWO_PI) % TWO_PI, el.e);
  const nu =
    2 *
    Math.atan2(Math.sqrt(1 + el.e) * Math.sin(ecc / 2), Math.sqrt(1 - el.e) * Math.cos(ecc / 2));
  const r = el.a * (1 - el.e * Math.cos(ecc));
  const u = el.omegaRad + nu;
  return { x: r * Math.cos(u), y: r * Math.sin(u), trueAnomaly: nu };
}

/** The full ellipse as points in the orbital plane. */
export function orbitPath(el: Elements, segments = 256): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 0; k <= segments; k += 1) {
    const nu = (TWO_PI * k) / segments;
    const r = (el.a * (1 - el.e * el.e)) / (1 + el.e * Math.cos(nu));
    pts.push([r * Math.cos(el.omegaRad + nu), r * Math.sin(el.omegaRad + nu)]);
  }
  return pts;
}

export function orbitsSinceEpoch(el: Elements, jd: number): number {
  return (jd - el.transitJd) / el.periodDays;
}

/**
 * 1σ uncertainty of the predicted position, as orbital phase in radians, after propagating
 * the transit epoch to `jd` with a linear ephemeris: σt² = σT0² + (N·σP)². TTVs are ignored.
 */
export function positionSigmaRad(p: OrbitPlanet, el: Elements, jd: number): number | null {
  const sT0 = sigma(p.transitEpoch);
  const sP = sigma(p.period);
  if (sT0 === null || sP === null) return null;
  const n = Math.abs(orbitsSinceEpoch(el, jd));
  return (TWO_PI * Math.hypot(sT0, n * sP)) / el.periodDays;
}

/**
 * The arc (orbital-plane points, AU) covering ±2σ of the predicted position at `jd`, capped at
 * half an orbit. Null when the position uncertainty is unknown.
 */
export function spreadArc(
  p: OrbitPlanet,
  el: Elements,
  jd: number,
  samples = 49,
): [number, number][] | null {
  const sig = positionSigmaRad(p, el, jd);
  if (sig === null) return null;
  const spanDays = Math.min((2 * sig * el.periodDays) / TWO_PI, el.periodDays / 2);
  const half = (samples - 1) / 2;
  return Array.from({ length: samples }, (_, i): [number, number] => {
    const pos = positionAt(el, jd + ((i - half) / half) * spanDays);
    return [pos.x, pos.y];
  });
}

/** Inner and outer radii (AU) of a ±1σ band around a; the inner edge never goes below zero. */
export function bandRadii(aAu: number, sigmaAu: number): { inner: number; outer: number } {
  return { inner: Math.max(aAu - sigmaAu, 0), outer: aAu + sigmaAu };
}

/** Scene units per AU so the widest orbit spans `extent` scene units. */
export function sceneScale(maxAu: number, extent = 6): number {
  return maxAu > 0 ? extent / maxAu : 1;
}

export function jdFromDate(d: Date): number {
  return d.getTime() / MS_PER_DAY + JD_UNIX_EPOCH;
}

export function dateFromJd(jd: number): Date {
  return new Date((jd - JD_UNIX_EPOCH) * MS_PER_DAY);
}
