import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_LAYERS } from "@/features/scene/orbits/layers";
import { useExoStore } from "./store";

beforeEach(() => {
  useExoStore.setState(useExoStore.getInitialState());
});

describe("manual scene persistence actions", () => {
  it("preserves unrelated settings across every layer and clock update", () => {
    useExoStore.setState({
      sceneSettings: { snapshot: "keep", explorerSections: { samples: false } },
    });
    useExoStore.getState().setOrbitLayers({ ...DEFAULT_LAYERS, trueSizes: true });
    useExoStore.getState().setSimulatedJulianDate(2460000.5);
    useExoStore.getState().setSimulatedJulianDate(2461000.5, true);
    expect(useExoStore.getState().sceneSettings).toEqual({
      snapshot: "keep",
      explorerSections: { samples: false },
      orbitLayers: { ...DEFAULT_LAYERS, trueSizes: true },
      simulatedJulianDate: 2461000.5,
      simulatedTimeReset: 2461000.5,
    });
  });

  it("rejects invalid readouts and locks scene updates during a Project transition", () => {
    for (const value of [NaN, Infinity, 1e100]) {
      useExoStore.getState().setSimulatedJulianDate(value, true);
    }
    expect(useExoStore.getState().sceneSettings).toEqual({});
    useExoStore.setState({ projectTransition: true });
    useExoStore.getState().setSimulatedJulianDate(2460000.5, true);
    useExoStore.getState().setOrbitLayers({ ...DEFAULT_LAYERS, trueSizes: true });
    useExoStore.getState().setPlaying(false);
    expect(useExoStore.getState().sceneSettings).toEqual({});
    expect(useExoStore.getState().playing).toBe(true);
  });
});
