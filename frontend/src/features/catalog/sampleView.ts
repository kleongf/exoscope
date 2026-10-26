import type { Sample, SamplePlanet } from "@/api/client";
import type { ComparisonView, ExclusionView, ValueView } from "@/features/compare/types";
import { provenanceLabel } from "@/features/scene/provenance";

type SampleValue = SamplePlanet["values"][string];

const FALLBACK_AXES = ["radius", "orbital_period", "insolation", "mass"];

/** Plot the Sample by the fields it was filtered on, then sensible defaults. */
export function sampleAxes(sample: Sample): [string, string] {
  const numeric = new Set(
    sample.fields.filter((f) => f.name !== "discovery_method").map((f) => f.name),
  );
  const ordered = [...sample.filters.map((f) => f.field), ...FALLBACK_AXES].filter(
    (name, index, all) => numeric.has(name) && all.indexOf(name) === index,
  );
  return [ordered[0] ?? "radius", ordered[1] ?? "orbital_period"];
}

function toValue(v: SampleValue | undefined): ValueView {
  if (v?.status !== "measured") return { status: "missing" };
  return {
    status: "measured",
    value: v.value,
    errLo: v.err_lo,
    errHi: v.err_hi,
    limit: v.limit,
    reference: v.reference ? { label: v.reference.label, url: v.reference.url } : null,
  };
}

function exclusion(x: ValueView, y: ValueView): ExclusionView | null {
  if (x.status === "missing" && y.status === "missing") return "missing_both";
  if (x.status === "missing") return "missing_x";
  if (y.status === "missing") return "missing_y";
  if (x.limit !== null || y.limit !== null) return "limit_only";
  return null;
}

/** "Showing 100 of 1,228 · 37 excluded for missing values" */
export function sampleCountLine(sample: Sample): string {
  const shown = sample.truncated
    ? `Showing ${sample.planets.length.toLocaleString()} of ${sample.matched.toLocaleString()}`
    : `${sample.matched.toLocaleString()} matched`;
  return `${shown} · ${sample.excluded.count.toLocaleString()} excluded for missing values`;
}

/** Map a Sample onto the chart/table view model shared with comparisons. */
export function toSampleView(sample: Sample): ComparisonView {
  const [xName, yName] = sampleAxes(sample);
  const field = (name: string) => sample.fields.find((f) => f.name === name);
  return {
    x: { label: field(xName)?.label ?? xName, unit: field(xName)?.unit ?? null, property: xName },
    y: { label: field(yName)?.label ?? yName, unit: field(yName)?.unit ?? null, property: yName },
    rows: sample.planets.map((p) => {
      const x = toValue(p.values[xName]);
      const y = toValue(p.values[yName]);
      return { planet: p.name, hostname: p.hostname, x, y, excluded: exclusion(x, y) };
    }),
    provenance: [`Sample · ${provenanceLabel(sample.provenance)}`, sampleCountLine(sample)],
    notes: sample.notes,
  };
}

function describe(f: Sample["filters"][number]): string {
  if (f.op === "between") return `${f.field} ${String(f.value)}–${String(f.upper)}`;
  if (f.op === "is_null") return `${f.field} missing`;
  return `${f.field} ${f.op} ${String(f.value)}`;
}

/** "radius < 2 · orbital_period < 10" for the Project explorer. */
export function sampleTitle(sample: Sample): string {
  return sample.filters.map(describe).join(" · ");
}
