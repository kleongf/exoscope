import { Check, ChevronDown, FolderOpen, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExoStore } from "@/store/store";
import { newProject, refreshProjects, switchProject } from "./projectController";

function updated(at: string | null | undefined) {
  if (!at) return "";
  return new Date(at).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

/** The Project dropdown: every saved Project, newest first, and "New Project". */
export function ProjectSwitcher() {
  const project = useExoStore((s) => s.project);
  const projects = useExoStore((s) => s.projects);
  const busy = useExoStore((s) => s.status !== "idle");
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void refreshProjects();
      }}
    >
      <DropdownMenuTrigger asChild disabled={busy}>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2"
          data-testid="project-switcher"
        >
          <FolderOpen className="size-4 text-muted-foreground" />
          <span className="flex-1 truncate text-left">{project?.name ?? "No Project open"}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Projects</DropdownMenuLabel>
        {projects.map((p) => (
          <DropdownMenuItem
            key={p.id}
            disabled={p.error != null}
            className="items-start"
            data-testid="project-option"
            onSelect={() => {
              if (p.id !== project?.id) void switchProject(p.id);
            }}
          >
            {p.error != null && <TriangleAlert className="mt-0.5 text-destructive" />}
            <span className="flex-1">
              <span className="block font-medium">{p.name}</span>
              <span
                className="line-clamp-2 text-xs text-muted-foreground"
                title={p.error ?? undefined}
              >
                {p.error ?? `${String(p.item_count ?? 0)} items · ${updated(p.updated_at)}`}
              </span>
            </span>
            {p.id === project?.id && <Check className="mt-0.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="new-project"
          onSelect={() => {
            void newProject();
          }}
        >
          <Plus /> New Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
