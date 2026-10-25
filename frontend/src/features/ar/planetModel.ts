/** Builds the single-planet AR model: a schematic sphere plus its label. */
import { Group, Mesh, MeshStandardMaterial, SphereGeometry } from "three";
import { exportGlb } from "./glb";
import { canvas, panelHeight, textPanel, texture } from "./textures";

const SPHERE_RADIUS_M = 0.15;
const LABEL_WIDTH_M = 0.5;

/** Flat tint with a latitude/longitude graticule, so rotation is visible without inventing a surface. */
function surfaceTexture(color: string) {
  const [element, ctx] = canvas(512, 256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= 512; x += 512 / 12) ctx.strokeRect(x, 0, 0, 256);
  for (let y = 256 / 6; y < 256; y += 256 / 6) ctx.strokeRect(0, y, 512, 0);
  return texture(element);
}

export function buildPlanetGroup(color: string, lines: string[]): Group {
  const group = new Group();
  const sphere = new Mesh(
    new SphereGeometry(SPHERE_RADIUS_M, 64, 32),
    new MeshStandardMaterial({ map: surfaceTexture(color), roughness: 0.9, metalness: 0 }),
  );
  sphere.position.y = SPHERE_RADIUS_M;
  const label = textPanel(lines, LABEL_WIDTH_M);
  label.position.y = SPHERE_RADIUS_M * 2 + 0.04 + panelHeight(label) / 2;
  group.add(sphere, label);
  return group;
}

/** The planet model as a binary glTF blob. */
export function planetGlb(color: string, lines: string[]): Promise<Blob> {
  return exportGlb(buildPlanetGroup(color, lines));
}
