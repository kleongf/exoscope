import type { Object3D } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

/** Any three.js object as a binary glTF blob, ready for <model-viewer>. */
export async function exportGlb(root: Object3D): Promise<Blob> {
  const result = await new GLTFExporter().parseAsync(root, { binary: true });
  if (!(result instanceof ArrayBuffer)) throw new Error("GLTFExporter returned JSON, expected GLB");
  return new Blob([result], { type: "model/gltf-binary" });
}
