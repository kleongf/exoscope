/*
 * PROTOTYPE switcher (branch prototype/turn-ui) — issue #4.
 *
 * Question: A turn takes ~5–8 s (measured: Gemma 4 26b tool call ~3 s, live load_system
 * ~2.2 s, final reply ~2 s). How should the workbench show a turn in progress and its
 * result — transcript, tool activity, Live/Cached label, honest failure — so the wait
 * feels purposeful in a live demo?
 *
 * Plan: three variants of the workbench, switchable via `?variant=A|B|C` on the existing
 * route. ← / → cycle (ignored while typing). Hidden in production builds.
 */
import { useEffect } from "react";

export interface PrototypeVariant {
  key: string;
  name: string;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: {
  variants: PrototypeVariant[];
  current: string;
  onChange: (key: string) => void;
}) {
  const idx = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );
  const go = (delta: number) => {
    const next = variants[(idx + delta + variants.length) % variants.length];
    if (!next) return;
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next.key);
    window.history.replaceState(null, "", url);
    onChange(next.key);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  });

  if (import.meta.env.PROD) return null;
  const v = variants[idx];
  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2 py-1 text-sm font-medium text-black shadow-[0_4px_24px_rgba(0,0,0,0.6)] ring-2 ring-fuchsia-500">
      <button
        type="button"
        aria-label="Previous variant"
        className="rounded-full px-2 hover:bg-black/10"
        onClick={() => {
          go(-1);
        }}
      >
        ←
      </button>
      <span className="min-w-56 text-center" data-testid="variant-label">
        PROTOTYPE · {v?.key} ({v?.name})
      </span>
      <button
        type="button"
        aria-label="Next variant"
        className="rounded-full px-2 hover:bg-black/10"
        onClick={() => {
          go(1);
        }}
      >
        →
      </button>
    </div>
  );
}
