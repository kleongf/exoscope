import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendTurn, type Project, type TurnResponse } from "@/api/client";
import { DEFAULT_LAYERS } from "@/features/scene/orbits/layers";
import { DEFAULT_DAYS_PER_SECOND, useExoStore } from "@/store/store";
import { ProjectController, projectSnapshot } from "./persistence";
import { restoreOrbitLayers } from "./scenePersistence";

vi.mock("@/api/client", () => ({ sendTurn: vi.fn() }));

const response = (project: Project): TurnResponse => ({
  transcript: "",
  reply_text: "",
  project_result: { current: project, projects: [] },
});
let controller: ProjectController;
let project: Project;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  useExoStore.setState(useExoStore.getInitialState());
  controller = new ProjectController();
  project = {
    id: "a".repeat(32),
    title: "Scene",
    version: 1,
    revision: 0,
    created_at: "2026-10-25",
    updated_at: "2026-10-25",
    state: projectSnapshot(),
    reports: [],
  };
});

afterEach(() => {
  controller.dispose();
  vi.useRealTimers();
});

describe("Project scene persistence", () => {
  it("restores controls, camera focus, layers and date, and New Project clears them", async () => {
    const empty = { ...project, id: "b".repeat(32), state: projectSnapshot() };
    empty.state.sceneSettings = {};
    project.state.focusedPlanetName = "TOI-700 d";
    project.state.daysPerSecond = 12;
    project.state.sceneSettings = {
      sceneState: {
        cameraFocus: "TOI-700 d",
        playing: false,
        showLabels: false,
        colorBy: "radius",
      },
      orbitLayers: {
        orbitBands: false,
        positionSpread: false,
        assumptions: false,
        trueSizes: true,
      },
      simulatedJulianDate: 2460000.5,
      snapshot: "keep",
      explorerSections: { systems: false },
    };
    vi.mocked(sendTurn).mockResolvedValue(response(project));
    await controller.start();
    expect(useExoStore.getState()).toMatchObject({
      focusedPlanetName: "TOI-700 d",
      cameraFocus: "TOI-700 d",
      playing: false,
      showLabels: false,
      colorBy: "radius",
      daysPerSecond: 12,
      sceneSettings: project.state.sceneSettings,
    });
    expect(projectSnapshot().sceneSettings).toEqual(project.state.sceneSettings);
    vi.mocked(sendTurn).mockResolvedValueOnce(response(empty));
    await controller.choose();
    const state = useExoStore.getState();
    expect(state).toMatchObject({
      system: null,
      focusedPlanetName: null,
      cameraFocus: null,
      playing: true,
      showLabels: true,
      colorBy: "none",
      daysPerSecond: DEFAULT_DAYS_PER_SECOND,
    });
    expect(state.sceneSettings.simulatedJulianDate).toBeUndefined();
    expect(restoreOrbitLayers(state.sceneSettings.orbitLayers)).toEqual(DEFAULT_LAYERS);
    vi.mocked(sendTurn).mockResolvedValueOnce(response(project));
    await controller.choose(project.id);
    expect(projectSnapshot().sceneSettings).toEqual(project.state.sceneSettings);
    expect(useExoStore.getState().cameraFocus).toBe("TOI-700 d");
  });

  it("legacy settings reset controls instead of leaking the previous Project's values", async () => {
    useExoStore.setState({
      cameraFocus: "old",
      playing: false,
      showLabels: false,
      colorBy: "radius",
    });
    project.state.sceneSettings = { snapshot: "legacy" };
    vi.mocked(sendTurn).mockResolvedValue(response(project));
    await controller.start();
    expect(useExoStore.getState()).toMatchObject({
      cameraFocus: null,
      playing: true,
      showLabels: true,
      colorBy: "none",
      sceneSettings: { snapshot: "legacy" },
    });
  });

  it("resets the clock mount when recovering the same Project", async () => {
    project.state.sceneSettings = { simulatedJulianDate: 2460000.5 };
    vi.mocked(sendTurn).mockResolvedValue(response(project));
    await controller.start();
    const version = useExoStore.getState().sceneRestoreVersion;
    useExoStore.getState().setSimulatedJulianDate(2461000.5);
    await controller.recover(project.id);
    expect(useExoStore.getState().sceneSettings.simulatedJulianDate).toBe(2460000.5);
    expect(useExoStore.getState().sceneRestoreVersion).toBe(version + 1);
    expect(projectSnapshot()).not.toHaveProperty("sceneRestoreVersion");
  });

  it("clock-only readouts keep Saved, while explicit flush includes the latest date", async () => {
    vi.mocked(sendTurn).mockResolvedValue(response(project));
    await controller.start();
    for (let tick = 0; tick < 10; tick++) {
      useExoStore.getState().setSimulatedJulianDate(2460000.5 + tick);
      await vi.advanceTimersByTimeAsync(200);
      expect(useExoStore.getState().projectStatus).toBe("saved");
    }
    expect(sendTurn).toHaveBeenCalledTimes(1);
    await controller.flush();
    expect(sendTurn).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendTurn).mock.calls.at(-1)?.[0].project_action).toMatchObject({
      operation: "save",
      state: { sceneSettings: { simulatedJulianDate: 2460009.5 } },
    });
    expect(useExoStore.getState().projectStatus).toBe("saved");
    await controller.flush();
    expect(sendTurn).toHaveBeenCalledTimes(2);
  });

  it("clock ticks cannot starve the debounce for controls, layers or manual resets", async () => {
    vi.mocked(sendTurn).mockResolvedValue(response(project));
    await controller.start();
    useExoStore.getState().setOrbitLayers({ ...DEFAULT_LAYERS, trueSizes: true });
    useExoStore.getState().applyCommand({ kind: "set_color_by", property: "insolation" });
    useExoStore.getState().setPlaying(false);
    await vi.advanceTimersByTimeAsync(200);
    useExoStore.getState().setSimulatedJulianDate(2460000.5);
    await vi.advanceTimersByTimeAsync(100);
    expect(sendTurn).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendTurn).mock.calls.at(-1)?.[0].project_action).toMatchObject({
      state: {
        sceneSettings: {
          sceneState: { playing: false, colorBy: "insolation" },
          orbitLayers: { trueSizes: true },
          simulatedJulianDate: 2460000.5,
        },
      },
    });
    useExoStore.getState().setSimulatedJulianDate(2461000.5, true);
    expect(useExoStore.getState().projectStatus).toBe("unsaved");
    await vi.advanceTimersByTimeAsync(300);
    expect(sendTurn).toHaveBeenCalledTimes(3);
  });

  it("retains newer settings across async save replies, and flushes time before switching", async () => {
    project.state.sceneSettings = { snapshot: "keep", explorerSections: { systems: false } };
    vi.mocked(sendTurn).mockResolvedValueOnce(response(project));
    await controller.start();
    useExoStore.getState().setPlaying(false);
    let release: (reply: TurnResponse) => void = () => {
      throw new Error("save not started");
    };
    vi.mocked(sendTurn).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = controller.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(sendTurn).toHaveBeenCalledTimes(2);
    const sent = vi.mocked(sendTurn).mock.calls.at(-1)?.[0].project_action?.state;
    useExoStore.getState().setSimulatedJulianDate(2460000.5);
    useExoStore.getState().setOrbitLayers({ ...DEFAULT_LAYERS, assumptions: false });
    useExoStore.setState((state) => ({
      sceneSettings: { ...state.sceneSettings, explorerSections: { systems: true } },
    }));
    release(response({ ...project, revision: 1, state: sent as Project["state"] }));
    await pending;
    expect(useExoStore.getState().sceneSettings).toMatchObject({
      snapshot: "keep",
      explorerSections: { systems: true },
      simulatedJulianDate: 2460000.5,
      orbitLayers: { assumptions: false },
    });
    expect(useExoStore.getState().projectStatus).toBe("unsaved");
    vi.mocked(sendTurn).mockResolvedValue(response({ ...project, revision: 2 }));
    await controller.choose("b".repeat(32));
    expect(vi.mocked(sendTurn).mock.calls[2]?.[0].project_action).toMatchObject({
      operation: "save",
      revision: 1,
      state: {
        sceneSettings: {
          snapshot: "keep",
          explorerSections: { systems: true },
          simulatedJulianDate: 2460000.5,
          orbitLayers: { assumptions: false },
        },
      },
    });
    expect(vi.mocked(sendTurn).mock.calls[3]?.[0].project_action).toMatchObject({
      operation: "load",
    });
  });

  it("clock updates during a save do not mark the saved controls unsaved", async () => {
    vi.mocked(sendTurn).mockResolvedValueOnce(response(project));
    await controller.start();
    useExoStore.getState().setPlaying(false);
    vi.mocked(sendTurn).mockImplementationOnce(() => {
      useExoStore.getState().setSimulatedJulianDate(2460000.5);
      return Promise.resolve(response({ ...project, revision: 1 }));
    });
    await controller.flush();
    expect(useExoStore.getState().projectStatus).toBe("saved");
    await vi.advanceTimersByTimeAsync(1000);
    expect(sendTurn).toHaveBeenCalledTimes(2);
  });
});
