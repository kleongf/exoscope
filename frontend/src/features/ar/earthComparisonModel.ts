import { DoubleSide, Group, Mesh, MeshBasicMaterial, SphereGeometry } from "three";
import type { Planet } from "@/api/client";
import { comparisonLabelLines, comparisonRadii } from "./earthComparison";
import { groupGlb, modelLabel, schematicSphere } from "./planetModel";
import { planetTint } from "./tint";

const EARTH_COLOR = "#3b82f6";
const LABEL_WIDTH_M = 0.36;
const LABEL_HEIGHT_M = (LABEL_WIDTH_M * 340) / 1024;
const BODY_GAP_M = 0.12;

function body(group: Group, x: number, radius: number, color: string, lines: string[]) {
  const sphere = schematicSphere(radius, color);
  sphere.position.set(x, radius, 0);
  const label = modelLabel(lines, LABEL_WIDTH_M);
  label.position.set(x, radius * 2 + 0.04 + LABEL_HEIGHT_M / 2, 0);
  group.add(sphere, label);
}

function uncertaintyShell(
  x: number,
  y: number,
  radius: number,
  name: string,
  opacity: number,
): Mesh {
  const shell = new Mesh(
    new SphereGeometry(radius, 64, 32),
    new MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  shell.name = name;
  shell.position.set(x, y, 0);
  return shell;
}

/** Earth and a measured planet at a shared scale, with both ±1σ bounds as faint shells. */
export function buildEarthComparisonGroup(planet: Planet): Group {
  if (planet.radius.status === "missing") {
    throw new Error("A planet with a missing radius cannot be compared with Earth");
  }
  const group = new Group();
  group.name = "earth-planet-radius-comparison";
  const radii = comparisonRadii(planet.radius);
  const labels = comparisonLabelLines(planet);
  const separation = radii.earth + radii.planet + BODY_GAP_M;
  const earthX = -separation / 2;
  const planetX = separation / 2;
  body(group, earthX, radii.earth, EARTH_COLOR, labels.earth);
  body(
    group,
    planetX,
    radii.planet,
    planetTint(planet.equilibrium_temperature).color,
    labels.planet,
  );
  if (radii.lower !== null && radii.lower < radii.planet) {
    group.add(
      uncertaintyShell(planetX, radii.planet, radii.lower, "planet-radius-minus-1-sigma", 0.1),
    );
  }
  if (radii.upper !== null && radii.upper > radii.planet) {
    group.add(
      uncertaintyShell(planetX, radii.planet, radii.upper, "planet-radius-plus-1-sigma", 0.18),
    );
  }
  return group;
}

export function earthComparisonGlb(planet: Planet): Promise<Blob> {
  return groupGlb(buildEarthComparisonGroup(planet));
}
