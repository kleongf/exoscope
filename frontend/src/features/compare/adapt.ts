import type { Comparison, Quantity } from "@/api/client";
import { provenanceLabel } from "@/features/scene/provenance";
import type { ComparisonView, ValueView } from "./types";

function toValue(q: Quantity): ValueView {
  if (q.status === "missing") return { status: "missing" };
  return {
    status: "measured",
    value: q.value,
    errLo: q.err_lo,
    errHi: q.err_hi,
    limit: q.limit,
    reference: q.reference ? { label: q.reference.label, url: q.reference.url } : null,
  };
}

/** Map the generated API Comparison onto the chart/table view model. */
export function toComparisonView(c: Comparison): ComparisonView {
  return {
    x: { label: c.x.label, unit: c.x.unit, property: c.x.property },
    y: { label: c.y.label, unit: c.y.unit, property: c.y.property },
    rows: c.rows.map((r) => ({
      planet: r.planet,
      hostname: r.hostname,
      x: toValue(r.x),
      y: toValue(r.y),
      excluded: r.excluded,
    })),
    provenance: c.provenance.map((p) => `${p.hostname} · ${provenanceLabel(p.provenance)}`),
    notes: c.notes,
  };
}

/** "Insolation vs Planet radius · TRAPPIST-1" for lists such as the Project explorer. */
export function comparisonTitle(c: Comparison): string {
  const hosts = [...new Set(c.rows.map((r) => r.hostname))].join(", ");
  return `${c.y.label} vs ${c.x.label} · ${hosts}`;
}
