import { propertyColor } from "@/lib/palette";

import type { QuantityParts } from "./quantity";

/**
 * A quantity coloured by part: the value (in its property's hue when known), dim
 * uncertainty, soft unit, amber "Missing", fuchsia limit sign. Text content is unchanged.
 */
export function ColouredQuantity({
  parts,
  property,
}: {
  parts: QuantityParts;
  property?: string | null | undefined;
}) {
  // A fragment, not a wrapper: the caller's element (e.g. a focusable tooltip trigger)
  // stays the one whose text is the whole quantity.
  if (parts.missing) {
    return (
      <>
        <span className="text-qty-missing italic">{parts.value}</span>
        <span className="text-qty-missing/70 italic">{parts.unit}</span>
      </>
    );
  }
  return (
    <>
      {parts.limit && <span className="font-semibold text-qty-limit">{parts.limit}</span>}
      <span
        className="font-semibold text-qty-value"
        style={property ? { color: propertyColor(property) } : undefined}
      >
        {parts.value}
      </span>
      {parts.uncertainty && <span className="text-qty-err">{parts.uncertainty}</span>}
      {parts.unit && <span className="text-qty-unit">{parts.unit}</span>}
    </>
  );
}

/** A small chip naming a property in its hue (planet card labels, legends). */
export function PropertyLabel({
  property,
  label,
}: {
  property?: string | null | undefined;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: propertyColor(property) }}
      />
      <span style={{ color: propertyColor(property) }}>{label}</span>
    </span>
  );
}
