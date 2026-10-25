import type { System } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useExoStore } from "@/store/store";
import { QuantityValue } from "./QuantityValue";

export function SystemEvidence({ system }: { system: System }) {
  const select = useExoStore((state) => state.selectPlanet);
  return (
    <div className="border-t bg-card p-3" aria-label="Archive evidence">
      <Table>
        <TableCaption>
          {system.hostname} · {system.provenance.source}. Values may use different source papers.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Planet</TableHead>
            <TableHead>Radius</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Orbit distance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {system.planets.map((planet) => (
            <TableRow key={planet.name}>
              <TableCell>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    select(planet.name);
                  }}
                >
                  {planet.name}
                </Button>
              </TableCell>
              <TableCell>
                <QuantityValue quantity={planet.radius} />
              </TableCell>
              <TableCell>
                <QuantityValue quantity={planet.orbital_period} />
              </TableCell>
              <TableCell>
                <QuantityValue quantity={planet.semi_major_axis} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {system.planets.some(
        (planet) =>
          planet.semi_major_axis.status === "missing" || planet.semi_major_axis.value <= 0,
      ) && (
        <p className="mt-2 text-xs text-muted-foreground">
          Planets with missing or unusable orbit distances remain in the table and are not
          positioned in the System view.
        </p>
      )}
      {system.notes.map((note) => (
        <p className="mt-2 text-xs text-muted-foreground" key={note}>
          {note}
        </p>
      ))}
    </div>
  );
}
