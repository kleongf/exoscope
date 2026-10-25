import { PrototypeSwitcher, useVariant } from "@/components/PROTOTYPE_VariantSwitcher";
import { useProtoClock } from "./prototype/PROTOTYPE_store";
import { VARIANT_A_NAME, VariantA } from "./prototype/PROTOTYPE_VariantA";
import { VARIANT_B_NAME, VariantB } from "./prototype/PROTOTYPE_VariantB";
import { VARIANT_C_NAME, VariantC } from "./prototype/PROTOTYPE_VariantC";

// PROTOTYPE (issue #5): three System view variants switchable via ?variant=A|B|C.
const VARIANTS = [
  { key: "A", name: VARIANT_A_NAME },
  { key: "B", name: VARIANT_B_NAME },
  { key: "C", name: VARIANT_C_NAME },
] as const;
const KEYS = VARIANTS.map((v) => v.key);

/** The System view: exactly one System in 3D. */
export function SystemView() {
  useProtoClock();
  const variant = useVariant(KEYS);
  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </>
  );
}
