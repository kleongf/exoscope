// PROTOTYPE (prototype/turn-ui): mounts the selected variant plus the switcher.
import { useState } from "react";
import { PrototypeSwitcher } from "@/components/PrototypeSwitcher";
import { readVariant } from "@/components/prototypeVariant";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VariantA, variantAName } from "./PROTOTYPE-VariantA";
import { VariantB, variantBName } from "./PROTOTYPE-VariantB";
import { VariantC, variantCName } from "./PROTOTYPE-VariantC";

const VARIANTS = [
  { key: "A", name: variantAName },
  { key: "B", name: variantBName },
  { key: "C", name: variantCName },
];

export function TurnVariants() {
  const [variant, setVariant] = useState(() => readVariant(VARIANTS.map((v) => v.key)));
  return (
    <TooltipProvider>
      {variant === "A" && <VariantA key="A" />}
      {variant === "B" && <VariantB key="B" />}
      {variant === "C" && <VariantC key="C" />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={setVariant} />
    </TooltipProvider>
  );
}
