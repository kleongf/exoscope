// PROTOTYPE switcher — throwaway. Shared floating bar for `?variant=` UI prototypes.
//
// Question (issue #5): "How should the System view present TRAPPIST-1 so it is both compelling
// and scientifically honest — real Keplerian orbits from the archive, exaggerated sizes, an
// edge-on system, extrapolated positions — and where do the caveats live?"
//
// Plan: three variants of the System view, switchable via `?variant=A|B|C`, mounted inside the
// existing workbench (centre panel). Hidden in production builds.
/* eslint-disable react-refresh/only-export-components -- PROTOTYPE helpers live beside components */
import { useEffect, useSyncExternalStore } from "react";

const EVENT = "prototype-variant-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useVariant(keys: readonly string[]): string {
  const raw = useSyncExternalStore(subscribe, () =>
    new URLSearchParams(window.location.search).get("variant"),
  );
  return raw !== null && keys.includes(raw) ? raw : (keys[0] ?? "A");
}

function setVariant(v: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("variant", v);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(EVENT));
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function PrototypeSwitcher({
  variants,
  current,
}: {
  variants: readonly { key: string; name: string }[];
  current: string;
}) {
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );
  const step = (d: number) => {
    const next = variants[(index + d + variants.length) % variants.length];
    if (next) setVariant(next.key);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  });

  if (import.meta.env.PROD) return null;
  const v = variants[index];
  return (
    <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border-2 border-fuchsia-400 bg-black/90 px-3 py-1.5 font-mono text-xs text-fuchsia-200 shadow-[0_0_24px_rgba(232,121,249,0.35)]">
      <button
        type="button"
        aria-label="Previous variant"
        className="px-1"
        onClick={() => {
          step(-1);
        }}
      >
        ←
      </button>
      <span data-testid="prototype-variant">
        PROTOTYPE {v?.key} ({v?.name})
      </span>
      <button
        type="button"
        aria-label="Next variant"
        className="px-1"
        onClick={() => {
          step(1);
        }}
      >
        →
      </button>
    </div>
  );
}
