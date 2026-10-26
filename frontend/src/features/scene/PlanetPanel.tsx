import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArButton } from "@/features/ar/ArButton";
import { useExoStore } from "@/store/store";
import { QuantityValue } from "./QuantityValue";
import { provenanceLabel } from "./provenance";

/** Floating properties for the selected canonical planet; no selection means no card. */
export function PlanetPanel() {
  const system = useExoStore((state) => state.system);
  const name = useExoStore((state) => state.focusedPlanetName);
  const select = useExoStore((state) => state.selectPlanet);
  const planet = system?.planets.find((item) => item.name === name);
  if (!planet || !system) return null;
  const properties = [
    ["Radius", planet.radius],
    ["Mass", planet.mass],
    ["Period", planet.orbital_period],
    ["Orbit distance", planet.semi_major_axis],
    ["Irradiation", planet.insolation],
    ["Equilibrium temperature", planet.equilibrium_temperature],
    ["Eccentricity", planet.eccentricity],
    ["Inclination", planet.inclination],
    ["Transit midpoint", planet.transit_midpoint],
    ["Argument of periastron", planet.argument_of_periastron],
  ] as const;
  return (
    <aside
      aria-label="Selected planet"
      className="absolute top-3 right-3 z-10 w-60 max-w-[calc(100%-1.5rem)]"
    >
      <Card size="sm" data-testid="planet-card" className="gap-2 py-3 shadow-lg">
        <CardHeader>
          <CardTitle className="text-sm">{planet.name}</CardTitle>
          <CardDescription className="text-[10px]">
            {provenanceLabel(system.provenance)}
          </CardDescription>
          <CardAction>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Close planet properties"
              onClick={() => {
                select(null);
              }}
            >
              <X />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {/* Compact: about five properties visible, the rest scroll. */}
          <ScrollArea className="h-40">
            <dl className="space-y-1.5 pr-3 text-[11px]">
              {properties.map(([label, quantity]) => (
                <div key={label}>
                  <dt className="text-[10px] text-muted-foreground">{label}</dt>
                  <dd>
                    <QuantityValue quantity={quantity} />
                  </dd>
                </div>
              ))}
            </dl>
          </ScrollArea>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Source papers may differ between properties.
          </p>
          <div className="mt-2">
            <ArButton planet={planet} system={system} />
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
