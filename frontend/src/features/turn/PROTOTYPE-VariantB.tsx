// PROTOTYPE (prototype/turn-ui) Variant B — "Scene-first".
// The System view fills the screen. A turn shows as a stepper overlaid on the scene;
// the answer arrives as a caption card on the scene. Transcript is one line.
import { Progress } from "./PROTOTYPE-progress";
import type { Turn } from "./PROTOTYPE-turnRunner";
import { AskBox, ProvenanceBadge, StepIcon } from "./PROTOTYPE-shared";
import { SimpleScene } from "./PROTOTYPE-SimpleScene";
import { elapsed, useNow, useProtoTurns } from "./PROTOTYPE-useTurns";

export const variantBName = "Scene-first";

function Stepper({ turn, now }: { turn: Turn; now: number }) {
  const running = turn.steps.find((s) => s.status === "running");
  const doneCount = turn.steps.filter((s) => s.status !== "pending").length;
  return (
    <div className="absolute top-1/2 left-1/2 w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-sky-500/30 bg-black/70 p-5 backdrop-blur">
      <div className="mb-1 text-xs tracking-wide text-sky-300 uppercase">
        Working · {elapsed(turn, now)}
      </div>
      <div className="mb-3 text-lg font-medium">{running?.label ?? "Finishing…"}</div>
      <Progress value={doneCount} max={turn.steps.length} />
      <div className="mt-3 flex justify-between">
        {turn.steps.map((s) => (
          <div key={s.id} className="flex flex-col items-center gap-1" title={s.detail}>
            <StepIcon status={s.status} />
          </div>
        ))}
      </div>
      {running && (
        <div className="mt-2 font-mono text-[11px] text-muted-foreground">{running.detail}</div>
      )}
    </div>
  );
}

function Caption({ turn }: { turn: Turn }) {
  const failed = turn.status === "failed";
  const failedStep = turn.steps.find((s) => s.status === "failed");
  return (
    <div
      className={`absolute bottom-6 left-1/2 w-[40rem] -translate-x-1/2 rounded-xl border p-4 backdrop-blur ${failed ? "border-red-500/50 bg-red-950/60" : "border-border bg-black/60"}`}
    >
      {failed && failedStep && (
        <div className="mb-1 text-xs font-medium text-red-300">
          {failedStep.label} — {failedStep.outcome}
        </div>
      )}
      <p className="text-sm leading-relaxed">{turn.reply}</p>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        {turn.provenance && <ProvenanceBadge provenance={turn.provenance} />}
        <span>
          {turn.steps.length} steps ·{" "}
          {(turn.steps.reduce((n, s) => n + (s.tookMs ?? 0), 0) / 1000).toFixed(1)} s
        </span>
      </div>
    </div>
  );
}

export function VariantB() {
  const t = useProtoTurns();
  const now = useNow(t.busy);
  const turn = t.current;
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <main className="relative min-h-0 flex-1 bg-[#05060a]">
        <SimpleScene system={t.system} dimmed={t.busy} />
        <div className="absolute top-3 left-4 flex items-center gap-3">
          <span className="text-sm font-semibold">{t.system ?? "No System loaded"}</span>
          {t.system && turn?.provenance && <ProvenanceBadge provenance={turn.provenance} />}
        </div>
        {turn?.status === "running" && <Stepper turn={turn} now={now} />}
        {turn && turn.status !== "running" && <Caption turn={turn} />}
      </main>
      <footer className="border-t border-border bg-card px-4 pt-2 pb-16">
        <div className="mb-2 truncate text-xs text-muted-foreground">
          {turn
            ? `You: “${turn.question}”`
            : "Ask about a planetary system, e.g. “Open TRAPPIST-1.”"}
        </div>
        <AskBox t={t} />
      </footer>
    </div>
  );
}
