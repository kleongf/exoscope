/** Canvas-drawn textures and text panels for AR models. Text lives in the model, not the page. */
import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";

export function canvas(
  width: number,
  height: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const context = element.getContext("2d");
  if (!context) throw new Error("2D canvas unavailable");
  return [element, context];
}

export function texture(element: HTMLCanvasElement): CanvasTexture {
  const map = new CanvasTexture(element);
  map.colorSpace = SRGBColorSpace;
  return map;
}

const PX_WIDTH = 1024;
const PADDING = 40;
const TITLE_PX = 64;
const LINE_PX = 34;
const LINE_GAP = 14;

/** A dark rounded panel with a bold first line; its height grows with the number of lines. */
export function textPanel(lines: string[], widthM: number): Mesh {
  const height = PADDING * 2 + TITLE_PX + (lines.length - 1) * (LINE_PX + LINE_GAP) + LINE_GAP;
  const [element, ctx] = canvas(PX_WIDTH, height);
  ctx.fillStyle = "rgba(10, 12, 18, 0.88)";
  ctx.beginPath();
  ctx.roundRect(0, 0, PX_WIDTH, height, 28);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  let y = PADDING;
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? `600 ${String(TITLE_PX)}px sans-serif` : `${String(LINE_PX)}px sans-serif`;
    ctx.globalAlpha = i === 0 ? 1 : 0.85;
    ctx.fillText(line, PADDING, y, PX_WIDTH - PADDING * 2);
    y += (i === 0 ? TITLE_PX : LINE_PX) + LINE_GAP;
  });
  return new Mesh(
    new PlaneGeometry(widthM, (widthM * height) / PX_WIDTH),
    new MeshBasicMaterial({ map: texture(element), transparent: true, side: DoubleSide }),
  );
}

/** Height of a panel built by textPanel, in metres. */
export function panelHeight(panel: Mesh): number {
  const geometry = panel.geometry as PlaneGeometry;
  return geometry.parameters.height;
}
