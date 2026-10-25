import { beforeEach, describe, expect, it } from "vitest";
import type { System, TurnResponse, WebSearchResult } from "../api/client";
import snapshot from "../test/trappist-1.json";
import { collectWebSources } from "../features/websearch/evidence";
import { useExoStore } from "./store";

const system = snapshot as System;
const source = {
  id: "web-6590fd623760de67c9713ec7",
  kind: "web_source" as const,
  title: "Explicit mock literature page",
  domain: "example.org",
  url: "https://example.org/water",
  retrieved_at: "2026-10-25T22:02:45Z",
};
const web: WebSearchResult = {
  status: "ok",
  query: "liquid water",
  grounded_text: "987.65 Earth radii is only web text.",
  sources: [source],
  supports: [{ text: "A mock claim", source_ids: [source.id] }],
  search_suggestions_html: null,
  error: null,
};
function accept(result: WebSearchResult | null = web) {
  const response: TurnResponse = {
    transcript: "Liquid water?",
    reply_text: "According to the mock page, liquid water is not established.",
    reply_audio: { data_base64: "AA==", mime_type: "audio/wav" },
    ui_commands: [],
    data: { web_search: result },
  };
  useExoStore.getState().beginTurn(response.transcript);
  useExoStore.getState().acceptTurn(response);
}
describe("per-turn Web evidence", () => {
  beforeEach(() => {
    useExoStore.setState(useExoStore.getInitialState());
    useExoStore.getState().applyCommand({ kind: "load_system", system });
    useExoStore.getState().applyCommand({ kind: "focus_planet", name: "TRAPPIST-1 e" });
  });
  it("stores original evidence and spoken reply availability without changing System state", () => {
    accept();
    const state = useExoStore.getState();
    expect(state.turns[0]?.webSearch).toBe(web);
    expect(state.turns[0]?.hasSpokenReply).toBe(true);
    expect(state.system).toBe(system);
    expect(state.focusedPlanetName).toBe("TRAPPIST-1 e");
    expect(state.daysPerSecond).toBe(1);
    expect(state.system?.planets).toEqual(snapshot.planets);
  });
  it("starts a new turn with no citations and keeps historical evidence in context", () => {
    accept();
    useExoStore.getState().beginTurn("What is the radius?");
    const { turns } = useExoStore.getState();
    expect(turns[0]?.webSearch).toBe(web);
    expect(turns[1]?.webSearch).toBeNull();
    expect(turns[1]?.hasSpokenReply).toBe(false);
    expect(collectWebSources(turns).sources).toEqual([source]);
    useExoStore.getState().fail("Network unavailable");
    expect(useExoStore.getState().turns[1]?.webSearch).toBeNull();
    expect(useExoStore.getState().turns[0]?.webSearch).toBe(web);
  });
  it("keeps historical evidence when microphone permission or recording fails", () => {
    accept();
    useExoStore.getState().setStatus("requesting");
    useExoStore.getState().fail("Microphone unavailable");
    expect(useExoStore.getState().turns[0]?.webSearch).toBe(web);
    expect(useExoStore.getState().system).toBe(system);
  });
  it("does not carry web evidence into an archive-only answer", () => {
    accept();
    accept(null);
    expect(useExoStore.getState().turns.map((turn) => turn.webSearch)).toEqual([web, null]);
    expect(collectWebSources(useExoStore.getState().turns).sources).toEqual([source]);
  });
  it("keeps the unavailable result on its own turn and excludes its stale fields from Project sources", () => {
    accept();
    const unavailable: WebSearchResult = {
      ...web,
      status: "unavailable",
      sources: [{ ...source, id: "stale", url: "https://example.org/stale" }],
      grounded_text: "",
      error: "Search unavailable.",
    };
    accept(unavailable);
    const { turns } = useExoStore.getState();
    expect(turns.map((turn) => turn.webSearch)).toEqual([web, unavailable]);
    expect(collectWebSources(turns).sources).toEqual([source]);
    expect(useExoStore.getState().system).toBe(system);
  });
  it("accumulates sources by URL and preserves claim association across repeated retrievals", () => {
    accept();
    const retrievedOnly = { ...source, id: "web-new-hash", title: "Latest title" };
    const additional = { ...source, id: "web-other", url: "https://example.org/other" };
    accept({ ...web, sources: [retrievedOnly, additional], supports: [] });
    const collected = collectWebSources(useExoStore.getState().turns);
    expect(collected.sources).toEqual([retrievedOnly, additional]);
    expect(collected.associatedIds).toEqual([retrievedOnly.id]);
    expect(useExoStore.getState().turns[0]?.webSearch?.sources).toEqual([source]);
  });
});
