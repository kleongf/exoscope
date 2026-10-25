/**
 * Floating card for the top-right of the System view: the selected planet's values with units,
 * uncertainties and limits. Hovering a row shows its source paper. The whole row is the tooltip
 * trigger and the tooltip opens outside the card's left edge, so it never covers other rows.
 */
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatQuantity } from "./format";
import { keplerPeriodDays } from "./maths";
import { provenanceLabel, type OrbitPlanet, type OrbitSystem, type Quantity } from "./types";

type QuantityKey = {
  [K in keyof OrbitPlanet]: OrbitPlanet[K] extends Quantity ? K : never;
}[keyof OrbitPlanet];

const ROWS: { key: QuantityKey; label: string }[] = [
  { key: "radius", label: "Radius" },
  { key: "mass", label: "Mass" },
  { key: "period", label: "Orbital period" },
  { key: "semiMajorAxis", label: "Semi-major axis" },
  { key: "eccentricity", label: "Eccentricity" },
  { key: "periastronArg", label: "Arg. of periastron ω" },
  { key: "inclination", label: "Inclination" },
  { key: "insolation", label: "Insolation" },
  { key: "eqTemp", label: "Equilibrium temp." },
  { key: "transitEpoch", label: "Transit epoch" },
];

function ValueRow({ label, q, provenance }: { label: string; q: Quantity; provenance: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex cursor-help items-baseline justify-between gap-3 border-b border-white/5 py-1 text-xs hover:bg-white/5">
          <span className="text-muted-foreground">{label}</span>
          <span className={`font-mono tabular-nums ${q.value === null ? "text-amber-300" : ""}`}>
            {formatQuantity(q)}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" align="center" sideOffset={20} collisionPadding={8}>
        <div>
          {q.source === null
            ? "No source: this value is missing in the archive"
            : `Source: ${q.source.label}`}
          <div className="opacity-70">{provenance} · pscomppars</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function KeplerCheck({ planet, system }: { planet: OrbitPlanet; system: OrbitSystem }) {
  const a = planet.semiMajorAxis.value;
  const m = system.star.mass.value;
  const p = planet.period.value;
  if (a === null || m === null || p === null) return null;
  return (
    <p className="mt-2 text-[11px] text-muted-foreground">
      Kepler III check: a and M★ imply P = {keplerPeriodDays(a, m).toFixed(3)} d (archive{" "}
      {p.toFixed(3)} d).
    </p>
  );
}

interface PlanetCardProps {
  system: OrbitSystem;
  planetName: string | null;
  onClose: () => void;
  className?: string;
}

export function PlanetCard({ system, planetName, onClose, className = "" }: PlanetCardProps) {
  const planet = system.planets.find((p) => p.name === planetName);
  if (planet === undefined) return null;
  const provenance = provenanceLabel(system.provenance);
  return (
    <Card
      size="sm"
      className={`w-80 bg-card/95 backdrop-blur ${className}`}
      data-testid="planet-card"
    >
      <CardHeader>
        <CardTitle>{planet.name}</CardTitle>
        <CardDescription>Hover a row for its source paper.</CardDescription>
        <CardAction>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Close planet details"
            onClick={onClose}
          >
            <X />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {ROWS.map(({ key, label }) => (
          <ValueRow key={key} label={label} q={planet[key]} provenance={provenance} />
        ))}
        <KeplerCheck planet={planet} system={system} />
      </CardContent>
    </Card>
  );
}
