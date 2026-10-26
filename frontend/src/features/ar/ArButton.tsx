import { Box } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { Planet, System } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArViewer } from "./ArViewer";
import { arLabelLines } from "./label";
import { planetGlb } from "./planetModel";
import { planetTint } from "./tint";

/** "View in AR" for the selected planet: a schematic model the phone can place on a surface. */
export function ArButton({ planet, system }: { planet: Planet; system: System }) {
  const lines = useMemo(() => arLabelLines(planet, system), [planet, system]);
  const { color } = planetTint(planet.equilibrium_temperature);
  const buildModel = useCallback(() => planetGlb(color, lines), [color, lines]);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <Box /> View in AR
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="ar-dialog">
        <DialogHeader>
          <DialogTitle>{planet.name} in AR</DialogTitle>
          <DialogDescription>
            A schematic model, not a photograph. Walk around it and pinch to resize.
          </DialogDescription>
        </DialogHeader>
        <ArViewer buildModel={buildModel} alt={`Schematic model of ${planet.name}`} />
        <ul className="text-xs text-muted-foreground" data-testid="ar-label">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
