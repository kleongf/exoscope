import { Orbit } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { OrbitSystem } from "@/features/scene/orbits/types";
import { ArViewer } from "./ArViewer";
import { systemGlb } from "./systemModel";
import { systemSnapshot, type SystemSnapshot } from "./systemSnapshot";

interface ArSystemButtonProps {
  system: OrbitSystem;
  /** The System view's current simulated time (JD); read once, when the dialog opens. */
  getJd: () => number;
}

/** "View System in AR": a frozen miniature of the open System for the table. */
export function ArSystemButton({ system, getJd }: ArSystemButtonProps) {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const build = useCallback(
    () => (snapshot ? systemGlb(snapshot) : Promise.reject(new Error("no snapshot"))),
    [snapshot],
  );
  return (
    <Dialog
      onOpenChange={(open) => {
        setSnapshot(open ? systemSnapshot(system, getJd()) : null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="xs" variant="outline" className="bg-black/70 text-white">
          <Orbit /> View System in AR
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="ar-system-dialog">
        <DialogHeader>
          <DialogTitle>{system.hostname} in AR</DialogTitle>
          <DialogDescription>
            A schematic miniature, frozen at the System view&apos;s current moment. Pinch to resize.
          </DialogDescription>
        </DialogHeader>
        {snapshot && (
          <>
            <ArViewer build={build} alt={`Schematic model of the ${system.hostname} System`} />
            <ul className="text-xs text-muted-foreground" data-testid="ar-system-label">
              {snapshot.infoLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
