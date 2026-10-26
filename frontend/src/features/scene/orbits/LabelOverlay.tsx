/** DOM labels drawn over the canvas; the LabelProjector moves each one to its 3D anchor. */
import type { ReactNode } from "react";
import { HOVER_LABEL, type LabelRegistry } from "./labels";
import type { PlanetLayout } from "./layout";
import { ProvenanceCard } from "./ProvenanceCard";
import type { Provenance } from "./types";

function Anchored({
  id,
  labels,
  centered = true,
  children,
}: {
  id: string;
  labels: LabelRegistry;
  centered?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      ref={(el) => {
        labels.setElement(id, el);
        return () => {
          labels.setElement(id, null);
        };
      }}
      className="invisible absolute top-0 left-0"
    >
      <div className={centered ? "-translate-x-1/2 -translate-y-1/2" : ""}>{children}</div>
    </div>
  );
}

function PlanetLabel({ item, onSelect }: { item: PlanetLayout; onSelect: (name: string) => void }) {
  const { model, planet, color } = item;
  return (
    <div className="font-mono text-[11px] font-semibold whitespace-nowrap">
      <button
        type="button"
        aria-label={planet.name}
        className="pointer-events-auto cursor-pointer rounded px-0.5 hover:bg-white/10"
        style={{ color }}
        onClick={() => {
          onSelect(planet.name);
        }}
      >
        {planet.letter}
      </button>
      {model.kind === "schematic" && (
        <span className="ml-1 font-sans font-normal text-amber-300">
          schematic: no {model.missing.join(", ")}
        </span>
      )}
    </div>
  );
}

interface LabelOverlayProps {
  labels: LabelRegistry;
  planets: PlanetLayout[];
  showAssumptions: boolean;
  inclinationDeg: number | null;
  hovered: PlanetLayout | null;
  jd: number;
  provenance: Provenance;
  showLabels: boolean;
  onSelect: (name: string) => void;
}

export function LabelOverlay(props: LabelOverlayProps) {
  const { labels, planets, hovered } = props;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {props.showLabels &&
        planets.map((item) => (
          <Anchored key={item.planet.name} id={item.planet.name} labels={labels}>
            <PlanetLabel item={item} onSelect={props.onSelect} />
          </Anchored>
        ))}
      {hovered !== null && (
        <Anchored id={HOVER_LABEL} labels={labels} centered={false}>
          <ProvenanceCard item={hovered} jd={props.jd} provenance={props.provenance} />
        </Anchored>
      )}
    </div>
  );
}
