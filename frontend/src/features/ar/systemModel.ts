/** Builds the AR System model from a snapshot: star, orbits as thin tubes, planets, labels. */
import {
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { exportGlb } from "./glb";
import type { SnapshotPlanet, SystemSnapshot } from "./systemSnapshot";
import { TABLE_RADIUS_M } from "./systemSnapshot";
import { panelHeight, textPanel } from "./textures";

// Tubes rather than lines: AR Quick Look's USDZ conversion drops line geometry.
const ORBIT_TUBE_M = 0.0012;
const UNKNOWN_RADIUS_M = 0.004;
const STAR_COLOR = "#ff7a3d";
const MISSING_COLOR = "#9aa0a6";

function orbitTube(planet: SnapshotPlanet, y: number): Mesh {
  const points = planet.path.map(([x, z]) => new Vector3(x, y, z));
  const curve = new CatmullRomCurve3(points, true);
  return new Mesh(
    new TubeGeometry(curve, points.length * 2, ORBIT_TUBE_M, 6, true),
    new MeshBasicMaterial({ color: planet.color, transparent: true, opacity: 0.75 }),
  );
}

function planetBody(planet: SnapshotPlanet, y: number): Group {
  const group = new Group();
  const radius = planet.radiusM ?? UNKNOWN_RADIUS_M;
  const color = planet.radiusM === null ? MISSING_COLOR : planet.color;
  const body = new Mesh(
    new SphereGeometry(radius, 32, 16),
    new MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  const label = textPanel(
    planet.radiusM === null ? [planet.letter, "radius missing"] : [planet.letter],
    planet.radiusM === null ? 0.06 : 0.035,
  );
  label.position.y = radius + 0.012 + panelHeight(label) / 2;
  group.add(body, label);
  group.position.set(planet.position[0], y, planet.position[1]);
  return group;
}

export function buildSystemGroup(snapshot: SystemSnapshot): Group {
  const group = new Group();
  const bodies = [
    snapshot.starRadiusM,
    ...snapshot.planets.map((p) => p.radiusM ?? UNKNOWN_RADIUS_M),
  ];
  // Lift the orbital plane so the largest body sits on the table rather than through it.
  const y = Math.max(...bodies) + 0.005;
  const star = new Mesh(
    new SphereGeometry(snapshot.starRadiusM, 32, 16),
    new MeshBasicMaterial({ color: STAR_COLOR }),
  );
  star.position.y = y;
  group.add(star);
  for (const planet of snapshot.planets) group.add(orbitTube(planet, y), planetBody(planet, y));
  const info = textPanel(snapshot.infoLines, 0.5);
  info.position.set(0, panelHeight(info) / 2, -TABLE_RADIUS_M - 0.08);
  group.add(info);
  return group;
}

export function systemGlb(snapshot: SystemSnapshot): Promise<Blob> {
  return exportGlb(buildSystemGroup(snapshot));
}
