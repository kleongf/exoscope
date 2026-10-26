import { useState } from "react";
import type { Interpretation, Sample } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { projectTurnController } from "@/features/voice/turnController";
import { useExoStore } from "@/store/store";
import { sampleTitle } from "./sampleView";

/**
 * One Interpretation as an editable chip. Editing re-runs the search as a normal turn with an
 * explicit instruction, so the assistant restates the new reading and the run shows in the chat.
 */
export function InterpretationChip({
  interpretation,
  sample,
}: {
  interpretation: Interpretation;
  sample: Sample;
}) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(interpretation.as);
  const busy = useExoStore((s) => s.status !== "idle");
  const rerun = () => {
    setOpen(false);
    void projectTurnController.submit({
      // The loop keeps no chat history, so the instruction carries the whole search.
      text:
        `Search the archive again with these filters: ${sampleTitle(sample)}. ` +
        `But now read "${interpretation.term}" as ${reading.trim()} instead of ` +
        `${interpretation.as}, replacing the matching filter, and record "${interpretation.term}" ` +
        `as an interpretation.`,
    });
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="interpretation-chip"
          aria-label={`Edit ${interpretation.term}`}
        >
          <Badge variant="secondary" className="cursor-pointer text-[11px] font-normal">
            <span className="font-medium">“{interpretation.term}”</span>
            &nbsp;= {interpretation.as}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 text-xs">
        <p>
          ExoScope read <span className="font-medium">“{interpretation.term}”</span> as{" "}
          {interpretation.as}.
        </p>
        {interpretation.caveat && <p className="text-amber-300">{interpretation.caveat}</p>}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (reading.trim()) rerun();
          }}
        >
          <Input
            aria-label={`New reading for ${interpretation.term}`}
            value={reading}
            onChange={(event) => {
              setReading(event.target.value);
            }}
            className="h-8 text-xs"
          />
          <Button type="submit" size="sm" disabled={busy || !reading.trim()}>
            Search again
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
