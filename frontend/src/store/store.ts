import { create } from "zustand";
import type {
  Project,
  ProjectState,
  ProjectSummary,
  ConversationTurn,
  ReplyAudio,
  System,
  TurnResponse,
  UiCommand,
} from "../api/client";
import { addSample, type SampleState } from "./samples";

export type TurnStatus = "idle" | "requesting" | "recording" | "processing";
export type PlaybackStatus = "idle" | "playing" | "blocked" | "error";
export type { ConversationTurn } from "../api/client";
export type SavedComparison = ProjectState["comparisons"][number];
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
export interface ExoState extends SceneState, SampleState {
  currentProject: Project | null;
  projects: ProjectSummary[];
  projectStatus: "opening" | "saving" | "saved" | "unsaved" | "error";
  projectError: string | null;
  projectTransition: boolean;
  sceneSettings: ProjectState["sceneSettings"];

  loadedSystems: System[];
  /** Comparisons build up across the Project; the drawer shows the active one. */
  comparisons: SavedComparison[];
  activeComparisonId: number | null;
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
  /** Select a planet from a chart or table, switching to its System when already loaded. */
  selectPlanetIn: (hostname: string, name: string) => void;
  openComparison: (id: number) => void;
  openSample: (id: number) => void;
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
type ComparisonState = Pick<
  ExoState,
  "comparisons" | "activeComparisonId" | "drawerOpen" | "drawerView"
>;
/** A new comparison joins the Project, becomes active and opens the drawer. */
function addComparison(state: ComparisonState, response: TurnResponse): ComparisonState {
  const comparison = response.data?.comparison;
  const { comparisons, activeComparisonId, drawerOpen, drawerView } = state;
  if (!comparison) return { comparisons, activeComparisonId, drawerOpen, drawerView };
  const id = (state.comparisons.at(-1)?.id ?? 0) + 1;
  return {
    comparisons: [...state.comparisons, { id, comparison }],
    activeComparisonId: id,
    drawerOpen: true,
    drawerView: "comparison",
  };
}
function finishTurn(turns: ConversationTurn[], update: Partial<ConversationTurn>) {
  return turns.map((turn, index) =>
    index === turns.length - 1 && turn.finishedAt === null
      ? { ...turn, ...update, finishedAt: Date.now() }
      : turn,
  );
}

function turnWebEvidence(response: TurnResponse) {
  return {
    webSearch: response.data?.web_search ?? null,
    hasSpokenReply: Boolean(response.reply_audio),
  };
}

/** UI state lives here; browser recorder/player resources live in lifecycle controllers. */
export const useExoStore = create<ExoState>()((set) => ({
  currentProject: null,
  projects: [],
  projectStatus: "opening",
  projectError: null,
  projectTransition: false,
  sceneSettings: {},
  system: null,
  focusedPlanetName: null,
  cameraFocus: null,
  daysPerSecond: DEFAULT_DAYS_PER_SECOND,
  playing: true,
  showLabels: true,
  colorBy: "none",
  loadedSystems: [],
  comparisons: [],
  activeComparisonId: null,
  samples: [],
  activeSampleId: null,
  drawerView: "comparison",
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
    set((state) => (state.projectTransition ? {} : { drawerOpen }));
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
  selectPlanetIn: (hostname, name) => {
    set((state) => {
      const system =
        state.system?.hostname === hostname
          ? state.system
          : (state.loadedSystems.find((item) => item.hostname === hostname) ?? state.system);
      return { system, focusedPlanetName: name };
    });
  },
  openComparison: (id) => {
    set({ activeComparisonId: id, drawerOpen: true, drawerView: "comparison" });
  },
  openSample: (id) => {
    set({ activeSampleId: id, drawerOpen: true, drawerView: "sample" });
  },
  setDraft: (draft) => {
    set((state) => (state.projectTransition ? {} : { draft }));
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
          webSearch: null,
          hasSpokenReply: false,
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
        ...addComparison(state, response),
        ...addSample(state, response),
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
          ...turnWebEvidence(response),
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
