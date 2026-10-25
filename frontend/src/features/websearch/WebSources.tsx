import type { WebSearchResult, WebSource } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { retrievalTime, sourceAnchor, webUrl } from "./evidence";

export function CitedSupport({
  result,
  anchorPrefix,
}: {
  result: WebSearchResult;
  anchorPrefix: string;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium">Provider citation associations</h4>
      {result.supports?.length ? (
        <ul className="space-y-3" data-testid="web-supports">
          {result.supports.map((support, index) => (
            <li key={index} className="space-y-1">
              <p className="whitespace-pre-wrap text-xs">{support.text}</p>
              <span className="text-xs text-muted-foreground">Sources: </span>
              {(support.source_ids ?? []).map((id) => {
                const sourceIndex = result.sources?.findIndex((source) => source.id === id) ?? -1;
                return sourceIndex >= 0 ? (
                  <a
                    className="mr-2 text-xs text-primary underline underline-offset-2"
                    href={`#${sourceAnchor(anchorPrefix, id)}`}
                    key={id}
                  >
                    [{sourceIndex + 1}]
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground" key={id}>
                    Source unavailable
                  </span>
                );
              })}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No claim associations were returned.</p>
      )}
    </div>
  );
}
export function WebSources({
  sources,
  associatedIds,
  anchorPrefix,
}: {
  sources: WebSource[];
  associatedIds: string[];
  anchorPrefix: string;
}) {
  return (
    <ul className="space-y-4" data-testid="web-sources">
      {sources.map((source, index) => {
        const href = webUrl(source.url);
        return (
          <li
            className="min-w-0 space-y-1 break-words [overflow-wrap:anywhere]"
            key={source.id}
            id={sourceAnchor(anchorPrefix, source.id)}
          >
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">
                Web source
              </Badge>
              <span>{source.domain}</span>
              <span>[{index + 1}]</span>
            </div>
            {href ? (
              <a
                className="text-xs text-primary underline underline-offset-2"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.title}
              </a>
            ) : (
              <span className="text-xs">{source.title} (URL unavailable)</span>
            )}
            <p className="text-[10px] text-muted-foreground">
              Retrieved{" "}
              <time dateTime={source.retrieved_at}>{retrievalTime(source.retrieved_at)}</time>
            </p>
            <p className="text-[10px] text-muted-foreground">
              {associatedIds.includes(source.id)
                ? "Associated with a claim in the search result"
                : "Retrieved only · no claim association returned"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
