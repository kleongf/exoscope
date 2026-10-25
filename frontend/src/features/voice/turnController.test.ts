import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendTurn, type TurnResponse } from "../../api/client";
import { useExoStore } from "../../store/store";
import { TurnController } from "./turnController";
vi.mock("../../api/client", () => ({ sendTurn: vi.fn() }));
const reply: TurnResponse = {
  transcript: "Open TRAPPIST-1",
  reply_text: "Mock reply",
  ui_commands: [],
};
describe("single turn controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExoStore.setState(useExoStore.getInitialState());
  });
  it("sends a typed turn once, with current System context and no credentials", async () => {
    vi.mocked(sendTurn).mockResolvedValue(reply);
    const controller = new TurnController();
    await controller.submit({ text: "Open TRAPPIST-1" });
    expect(sendTurn).toHaveBeenCalledWith(
      { text: "Open TRAPPIST-1", current_system: null },
      expect.any(AbortSignal),
    );
    expect(useExoStore.getState().transcript).toBe(reply.transcript);
    expect(useExoStore.getState().status).toBe("idle");
    controller.dispose();
  });
  it("suppresses duplicate submits and ignores a response arriving after unmount", async () => {
    let respond: (response: TurnResponse) => void = () => {
      throw new Error("not pending");
    };
    vi.mocked(sendTurn).mockImplementation(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );
    const controller = new TurnController();
    const pending = controller.submit({ audio: { data_base64: "AA==", mime_type: "audio/webm" } });
    await controller.submit({ text: "duplicate" });
    expect(sendTurn).toHaveBeenCalledTimes(1);
    controller.dispose();
    expect(vi.mocked(sendTurn).mock.calls[0]?.[1].aborted).toBe(true);
    respond(reply);
    await pending;
    expect(useExoStore.getState().replyText).toBe("");
    expect(useExoStore.getState().status).toBe("idle");
  });
  it("recovers from network errors so the next typed turn works", async () => {
    vi.mocked(sendTurn)
      .mockRejectedValueOnce(new Error("Mock transport failure"))
      .mockResolvedValueOnce(reply);
    const controller = new TurnController();
    await controller.submit({ audio: { data_base64: "AA==", mime_type: "audio/webm" } });
    expect(useExoStore.getState().error).toContain("type your question");
    await controller.submit({ text: "Open TRAPPIST-1" });
    expect(useExoStore.getState().error).toBeNull();
    expect(useExoStore.getState().replyText).toBe("Mock reply");
    controller.dispose();
  });
});
