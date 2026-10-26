import { useState } from "react";
import type { ReportInclude } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useExoStore } from "@/store/store";
import { writeReport } from "./actions";
import { ScopePicker } from "./ScopePicker";

export function ReportComposer() {
  const state = useExoStore((s) => s);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Evidence Report");
  const [include, setInclude] = useState<ReportInclude>({
    systems: [],
    comparisons: [],
    samples: [],
    web_sources: [],
  });
  const changeOpen = (next: boolean) => {
    if (next) {
      const current = useExoStore.getState();
      const systemId = current.project?.systems?.find(
        (item) => item.system.hostname === current.system?.hostname,
      )?.id;
      setInclude({
        systems: systemId ? [systemId] : [],
        comparisons: [],
        samples: [],
        web_sources: [],
      });
    }
    setOpen(next);
  };
  const selected = Object.values(include).some((values) => values.length > 0);
  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={!state.project || state.status !== "idle"}
        >
          Write Report
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <h3 className="text-sm font-medium">Write a new Report</h3>
        <p className="text-xs text-muted-foreground">
          Choose saved evidence. The HTML file opens offline and stays unchanged after writing.
        </p>
        <Input
          aria-label="Report title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          maxLength={160}
          disabled={state.reportWriting}
        />
        <ScopePicker include={include} setInclude={setInclude} />
        <Button
          className="w-full"
          disabled={!title.trim() || !selected || state.reportWriting}
          onClick={() => {
            void writeReport({
              title: title.trim(),
              include,
              summary: "This Report presents selected evidence saved in this Project.",
              limitations: "",
            }).then((success) => {
              if (success) setOpen(false);
            });
          }}
        >
          {state.reportWriting ? "Writing Report…" : "Save HTML Report"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
