import type { WebSearchResult } from "@/api/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CitedSupport, WebSources } from "./WebSources";
import { SearchSuggestions } from "./SearchSuggestions";

/** Sources shown under an answer before "Show N more sources". */
export const INLINE_SOURCES = 3;

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
      {result.status === "unavailable" ? (
        <p role="status" className="text-xs text-destructive">
          Web search unavailable. {result.error || "No Web sources could be retrieved."}
        </p>
      ) : (
        <>
          <WebSources
            sources={result.sources ?? []}
            associatedIds={result.supports?.flatMap((support) => support.source_ids ?? []) ?? []}
            anchorPrefix={anchorPrefix}
            visible={INLINE_SOURCES}
          />
          <Collapsible>
            <CollapsibleTrigger
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              data-testid="provider-details-toggle"
            >
              Provider details · search “{result.query}”
            </CollapsibleTrigger>
            {/* Kept mounted (hidden) so citation anchors and history stay intact. */}
            <CollapsibleContent forceMount className="space-y-3 pt-2 data-[state=closed]:hidden">
              <p className="text-xs text-muted-foreground" data-testid="spoken-attribution">
                {hasSpokenReply
                  ? "The assistant's synthesis is shown and spoken above. "
                  : "Reply text is shown above. "}
                Provider citation associations below apply only to the original search text, not to
                the assistant's synthesis. They do not verify the claims.
              </p>
              <div className="space-y-1">
                <h4 className="text-xs font-medium">Original search result · provider support</h4>
                <p className="whitespace-pre-wrap text-xs" data-testid="grounded-text">
                  {result.grounded_text}
                </p>
              </div>
              <CitedSupport result={result} anchorPrefix={anchorPrefix} />
              {result.search_suggestions_html && (
                <SearchSuggestions html={result.search_suggestions_html} />
              )}
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </section>
  );
}
