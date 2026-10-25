import type { System } from "../../api/client";

export function provenanceLabel(provenance: System["provenance"]) {
  if (provenance.mode === "snapshot") return `Cached · Snapshot ${provenance.snapshot_date}`;
  return `Live · fetched ${new Date(provenance.fetched_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
