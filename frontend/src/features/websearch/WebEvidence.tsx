import type { WebSearchResult } from "@/api/client";
import { CitedSupport, WebSources } from "./WebSources";
import { SearchSuggestions } from "./SearchSuggestions";

export function WebEvidence({
  result,
  hasSpokenReply,
  anchorPrefix,
}: {
  result: WebSearchResult | null;
  hasSpokenReply: boolean;
  anchorPrefix: string;
}) {
  if (!result) return null;
  return (
    <section
      className="space-y-3 border-t pt-3 [overflow-wrap:anywhere]"
      aria-labelledby={`${anchorPrefix}-web-heading`}
      data-testid="web-evidence"
    >
      <h3 id={`${anchorPrefix}-web-heading`} className="text-sm font-semibold">
        Web sources
      </h3>
      <p className="text-xs text-muted-foreground">Search: {result.query}</p>
      {result.status === "unavailable" ? (
        <p role="status" className="text-xs text-destructive">
          Web search unavailable. {result.error || "No Web sources could be retrieved."}
        </p>
      ) : (
        <>
          {hasSpokenReply && (
            <p className="text-xs text-muted-foreground" data-testid="spoken-attribution">
              Spoken reply text is shown above. Claim associations below apply to the original
              search result.
            </p>
          )}
          <div className="space-y-1">
            <h4 className="text-xs font-medium">Original search result</h4>
            <p className="whitespace-pre-wrap text-xs" data-testid="grounded-text">
              {result.grounded_text}
            </p>
          </div>
          <CitedSupport result={result} anchorPrefix={anchorPrefix} />
          <WebSources
            sources={result.sources ?? []}
            associatedIds={result.supports?.flatMap((support) => support.source_ids ?? []) ?? []}
            anchorPrefix={anchorPrefix}
          />
          {result.search_suggestions_html && (
            <SearchSuggestions html={result.search_suggestions_html} />
          )}
        </>
      )}
    </section>
  );
}
