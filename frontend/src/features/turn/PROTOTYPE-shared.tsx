// PROTOTYPE (prototype/turn-ui): small pieces every variant reuses (not layout).
import { AlertTriangle, Check, Circle, Database, Loader2, Radio } from "lucide-react";
import { useState, type SyntheticEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Provenance, StepStatus } from "./PROTOTYPE-turnRunner";
import type { ProtoTurns } from "./PROTOTYPE-useTurns";

export function StepIcon({ status }: { status: StepStatus }) {
  if (status === "running") return <Loader2 className="size-4 animate-spin text-sky-400" />;
  if (status === "done") return <Check className="size-4 text-emerald-400" />;
  if (status === "failed") return <AlertTriangle className="size-4 text-red-400" />;
  return <Circle className="size-4 text-muted-foreground/40" />;
}

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const live = provenance.mode === "live";
  return (
    <Badge
      variant="outline"
      className={
        live ? "border-emerald-500/50 text-emerald-300" : "border-amber-500/50 text-amber-300"
      }
    >
      {live ? <Radio /> : <Database />}
      {provenance.label}
    </Badge>
  );
}

/** Text box plus the prototype's demo shortcuts (quick questions, simulated NASA outage). */
export function AskBox({ t, placeholder }: { t: ProtoTurns; placeholder?: string }) {
  const [text, setText] = useState("");
  const submit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!text.trim() || t.busy) return;
    t.ask(text);
    setText("");
  };
  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          aria-label="Question"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          placeholder={placeholder ?? "Type a question…"}
          disabled={t.busy}
        />
        <Button type="submit" disabled={t.busy}>
          Ask
        </Button>
      </form>
      <DemoShortcuts t={t} />
    </div>
  );
}

function DemoShortcuts({ t }: { t: ProtoTurns }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Prototype:</span>
      {["Open TRAPPIST-1", "Open Planet Nonexistent"].map((q) => (
        <Button
          key={q}
          size="xs"
          variant="secondary"
          disabled={t.busy}
          onClick={() => {
            t.ask(q);
          }}
        >
          {q}
        </Button>
      ))}
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={t.outage}
          onChange={(e) => {
            t.setOutage(e.target.checked);
          }}
        />
        Simulate NASA outage
      </label>
    </div>
  );
}
