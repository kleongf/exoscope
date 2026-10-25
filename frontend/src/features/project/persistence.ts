import { sendTurn, type ProjectAction, type Project, type ProjectState } from "@/api/client";
import { useExoStore } from "@/store/store";

export function projectSnapshot(): ProjectState {
  const s = useExoStore.getState();
  return {
    system: s.system,
    loadedSystems: s.loadedSystems,
    focusedPlanetName: s.focusedPlanetName,
    daysPerSecond: s.daysPerSecond,
    drawerOpen: s.drawerOpen,
    turns: s.turns,
    samples: s.samples,
    comparisons: s.comparisons,
    activeComparisonId: s.activeComparisonId,
    activeSampleId: s.activeSampleId,
    drawerView: s.drawerView,
    sceneSettings: s.sceneSettings,
    draft: s.draft,
    transcript: s.transcript,
    replyText: s.replyText,
  };
}

function restore(project: Project) {
  const s = project.state;
  useExoStore.setState({
    ...s,
    turns: s.turns,
    currentProject: project,
    replyAudio: null,
    playback: "idle",
    status: "idle",
    error: null,
    warnings: [],
    projectError: null,
  });
}

export class ProjectController {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private queue: Promise<void> = Promise.resolve();
  private unsubscribe: (() => void) | undefined;
  private applying = false;
  private lastSaved = "";
  private lastObserved = "";
  ready: Promise<void> = Promise.resolve();

  start() {
    if (this.unsubscribe) return this.ready;
    this.unsubscribe = useExoStore.subscribe((state, previous) => {
      if (this.applying || !state.currentProject || state.status !== "idle") return;
      if (state.projectError && state.projectError !== previous.projectError) return;
      const value = JSON.stringify(projectSnapshot());
      if (value === this.lastObserved) return;
      this.lastObserved = value;
      useExoStore.setState({ projectStatus: "unsaved" });
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        void this.flush();
      }, 300);
    });
    this.ready = this.perform(async () => {
      try {
        await this.request({ operation: "bootstrap" }, true);
      } catch (error) {
        try {
          await this.request({ operation: "list" }, false);
        } catch {
          /* Original error stays visible. */
        }
        throw error;
      }
    });
    return this.ready;
  }

  private async request(action: ProjectAction, apply: boolean) {
    const reply = await sendTurn({ project_action: action }, new AbortController().signal);
    if (reply.error || !reply.project_result)
      throw new Error(reply.error ?? "Project unavailable.");
    this.applying = true;
    try {
      useExoStore.setState({ projects: reply.project_result.projects ?? [] });
      const current = reply.project_result.current as Project | null | undefined;
      if (current) {
        if (apply) restore(current);
        else useExoStore.setState({ currentProject: current });
      }
      if (apply) {
        this.lastSaved = JSON.stringify(projectSnapshot());
        this.lastObserved = this.lastSaved;
      }
    } finally {
      this.applying = false;
    }
  }

  private perform(work: () => Promise<void>) {
    const next = this.queue.then(async () => {
      useExoStore.setState({ projectStatus: "saving" });
      try {
        await work();
        useExoStore.setState({
          projectError: null,
          projectStatus: JSON.stringify(projectSnapshot()) === this.lastSaved ? "saved" : "unsaved",
        });
      } catch (error) {
        useExoStore.setState({
          projectError: error instanceof Error ? error.message : "Project unavailable.",
          projectStatus: "error",
        });
      }
    });
    this.queue = next;
    return next;
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    return this.perform(async () => {
      const current = useExoStore.getState().currentProject;
      if (!current) {
        await this.request({ operation: "bootstrap" }, true);
        return;
      }
      const state = projectSnapshot();
      const serialized = JSON.stringify(state);
      if (serialized === this.lastSaved) return;
      await this.request(
        { operation: "save", id: current.id, revision: current.revision, state },
        false,
      );
      this.lastSaved = serialized;
    });
  }

  async choose(id?: string) {
    const state = useExoStore.getState();
    if (state.status !== "idle" || state.projectTransition) return;
    useExoStore.setState({ projectTransition: true });
    try {
      if (state.currentProject) {
        await this.flush();
        if (useExoStore.getState().projectError) return;
      }
      await this.perform(async () => {
        await this.request(
          id
            ? { operation: "load", id }
            : {
                operation: "create",
                title: `Project ${String(useExoStore.getState().projects.length + 1)}`,
              },
          true,
        );
      });
    } finally {
      useExoStore.setState({ projectTransition: false });
    }
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (this.timer) clearTimeout(this.timer);
  }

  async recover(id: string) {
    useExoStore.setState({ projectTransition: true });
    await this.perform(async () => {
      await this.request({ operation: "load", id }, true);
    });
    useExoStore.setState({ projectTransition: false });
  }
}

export const projectController = new ProjectController();
