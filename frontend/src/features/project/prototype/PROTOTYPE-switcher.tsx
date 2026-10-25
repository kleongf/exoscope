// PROTOTYPE (throwaway) — issue #15, Project explorer + Project switcher.
//
// QUESTION: "How should a student see, navigate and switch the Projects that organise their
// work — what's in a Project, what did they do, and how do they get back to it?"
//
// Three variants of the workbench's LEFT panel on the real route, switchable with ?variant=A|B|C
// (←/→ also cycle). Without ?variant the real ProjectExplorer renders unchanged. DEV only: in a
// production build neither the variants nor this switcher bar can appear.
//   A — Grouped list: today's sections with counts, collapsible; switcher = header dropdown.
//   B — Timeline: what the student did, in order, filterable; switcher = Projects home list.
//   C — Cards / board: each item a card with a tiny preview; switcher = tabs.
// Stub data only (PROTOTYPE-data.ts); clicking an item shows what "reopen" would do.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useStubProjects } from "./PROTOTYPE-data";
import { ReopenToast } from "./PROTOTYPE-shared";
import { VariantA } from "./PROTOTYPE-VariantA";
import { VariantB } from "./PROTOTYPE-VariantB";
import { VariantC } from "./PROTOTYPE-VariantC";

const VARIANTS = { A: VariantA, B: VariantB, C: VariantC } as const;
type Key = keyof typeof VARIANTS;
const KEYS = Object.keys(VARIANTS) as Key[];

function readVariant(): Key | null {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(location.search).get("variant")?.toUpperCase();
  return v !== undefined && v in VARIANTS ? (v as Key) : null;
}

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** The prototype variant named in the URL, kept in sync with ←/→ and the floating bar. */
export function usePrototypeVariant() {
  const [variant, setVariant] = useState<Key | null>(readVariant);
  const go = (step: number) => {
    setVariant((current) => {
      if (current === null) return current;
      const next = KEYS[(KEYS.indexOf(current) + step + KEYS.length) % KEYS.length] ?? current;
      const url = new URL(location.href);
      url.searchParams.set("variant", next);
      history.replaceState(null, "", url);
      return next;
    });
  };
  useEffect(() => {
    if (variant === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [variant === null]); // eslint-disable-line react-hooks/exhaustive-deps
  return { variant, go };
}

/** The left panel for the chosen variant, sharing one in-memory set of stub Projects. */
export function PrototypeExplorer({ variant }: { variant: Key }) {
  const stub = useStubProjects();
  const Variant = VARIANTS[variant];
  return (
    <>
      <Variant stub={stub} />
      <ReopenToast
        item={stub.reopened}
        onClose={() => {
          stub.reopen(null);
        }}
      />
    </>
  );
}

export function PrototypeSwitcherBar({
  variant,
  go,
}: {
  variant: Key;
  go: (step: number) => void;
}) {
  if (!import.meta.env.DEV) return null;
  return (
    <div
      data-testid="prototype-switcher"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border-2 border-fuchsia-500 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 shadow-xl"
    >
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => {
          go(-1);
        }}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span>
        PROTOTYPE · {variant} ({VARIANTS[variant].label})
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => {
          go(1);
        }}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
