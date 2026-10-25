import { Buffer } from "node:buffer";

import { readFileSync } from "node:fs";

// Real canonical Snapshot, narrowed for this explicit browser fixture. No provider calls.
const snapshot = JSON.parse(
  readFileSync(new URL("../src/test/trappist-1.json", import.meta.url), "utf8"),
);
export const fixtureSystem = structuredClone(snapshot);
fixtureSystem.planets = fixtureSystem.planets.filter((planet) =>
  ["TRAPPIST-1 b", "TRAPPIST-1 e"].includes(planet.name),
);
// Explicit missing-value test, never presented as a real catalog result.
fixtureSystem.planets[1].radius = { status: "missing", unit: "Earth radii" };
// A valid 100 ms mono PCM WAV: playback is mocked, decoding still has valid input.
const wav = Buffer.alloc(44 + 4800);
wav.write("RIFF", 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(24000, 24);
wav.writeUInt32LE(48000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(4800, 40);
export const fixtureReply = {
  transcript: "Open TRAPPIST-1",
  reply_text: "Loaded the explicitly mocked System for this browser test.",
  reply_audio: { data_base64: wav.toString("base64"), mime_type: "audio/wav" },
  ui_commands: [{ kind: "load_system", system: fixtureSystem }],
  data: { system: fixtureSystem },
  error: null,
  steps: [
    {
      id: "load-1",
      name: "load_system",
      status: "completed",
      detail: "Explicit browser fixture",
      elapsed_ms: 1234,
    },
  ],
  warnings: [],
};

export async function installVoiceFixtures(page) {
  await page.addInitScript(() => {
    window.voiceFixture = {
      stops: 0,
      recordings: 0,
      plays: 0,
      pauses: 0,
      revokes: 0,
      loadBeforePlay: false,
      allowPlay: false,
      delayPermission: false,
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          new Promise((resolve) => {
            const grant = () =>
              resolve({
                getTracks: () => [
                  {
                    stop: () => {
                      window.voiceFixture.stops++;
                    },
                  },
                ],
              });
            if (window.voiceFixture.delayPermission) window.voiceFixture.grant = grant;
            else setTimeout(grant, 20);
          }),
      },
    });
    window.MediaRecorder = class {
      static isTypeSupported(type) {
        return type === "audio/webm;codecs=opus";
      }
      constructor(_stream, options) {
        this.mimeType = options.mimeType;
        this.state = "inactive";
      }
      start() {
        this.state = "recording";
        window.voiceFixture.recordings++;
        this.ondataavailable?.({ data: new Blob(["fixture-start-"]) });
      }
      stop() {
        this.state = "inactive";
        queueMicrotask(() => {
          this.ondataavailable?.({ data: new Blob(["fixture-final"]) });
          this.onstop?.();
        });
      }
    };
    HTMLMediaElement.prototype.play = function () {
      window.voiceFixture.plays++;
      window.voiceFixture.loadBeforePlay =
        document.getElementById("system-heading")?.textContent === "TRAPPIST-1";
      return window.voiceFixture.allowPlay
        ? Promise.resolve()
        : Promise.reject(new DOMException("Fixture autoplay blocked", "NotAllowedError"));
    };
    HTMLMediaElement.prototype.pause = function () {
      window.voiceFixture.pauses++;
    };
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      window.voiceFixture.revokes++;
      revoke(url);
    };
  });
}
