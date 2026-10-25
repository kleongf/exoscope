// PROTOTYPE (throwaway): small pieces every Project explorer variant uses — icons, the
// "reopened" toast, the mini chart and the empty-Project hint. No shared layout.
import { ChartScatter, FileText, Globe, Orbit, SlidersHorizontal, X } from "lucide-react";
import type { ComponentType } from "react";
import type { ItemKind, ProjectItem } from "./PROTOTYPE-data";

export const KIND_ICON: Record<ItemKind, ComponentType<{ className?: string }>> = {
  system: Orbit,
  sample: SlidersHorizontal,
  comparison: ChartScatter,
  source: Globe,
  report: FileText,
};

const REOPEN_EFFECT: Record<ItemKind, string> = {
  system: "would reload it in the System view",
  sample: "would refill the table and chart with this Sample",
  comparison: "would reopen its chart and table in the drawer",
  source: "would open the page in a new tab",
  report: "would open the Report in a new tab",
};

/** Stub for "clicking an item brings it back": a toast saying what would happen. */
export function ReopenToast({ item, onClose }: { item: ProjectItem | null; onClose: () => void }) {
  if (!item) return null;
  const Icon = KIND_ICON[item.kind];
  return (
    <div
      role="status"
      className="fixed top-4 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-start gap-2 rounded-lg border border-sky-400/40 bg-zinc-900 px-3 py-2 text-xs shadow-lg"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-sky-300" />
      <p>
        <span className="font-medium">Reopened “{item.title}”.</span>{" "}
        <span className="text-muted-foreground">
          In the real app this {REOPEN_EFFECT[item.kind]}.
        </span>
      </p>
      <button type="button" aria-label="Dismiss" onClick={onClose}>
        <X className="size-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

/** A tiny scatter used as a comparison preview. */
export function MiniChart({
  points,
  className,
}: {
  points: [number, number][];
  className?: string;
}) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => 6 + ((x - x0) / (x1 - x0 || 1)) * 88;
  const sy = (y: number) => 34 - ((y - y0) / (y1 - y0 || 1)) * 28;
  return (
    <svg viewBox="0 0 100 40" className={className} aria-hidden>
      <path d="M4 37 H97 M4 37 V3" className="stroke-zinc-600" fill="none" strokeWidth="0.8" />
      {points.map(([x, y]) => (
        <circle
          key={`${String(x)}-${String(y)}`}
          cx={sx(x)}
          cy={sy(y)}
          r="2.2"
          className="fill-sky-300"
        />
      ))}
    </svg>
  );
}

export function EmptyProjectHint({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">This Project is empty.</p>
      <p className="mt-1">
        Everything you open, compare, search, cite or report on will collect here.
      </p>
      {compact ? null : (
        <p className="mt-2">
          Try <span className="text-foreground">“Open TRAPPIST-1”</span> in the chat.
        </p>
      )}
    </div>
  );
}

export function StubNote() {
  return <p className="px-3 pb-2 text-[10px] text-amber-300/80">PROTOTYPE · stub Project data</p>;
}
