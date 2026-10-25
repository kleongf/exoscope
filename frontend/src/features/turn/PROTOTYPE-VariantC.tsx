// PROTOTYPE (prototype/turn-ui) Variant C — "Mission log".
// A command bar sits on top of the scene; every tool step streams into a timestamped,
// monospace log docked under the scene; a one-line ticker in the status bar shows the
// step in flight. The log doubles as the Investigation's audit trail.
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Turn } from "./PROTOTYPE-turnRunner";
import { AskBox, ProvenanceBadge, StepIcon } from "./PROTOTYPE-shared";
import { SimpleScene } from "./PROTOTYPE-SimpleScene";
import { elapsed, useNow, useProtoTurns } from "./PROTOTYPE-useTurns";

export const variantCName = "Mission log";

const clock = (ms: number) => new Date(ms).toTimeString().slice(0, 8);

function LogTurn({ turn }: { turn: Turn }) {
  const started = turn.steps.map((_, i) =>
    turn.steps.slice(0, i).reduce((n, s) => n + (s.tookMs ?? 0), turn.startedAt),
  );
  return (
    <div className="border-b border-white/5 py-2">
      <div className="text-sky-300">
        {clock(turn.startedAt)} ▸ {turn.question}
      </div>
      {turn.steps
        .map((s, i) => ({ s, at: started[i] ?? turn.startedAt }))
        .filter(({ s }) => s.status !== "pending")
        .map(({ s, at }) => (
          <div key={s.id} className="flex items-center gap-2 pl-4">
            <span className="text-muted-foreground">{clock(at)}</span>
            <StepIcon status={s.status} />
            <span className={s.status === "failed" ? "text-red-300" : ""}>{s.detail}</span>
            {s.tookMs !== undefined && (
              <span className="text-muted-foreground">{(s.tookMs / 1000).toFixed(1)}s</span>
            )}
            {s.status === "failed" && <span className="text-red-300">✗ {s.outcome}</span>}
          </div>
        ))}
      {turn.reply && (
        <div className={`mt-1 pl-4 font-sans ${turn.status === "failed" ? "text-red-200" : ""}`}>
          {turn.reply}
        </div>
      )}
      {turn.provenance && (
        <div className="mt-1 pl-4">
          <ProvenanceBadge provenance={turn.provenance} />
        </div>
      )}
    </div>
  );
}

function Ticker({ turn, now }: { turn: Turn | undefined; now: number }) {
  if (!turn) return <span>Idle</span>;
  const idx = turn.steps.findIndex((s) => s.status === "running");
  if (turn.status === "running" && idx >= 0) {
    const s = turn.steps[idx];
    return (
      <span className="text-sky-300">
        ▸ {idx + 1}/{turn.steps.length} {s?.label} · {elapsed(turn, now)}
      </span>
    );
  }
  return turn.status === "failed" ? (
    <span className="text-red-300">✗ Last request failed — view unchanged</span>
  ) : (
    <span className="text-emerald-300">✓ Done in {elapsed(turn, now)}</span>
  );
}

export function VariantC() {
  const t = useProtoTurns();
  const now = useNow(t.busy);
  return (
    <div className="grid h-screen grid-rows-[1fr_16rem_auto] bg-background text-foreground">
      <main className="relative min-h-0 bg-[#05060a]">
        <SimpleScene system={t.system} />
        <div className="absolute top-4 left-1/2 w-[36rem] -translate-x-1/2 rounded-xl border border-border bg-black/70 p-3 shadow-2xl backdrop-blur">
          <AskBox t={t} placeholder="⌘K  Ask ExoScope… e.g. “Open TRAPPIST-1”" />
        </div>
      </main>
      <section className="flex min-h-0 flex-col border-t border-border bg-black font-mono text-xs">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-1 text-muted-foreground">
          <span>MISSION LOG · Investigation #1</span>
          {t.current?.provenance && <ProvenanceBadge provenance={t.current.provenance} />}
        </div>
        <ScrollArea className="min-h-0 flex-1 px-3">
          {t.turns.length === 0 && (
            <div className="py-2 text-muted-foreground">No entries yet.</div>
          )}
          {t.turns.map((turn) => (
            <LogTurn key={turn.id} turn={turn} />
          ))}
        </ScrollArea>
      </section>
      <footer className="flex h-8 items-center gap-4 border-t border-border bg-card px-3 pr-64 font-mono text-xs">
        <span className="text-muted-foreground">{t.system ?? "No System"}</span>
        <Ticker turn={t.current} now={now} />
      </footer>
    </div>
  );
}
