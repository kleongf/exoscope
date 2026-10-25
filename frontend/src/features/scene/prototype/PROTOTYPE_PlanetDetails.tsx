// PROTOTYPE (issue #5): selected-planet values for the existing right panel. Every value shows
// its unit and ±; hovering it shows the source paper (shadcn Tooltip). Missing says "missing".
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { keplerPeriodDays, sigma, type ProtoPlanet, type ProtoQuantity } from "./PROTOTYPE_orbits";
import { TRAPPIST1 } from "./PROTOTYPE_trappist1";
import { useProto } from "./PROTOTYPE_store";
import { planetColor } from "./PROTOTYPE_sceneParts";

const ROWS: [keyof ProtoPlanet, string][] = [
  ["radius", "Radius"],
  ["mass", "Mass"],
  ["period", "Orbital period"],
  ["a", "Semi-major axis"],
  ["e", "Eccentricity"],
  ["omega", "Arg. of periastron ω"],
  ["incl", "Inclination"],
  ["insol", "Insolation"],
  ["eqt", "Equilibrium temp."],
  ["tranmid", "Transit epoch"],
];

function fmt(v: number): string {
  return Math.abs(v) >= 1e5 ? v.toFixed(5) : v.toPrecision(4);
}

function ValueRow({ label, q }: { label: string; q: ProtoQuantity }) {
  const s = sigma(q);
  const text =
    q.value === null
      ? "missing"
      : `${fmt(q.value)}${s === null ? "" : ` ± ${s.toPrecision(2)}`} ${q.unit}`;
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-white/5 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`cursor-help font-mono tabular-nums underline decoration-dotted decoration-white/30 underline-offset-2 ${q.value === null ? "text-amber-300" : ""}`}
          >
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">
          {q.ref === null ? "No source: value missing in the archive" : `Source: ${q.ref.label}`}
          <div className="opacity-70">Cached · Snapshot {TRAPPIST1.snapshotDate}</div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function PlanetDetails() {
  const id = useProto((s) => s.selectedId);
  const planet = TRAPPIST1.planets.find((p) => p.id === id);
  if (planet === undefined) return null;
  const a = planet.a.value;
  const m = TRAPPIST1.star.mass.value;
  const kepler = a !== null && m !== null ? keplerPeriodDays(a, m) : null;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle style={{ color: planetColor(planet) }}>{planet.id}</CardTitle>
        <CardDescription>Hover a value for its source paper.</CardDescription>
      </CardHeader>
      <CardContent>
        {ROWS.map(([key, label]) => (
          <ValueRow key={key} label={label} q={planet[key] as ProtoQuantity} />
        ))}
        {kepler !== null && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Kepler III check: a and M★ imply P = {kepler.toFixed(3)} d (archive{" "}
            {planet.period.value?.toFixed(3)} d).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
