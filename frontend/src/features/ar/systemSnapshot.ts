/**
 * What the AR System model shows, frozen at one simulated moment. Uses the System view's own
 * layout, Kepler maths, size factors and badge wording so the two can't drift apart.
 */
import {
  buildLayout,
  caveatParts,
  EXAGGERATED,
  planetRadiusScene,
  starRadiusScene,
} from "@/features/scene/orbits/layout";
import {
  dateFromJd,
  orbitPath,
  positionAt,
  type KeplerianOrbit,
} from "@/features/scene/orbits/maths";
import { provenanceLabel, type OrbitSystem } from "@/features/scene/orbits/types";

/** Radius of the widest drawn orbit on the table, in metres. Pinch-to-resize scales from here. */
export const TABLE_RADIUS_M = 0.4;

export interface SnapshotPlanet {
  name: string;
  letter: string;
  color: string;
  /** Orbit ellipse in the table plane, metres: [x, z]. */
  path: [number, number][];
  position: [number, number];
  /** Exaggerated by the same factor as the System view; null when the archive has no radius. */
  radiusM: number | null;
}

export interface SystemSnapshot {
  planets: SnapshotPlanet[];
  starRadiusM: number;
  /** Text panel lines, title first. */
  infoLines: string[];
}

const ASSUMPTION_TEXT = {
  circular: "eccentricity missing, drawn circular",
  periastron: "periastron argument missing, assumed 90°",
} as const;

function widestAu(orbits: KeplerianOrbit[]): number {
  return Math.max(...orbits.map((o) => o.elements.a * (1 + o.elements.e)), 1e-6);
}

function omittedLine(names: string[]): string[] {
  if (names.length === 0) return [];
  const noun = names.length === 1 ? "planet" : "planets";
  return [`${String(names.length)} ${noun} not shown: orbit unknown (${names.join(", ")})`];
}

export function systemSnapshot(system: OrbitSystem, jd: number): SystemSnapshot {
  const layout = buildLayout(system);
  const placeable = layout.planets.flatMap((item) =>
    item.model.kind === "keplerian" ? [{ item, orbit: item.model }] : [],
  );
  const omitted = layout.planets
    .filter((item) => item.model.kind !== "keplerian")
    .map((item) => item.planet.name);
  const metresPerAu = TABLE_RADIUS_M / widestAu(placeable.map((p) => p.orbit));
  const planets = placeable.map(({ item, orbit }): SnapshotPlanet => {
    const at = positionAt(orbit.elements, jd);
    return {
      name: item.planet.name,
      letter: item.planet.letter,
      color: item.color,
      path: orbitPath(orbit.elements, 128).map(([x, y]) => [x * metresPerAu, y * metresPerAu]),
      position: [at.x * metresPerAu, at.y * metresPerAu],
      radiusM: planetRadiusScene(item.planet, metresPerAu, EXAGGERATED),
    };
  });
  const assumptions = placeable.flatMap(({ item, orbit }) =>
    orbit.assumed.map((a) => `${item.planet.name}: ${ASSUMPTION_TEXT[a]}`),
  );
  const date = dateFromJd(jd).toISOString().slice(0, 10);
  return {
    planets,
    starRadiusM: starRadiusScene(system, metresPerAu, EXAGGERATED),
    infoLines: [
      `${system.hostname} · schematic model`,
      `Positions frozen at ${date} (simulated date)`,
      ...caveatParts(EXAGGERATED),
      provenanceLabel(system.provenance),
      ...omittedLine(omitted),
      ...assumptions,
    ],
  };
}
