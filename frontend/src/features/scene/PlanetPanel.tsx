import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanetDetails } from "./prototype/PROTOTYPE_PlanetDetails";
import { useProto } from "./prototype/PROTOTYPE_store";

/** Right panel: properties of the selected planet, each with unit and provenance. */
export function PlanetPanel() {
  const selected = useProto((s) => s.selectedId);
  return (
    <aside aria-label="Selected planet" className="min-h-0 overflow-y-auto bg-card p-3">
      {selected !== null ? (
        <PlanetDetails />
      ) : (
        <Card size="sm">
          <CardHeader>
            <CardTitle>No planet selected</CardTitle>
            <CardDescription>
              Open a System, then click a planet to see its properties and where each value comes
              from.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}
    </aside>
  );
}
