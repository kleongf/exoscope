import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WebSearchResult } from "../../api/client";
import { WebEvidence } from "./WebEvidence";

const source: NonNullable<WebSearchResult["sources"]>[number] = {
  id: "web-a65bf204b153fce189d34bd1123400de",
  kind: "web_source",
  title: "A water study",
  url: "https://example.org/water",
  domain: "example.org",
  retrieved_at: "2026-10-25T22:02:45Z",
};
const result: WebSearchResult = {
  status: "ok",
  query: "Liquid water?",
  grounded_text: "Original finding\nwith <untrusted> text.",
  sources: [source],
  supports: [{ text: "Original supported claim.", source_ids: [source.id] }],
  search_suggestions_html: "<p>Suggested search</p><script>parent.compromised = true</script>",
  error: null,
};
describe("Web evidence rendering", () => {
  it("preserves grounded text and support association separately from agent prose", () => {
    const html = renderToStaticMarkup(
      <WebEvidence anchorPrefix="turn-1" result={result} hasSpokenReply />,
    );
    expect(html).toContain('data-slot="badge"');
    expect(html).toContain("Web source");
    expect(html).toContain("example.org");
    expect(html).toContain('href="https://example.org/water"');
    expect(html).toContain('dateTime="2026-10-25T22:02:45Z"');
    expect(html).toContain("Original finding\nwith &lt;untrusted&gt; text.");
    expect(html).toContain("Original supported claim.");
    expect(html).toContain('href="#turn-1-web-source-web-a65bf204b153fce189d34bd1123400de"');
    expect(html).toContain('id="turn-1-web-source-web-a65bf204b153fce189d34bd1123400de"');
    expect(html).toContain('data-testid="spoken-attribution"');
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<canvas");
  });
  it("places provider HTML only in a sandboxed iframe without script or same-origin permission", () => {
    const html = renderToStaticMarkup(
      <WebEvidence anchorPrefix="turn-1" result={result} hasSpokenReply={false} />,
    );
    expect(html).toContain('title="Provider search suggestions" sandbox=""');
    expect(html).toContain("srcDoc=");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("allow-scripts");
    expect(html).not.toContain("allow-same-origin");
  });
  it.each(["javascript:alert(1)", "data:text/html,unsafe", "/local", "not a URL"])(
    "does not create a clickable source for unsafe URL %s",
    (url) => {
      const html = renderToStaticMarkup(
        <WebEvidence
          anchorPrefix="turn-1"
          result={{
            ...result,
            sources: [{ ...source, url }],
          }}
          hasSpokenReply={false}
        />,
      );
      expect(html).toContain("A water study (URL unavailable)");
      expect(html).not.toContain(`href="${url}`);
    },
  );
  it("displays unavailable honestly even if a response contains stale source fields", () => {
    const html = renderToStaticMarkup(
      <WebEvidence
        anchorPrefix="turn-1"
        result={{
          ...result,
          status: "unavailable",
          error: "Provider failed.",
        }}
        hasSpokenReply
      />,
    );
    expect(html).toContain("Web search unavailable. Provider failed.");
    expect(html).not.toContain("A water study");
    expect(html).not.toContain("Original supported claim");
    expect(html).not.toContain("iframe");
  });
  it("does not assign missing support IDs to another source", () => {
    const html = renderToStaticMarkup(
      <WebEvidence
        anchorPrefix="turn-1"
        result={{
          ...result,
          supports: [{ text: "Unresolved claim", source_ids: ["missing"] }],
        }}
        hasSpokenReply={false}
      />,
    );
    expect(html).toContain("Source unavailable");
    expect(html).not.toContain("[missing]");
    expect(html).not.toContain('href="#web-source-missing"');
  });
  it("uses friendly citation numbers, identifies retrieved-only sources and namespaces history anchors", () => {
    const withRetrieved = {
      ...result,
      sources: [source, { ...source, id: "web-another-hash", url: "https://example.org/other" }],
    };
    const html = renderToStaticMarkup(
      <>
        <WebEvidence anchorPrefix="turn-1" result={withRetrieved} hasSpokenReply />
        <WebEvidence anchorPrefix="turn-2" result={withRetrieved} hasSpokenReply />
      </>,
    );
    expect(html).toContain(">[1]</a>");
    expect(html).toContain("Retrieved only · no claim association returned");
    expect(html).toContain("Associated with a claim in the search result");
    expect(html).not.toContain(`[${source.id}]`);
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) expect(ids).toContain(target);
  });
  it("handles 33 retrieved sources without assigning all of them to the six claims", () => {
    const sources = Array.from({ length: 33 }, (_, index) => ({
      ...source,
      id: `web-${index.toString(16).padStart(24, "0")}`,
      url: `https://example.org/source/${String(index)}`,
    }));
    const supports = sources.slice(0, 6).map((item) => ({
      text: "Explicit mock claim",
      source_ids: [item.id],
    }));
    const html = renderToStaticMarkup(
      <WebEvidence
        anchorPrefix="turn-33"
        result={{ ...result, sources, supports, search_suggestions_html: null }}
        hasSpokenReply
      />,
    );
    expect(html.match(/data-slot="badge"/g)).toHaveLength(33);
    expect(html.match(/href="#turn-33-web-source-/g)).toHaveLength(6);
    expect(html.match(/Retrieved only · no claim association returned/g)).toHaveLength(27);
    expect(html.match(/Associated with a claim in the search result/g)).toHaveLength(6);
    expect(html).not.toMatch(/\[web-[a-f0-9]+\]/);
  });
  it("renders nothing when the turn has no web search", () => {
    expect(
      renderToStaticMarkup(
        <WebEvidence anchorPrefix="turn-1" result={null} hasSpokenReply={false} />,
      ),
    ).toBe("");
  });
});
