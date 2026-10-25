import { createHash } from "node:crypto";
import { fixtureReply } from "./voice-fixtures.mjs";

// Explicit MOCK responses. No live Gemma/xAI calls or readiness claims.
export const webQuestion = "Does any of these have liquid water?";
const mockSource = (title, url) => ({
  id: `web-${createHash("sha256").update(url).digest("hex").slice(0, 24)}`,
  kind: "web_source",
  title,
  url,
  retrieved_at: "2026-10-25T22:02:45Z",
  domain: new URL(url).hostname,
});
const cited = mockSource("Mock liquid-water evidence page", "https://science.nasa.gov/exoplanets/");
const retrieved = mockSource("Mock retrieved-only page", "https://example.org/retrieved");
const additional = mockSource("Mock follow-up evidence page", "https://example.org/follow-up");
export const webResult = {
  status: "ok",
  query: "TRAPPIST-1 e liquid water evidence",
  grounded_text:
    "MOCK literature result: liquid water is not established. A hypothetical 987.65 Earth radii value is Web source text only.",
  sources: [cited, retrieved],
  supports: [{ text: "Liquid water is not established.", source_ids: [cited.id] }],
  search_suggestions_html: null,
  error: null,
};
const baseReply = {
  reply_audio: fixtureReply.reply_audio,
  ui_commands: [],
  error: null,
  warnings: [],
  steps: [],
};
export const waterReply = {
  ...baseReply,
  transcript: webQuestion,
  reply_text:
    "The archive does not establish liquid water. According to the Mock liquid-water evidence page, liquid water is not established.",
  data: { system: null, web_search: webResult },
};
export const followUpReply = {
  ...waterReply,
  transcript: "Find more liquid water evidence",
  data: {
    system: null,
    web_search: {
      ...webResult,
      sources: [cited, additional],
      supports: [{ text: "A second mock claim.", source_ids: [additional.id] }],
    },
  },
};
export const radiusReply = {
  ...baseReply,
  transcript: "What is planet e's radius?",
  reply_text: "The Snapshot has no radius for TRAPPIST-1 e: Missing. No web search was needed.",
  data: { system: null, web_search: null },
};
export const searchFailureReply = {
  ...baseReply,
  transcript: "Search for liquid water again",
  error: "Web search is unavailable; no Web sources were obtained.",
  reply_audio: null,
  reply_text: "Web search is unavailable. I cannot verify liquid water or provide Web sources.",
  data: {
    system: null,
    web_search: {
      status: "unavailable",
      query: "TRAPPIST-1 e liquid water evidence",
      grounded_text: "",
      sources: [],
      supports: [],
      search_suggestions_html: null,
      error: "Mock provider search failure; no live provider call was made.",
    },
  },
};
