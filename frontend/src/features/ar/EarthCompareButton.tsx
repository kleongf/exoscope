import { Scale } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { Planet } from "@/api/client";
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
import { comparisonLabelLines, earthComparisonUnavailable } from "./earthComparison";
import { earthComparisonGlb } from "./earthComparisonModel";

export function EarthCompareButton({ planet }: { planet: Planet }) {
  const unavailable = earthComparisonUnavailable(planet.radius);
  if (unavailable) {
    return (
      <div className="space-y-1.5">
        <Button size="sm" variant="outline" className="w-full" disabled>
          <Scale /> Compare with Earth in AR
        </Button>
        <p className="text-xs text-muted-foreground" data-testid="ar-compare-unavailable">
          {unavailable}
        </p>
      </div>
    );
  }
  return <AvailableEarthComparison planet={planet} />;
}

function AvailableEarthComparison({ planet }: { planet: Planet }) {
  const labels = useMemo(() => comparisonLabelLines(planet), [planet]);
  const buildModel = useCallback(() => earthComparisonGlb(planet), [planet]);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <Scale /> Compare with Earth in AR
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="ar-compare-dialog">
        <DialogHeader>
          <DialogTitle>Earth and {planet.name} in AR</DialogTitle>
          <DialogDescription>
            Both bodies use the same radius scale. The faint shell marks the planet&apos;s ±1σ
            radius range.
          </DialogDescription>
        </DialogHeader>
        <ArViewer
          buildModel={buildModel}
          alt={`Earth and ${planet.name} at the same radius scale`}
          startLabel="Place comparison in your room"
        />
        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          {[labels.earth, labels.planet].map((lines) => (
            <ul key={lines[0]} data-testid="ar-compare-label">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
