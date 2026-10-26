import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSearchResult } from "@/api/client";
import { ProjectExplorer } from "@/features/project/ProjectExplorer";
import { TurnHistory } from "@/features/voice/TurnHistory";
import { useExoStore, type ExoState } from "@/store/store";

// SSR normally reads Zustand's initial snapshot; render the prepared current history here.
vi.mock("@/store/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store/store")>();
  return {
    ...actual,
    useExoStore: Object.assign(
      (selector: (state: ExoState) => unknown) => selector(actual.useExoStore.getState()),
      actual.useExoStore,
    ),
  };
});

const source = {
  id: "web-1234567890abcdef12345678",
  kind: "web_source" as const,
  title: "Explicit mock page",
  domain: "example.org",
  url: "https://example.org/evidence",
  retrieved_at: "2026-10-25T22:02:45Z",
};
const web: WebSearchResult = {
  status: "ok",
  query: "Mock evidence",
  grounded_text: "Original mock search finding",
  sources: [source],
  supports: [{ text: "Original mock claim", source_ids: [source.id] }],
};
function accept(result: WebSearchResult | null) {
  const store = useExoStore.getState();
  store.beginTurn("Mock question");
  store.acceptTurn({
    transcript: "Mock question",
    reply_text: "According to the explicit mock page…",
    data: { web_search: result },
    reply_audio: { data_base64: "AA==", mime_type: "audio/wav" },
  });
}
describe("Web evidence in the Project layout", () => {
  beforeEach(() => {
    useExoStore.setState(useExoStore.getInitialState());
  });
  it("wires evidence into its own history turn and deduplicates the Project list", () => {
    accept(web);
    accept(web);
    accept(null);
    accept({ ...web, status: "unavailable", error: "Explicit failure" });
    const html = renderToStaticMarkup(
      <>
        <ProjectExplorer />
        <TurnHistory />
      </>,
    );
    const articles = html.split("<article ").slice(1);
    expect(articles).toHaveLength(4);
    expect(articles[0]).toContain("Original mock claim");
    expect(articles[1]).toContain("Original mock claim");
    expect(articles[2]).not.toContain('data-testid="web-evidence"');
    expect(articles[3]).toContain("Web search unavailable. Explicit failure");
    expect(articles[3]).not.toContain("Original mock claim");
    expect(articles[3]).not.toContain(source.url);
    // Two turns; the Project's Web sources section starts collapsed, so it renders no links.
    expect(html.match(/href="https:\/\/example.org\/evidence"/g)).toHaveLength(2);
    expect(html.match(/data-testid="spoken-attribution"/g)).toHaveLength(2);
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) expect(ids).toContain(target);
    expect(html).not.toContain(`[${source.id}]`);
  });
});
