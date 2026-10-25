import { create } from "zustand";
import type { ReplyAudio, System, ToolStep, TurnResponse, UiCommand } from "../api/client";

export type TurnStatus = "idle" | "requesting" | "recording" | "processing";
export type PlaybackStatus = "idle" | "playing" | "blocked" | "error";
export interface ConversationTurn {
  id: number;
  question: string;
  reply: string;
  startedAt: number;
  finishedAt: number | null;
  steps: ToolStep[];
  provenance: System["provenance"] | null;
  error: string | null;
  warnings: string[];
  appliedCommands: number;
}
export type ColorBy = Extract<UiCommand, { kind: "set_color_by" }>["property"];
export interface SceneState {
  system: System | null;
  focusedPlanetName: string | null;
  /** Planet the camera follows; set by focus commands, cleared by a new System or deselection. */
  cameraFocus: string | null;
  /** Simulated days per real second while playing. */
  daysPerSecond: number;
  playing: boolean;
  showLabels: boolean;
  colorBy: ColorBy;
}
export const DEFAULT_DAYS_PER_SECOND = 0.5;
export interface ExoState extends SceneState {
  loadedSystems: System[];
  drawerOpen: boolean;
  turns: ConversationTurn[];
  draft: string;
  transcript: string;
  replyText: string;
  replyAudio: ReplyAudio | null;
  status: TurnStatus;
  playback: PlaybackStatus;
  error: string | null;
  warnings: string[];
  setDrawerOpen: (open: boolean) => void;
  selectPlanet: (name: string | null) => void;
  setPlaying: (playing: boolean) => void;
  setDraft: (draft: string) => void;
  setStatus: (status: TurnStatus) => void;
  setPlayback: (playback: PlaybackStatus) => void;
  fail: (error: string) => void;
  beginTurn: (transcript: string) => void;
  acceptTurn: (response: TurnResponse) => void;
  applyCommand: (command: UiCommand) => void;
}

export function reduceCommand(state: SceneState, command: UiCommand): SceneState {
  switch (command.kind) {
    case "load_system":
      return { ...state, system: command.system, focusedPlanetName: null, cameraFocus: null };
    case "focus_planet":
      return { ...state, focusedPlanetName: command.name, cameraFocus: command.name };
    case "set_time_scale":
      // 0 pauses but keeps the last pace, so pressing play resumes at it.
      return command.days_per_second === 0
        ? { ...state, playing: false }
        : { ...state, daysPerSecond: command.days_per_second, playing: true };
    case "set_labels":
      return { ...state, showLabels: command.visible };
    case "set_color_by":
      return { ...state, colorBy: command.property };
  }
}
function remember(systems: System[], system: System | null) {
  if (!system) return systems;
  return [...systems.filter((item) => item.hostname !== system.hostname), system];
}
function finishTurn(turns: ConversationTurn[], update: Partial<ConversationTurn>) {
  return turns.map((turn, index) =>
    index === turns.length - 1 && turn.finishedAt === null
      ? { ...turn, ...update, finishedAt: Date.now() }
      : turn,
  );
}

/** UI state lives here; browser recorder/player resources live in lifecycle controllers. */
export const useExoStore = create<ExoState>()((set) => ({
  system: null,
  focusedPlanetName: null,
  cameraFocus: null,
  daysPerSecond: DEFAULT_DAYS_PER_SECOND,
  playing: true,
  showLabels: true,
  colorBy: "none",
  loadedSystems: [],
  drawerOpen: false,
  turns: [],
  draft: "",
  transcript: "",
  replyText: "",
  replyAudio: null,
  status: "idle",
  playback: "idle",
  error: null,
  warnings: [],
  setDrawerOpen: (drawerOpen) => {
    set({ drawerOpen });
  },
  selectPlanet: (focusedPlanetName) => {
    set((state) => ({
      focusedPlanetName,
      cameraFocus: focusedPlanetName === null ? null : state.cameraFocus,
    }));
  },
  setPlaying: (playing) => {
    set({ playing });
  },
  setDraft: (draft) => {
    set({ draft });
  },
  setStatus: (status) => {
    set(
      status === "requesting"
        ? { status, replyAudio: null, playback: "idle", error: null }
        : { status },
    );
  },
  setPlayback: (playback) => {
    set({ playback });
  },
  fail: (error) => {
    set((state) => ({ error, status: "idle", turns: finishTurn(state.turns, { error }) }));
  },
  beginTurn: (transcript) => {
    set((state) => ({
      status: "processing",
      transcript,
      replyText: "",
      replyAudio: null,
      playback: "idle",
      error: null,
      warnings: [],
      turns: [
        ...state.turns,
        {
          id: (state.turns.at(-1)?.id ?? 0) + 1,
          question: transcript,
          reply: "",
          startedAt: Date.now(),
          finishedAt: null,
          steps: [],
          provenance: null,
          error: null,
          warnings: [],
          appliedCommands: 0,
        },
      ],
    }));
  },
  acceptTurn: (response) => {
    set((state) => {
      const commands = response.ui_commands ?? [];
      const scene = commands.reduce(reduceCommand, state);
      const loaded = commands.filter((command) => command.kind === "load_system");
      return {
        ...scene,
        loadedSystems: loaded.reduce(
          (systems, command) => remember(systems, command.system),
          state.loadedSystems,
        ),
        transcript: response.transcript,
        replyText: response.reply_text,
        replyAudio: response.reply_audio ?? null,
        warnings: response.warnings ?? [],
        error: response.error ?? null,
        status: "idle",
        turns: finishTurn(state.turns, {
          question: response.transcript,
          reply: response.reply_text,
          steps: response.steps ?? [],
          provenance: loaded.at(-1)?.system.provenance ?? null,
          error: response.error ?? null,
          warnings: response.warnings ?? [],
          appliedCommands: commands.length,
        }),
      };
    });
  },
  applyCommand: (command) => {
    set((state) => ({
      ...reduceCommand(state, command),
      loadedSystems:
        command.kind === "load_system"
          ? remember(state.loadedSystems, command.system)
          : state.loadedSystems,
    }));
  },
}));
