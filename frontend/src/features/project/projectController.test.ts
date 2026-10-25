import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, ProjectSummary } from "@/api/client";
import { useExoStore } from "@/store/store";
import { newProject, startProjects, switchProject } from "./projectController";

const client = vi.hoisted(() => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  loadProject: vi.fn(),
}));
vi.mock("@/api/client", () => client);

const at = "2026-10-25T15:00:00Z";
function project(id: string, name: string): Project {
  return {
    format: "exoscope.project",
    version: 1,
    id,
    name,
    created_at: at,
    updated_at: at,
    next_seq: 1,
  };
}
function summary(id: string, error: string | null = null): ProjectSummary {
  return { id, name: id, updated_at: error ? null : at, item_count: error ? null : 0, error };
}

const remembered = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => remembered.get(k) ?? null,
  setItem: (k: string, v: string) => remembered.set(k, v),
});

beforeEach(() => {
  vi.resetAllMocks();
  remembered.clear();
  useExoStore.setState({ project: null, projects: [], projectError: null });
});

describe("Project controller", () => {
  it("opens the newest readable Project on start", async () => {
    client.listProjects.mockResolvedValue([summary("p-bad", "damaged"), summary("p-good")]);
    client.loadProject.mockResolvedValue(project("p-good", "Rocky worlds"));
    await startProjects();
    expect(client.loadProject).toHaveBeenCalledWith("p-good");
    expect(useExoStore.getState().project?.name).toBe("Rocky worlds");
    expect(useExoStore.getState().projects).toHaveLength(2);
  });

  it("after a reload, reopens the Project that was open, not just the newest", async () => {
    client.listProjects.mockResolvedValue([summary("p-new"), summary("p-old")]);
    client.loadProject.mockImplementation((id: string) => Promise.resolve(project(id, id)));
    await switchProject("p-old");
    useExoStore.setState({ project: null });
    await startProjects();
    expect(client.loadProject).toHaveBeenLastCalledWith("p-old");
    expect(useExoStore.getState().project?.id).toBe("p-old");
  });

  it("creates a first Project when there are none", async () => {
    client.listProjects.mockResolvedValueOnce([]).mockResolvedValue([summary("p-new")]);
    client.createProject.mockResolvedValue(project("p-new", "New Project"));
    await startProjects();
    expect(useExoStore.getState().project?.id).toBe("p-new");
    expect(useExoStore.getState().projects.map((p) => p.id)).toEqual(["p-new"]);
  });

  it("New Project starts empty and joins the switcher", async () => {
    client.createProject.mockResolvedValue(project("p-2", "New Project"));
    client.listProjects.mockResolvedValue([summary("p-2"), summary("p-1")]);
    await newProject();
    expect(useExoStore.getState().project?.id).toBe("p-2");
    expect(useExoStore.getState().projects.map((p) => p.id)).toEqual(["p-2", "p-1"]);
  });

  it("a Project that fails to open is reported and the current one stays", async () => {
    useExoStore.setState({ project: project("p-1", "Current") });
    client.loadProject.mockRejectedValue(new Error("Project 'p-bad' could not be read: damaged."));
    await switchProject("p-bad");
    expect(useExoStore.getState().projectError).toContain("p-bad");
    expect(useExoStore.getState().project?.id).toBe("p-1");
  });
});
