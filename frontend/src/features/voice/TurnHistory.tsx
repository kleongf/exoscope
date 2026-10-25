import { useEffect, useRef, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useExoStore, type ConversationTurn } from "@/store/store";
import { WebEvidence } from "@/features/websearch/WebEvidence";
import { provenanceLabel } from "@/features/scene/provenance";

function Waiting({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return (
    <p className="text-xs text-muted-foreground" role="status">
      Waiting for response… {Math.max(0, (now - startedAt) / 1000).toFixed(1)} s
    </p>
  );
}
function FailureOutcome({ appliedCommands }: { appliedCommands: number }) {
  return (
    <p className="text-xs text-muted-foreground">
      {appliedCommands > 0
        ? "Some steps failed; successful changes are shown in the view."
        : "Nothing in the view was changed."}
    </p>
  );
}
function ReplyFinding({ turn }: { turn: ConversationTurn }) {
  return (
    <>
      {turn.reply && (
        <div>
          {turn.webSearch?.status === "ok" && (
            <p className="text-xs text-muted-foreground">
              {turn.error ? "Synthesis unavailable" : "Gemma synthesis · with archive context"}
            </p>
          )}
          <p
            className="whitespace-pre-wrap break-words text-sm leading-relaxed"
            data-testid="student-reply"
          >
            {turn.reply}
          </p>
        </div>
      )}
    </>
  );
}
function TurnBlock({ turn }: { turn: ConversationTurn }) {
  const failed = Boolean(turn.error) || turn.steps.some((step) => step.status === "failed");
  return (
    <article className="flex flex-col gap-2" data-testid="conversation-turn" data-turn-id={turn.id}>
      <p className="max-w-[95%] self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
        {turn.question || "Spoken question"}
      </p>
      <Card
        size="sm"
        className={
          failed ? "rounded-2xl rounded-bl-sm ring-destructive/40" : "rounded-2xl rounded-bl-sm"
        }
      >
        <CardContent className="space-y-2">
          {turn.steps.length > 0 && (
            <ol className="space-y-2" aria-label="Tool steps">
              {turn.steps.map((step) => (
                <li key={step.id} className="flex items-start gap-2 text-xs">
                  {step.status === "completed" ? (
                    <Check className="mt-0.5 size-3 shrink-0" />
                  ) : (
                    <TriangleAlert className="mt-0.5 size-3 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0">
                    <p>{step.name}</p>
                    <p className="break-words text-muted-foreground">
                      {step.detail} · {(step.elapsed_ms / 1000).toFixed(1)} s
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {turn.finishedAt === null && <Waiting startedAt={turn.startedAt} />}
          <ReplyFinding turn={turn} />
          {turn.error && (
            <p className="text-sm text-destructive" role="alert">
              {turn.error}
            </p>
          )}
          {turn.warnings.map((warning, index) => (
            <p className="text-xs text-muted-foreground" key={`${String(index)}-${warning}`}>
              {warning}
            </p>
          ))}
          {turn.provenance && (
            <Badge variant="outline" className="text-[10px]">
              {provenanceLabel(turn.provenance)}
            </Badge>
          )}
          <WebEvidence
            result={turn.webSearch}
            hasSpokenReply={turn.hasSpokenReply}
            anchorPrefix={`turn-${String(turn.id)}`}
          />
          {failed && <FailureOutcome appliedCommands={turn.appliedCommands} />}
        </CardContent>
      </Card>
    </article>
  );
}
export function TurnHistory() {
  const turns = useExoStore((state) => state.turns);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-4 p-4" aria-live="polite">
        {turns.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ask about a System, e.g. “Open TRAPPIST-1.” Each answer will show the tools used and
            their timings.
          </p>
        )}
        {turns.map((turn) => (
          <TurnBlock key={turn.id} turn={turn} />
        ))}
        <div ref={end} />
      </div>
    </ScrollArea>
  );
}
