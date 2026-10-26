/**
 * View model for a comparison chart and table.
 *
 * This is a display shape, not an API type: once `compare` is exposed through `/turn`,
 * map the generated API Comparison onto it.
 */

export interface ReferenceView {
  label: string;
  url: string | null;
}

export type ValueView =
  | {
      status: "measured";
      value: number;
      errLo: number | null;
      errHi: number | null;
      limit: "upper" | "lower" | null;
      reference: ReferenceView | null;
    }
  | { status: "missing" };

export type ExclusionView = "missing_x" | "missing_y" | "missing_both" | "limit_only";

export interface AxisView {
  label: string;
  unit: string | null;
  /** Archive property key (e.g. "radius"), which picks the axis colour. */
  property?: string | undefined;
}

export interface ComparisonRowView {
  /** Canonical archive pl_name: links chart, table and System view. */
  planet: string;
  hostname: string;
  x: ValueView;
  y: ValueView;
  excluded: ExclusionView | null;
}

export interface ComparisonView {
  x: AxisView;
  y: AxisView;
  rows: ComparisonRowView[];
  /** One line per System, e.g. "TRAPPIST-1 · Cached · Snapshot 2026-10-25". */
  provenance: string[];
  notes: string[];
}

export interface LinkedSelection {
  selected: string | null;
  onSelectPlanet: (planet: string) => void;
}
