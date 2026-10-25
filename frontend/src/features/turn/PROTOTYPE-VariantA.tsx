// PROTOTYPE (prototype/turn-ui) Variant A — "Conversation-first".
// A wide conversation column owns the left side; each answer shows its tool steps inline,
// like a worked solution. The scene is secondary.
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Turn } from "./PROTOTYPE-turnRunner";
import { AskBox, ProvenanceBadge, StepIcon } from "./PROTOTYPE-shared";
import { SimpleScene } from "./PROTOTYPE-SimpleScene";
import { elapsed, useNow, useProtoTurns } from "./PROTOTYPE-useTurns";

export const variantAName = "Conversation-first";

function TurnBlock({ turn, now }: { turn: Turn; now: number }) {
  const failed = turn.status === "failed";
  return (
    <div className="flex flex-col gap-2">
      <div className="self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
        {turn.question}
      </div>
      <div
        className={`rounded-2xl rounded-bl-sm border px-3 py-2 text-sm ${failed ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"}`}
      >
        <ol className="mb-2 flex flex-col gap-1">
          {turn.steps.map((s) => (
            <li key={s.id} className="flex items-start gap-2">
              <StepIcon status={s.status} />
              <div className="min-w-0">
                <div className={s.status === "pending" ? "text-muted-foreground/50" : ""}>
                  {s.label}
                </div>
                {s.status !== "pending" && (
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {s.detail}
                    {s.tookMs !== undefined && ` · ${(s.tookMs / 1000).toFixed(1)} s`}
                  </div>
                )}
                {s.status === "failed" && s.outcome && (
                  <div className="text-xs text-red-300">{s.outcome}</div>
                )}
              </div>
            </li>
          ))}
        </ol>
        {turn.status === "running" && (
          <div className="text-xs text-muted-foreground">Working… {elapsed(turn, now)}</div>
        )}
        {turn.reply && <p className="leading-relaxed">{turn.reply}</p>}
        <div className="mt-2 flex items-center gap-2">
          {turn.provenance && <ProvenanceBadge provenance={turn.provenance} />}
          {failed && <span className="text-xs text-red-300">Nothing in the view was changed.</span>}
        </div>
      </div>
    </div>
  );
}

export function VariantA() {
  const t = useProtoTurns();
  const now = useNow(t.busy);
  return (
    <div className="grid h-screen grid-cols-[30rem_1fr] bg-background text-foreground">
      <aside className="flex min-h-0 flex-col border-r border-border bg-card/40">
        <header className="border-b border-border px-4 py-3 text-sm font-semibold">
          ExoScope · Investigation
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-4">
            {t.turns.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask about a planetary system, e.g. “Open TRAPPIST-1.”
              </p>
            )}
            {t.turns.map((turn) => (
              <TurnBlock key={turn.id} turn={turn} now={now} />
            ))}
          </div>
        </ScrollArea>
        <div className="border-t border-border p-3 pb-16">
          <AskBox t={t} />
        </div>
      </aside>
      <main className="relative bg-[#05060a]">
        <SimpleScene system={t.system} />
        <div className="absolute top-3 left-3 text-xs text-muted-foreground">
          {t.system ?? "No System loaded"}
        </div>
      </main>
    </div>
  );
}
