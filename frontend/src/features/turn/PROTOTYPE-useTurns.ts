// PROTOTYPE (prototype/turn-ui): in-memory turn state shared by every variant.
import { useCallback, useEffect, useRef, useState } from "react";
import { runTurn, type Turn } from "./PROTOTYPE-turnRunner";

export interface ProtoTurns {
  turns: Turn[];
  current: Turn | undefined;
  busy: boolean;
  /** The System currently in the scene (unchanged by a failed turn). */
  system: string | null;
  outage: boolean;
  setOutage: (on: boolean) => void;
  ask: (question: string) => void;
}

export function useProtoTurns(): ProtoTurns {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [outage, setOutage] = useState(false);
  const [system, setSystem] = useState<string | null>(null);
  const nextId = useRef(1);
  const current = turns.at(-1);
  const busy = current?.status === "running";

  const ask = useCallback(
    (question: string) => {
      const id = nextId.current++;
      void runTurn(id, question, outage, (turn) => {
        setTurns((all) => [...all.filter((t) => t.id !== id), turn]);
        if (turn.status === "done" && turn.loadedSystem) setSystem(turn.loadedSystem);
      });
    },
    [outage],
  );

  return { turns, current, busy, system, outage, setOutage, ask };
}

/** Seconds elapsed since the turn started, for "3.4 s" style timers. */
export function elapsed(turn: Turn, now: number): string {
  return `${((now - turn.startedAt) / 1000).toFixed(1)} s`;
}

/** Re-render every 100 ms while something is running, for live timers. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setNow(Date.now());
    }, 100);
    return () => {
      clearInterval(t);
    };
  }, [active]);
  return now;
}
