import type { Planet, System } from "@/api/client";
import { provenanceLabel } from "@/features/scene/provenance";
import { quantityText } from "@/features/scene/quantity";
import { planetTint } from "./tint";

/** Text carried on the AR model itself, so it stays visible inside any AR viewer. */
export function arLabelLines(planet: Planet, system: System): string[] {
  return [
    planet.name,
    `Radius: ${quantityText(planet.radius)}`,
    `Equilibrium temperature: ${quantityText(planet.equilibrium_temperature)}`,
    planetTint(planet.equilibrium_temperature).basis,
    `Size not to scale · ${provenanceLabel(system.provenance)}`,
  ];
}
