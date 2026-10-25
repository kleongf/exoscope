import { Mic, Send } from "lucide-react";
import type { SyntheticEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Persistent bar: transcript, the always-visible text box, and push-to-talk. */
export function ConversationBar() {
  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
  };
  return (
    <footer className="border-t border-border bg-card px-4 py-3">
      <div
        aria-label="Transcript"
        className="mb-2 h-10 overflow-y-auto text-sm text-muted-foreground"
      >
        Ask about a planetary system, e.g. “Open TRAPPIST-1.”
      </div>
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                disabled
                aria-label="Push to talk"
              >
                <Mic />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Voice input is not connected yet</TooltipContent>
        </Tooltip>
        <Input name="question" placeholder="Type a question…" className="flex-1" />
        <Button type="submit" size="icon" aria-label="Send">
          <Send />
        </Button>
      </form>
    </footer>
  );
}
