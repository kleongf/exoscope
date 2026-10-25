import { useExoStore } from "@/store/store";
import { collectWebSources } from "@/features/websearch/evidence";
import { WebSources } from "@/features/websearch/WebSources";

export function ProjectWebSources({ compact = false }: { compact?: boolean }) {
  const turns = useExoStore((state) => state.turns);
  const { sources, associatedIds } = collectWebSources(turns);
  return (
    <section
      className={compact ? "space-y-3 px-4 pb-3" : "space-y-3 border-t px-4 py-3"}
      aria-label="Project Web sources"
    >
      {!compact && <h3 className="text-xs font-medium text-muted-foreground">Web sources</h3>}
      {sources.length ? (
        <WebSources sources={sources} associatedIds={associatedIds} anchorPrefix="project" />
      ) : (
        <p className="text-xs text-muted-foreground">None yet</p>
      )}
    </section>
  );
}
