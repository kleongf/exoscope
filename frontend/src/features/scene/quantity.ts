import type { Quantity } from "@/api/client";

const number = (value: number) => value.toLocaleString(undefined, { maximumSignificantDigits: 7 });
export function quantityText(quantity: Quantity) {
  if (quantity.status === "missing") return `Missing${quantity.unit ? ` (${quantity.unit})` : ""}`;
  const limit = quantity.limit === "upper" ? "≤ " : quantity.limit === "lower" ? "≥ " : "";
  const uncertainty =
    quantity.err_lo !== null || quantity.err_hi !== null
      ? ` −${quantity.err_lo === null ? "?" : number(quantity.err_lo)} / +${quantity.err_hi === null ? "?" : number(quantity.err_hi)}`
      : "";
  return `${limit}${number(quantity.value)}${uncertainty}${quantity.unit ? ` ${quantity.unit}` : ""}`;
}
