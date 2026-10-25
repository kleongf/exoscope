// PROTOTYPE (prototype/turn-ui): throwaway. Values copied from the TRAPPIST-1 Snapshot
// (backend/exoscope/catalog/snapshots/trappist-1.json, 2026-10-25).

export interface ProtoPlanet {
  id: string;
  /** Semi-major axis, AU. */
  a: number;
  /** Radius, Earth radii. */
  radius: number;
  /** Orbital period, days. */
  period: number;
}

export const TRAPPIST_1: ProtoPlanet[] = [
  { id: "TRAPPIST-1 b", a: 0.01154, radius: 1.116, period: 1.510826 },
  { id: "TRAPPIST-1 c", a: 0.0158, radius: 1.097, period: 2.421937 },
  { id: "TRAPPIST-1 d", a: 0.02227, radius: 0.788, period: 4.049219 },
  { id: "TRAPPIST-1 e", a: 0.02925, radius: 0.92, period: 6.101013 },
  { id: "TRAPPIST-1 f", a: 0.03849, radius: 1.045, period: 9.20754 },
  { id: "TRAPPIST-1 g", a: 0.04683, radius: 1.129, period: 12.352446 },
  { id: "TRAPPIST-1 h", a: 0.06189, radius: 0.755, period: 18.772866 },
];

export const SNAPSHOT_DATE = "2026-10-25";
