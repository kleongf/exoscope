import type { WebSource } from "@/api/client";
import type { ConversationTurn } from "@/store/store";

export function sourceAnchor(prefix: string, id: string) {
  return `${prefix}-web-source-${encodeURIComponent(id)}`;
}
export function webUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}
export function retrievalTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Retrieval time unavailable" : date.toLocaleString();
}

function wasAssociated(entry: { associated: boolean } | undefined) {
  return Boolean(entry?.associated);
}

/** Project evidence is derived from completed history; no persistence API is involved. */
export function collectWebSources(turns: ConversationTurn[]) {
  const byUrl = new Map<string, { source: WebSource; associated: boolean }>();
  for (const turn of turns) {
    if (turn.finishedAt === null || turn.webSearch?.status !== "ok") continue;
    const associatedIds = new Set(
      turn.webSearch.supports?.flatMap((item) => item.source_ids ?? []),
    );
    for (const source of turn.webSearch.sources ?? []) {
      const key = webUrl(source.url) ?? source.url;
      const previous = byUrl.get(key);
      byUrl.set(key, {
        source,
        associated: associatedIds.has(source.id) || wasAssociated(previous),
      });
    }
  }
  const entries = [...byUrl.values()];
  return {
    sources: entries.map((entry) => entry.source),
    associatedIds: entries.filter((entry) => entry.associated).map((entry) => entry.source.id),
  };
}
