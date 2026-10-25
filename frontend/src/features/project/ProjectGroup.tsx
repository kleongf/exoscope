import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useExoStore } from "@/store/store";

type SectionId = "systems" | "samples" | "comparisons" | "webSources" | "reports";

function sectionSettings(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Open state belongs to the Project's existing JSON settings, alongside scene settings. */
export function ProjectGroup({
  sectionId,
  label,
  count,
  children,
}: {
  sectionId: SectionId;
  label: string;
  count: number;
  children: ReactNode;
}) {
  const savedOpen = useExoStore(
    (state) => sectionSettings(state.sceneSettings.explorerSections)[sectionId],
  );
  const transitioning = useExoStore((state) => state.projectTransition);
  const open = typeof savedOpen === "boolean" ? savedOpen : true;
  return (
    <Collapsible
      open={open}
      className="border-t"
      onOpenChange={(nextOpen) => {
        useExoStore.setState((state) => {
          if (state.projectTransition) return {};
          const sections = sectionSettings(state.sceneSettings.explorerSections);
          if (sections[sectionId] === nextOpen) return {};
          return {
            sceneSettings: {
              ...state.sceneSettings,
              explorerSections: { ...sections, [sectionId]: nextOpen },
            },
          };
        });
      }}
    >
      <h3 className="px-3 py-1">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 w-full justify-start gap-2 px-1 text-xs font-medium"
            disabled={transitioning}
            aria-label={`${label} (${count.toLocaleString()})`}
          >
            <ChevronRight
              aria-hidden="true"
              className={`size-3.5 shrink-0 ${open ? "rotate-90" : ""}`}
            />
            <span className="flex-1 text-left">{label}</span>
            <Badge variant="secondary" aria-hidden="true" className="text-[10px] tabular-nums">
              {count.toLocaleString()}
            </Badge>
          </Button>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent forceMount className="data-[state=closed]:hidden">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
