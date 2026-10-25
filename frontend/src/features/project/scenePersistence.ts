import type { ProjectState, UiCommand } from "@/api/client";
import schema from "@/api/openapi.json";
import { DEFAULT_LAYERS, type Layers } from "@/features/scene/orbits/layers";
import type { SceneState } from "@/store/store";

type SceneControls = Pick<SceneState, "cameraFocus" | "playing" | "showLabels" | "colorBy">;
type ColorBy = Extract<UiCommand, { kind: "set_color_by" }>["property"];
type Settings = ProjectState["sceneSettings"];
const COLORS: readonly string[] = schema.components.schemas.SetColorBy.properties.property.enum;
const DEFAULT_CONTROLS: SceneControls = {
  cameraFocus: null,
  playing: true,
  showLabels: true,
  colorBy: "none",
};

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Generic Project JSON is untrusted, including older or partially saved settings. */
export function restoreSceneControls(settings: Settings): SceneControls {
  const saved = object(settings.sceneState);
  return {
    cameraFocus: typeof saved.cameraFocus === "string" ? saved.cameraFocus : null,
    playing: typeof saved.playing === "boolean" ? saved.playing : DEFAULT_CONTROLS.playing,
    showLabels:
      typeof saved.showLabels === "boolean" ? saved.showLabels : DEFAULT_CONTROLS.showLabels,
    colorBy:
      typeof saved.colorBy === "string" && COLORS.includes(saved.colorBy)
        ? (saved.colorBy as ColorBy)
        : DEFAULT_CONTROLS.colorBy,
  };
}

export function restoreOrbitLayers(value: unknown): Layers {
  const saved = object(value);
  return Object.fromEntries(
    Object.entries(DEFAULT_LAYERS).map(([key, fallback]) => [
      key,
      typeof saved[key] === "boolean" ? saved[key] : fallback,
    ]),
  ) as unknown as Layers;
}

export function restoreJulianDate(value: unknown): number | undefined {
  // The date readout uses JavaScript Date, whose supported range is ±100 million days.
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value - 2440587.5) <= 1e8
    ? value
    : undefined;
}

export function snapshotSceneSettings(settings: Settings, scene: SceneControls): Settings {
  const { cameraFocus, playing, showLabels, colorBy } = scene;
  return {
    ...settings,
    sceneState: { ...object(settings.sceneState), cameraFocus, playing, showLabels, colorBy },
  };
}

/** Clock readouts belong in explicit saves, but never restart the autosave debounce. */
export function observedProjectKey(state: ProjectState): string {
  return JSON.stringify({
    ...state,
    sceneSettings: { ...state.sceneSettings, simulatedJulianDate: undefined },
  });
}
