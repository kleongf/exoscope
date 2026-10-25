import type { Quantity } from "@/api/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { quantityText } from "./quantity";

/** A measured value's source paper stays attached to the value, including keyboard access. */
export function QuantityValue({ quantity }: { quantity: Quantity }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help decoration-muted-foreground/50 underline decoration-dotted underline-offset-4"
        >
          {quantityText(quantity)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 flex-col items-start">
        {quantity.status === "measured" ? (
          <>
            {quantity.reference?.url ? (
              <a
                href={quantity.reference.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {quantity.reference.label} ↗
              </a>
            ) : (
              <span>{quantity.reference?.label ?? "Source paper missing"}</span>
            )}
            {quantity.note && <span>{quantity.note}</span>}
            <span>
              {quantity.err_lo === null && quantity.err_hi === null
                ? "Uncertainty missing"
                : "Uncertainties shown as lower / upper"}
            </span>
          </>
        ) : (
          <span>No measured value in the archive.</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
