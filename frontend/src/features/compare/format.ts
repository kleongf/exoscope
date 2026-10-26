import type { QuantityParts } from "@/features/scene/quantity";
import type { AxisView, ComparisonView, ExclusionView, ValueView } from "./types";

const EXCLUSION_TEXT: Record<ExclusionView, string> = {
  missing_x: "missing x value",
  missing_y: "missing y value",
  missing_both: "missing both values",
  limit_only: "only a limit, not a measurement",
};

export function axisTitle(axis: AxisView): string {
  return axis.unit ? `${axis.label} (${axis.unit})` : axis.label;
}

export function exclusionText(reason: ExclusionView): string {
  return EXCLUSION_TEXT[reason];
}

function trim(n: number): string {
  return Number(n.toPrecision(4)).toString();
}

/** formatValue split into colourable pieces (units live in the column header here). */
export function valueParts(v: ValueView): QuantityParts {
  const base = { missing: false, limit: "", uncertainty: "", unit: "" };
  if (v.status === "missing") return { ...base, missing: true, value: "missing" };
  if (v.limit === "upper") return { ...base, limit: "< ", value: trim(v.value) };
  if (v.limit === "lower") return { ...base, limit: "> ", value: trim(v.value) };
  if (v.errLo === null || v.errHi === null) return { ...base, value: trim(v.value) };
  const uncertainty =
    trim(v.errLo) === trim(v.errHi)
      ? ` ± ${trim(v.errHi)}`
      : ` +${trim(v.errHi)}/−${trim(v.errLo)}`;
  return { ...base, value: trim(v.value), uncertainty };
}

/** "0.92 +0.013/−0.013", "< 1.2", or "missing". Never renders a missing value as 0. */
export function formatValue(v: ValueView): string {
  const p = valueParts(v);
  return `${p.limit}${p.value}${p.uncertainty}`;
}

export function countRows(c: ComparisonView): { plotted: number; excluded: number } {
  const excluded = c.rows.filter((r) => r.excluded !== null).length;
  return { plotted: c.rows.length - excluded, excluded };
}

/** Short planet label for markers: "TRAPPIST-1 e" → "e". */
export function shortName(planet: string, hostname: string): string {
  return planet.startsWith(`${hostname} `) ? planet.slice(hostname.length + 1) : planet;
}
