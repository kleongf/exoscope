import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendTurn, type Project, type TurnResponse } from "@/api/client";
import { useExoStore } from "@/store/store";
import { ProjectController, projectSnapshot } from "./persistence";
vi.mock("@/api/client", () => ({ sendTurn: vi.fn() }));

const response = (project: Project): TurnResponse => ({
  transcript: "",
  reply_text: "",
  project_result: {
    current: project,
    projects: [
      {
        id: project.id,
        title: project.title,
        revision: project.revision,
        updated_at: project.updated_at,
      },
    ],
  },
});
let controller: ProjectController;
let project: Project;
beforeEach(() => {
  vi.resetAllMocks();
  useExoStore.setState(useExoStore.getInitialState());
  controller = new ProjectController();
  project = {
    id: "a".repeat(32),
    title: "First",
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
});

describe("Project persistence boundaries", () => {
  it("restores durable work without reviving generated audio", async () => {
    project.state.draft = "Saved question";
    project.state.daysPerSecond = 12;
    useExoStore.setState({
      replyAudio: { mime_type: "audio/wav", data_base64: "AA==" },
      playback: "playing",
    });
    vi.mocked(sendTurn).mockResolvedValue(response(project));
    await controller.start();
    expect(useExoStore.getState().draft).toBe("Saved question");
    expect(useExoStore.getState().daysPerSecond).toBe(12);
    expect(useExoStore.getState().replyAudio).toBeNull();
    expect(projectSnapshot()).not.toHaveProperty("replyAudio");
  });
  it("retains edits made while a save is in flight, then saves the new revision", async () => {
    vi.mocked(sendTurn).mockResolvedValueOnce(response(project));
    await controller.start();
    useExoStore.getState().setDraft("first edit");
    expect(useExoStore.getState().projectStatus).toBe("unsaved");
    let release: (reply: TurnResponse) => void = () => {
      throw new Error("not pending");
    };
    vi.mocked(sendTurn).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = controller.flush();
    await vi.waitFor(() => {
      expect(sendTurn).toHaveBeenCalledTimes(2);
    });
    useExoStore.getState().setDraft("newer edit");
    release(
      response({ ...project, revision: 1, state: { ...project.state, draft: "first edit" } }),
    );
    await pending;
    expect(useExoStore.getState().draft).toBe("newer edit");
    vi.mocked(sendTurn).mockResolvedValueOnce(
      response({ ...project, revision: 2, state: { ...project.state, draft: "newer edit" } }),
    );
    await controller.flush();
    expect(vi.mocked(sendTurn).mock.calls.at(-1)?.[0].project_action).toMatchObject({
      operation: "save",
      revision: 1,
      state: { draft: "newer edit" },
    });
    expect(useExoStore.getState().projectStatus).toBe("saved");
  });
  it("refuses to switch away from unsaved work after a stale-save error", async () => {
    vi.mocked(sendTurn).mockResolvedValueOnce(response(project));
    await controller.start();
    useExoStore.getState().setDraft("Do not lose this");
    vi.mocked(sendTurn).mockResolvedValue({
      transcript: "",
      reply_text: "",
      error: "This Project changed in another tab.",
    });
    await controller.choose("b".repeat(32));
    expect(useExoStore.getState().currentProject?.id).toBe(project.id);
    expect(useExoStore.getState().draft).toBe("Do not lose this");
    expect(useExoStore.getState().projectError).toContain("another tab");
    expect(vi.mocked(sendTurn).mock.calls).toHaveLength(2);
  });
  it("locks draft mutations until switching has restored the destination", async () => {
    vi.mocked(sendTurn).mockResolvedValueOnce(response(project));
    await controller.start();
    let release: (reply: TurnResponse) => void = () => {
      throw new Error("not pending");
    };
    vi.mocked(sendTurn).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = controller.choose("b".repeat(32));
    expect(useExoStore.getState().projectTransition).toBe(true);
    useExoStore.getState().setDraft("Must not change the old Project during switching");
    expect(useExoStore.getState().draft).toBe("");
    await vi.waitFor(() => {
      expect(sendTurn).toHaveBeenCalledTimes(2);
    });
    release(response({ ...project, id: "b".repeat(32), title: "Second" }));
    await pending;
    expect(useExoStore.getState().currentProject?.title).toBe("Second");
    expect(useExoStore.getState().projectTransition).toBe(false);
  });
  it("lists recoverable Projects after a broken current pointer", async () => {
    vi.mocked(sendTurn).mockResolvedValueOnce({
      transcript: "",
      reply_text: "",
      error: "Current Project pointer is missing.",
    });
    const listing = response(project);
    if (listing.project_result) listing.project_result.current = null;
    vi.mocked(sendTurn).mockResolvedValueOnce(listing);
    await controller.start();
    expect(useExoStore.getState().currentProject).toBeNull();
    expect(useExoStore.getState().projects[0]?.id).toBe(project.id);
    expect(useExoStore.getState().projectError).toContain("pointer is missing");
    vi.mocked(sendTurn).mockResolvedValueOnce(response(project));
    await controller.choose(project.id);
    expect(useExoStore.getState().currentProject?.id).toBe(project.id);
    expect(useExoStore.getState().projectError).toBeNull();
  });
});
