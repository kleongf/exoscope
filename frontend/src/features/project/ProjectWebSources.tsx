import { useExoStore } from "@/store/store";
import { collectWebSources } from "@/features/websearch/evidence";
import { WebSources } from "@/features/websearch/WebSources";

export function ProjectWebSources() {
  const turns = useExoStore((state) => state.turns);
  const { sources, associatedIds } = collectWebSources(turns);
  return (
    <section className="space-y-3 border-t px-4 py-3" aria-label="Project Web sources">
      <h3 className="text-xs font-medium text-muted-foreground">Web sources</h3>
      {sources.length ? (
        <WebSources sources={sources} associatedIds={associatedIds} anchorPrefix="project" />
      ) : (
        <p className="text-xs text-muted-foreground">None yet</p>
      )}
    </section>
  );
}
