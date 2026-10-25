import type { ExoState } from "./store";
import type { Layers } from "@/features/scene/orbits/layers";
import { restoreJulianDate } from "@/features/project/scenePersistence";

export function changeOrbitLayers(state: ExoState, layers: Layers) {
  return state.projectTransition
    ? {}
    : { sceneSettings: { ...state.sceneSettings, orbitLayers: { ...layers } } };
}

export function readSimulatedTime(state: ExoState, jd: number, manual = false) {
  if (state.projectTransition || restoreJulianDate(jd) === undefined) return {};
  return {
    sceneSettings: {
      ...state.sceneSettings,
      simulatedJulianDate: jd,
      // A manual reset must save even though ordinary clock ticks are unobserved.
      ...(manual ? { simulatedTimeReset: jd } : {}),
    },
  };
}
