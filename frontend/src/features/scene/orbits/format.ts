/** Text formatting for archive values and simulated dates. */
import { dateFromJd, sigma } from "./maths";
import type { Quantity } from "./types";

const LIMIT_PREFIX = { upper: "< ", lower: "> " } as const;

/** "0.9200 ± 0.013 R⊕", "< 0.04", or "missing". Limits never show an error bar. */
export function formatQuantity(q: Quantity, digits = 4): string {
  if (q.value === null) return "missing";
  const v = Math.abs(q.value) >= 1e5 ? q.value.toFixed(5) : q.value.toPrecision(digits);
  const s = sigma(q);
  const prefix = q.limit === null ? "" : LIMIT_PREFIX[q.limit];
  const err = s === null || q.limit !== null ? "" : ` ± ${s.toPrecision(2)}`;
  return `${prefix}${v}${err}${q.unit === "" ? "" : ` ${q.unit}`}`;
}

export function formatJd(jd: number): string {
  return `${dateFromJd(jd).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
