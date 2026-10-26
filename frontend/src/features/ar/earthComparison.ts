import type { Planet, Quantity } from "@/api/client";
import { quantityText } from "@/features/scene/quantity";

const MAX_BODY_RADIUS_M = 0.13;

type Measured = Extract<Quantity, { status: "measured" }>;

export interface ComparisonRadii {
  earth: number;
  planet: number;
  lower: number | null;
  upper: number | null;
}

export function earthComparisonUnavailable(radius: Quantity): string | null {
  return radius.status === "missing" ? "Radius missing in the archive" : null;
}

/** AR-space radii in metres. Normalisation changes display size, never the planet/Earth ratio. */
export function comparisonRadii(radius: Measured): ComparisonRadii {
  const lowerValue = radius.err_lo === null ? null : Math.max(0, radius.value - radius.err_lo);
  const upperValue = radius.err_hi === null ? null : radius.value + radius.err_hi;
  const largest = Math.max(1, upperValue ?? radius.value);
  const metresPerEarthRadius = MAX_BODY_RADIUS_M / largest;
  return {
    earth: metresPerEarthRadius,
    planet: radius.value * metresPerEarthRadius,
    lower: lowerValue === null ? null : lowerValue * metresPerEarthRadius,
    upper: upperValue === null ? null : upperValue * metresPerEarthRadius,
  };
}

function rangeText(radius: Measured): string {
  if (radius.err_lo === null && radius.err_hi === null) return "Uncertainty: missing";
  const format = (value: number) =>
    value.toLocaleString(undefined, { maximumSignificantDigits: 7 });
  const lower = radius.err_lo === null ? "?" : format(radius.value - radius.err_lo);
  const upper = radius.err_hi === null ? "?" : format(radius.value + radius.err_hi);
  return `±1σ range: ${lower}–${upper} ${radius.unit ?? ""}`.trim();
}

export function comparisonLabelLines(planet: Planet) {
  if (planet.radius.status === "missing") {
    throw new Error("A planet with a missing radius cannot be compared with Earth");
  }
  return {
    earth: [
      "Earth",
      "Radius: 1 Earth radius",
      "Uncertainty: not applicable",
      "Standard reference value · not archive data",
    ],
    planet: [
      planet.name,
      `Radius: ${quantityText(planet.radius)}`,
      rangeText(planet.radius),
      `Source paper: ${planet.radius.reference?.label ?? "missing"}`,
    ],
  };
}
