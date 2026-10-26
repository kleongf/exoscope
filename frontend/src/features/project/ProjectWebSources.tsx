import { useExoStore } from "@/store/store";
import { collectWebSources } from "@/features/websearch/evidence";
import { WebSources } from "@/features/websearch/WebSources";
import { ExplorerSection } from "./ExplorerSection";

export function ProjectWebSources() {
  const turns = useExoStore((state) => state.turns);
  const { sources, associatedIds } = collectWebSources(turns);
  return (
    <ExplorerSection
      title="Web sources"
      count={sources.length}
      empty="None yet"
      defaultOpen={false}
    >
      <section aria-label="Project Web sources">
        <WebSources sources={sources} associatedIds={associatedIds} anchorPrefix="project" />
      </section>
    </ExplorerSection>
  );
}
