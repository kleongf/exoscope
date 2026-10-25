import { useState } from "react";
import { ChevronDown, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useExoStore } from "@/store/store";
import { projectController } from "./persistence";

export function ProjectHeader() {
  const [open, setOpen] = useState(false);
  const current = useExoStore((s) => s.currentProject);
  const projects = useExoStore((s) => s.projects);
  const status = useExoStore((s) => s.projectStatus);
  const error = useExoStore((s) => s.projectError);
  const turnBusy = useExoStore((s) => s.status !== "idle" || s.projectTransition);
  const busy = turnBusy || status === "saving";
  return (
    <div className="space-y-2 px-3 py-3">
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="min-w-0 flex-1 justify-start"
              disabled={busy}
              aria-label="Switch Project"
            >
              <FolderOpen className="size-4 shrink-0" />
              <span className="flex-1 truncate text-left">{current?.title ?? "Project"}</span>
              <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <h3 className="mb-2 text-sm font-medium">Projects</h3>
            <Button
              variant="ghost"
              className="w-full justify-start"
              aria-label="Create New Project"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                void projectController.choose();
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              New Project
            </Button>
            <Separator className="my-2" />
            {projects.map((p) => (
              <Button
                key={p.id}
                disabled={busy}
                variant={p.id === current?.id ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  setOpen(false);
                  void projectController.choose(p.id);
                }}
              >
                {p.title}
              </Button>
            ))}
          </PopoverContent>
        </Popover>
        <Button
          variant="outline"
          size="icon"
          aria-label="New Project"
          title="New Project"
          disabled={busy}
          onClick={() => {
            void projectController.choose();
          }}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <p
        className="px-1 text-xs text-muted-foreground"
        role="status"
        data-testid="project-save-status"
      >
        {status === "saving"
          ? "Saving Project…"
          : status === "error"
            ? "Project not saved"
            : status === "unsaved"
              ? "Unsaved changes"
              : current
                ? "Project saved"
                : "Opening Project…"}
      </p>
      {error && (
        <div role="alert" className="space-y-1 text-xs text-destructive">
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void projectController.flush();
            }}
          >
            Retry save
          </Button>
          {current && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void projectController.recover(current.id);
              }}
            >
              Reload saved Project
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
