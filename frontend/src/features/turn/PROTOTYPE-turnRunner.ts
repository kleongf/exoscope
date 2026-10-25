// PROTOTYPE (prototype/turn-ui): throwaway stub of a /turn round-trip with realistic delays.
// Measured 2026-10-25: Gemma 4 26b tool call ~3 s, live load_system ~2.2 s, reply ~2 s,
// TAP timeout before Snapshot fallback 5 s. No backend, no keys.

export type StepStatus = "pending" | "running" | "done" | "failed";

export interface Step {
  id: string;
  /** Plain-language label shown to students. */
  label: string;
  /** The real tool call / detail, shown where a variant wants it. */
  detail: string;
  durationMs: number;
  status: StepStatus;
  /** Wall-clock ms the step actually took, once finished. */
  tookMs?: number;
  outcome?: string;
}

export interface Provenance {
  mode: "live" | "snapshot";
  label: string;
}

export interface Turn {
  id: number;
  question: string;
  status: "running" | "done" | "failed";
  startedAt: number;
  steps: Step[];
  reply?: string;
  provenance?: Provenance;
  /** Name of the System the scene shows after this turn, if it changed. */
  loadedSystem?: string;
}

export interface Scenario {
  steps: Omit<Step, "status">[];
  failAt?: string;
  reply: string;
  provenance?: Provenance;
  loadedSystem?: string;
}

const hhmm = () => new Date().toTimeString().slice(0, 5);

const heard = { id: "heard", label: "Heard your question", detail: "POST /turn", durationMs: 150 };
const choose = {
  id: "choose",
  label: "Gemma is choosing a tool",
  detail: "gemma-4-26b-a4b-it · tool selection",
  durationMs: 3000,
};
const validate = {
  id: "validate",
  label: "Checking scene commands",
  detail: "validate ui_commands",
  durationMs: 200,
};
const reply = {
  id: "reply",
  label: "Gemma is writing the answer",
  detail: "gemma-4-26b-a4b-it · final reply",
  durationMs: 2000,
};

/** Pick the stubbed scenario for a question. `outage` simulates NASA being unreachable. */
export function scenarioFor(question: string, outage: boolean): Scenario {
  const q = question.toLowerCase();
  if (!q.includes("trappist")) {
    return {
      steps: [
        heard,
        choose,
        {
          id: "load",
          label: "Looking up “Planet Nonexistent” in the NASA archive",
          detail: 'load_system("Planet Nonexistent")',
          durationMs: 1100,
          outcome: "No System with that name (unknown_system)",
        },
        { ...reply, label: "Gemma is explaining what went wrong" },
      ],
      failAt: "load",
      reply:
        "I couldn’t find a System called “Planet Nonexistent” in the NASA Exoplanet Archive, so I left the view unchanged. Check the spelling, or try a host star name like “TRAPPIST-1”.",
    };
  }
  const load = outage
    ? {
        id: "load",
        label: "NASA archive didn’t answer, so using the saved Snapshot",
        detail: 'load_system("TRAPPIST-1") · TAP timeout 5 s → Snapshot',
        durationMs: 5100,
        outcome: "7 planets · Cached · Snapshot 2026-10-25",
      }
    : {
        id: "load",
        label: "Fetching TRAPPIST-1 live from the NASA archive",
        detail: 'load_system("TRAPPIST-1") · pscomppars',
        durationMs: 2200,
        outcome: "7 planets · Live",
      };
  return {
    steps: [heard, choose, load, validate, reply],
    reply:
      "Here’s TRAPPIST-1: an ultracool dwarf with seven roughly Earth-sized planets, all within 0.062 AU of the star — closer than Mercury is to the Sun. Planet sizes are exaggerated so you can see them.",
    provenance: outage
      ? { mode: "snapshot", label: "Cached · Snapshot 2026-10-25" }
      : { mode: "live", label: `Live · fetched ${hhmm()}` },
    loadedSystem: "TRAPPIST-1",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run a scenario, calling `emit` with the updated turn after every step change. */
export async function runTurn(
  id: number,
  question: string,
  outage: boolean,
  emit: (turn: Turn) => void,
): Promise<void> {
  const sc = scenarioFor(question, outage);
  let turn: Turn = {
    id,
    question,
    status: "running",
    startedAt: Date.now(),
    steps: sc.steps.map((s) => ({ ...s, status: "pending" as const })),
  };
  const update = (stepId: string, patch: Partial<Step>) => {
    turn = { ...turn, steps: turn.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) };
    emit(turn);
  };
  emit(turn);
  for (const step of sc.steps) {
    update(step.id, { status: "running" });
    await sleep(step.durationMs);
    const failed = sc.failAt === step.id;
    update(step.id, { status: failed ? "failed" : "done", tookMs: step.durationMs });
  }
  turn = {
    ...turn,
    status: sc.failAt ? "failed" : "done",
    reply: sc.reply,
    ...(sc.provenance ? { provenance: sc.provenance } : {}),
    ...(sc.loadedSystem ? { loadedSystem: sc.loadedSystem } : {}),
  };
  emit(turn);
}
