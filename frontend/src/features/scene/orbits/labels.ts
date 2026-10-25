/**
 * Screen-space labels for the 3D scene. Scene code records where each label is anchored in world
 * space; the overlay registers the matching DOM node; once per frame `project` moves each node to
 * its anchor's screen position. Plain DOM keeps labels crisp and avoids a React root per label.
 */
import { Vector3, type Camera } from "three";

interface Entry {
  world: Vector3 | null;
  el: HTMLElement | null;
}

export class LabelRegistry {
  private readonly entries = new Map<string, Entry>();
  private readonly scratch = new Vector3();

  private entry(id: string): Entry {
    let e = this.entries.get(id);
    if (e === undefined) {
      e = { world: null, el: null };
      this.entries.set(id, e);
    }
    return e;
  }

  /** Anchor `id` at a world position; `null` hides it. */
  setWorld(id: string, position: Vector3 | null): void {
    const e = this.entry(id);
    if (position === null) e.world = null;
    else (e.world ??= new Vector3()).copy(position);
  }

  /** Attach (or detach, with null) the DOM node that shows label `id`. */
  setElement(id: string, el: HTMLElement | null): void {
    this.entry(id).el = el;
  }

  project(camera: Camera, width: number, height: number): void {
    for (const { world, el } of this.entries.values()) {
      if (el === null) continue;
      const v = world === null ? null : this.scratch.copy(world).project(camera);
      if (v === null || v.z > 1) {
        el.style.visibility = "hidden";
        continue;
      }
      const x = ((v.x + 1) / 2) * width;
      const y = ((1 - v.y) / 2) * height;
      el.style.visibility = "visible";
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }
}

export const HOVER_LABEL = "__hover__";
export const NODES_LABEL = "__line-of-nodes__";
export const EARTH_LABEL = "__earth__";

/** World anchors for the assumption labels: past the end of each dashed line. */
export function assumptionAnchors(extent: number): { nodes: Vector3; earth: Vector3 } {
  const reach = extent + 0.8;
  return { nodes: new Vector3(reach + 0.3, 0, 0), earth: new Vector3(0, 0, extent + 0.4) };
}
