/** Hover card (plain DOM, positioned by the label overlay): where a planet's orbit comes from and how uncertain its position is. */
import { formatQuantity } from "./format";
import { orbitsSinceEpoch, positionSigmaRad } from "./maths";
import type { PlanetLayout } from "./layout";
import { provenanceLabel, type Provenance, type Quantity } from "./types";

function Line({ label, q, digits = 4 }: { label: string; q: Quantity; digits?: number }) {
  return (
    <div>
      {label} = {formatQuantity(q, digits)}
      {q.source !== null && <span className="text-white/50"> · {q.source.label}</span>}
    </div>
  );
}

function UncertaintyNote({ item, jd }: { item: PlanetLayout; jd: number }) {
  const { model, planet } = item;
  if (model.kind === "schematic") {
    return (
      <div className="mt-1 text-amber-300">
        Schematic orbit: no {model.missing.join(", ")} in the archive
        {model.radiusMethod === "kepler3" &&
          "; distance derived from the period by Kepler's third law"}
        {model.radiusMethod === "placeholder" &&
          "; distance unknown, placed outside the known orbits"}
      </div>
    );
  }
  const sig = positionSigmaRad(planet, model.elements, jd);
  const orbits = Math.round(orbitsSinceEpoch(model.elements, jd)).toLocaleString();
  const spread = sig === null ? "unknown" : `±${((2 * sig * 180) / Math.PI).toFixed(1)}° (2σ)`;
  return (
    <div className="mt-1 text-amber-200/90">
      {orbits} orbits since that epoch → position {spread}, TTVs ignored
      {model.assumed.includes("circular") && <div>Eccentricity missing: drawn circular</div>}
      {model.assumed.includes("periastron") && <div>ω missing: orientation assumed</div>}
    </div>
  );
}

export function ProvenanceCard({
  item,
  jd,
  provenance,
}: {
  item: PlanetLayout;
  jd: number;
  provenance: Provenance;
}) {
  const { planet, color } = item;
  return (
    <div className="ml-4 w-64 -translate-y-1/2 rounded-md border border-white/15 bg-black/85 p-2 text-[10.5px] leading-snug text-white/85">
      <div className="mb-1 font-semibold" style={{ color }}>
        {planet.name}
      </div>
      <Line label="a" q={planet.semiMajorAxis} />
      <Line label="P" q={planet.period} digits={7} />
      <Line label="e" q={planet.eccentricity} digits={3} />
      <Line label="Epoch" q={planet.transitEpoch} />
      <UncertaintyNote item={item} jd={jd} />
      <div className="mt-1 text-white/45">{provenanceLabel(provenance)} · pscomppars</div>
    </div>
  );
}
