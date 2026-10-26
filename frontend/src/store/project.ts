import type { Project, ProjectSummary, ToolStep, TurnResponse } from "../api/client";
import type { ConversationTurn, ExoState } from "./store";

export interface ProjectState {
  /** The Project the backend saved after the latest turn; work builds up in it. */
  project: Project | null;
  /** Every Project for the switcher, newest first; unreadable files carry their error. */
  projects: ProjectSummary[];
  /** Why a Project could not be listed, created or opened. Never hidden behind an empty one. */
  projectError: string | null;
}

/** Everything the explorer, System view, drawer and chat show, rebuilt from a saved Project. */
export function restoreProject(project: Project): Partial<ExoState> {
  const systems = (project.systems ?? []).map((item) => item.system);
  const comparisons = (project.comparisons ?? []).map((item, i) => ({
    id: i + 1,
    comparison: item.comparison,
  }));
  const samples = (project.samples ?? []).map((item, i) => ({ id: i + 1, sample: item.sample }));
  const turns = (project.turns ?? []).map((turn, i): ConversationTurn => {
    const at = Date.parse(turn.at);
    const steps = (turn.steps ?? []).map((s, j): ToolStep => ({
      ...s,
      id: `${turn.id}-${String(j)}`,
    }));
    return {
      id: i + 1,
      question: turn.transcript,
      reply: turn.reply_text,
      startedAt: at,
      finishedAt: at,
      steps,
      provenance: null,
      error: turn.error ?? null,
      warnings: [],
      appliedCommands: 0,
      webSearch: turn.web_search ?? null,
      hasSpokenReply: false,
    };
  });
  return {
    project,
    projectError: null,
    system: systems.find((s) => s.hostname === project.current_system) ?? null,
    focusedPlanetName: null,
    cameraFocus: null,
    loadedSystems: systems,
    comparisons,
    activeComparisonId: comparisons.at(-1)?.id ?? null,
    samples,
    activeSampleId: samples.at(-1)?.id ?? null,
    drawerOpen: false,
    turns,
    transcript: "",
    replyText: "",
    replyAudio: null,
    error: null,
    warnings: [],
  };
}

/** The Project as saved after this turn; if the turn wasn't saved, the one already shown. */
export function savedProject(state: ProjectState, response: TurnResponse) {
  return { project: response.project ?? state.project };
}
