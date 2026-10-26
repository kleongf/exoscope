import type { WebSearchResult } from "@/api/client";
import { sourceAnchor } from "./evidence";

export { WebSources } from "./WebSourceList";

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
