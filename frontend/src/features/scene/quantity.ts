import type { Quantity } from "@/api/client";

const number = (value: number) => value.toLocaleString(undefined, { maximumSignificantDigits: 7 });

/** The pieces of a quantity's text, so each can be coloured; joined they equal quantityText. */
export interface QuantityParts {
  missing: boolean;
  /** "≤ ", "≥ " or "" */
  limit: string;
  value: string;
  /** " −0.012 / +0.014" or "" */
  uncertainty: string;
  /** " Earth radii", " (Earth radii)" for missing, or "" */
  unit: string;
}

export function quantityParts(quantity: Quantity): QuantityParts {
  if (quantity.status === "missing") {
    return {
      missing: true,
      limit: "",
      value: "Missing",
      uncertainty: "",
      unit: quantity.unit ? ` (${quantity.unit})` : "",
    };
  }
  const limit = quantity.limit === "upper" ? "≤ " : quantity.limit === "lower" ? "≥ " : "";
  const uncertainty =
    quantity.err_lo !== null || quantity.err_hi !== null
      ? ` −${quantity.err_lo === null ? "?" : number(quantity.err_lo)} / +${quantity.err_hi === null ? "?" : number(quantity.err_hi)}`
      : "";
  return {
    missing: false,
    limit,
    value: number(quantity.value),
    uncertainty,
    unit: quantity.unit ? ` ${quantity.unit}` : "",
  };
}

export function quantityText(quantity: Quantity) {
  const p = quantityParts(quantity);
  return `${p.limit}${p.value}${p.uncertainty}${p.unit}`;
}
