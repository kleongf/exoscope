import { beforeEach, describe, expect, it } from "vitest";
import type { System } from "../api/client";
import { reduceCommand, useExoStore } from "./store";

const missing = { status: "missing", unit: null } as const;
const system: System = {
  hostname: "TOI-700",
  star: {
    hostname: "TOI-700",
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
  provenance: {
    mode: "snapshot",
    source: "NASA Exoplanet Archive (pscomppars)",
    snapshot_date: "2026-10-25",
  },
};
const scene = { system: null, focusedPlanetName: null, daysPerSecond: 1 };
describe("System commands and turn state", () => {
  beforeEach(() => {
    useExoStore.setState(useExoStore.getInitialState());
  });
  it("focuses a planet", () => {
    expect(
      reduceCommand(scene, { kind: "focus_planet", name: "TRAPPIST-1 e" }).focusedPlanetName,
    ).toBe("TRAPPIST-1 e");
  });
  it("replaces the single System and clears focus from the previous System", () => {
    const next = reduceCommand(
      { ...scene, focusedPlanetName: "TRAPPIST-1 e" },
      { kind: "load_system", system },
    );
    expect(next.system).toBe(system);
    expect(next.focusedPlanetName).toBeNull();
  });
  it("applies every command before publishing reply audio in the same store update", () => {
    const observed: string[] = [];
    const unsubscribe = useExoStore.subscribe((state) => {
      if (state.replyAudio) observed.push(state.system?.hostname ?? "missing");
    });
    useExoStore.getState().acceptTurn({
      transcript: "Open TOI-700",
      reply_text: "Mock finding",
      reply_audio: { data_base64: "AA==", mime_type: "audio/wav" },
      ui_commands: [
        { kind: "load_system", system },
        { kind: "focus_planet", name: "TOI-700 d" },
        { kind: "set_time_scale", days_per_second: 4 },
      ],
    });
    unsubscribe();
    expect(observed).toEqual(["TOI-700"]);
    expect(useExoStore.getState().focusedPlanetName).toBe("TOI-700 d");
    expect(useExoStore.getState().daysPerSecond).toBe(4);
  });
  it("stops the previous spoken reply when requesting microphone access, preserving transcript and scene", () => {
    useExoStore.getState().acceptTurn({
      transcript: "Open TOI-700",
      reply_text: "Previous finding",
      reply_audio: { data_base64: "AA==", mime_type: "audio/wav" },
      ui_commands: [{ kind: "load_system", system }],
    });
    useExoStore.getState().setPlayback("playing");
    useExoStore.getState().setStatus("requesting");
    expect(useExoStore.getState().replyAudio).toBeNull();
    expect(useExoStore.getState().playback).toBe("idle");
    expect(useExoStore.getState().system).toBe(system);
    expect(useExoStore.getState().transcript).toBe("Open TOI-700");
  });
  it("preserves the loaded System when STT fails and enables typed fallback", () => {
    useExoStore.getState().applyCommand({ kind: "load_system", system });
    useExoStore.getState().setDraft("Open TRAPPIST-1");
    useExoStore.getState().beginTurn("");
    useExoStore.getState().acceptTurn({
      transcript: "",
      reply_text: "",
      error: "STT failed. Type instead.",
      ui_commands: [],
    });
    expect(useExoStore.getState().system).toBe(system);
    expect(useExoStore.getState().draft).toBe("Open TRAPPIST-1");
    expect(useExoStore.getState().status).toBe("idle");
    expect(useExoStore.getState().error).toContain("Type instead");
  });
  it("does not load uncommanded response data or invent planets", () => {
    useExoStore
      .getState()
      .acceptTurn({ transcript: "Hello", reply_text: "Mock", data: { system } });
    expect(useExoStore.getState().system).toBeNull();
  });
  it("retains previous answers and real tool steps across turns, including partial success", () => {
    const store = useExoStore.getState();
    store.beginTurn("Open TOI-700");
    store.acceptTurn({
      transcript: "Open TOI-700",
      reply_text: "Loaded",
      ui_commands: [{ kind: "load_system", system }],
      steps: [
        {
          id: "load",
          name: "load_system",
          status: "completed",
          detail: "Snapshot",
          elapsed_ms: 1234,
        },
      ],
    });
    store.beginTurn("Try another name");
    store.acceptTurn({
      transcript: "Try another name",
      reply_text: "Recovered after lookup failed",
      ui_commands: [{ kind: "load_system", system }],
      steps: [
        {
          id: "failed",
          name: "load_system",
          status: "failed",
          detail: "Unknown name",
          elapsed_ms: 100,
        },
        {
          id: "recovered",
          name: "load_system",
          status: "completed",
          detail: "Canonical name",
          elapsed_ms: 234,
        },
      ],
    });
    const state = useExoStore.getState();
    expect(state.turns).toHaveLength(2);
    expect(state.turns[0]?.steps[0]?.elapsed_ms).toBe(1234);
    expect(state.turns[0]?.reply).toBe("Loaded");
    expect(state.turns[1]?.steps.map((step) => step.status)).toEqual(["failed", "completed"]);
    expect(state.turns[1]?.appliedCommands).toBe(1);
    expect(state.turns[1]?.error).toBeNull();
    expect(state.loadedSystems).toEqual([system]);
  });
  it("pending and transport-failed turns never invent tool steps or applied commands", () => {
    useExoStore.getState().beginTurn("Open TOI-700");
    expect(useExoStore.getState().turns[0]?.steps).toEqual([]);
    useExoStore.getState().fail("Network unavailable");
    const turn = useExoStore.getState().turns[0];
    expect(turn?.steps).toEqual([]);
    expect(turn?.appliedCommands).toBe(0);
    expect(turn?.finishedAt).not.toBeNull();
  });
  it("remembers opened Systems while keeping only one in the System view", () => {
    const second = { ...system, hostname: "TRAPPIST-1" };
    useExoStore.getState().applyCommand({ kind: "load_system", system });
    useExoStore.getState().selectPlanet("TOI-700 d");
    useExoStore.getState().applyCommand({ kind: "load_system", system: second });
    expect(useExoStore.getState().loadedSystems).toEqual([system, second]);
    expect(useExoStore.getState().system).toBe(second);
    expect(useExoStore.getState().focusedPlanetName).toBeNull();
    useExoStore.getState().setDrawerOpen(true);
    expect(useExoStore.getState().drawerOpen).toBe(true);
  });
});
