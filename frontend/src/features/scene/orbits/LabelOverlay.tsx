/** DOM labels drawn over the canvas; the LabelProjector moves each one to its 3D anchor. */
import type { ReactNode } from "react";
import { EARTH_LABEL, HOVER_LABEL, NODES_LABEL, type LabelRegistry } from "./labels";
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

function PlanetLabel({ item }: { item: PlanetLayout }) {
  const { model, planet, color } = item;
  return (
    <div className="font-mono text-[11px] font-semibold whitespace-nowrap">
      <span style={{ color }}>{planet.letter}</span>
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
}

export function LabelOverlay(props: LabelOverlayProps) {
  const { labels, planets, hovered, inclinationDeg } = props;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {planets.map((item) => (
        <Anchored key={item.planet.name} id={item.planet.name} labels={labels}>
          <PlanetLabel item={item} />
        </Anchored>
      ))}
      {props.showAssumptions && (
        <>
          <Anchored id={NODES_LABEL} labels={labels} centered={false}>
            <div className="w-40 -translate-y-1/2 text-[10px] text-slate-300">
              Line of nodes assumed (Ω unknown); all orbits drawn coplanar
            </div>
          </Anchored>
          <Anchored id={EARTH_LABEL} labels={labels} centered={false}>
            <div className="ml-2 -translate-y-1/2 text-[10px] whitespace-nowrap text-sky-300">
              Toward Earth
              {inclinationDeg === null
                ? ""
                : ` (system is edge-on, i ≈ ${inclinationDeg.toFixed(1)}°)`}
            </div>
          </Anchored>
        </>
      )}
      {hovered !== null && (
        <Anchored id={HOVER_LABEL} labels={labels} centered={false}>
          <ProvenanceCard item={hovered} jd={props.jd} provenance={props.provenance} />
        </Anchored>
      )}
    </div>
  );
}
