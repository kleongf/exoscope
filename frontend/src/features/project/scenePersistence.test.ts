import { describe, expect, it } from "vitest";
import schema from "@/api/openapi.json";
import { DEFAULT_LAYERS } from "@/features/scene/orbits/layers";
import { useExoStore } from "@/store/store";
import {
  observedProjectKey,
  restoreJulianDate,
  restoreOrbitLayers,
  restoreSceneControls,
  snapshotSceneSettings,
} from "./scenePersistence";
import { projectSnapshot } from "./persistence";

describe("scene settings validation", () => {
  it("accepts exactly the generated command colour allowlist", () => {
    for (const colorBy of schema.components.schemas.SetColorBy.properties.property.enum) {
      expect(restoreSceneControls({ sceneState: { colorBy } }).colorBy).toBe(colorBy);
    }
    for (const colorBy of ["mass", "__proto__", 1, null, {}]) {
      expect(restoreSceneControls({ sceneState: { colorBy } }).colorBy).toBe("none");
    }
  });

  it("defaults missing, malformed and incorrectly typed controls without coercion", () => {
    const defaults = { cameraFocus: null, playing: true, showLabels: true, colorBy: "none" };
    for (const sceneState of [null, [], "invalid", true, 3]) {
      expect(restoreSceneControls({ sceneState })).toEqual(defaults);
    }
    expect(
      restoreSceneControls({
        sceneState: { cameraFocus: [], playing: "false", showLabels: 0, colorBy: false },
      }),
    ).toEqual(defaults);
    expect(
      restoreSceneControls({
        sceneState: {
          cameraFocus: "TOI-700 d",
          playing: false,
          showLabels: false,
          colorBy: "radius",
        },
      }),
    ).toEqual({ cameraFocus: "TOI-700 d", playing: false, showLabels: false, colorBy: "radius" });
  });

  it("validates each honesty layer independently and ignores unknown keys", () => {
    expect(restoreOrbitLayers(null)).toEqual(DEFAULT_LAYERS);
    expect(restoreOrbitLayers([false])).toEqual(DEFAULT_LAYERS);
    expect(
      restoreOrbitLayers({
        orbitBands: false,
        positionSpread: "false",
        trueSizes: true,
        extra: true,
      }),
    ).toEqual({ ...DEFAULT_LAYERS, orbitBands: false, trueSizes: true });
  });

  it("accepts finite Julian dates within the date readout's supported range", () => {
    expect(restoreJulianDate(2460000.5)).toBe(2460000.5);
    for (const value of [null, "2460000.5", [], NaN, Infinity, -Infinity, 1e100]) {
      expect(restoreJulianDate(value)).toBeUndefined();
    }
  });

  it("merges controls while retaining other settings, including future scene keys", () => {
    const settings = {
      snapshot: { source: "fixture" },
      explorerSections: { systems: false },
      sceneState: { future: "keep", playing: false },
      orbitLayers: { trueSizes: true },
      simulatedJulianDate: 2460000.5,
    };
    expect(snapshotSceneSettings(settings, useExoStore.getInitialState())).toEqual({
      ...settings,
      sceneState: {
        future: "keep",
        cameraFocus: null,
        playing: true,
        showLabels: true,
        colorBy: "none",
      },
    });
    expect(settings.sceneState.playing).toBe(false);
  });

  it("excludes only the animated date from the observed key", () => {
    const snapshot = projectSnapshot();
    const key = observedProjectKey(snapshot);
    expect(
      observedProjectKey({
        ...snapshot,
        sceneSettings: { ...snapshot.sceneSettings, simulatedJulianDate: 2460000.5 },
      }),
    ).toBe(key);
    for (const settings of [
      { simulatedTimeReset: 2460000.5 },
      { explorerSections: { systems: false } },
      { orbitLayers: { trueSizes: true } },
      { sceneState: { playing: false } },
    ]) {
      expect(
        observedProjectKey({
          ...snapshot,
          sceneSettings: { ...snapshot.sceneSettings, ...settings },
        }),
      ).not.toBe(key);
    }
  });
});
