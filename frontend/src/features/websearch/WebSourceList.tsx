import type { WebSource } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { displayTitle, retrievalTime, sourceAnchor, webUrl } from "./evidence";

function SourceItem(props: {
  source: WebSource;
  index: number;
  associated: boolean;
  anchorPrefix: string;
}) {
  const { source, index } = props;
  const href = webUrl(source.url);
  const title = displayTitle(source);
  // Provenance stays available on hover instead of two extra lines per source.
  const provenance = `${source.url}\n${
    props.associated
      ? "Associated with a claim in the search result"
      : "Retrieved only · no claim association returned"
  }`;
  return (
    <li
      className="min-w-0 break-words [overflow-wrap:anywhere]"
      id={sourceAnchor(props.anchorPrefix, source.id)}
      title={provenance}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="shrink-0 font-mono text-[10px] text-sky-400">[{index + 1}]</span>
        {href ? (
          <a
            className="text-xs text-primary underline-offset-2 hover:underline"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {title}
          </a>
        ) : (
          <span className="text-xs">{title} (URL unavailable)</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-5 text-[10px] text-muted-foreground">
        <Badge variant="outline" className="h-4 px-1 text-[9px]">
          Web source
        </Badge>
        <span>{source.domain}</span>
        <span>
          · <time dateTime={source.retrieved_at}>{retrievalTime(source.retrieved_at)}</time>
        </span>
      </div>
    </li>
  );
}

/** Titles first, domain secondary; sources beyond `visible` collapse behind "Show N more". */
export function WebSources({
  sources,
  associatedIds,
  anchorPrefix,
  visible = sources.length,
}: {
  sources: WebSource[];
  associatedIds: string[];
  anchorPrefix: string;
  visible?: number;
}) {
  const item = (source: WebSource, index: number) => (
    <SourceItem
      key={source.id}
      source={source}
      index={index}
      associated={associatedIds.includes(source.id)}
      anchorPrefix={anchorPrefix}
    />
  );
  const hidden = sources.slice(visible);
  return (
    <ul className="space-y-2" data-testid="web-sources">
      {sources.slice(0, visible).map(item)}
      {hidden.length > 0 && (
        <Collapsible asChild>
          <li className="list-none">
            {/* Kept mounted so citation anchors to later sources still resolve. */}
            <CollapsibleContent forceMount className="data-[state=closed]:hidden">
              <ul className="space-y-2">{hidden.map((source, i) => item(source, visible + i))}</ul>
            </CollapsibleContent>
            <CollapsibleTrigger className="group mt-1 text-xs text-sky-400 hover:underline">
              <span className="group-data-[state=open]:hidden">
                Show {hidden.length} more sources
              </span>
              <span className="group-data-[state=closed]:hidden">Show fewer sources</span>
            </CollapsibleTrigger>
          </li>
        </Collapsible>
      )}
    </ul>
  );
}
