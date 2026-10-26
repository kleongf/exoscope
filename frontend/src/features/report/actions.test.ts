import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { System } from "@/api/client";
import { useExoStore } from "@/store/store";
import { captureSystemView } from "./actions";

const missing = { status: "missing", unit: null } as const;
function system(hostname: string): System {
  return {
    hostname,
    star: {
      hostname,
      effective_temperature: missing,
      radius: missing,
      mass: missing,
      luminosity: missing,
      distance: missing,
      ra: missing,
      dec: missing,
    },
    planets: [],
    notes: [],
    provenance: { mode: "snapshot", source: "NASA", snapshot_date: "2026-10-25" },
  };
}
beforeEach(() => {
  useExoStore.setState(useExoStore.getInitialState());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it("retries a System change instead of labeling new pixels with the previous hostname", async () => {
  const first = system("TRAPPIST-1"),
    second = system("TOI-700");
  useExoStore.setState({ system: first });
  const canvas = {
    toDataURL: vi.fn(() => `pixels:${useExoStore.getState().system?.hostname ?? "none"}`),
  };
  vi.stubGlobal("document", { querySelector: () => canvas });
  let frames = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    if (++frames === 1) useExoStore.setState({ system: second });
    callback(0);
    return frames;
  });
  const snapshot = await captureSystemView();
  expect(canvas.toDataURL).toHaveBeenCalledOnce();
  expect(snapshot).toMatchObject({ hostname: "TOI-700", data_url: "pixels:TOI-700" });
});

it("discards the snapshot when the canvas keeps being replaced", async () => {
  useExoStore.setState({
    system: system("TRAPPIST-1"),
  });
  const read = vi.fn(() => "must not capture");
  vi.stubGlobal("document", { querySelector: () => ({ toDataURL: read }) });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  expect(await captureSystemView()).toBeUndefined();
  expect(read).not.toHaveBeenCalled();
});
