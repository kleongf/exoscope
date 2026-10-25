import { createProject, listProjects, loadProject, type Project } from "@/api/client";
import { useExoStore } from "@/store/store";

const LAST_OPEN = "exoscope.projectId";

/** Which Project this browser had open: a per-viewer convenience, so failures are ignored. */
function lastOpen(): string | null {
  try {
    return localStorage.getItem(LAST_OPEN);
  } catch {
    return null;
  }
}

function open(project: Project) {
  useExoStore.getState().openProject(project);
  try {
    localStorage.setItem(LAST_OPEN, project.id);
  } catch {
    // Private windows or blocked storage: a reload then opens the newest Project instead.
  }
}

function report(error: unknown) {
  useExoStore.getState().failProject(error instanceof Error ? error.message : String(error));
}

async function refreshList() {
  useExoStore.getState().setProjects(await listProjects());
}

/** Re-read the switcher's list, e.g. when it opens, so counts and times are current. */
export async function refreshProjects() {
  try {
    await refreshList();
  } catch (error) {
    report(error);
  }
}

/** On page load: reopen the Project this browser had open, else the newest, else start one. */
export async function startProjects() {
  try {
    const projects = await listProjects();
    useExoStore.getState().setProjects(projects);
    const readable = projects.filter((p) => p.error == null);
    const chosen = readable.find((p) => p.id === lastOpen()) ?? readable[0];
    if (chosen) open(await loadProject(chosen.id));
    else await newProject();
  } catch (error) {
    report(error);
  }
}

export async function newProject() {
  try {
    open(await createProject());
    await refreshList();
  } catch (error) {
    report(error);
  }
}

/** Open another Project. If it can't be read, say so and keep showing the current one. */
export async function switchProject(id: string) {
  try {
    open(await loadProject(id));
    await refreshList();
  } catch (error) {
    report(error);
  }
}
