/** Builds the AR model in the browser: a schematic sphere plus its label, exported as GLB. */
import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const SPHERE_RADIUS_M = 0.15;
const LABEL_WIDTH_M = 0.5;
const LABEL_PX = { width: 1024, height: 340 };

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const context = element.getContext("2d");
  if (!context) throw new Error("2D canvas unavailable");
  return [element, context];
}

function texture(element: HTMLCanvasElement): CanvasTexture {
  const map = new CanvasTexture(element);
  map.colorSpace = SRGBColorSpace;
  return map;
}

/** Flat tint with a latitude/longitude graticule, so rotation is visible without inventing a surface. */
function surfaceTexture(color: string): CanvasTexture {
  const [element, ctx] = canvas(512, 256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= 512; x += 512 / 12) ctx.strokeRect(x, 0, 0, 256);
  for (let y = 256 / 6; y < 256; y += 256 / 6) ctx.strokeRect(0, y, 512, 0);
  return texture(element);
}

function labelTexture(lines: string[]): CanvasTexture {
  const [element, ctx] = canvas(LABEL_PX.width, LABEL_PX.height);
  ctx.fillStyle = "rgba(10, 12, 18, 0.88)";
  ctx.beginPath();
  ctx.roundRect(0, 0, LABEL_PX.width, LABEL_PX.height, 28);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? "600 64px sans-serif" : "34px sans-serif";
    ctx.globalAlpha = i === 0 ? 1 : 0.85;
    ctx.fillText(line, 40, i === 0 ? 30 : 70 + i * 48, LABEL_PX.width - 80);
  });
  return texture(element);
}

export function buildPlanetGroup(color: string, lines: string[]): Group {
  const group = new Group();
  const sphere = new Mesh(
    new SphereGeometry(SPHERE_RADIUS_M, 64, 32),
    new MeshStandardMaterial({ map: surfaceTexture(color), roughness: 0.9, metalness: 0 }),
  );
  sphere.position.y = SPHERE_RADIUS_M;
  const labelHeight = (LABEL_WIDTH_M * LABEL_PX.height) / LABEL_PX.width;
  const label = new Mesh(
    new PlaneGeometry(LABEL_WIDTH_M, labelHeight),
    new MeshBasicMaterial({ map: labelTexture(lines), transparent: true, side: DoubleSide }),
  );
  label.position.y = SPHERE_RADIUS_M * 2 + 0.04 + labelHeight / 2;
  group.add(sphere, label);
  return group;
}

/** The planet model as a binary glTF blob, ready for <model-viewer>. */
export async function planetGlb(color: string, lines: string[]): Promise<Blob> {
  const result = await new GLTFExporter().parseAsync(buildPlanetGroup(color, lines), {
    binary: true,
  });
  if (!(result instanceof ArrayBuffer)) throw new Error("GLTFExporter returned JSON, expected GLB");
  return new Blob([result], { type: "model/gltf-binary" });
}
