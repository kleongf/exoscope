// PROTOTYPE (issue #5): pure Keplerian orbit maths for the System view variants.
// No DOM, no React: this module is the part worth lifting into the real scene feature.

export interface ProtoRef {
  label: string;
  url: string | null;
}

export interface ProtoQuantity {
  value: number | null;
  unit: string;
  errHi: number | null;
  errLo: number | null;
  ref: ProtoRef | null;
}

export interface ProtoPlanet {
  id: string;
  letter: string;
  period: ProtoQuantity;
  a: ProtoQuantity;
  e: ProtoQuantity;
  omega: ProtoQuantity;
  tranmid: ProtoQuantity;
  radius: ProtoQuantity;
  mass: ProtoQuantity;
  insol: ProtoQuantity;
  eqt: ProtoQuantity;
  incl: ProtoQuantity;
}

export interface ProtoSystem {
  hostname: string;
  snapshotDate: string;
  star: { teff: ProtoQuantity; radius: ProtoQuantity; mass: ProtoQuantity };
  planets: ProtoPlanet[];
}

/** Orbital elements a renderer needs; null when the archive lacks something essential. */
export interface Elements {
  a: number; // AU
  e: number;
  omegaRad: number; // argument of periastron
  periodDays: number;
  tranmidJd: number;
  inclRad: number;
}

/** Position in the orbital plane. x along the line of nodes, y toward Earth at transit. */
export interface OrbitPoint {
  x: number; // AU
  y: number; // AU
  trueAnomaly: number;
}

const DEG = Math.PI / 180;
export const AU_PER_RSUN = 0.00465047;
export const AU_PER_REARTH = 4.26352e-5;

export function elementsOf(p: ProtoPlanet): Elements | null {
  const a = p.a.value;
  const per = p.period.value;
  const t0 = p.tranmid.value;
  if (a === null || per === null || t0 === null) return null;
  return {
    a,
    e: p.e.value ?? 0, // the badge says when e is assumed 0
    omegaRad: (p.omega.value ?? 90) * DEG,
    periodDays: per,
    tranmidJd: t0,
    inclRad: (p.incl.value ?? 90) * DEG,
  };
}

function solveKepler(meanAnomaly: number, e: number): number {
  let ecc = meanAnomaly;
  for (let i = 0; i < 12; i += 1) {
    ecc -= (ecc - e * Math.sin(ecc) - meanAnomaly) / (1 - e * Math.cos(ecc));
  }
  return ecc;
}

/** Mean anomaly at the reference transit, where the true anomaly is 90° − ω. */
function meanAnomalyAtTransit(el: Elements): number {
  const nu = Math.PI / 2 - el.omegaRad;
  const ecc = 2 * Math.atan(Math.sqrt((1 - el.e) / (1 + el.e)) * Math.tan(nu / 2));
  return ecc - el.e * Math.sin(ecc);
}

export function positionAt(el: Elements, jd: number): OrbitPoint {
  const n = (2 * Math.PI) / el.periodDays;
  const m = meanAnomalyAtTransit(el) + n * (jd - el.tranmidJd);
  const ecc = solveKepler(m, el.e);
  const nu =
    2 *
    Math.atan2(Math.sqrt(1 + el.e) * Math.sin(ecc / 2), Math.sqrt(1 - el.e) * Math.cos(ecc / 2));
  const r = el.a * (1 - el.e * Math.cos(ecc));
  const u = el.omegaRad + nu; // argument of latitude
  return { x: r * Math.cos(u), y: r * Math.sin(u), trueAnomaly: nu };
}

/** The whole ellipse as points in the orbital plane (for drawing). */
export function orbitPath(el: Elements, segments = 256): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 0; k <= segments; k += 1) {
    const nu = (2 * Math.PI * k) / segments;
    const r = (el.a * (1 - el.e * el.e)) / (1 + el.e * Math.cos(nu));
    const u = el.omegaRad + nu;
    pts.push([r * Math.cos(u), r * Math.sin(u)]);
  }
  return pts;
}

/** Sky-plane projection as seen from Earth. depth > 0 means in front of the star. */
export function skyProjection(
  pt: OrbitPoint,
  el: Elements,
): { sx: number; sy: number; depth: number } {
  return { sx: pt.x, sy: -pt.y * Math.cos(el.inclRad), depth: pt.y * Math.sin(el.inclRad) };
}

/**
 * 1σ uncertainty of the predicted position along the orbit, in radians of phase,
 * after propagating the transit epoch forward: σt² = σT0² + (N·σP)².
 */
export function phaseSigmaRad(p: ProtoPlanet, jd: number): number | null {
  const el = elementsOf(p);
  if (el === null) return null;
  const sT0 = sigma(p.tranmid);
  const sP = sigma(p.period);
  if (sT0 === null || sP === null) return null;
  const orbits = Math.abs(jd - el.tranmidJd) / el.periodDays;
  const sigmaDays = Math.hypot(sT0, orbits * sP);
  return (2 * Math.PI * sigmaDays) / el.periodDays;
}

/** The next predicted transit after `jd`, with its 1σ timing uncertainty in hours. */
export function nextTransit(
  p: ProtoPlanet,
  jd: number,
): { jd: number; sigmaHours: number | null } | null {
  const el = elementsOf(p);
  if (el === null) return null;
  const n = Math.ceil((jd - el.tranmidJd) / el.periodDays);
  const sT0 = sigma(p.tranmid);
  const sP = sigma(p.period);
  const sigmaHours = sT0 === null || sP === null ? null : Math.hypot(sT0, n * sP) * 24;
  return { jd: el.tranmidJd + n * el.periodDays, sigmaHours };
}

export function sigma(q: ProtoQuantity): number | null {
  if (q.errHi === null || q.errLo === null) return null;
  return (Math.abs(q.errHi) + Math.abs(q.errLo)) / 2;
}

/** Kepler's third law check: the period implied by a and the stellar mass, in days. */
export function keplerPeriodDays(aAu: number, starMassSun: number): number {
  return Math.sqrt((aAu * aAu * aAu) / starMassSun) * 365.25;
}

export function orbitsSinceEpoch(el: Elements, jd: number): number {
  return (jd - el.tranmidJd) / el.periodDays;
}

export function jdFromDate(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

export function dateFromJd(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}
