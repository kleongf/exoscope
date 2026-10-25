import type { AudioInput } from "../../api/client";

export const MAX_RECORDING_MS = 30_000;
export const MAX_RECORDING_BYTES = 8 * 1024 * 1024;
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];
interface CaptureCallbacks {
  status: (status: "idle" | "requesting" | "recording" | "processing") => void;
  complete: (audio: AudioInput) => void;
  error: (message: string) => void;
}
interface CaptureSession {
  stream?: MediaStream;
  recorder?: MediaRecorder;
  timer?: ReturnType<typeof setTimeout>;
  chunks: Blob[];
  size: number;
  released: boolean;
}

export function supportedMimeType() {
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export async function encodeAudio(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

/** A session identity guards late permission, final data events and async encoding. */
export class VoiceCapture {
  private session: CaptureSession | undefined;
  constructor(private callbacks: CaptureCallbacks) {}

  async start() {
    if (this.session) return;
    if (
      typeof navigator.mediaDevices === "undefined" ||
      typeof navigator.mediaDevices.getUserMedia !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      this.callbacks.error(
        "Microphone recording is unavailable in this browser. Type your question below.",
      );
      return;
    }
    const session: CaptureSession = { chunks: [], size: 0, released: false };
    this.session = session;
    this.callbacks.status("requesting");
    try {
      const mimeType = supportedMimeType();
      if (!mimeType) throw new Error("No supported microphone audio format.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      session.stream = stream;
      if (this.session !== session) {
        this.stopTracks(session);
        return;
      }
      this.record(session, stream, mimeType);
    } catch {
      if (this.session === session)
        this.fail(
          "Microphone access or recording failed. Check permission, or type your question below.",
        );
    }
  }

  private record(session: CaptureSession, stream: MediaStream, mimeType: string) {
    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128_000 });
    session.recorder = recorder;
    recorder.ondataavailable = (event) => {
      if (this.session !== session) return;
      session.size += event.data.size;
      if (session.size > MAX_RECORDING_BYTES) {
        this.fail("Recording exceeded 8 MiB. Hold to record a shorter question, or type instead.");
        return;
      }
      if (event.data.size) session.chunks.push(event.data);
    };
    recorder.onerror = () => {
      if (this.session === session)
        this.fail("Audio recording failed. Please type your question instead.");
    };
    recorder.onstop = () => {
      void this.finish(session);
    };
    session.timer = setTimeout(() => {
      this.fail(
        "Recording reached the 30 second limit. Record a shorter question, or type instead.",
      );
    }, MAX_RECORDING_MS);
    recorder.start(250);
    this.callbacks.status("recording");
  }

  stop() {
    const session = this.session;
    if (!session || session.released) return;
    if (!session.recorder) {
      this.cancel();
      return;
    }
    session.released = true;
    clearTimeout(session.timer);
    this.callbacks.status("processing");
    if (session.recorder.state !== "inactive") session.recorder.stop();
    this.stopTracks(session);
  }

  cancel() {
    if (!this.session || this.session.released) return;
    this.dispose();
    this.callbacks.status("idle");
  }

  dispose() {
    const session = this.session;
    this.session = undefined;
    if (!session) return;
    clearTimeout(session.timer);
    if (session.recorder?.state === "recording") session.recorder.stop();
    this.stopTracks(session);
  }

  private stopTracks(session: CaptureSession) {
    session.stream?.getTracks().forEach((track) => {
      track.stop();
    });
  }

  private fail(message: string) {
    this.dispose();
    this.callbacks.error(message);
  }

  private async finish(session: CaptureSession) {
    this.stopTracks(session);
    if (this.session !== session) return;
    if (!session.released) {
      this.fail("Microphone recording ended unexpectedly. Please try again or type instead.");
      return;
    }
    try {
      const blob = new Blob(session.chunks, { type: session.recorder?.mimeType ?? "" });
      if (!blob.size) throw new Error("Empty recording");
      const data_base64 = await encodeAudio(blob);
      if (this.session !== session) return;
      this.session = undefined;
      this.callbacks.complete({ data_base64, mime_type: blob.type });
    } catch {
      if (this.session === session)
        this.fail("The recording could not be read. Please type your question instead.");
    }
  }
}
