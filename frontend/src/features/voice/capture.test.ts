import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_RECORDING_BYTES, MAX_RECORDING_MS, VoiceCapture } from "./capture";

class Recorder {
  static supported = true;
  static last: Recorder;
  static isTypeSupported(type: string) {
    return Recorder.supported && type === "audio/mp4";
  }
  mimeType = "audio/mp4";
  state = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: unknown, options: { mimeType: string }) {
    expect(options.mimeType).toBe("audio/mp4");
    Recorder.last = this;
  }
  start() {
    this.state = "recording";
    this.emit("first-");
  }
  emit(text: string) {
    this.ondataavailable?.({ data: new Blob([text]) });
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => {
      this.emit("final");
      this.onstop?.();
    });
  }
}
const flush = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};
describe("push-to-talk capture lifecycle (mock microphone and MediaRecorder)", () => {
  const stopTrack = vi.fn();
  const stream = { getTracks: () => [{ stop: stopTrack }] };
  const status = vi.fn();
  const complete = vi.fn();
  const error = vi.fn();
  let capture: VoiceCapture;
  beforeEach(() => {
    vi.clearAllMocks();
    Recorder.supported = true;
    vi.stubGlobal("MediaRecorder", Recorder);
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    capture = new VoiceCapture({ status, complete, error });
  });
  afterEach(() => {
    capture.dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it("uses a supported MIME and sends every chunk only after release and final stop", async () => {
    await capture.start();
    expect(status.mock.calls).toEqual([["requesting"], ["recording"]]);
    expect(complete).not.toHaveBeenCalled();
    capture.stop();
    expect(status).toHaveBeenLastCalledWith("processing");
    expect(stopTrack).toHaveBeenCalled();
    await flush();
    expect(complete).toHaveBeenCalledWith({
      data_base64: btoa("first-final"),
      mime_type: "audio/mp4",
    });
    expect(error).not.toHaveBeenCalled();
  });
  it.each(["cancel", "dispose"] as const)(
    "%s discards capture and stops all tracks",
    async (action) => {
      await capture.start();
      capture[action]();
      await flush();
      expect(stopTrack).toHaveBeenCalled();
      expect(complete).not.toHaveBeenCalled();
    },
  );
  it("ignores and closes a late permission grant after release", async () => {
    let grant: (value: typeof stream) => void = () => {
      throw new Error("not pending");
    };
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: () =>
          new Promise((resolve) => {
            grant = resolve;
          }),
      },
    });
    const pending = capture.start();
    capture.stop();
    grant(stream);
    await pending;
    expect(stopTrack).toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith("idle");
    expect(complete).not.toHaveBeenCalled();
  });
  it("releases microphone on recording timeout", async () => {
    vi.useFakeTimers();
    await capture.start();
    vi.advanceTimersByTime(MAX_RECORDING_MS);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("30 second"));
    expect(stopTrack).toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });
  it("rejects recordings beyond the byte bound including a final chunk", async () => {
    await capture.start();
    Recorder.last.ondataavailable?.({ data: new Blob([new Uint8Array(MAX_RECORDING_BYTES + 1)]) });
    await flush();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("8 MiB"));
    expect(complete).not.toHaveBeenCalled();
  });
  it("shows a text fallback when formats or microphone permission are unavailable", async () => {
    Recorder.supported = false;
    await capture.start();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("type your question"));
    Recorder.supported = true;
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    await capture.start();
    expect(error).toHaveBeenCalledTimes(2);
  });
  it("handles recorder failure without sending partial audio", async () => {
    await capture.start();
    Recorder.last.onerror?.();
    await flush();
    expect(stopTrack).toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("type your question"));
  });
});
