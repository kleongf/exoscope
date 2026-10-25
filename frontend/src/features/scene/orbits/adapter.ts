/** Converts the generated API System into the orbit scene's view model. */
import type { Planet, Quantity as ApiQuantity, System } from "@/api/client";
import type { OrbitPlanet, OrbitSystem, Provenance, Quantity } from "./types";

function quantity(q: ApiQuantity): Quantity {
  if (q.status === "missing") {
    return { value: null, unit: q.unit ?? "", errHi: null, errLo: null, limit: null, source: null };
  }
  return {
    value: q.value,
    unit: q.unit ?? "",
    errHi: q.err_hi,
    errLo: q.err_lo,
    limit: q.limit,
    source: q.reference ? { label: q.reference.label, url: q.reference.url } : null,
  };
}

function planet(p: Planet): OrbitPlanet {
  return {
    name: p.name,
    letter: p.letter ?? p.name.split(" ").at(-1) ?? p.name,
    period: quantity(p.orbital_period),
    semiMajorAxis: quantity(p.semi_major_axis),
    eccentricity: quantity(p.eccentricity),
    periastronArg: quantity(p.argument_of_periastron),
    transitEpoch: quantity(p.transit_midpoint),
    inclination: quantity(p.inclination),
    radius: quantity(p.radius),
    mass: quantity(p.mass),
    insolation: quantity(p.insolation),
    eqTemp: quantity(p.equilibrium_temperature),
  };
}

function provenance(p: System["provenance"]): Provenance {
  return p.mode === "live"
    ? { mode: "live", fetchedAt: p.fetched_at }
    : { mode: "snapshot", snapshotDate: p.snapshot_date };
}

export function toOrbitSystem(system: System): OrbitSystem {
  return {
    hostname: system.hostname,
    star: {
      teff: quantity(system.star.effective_temperature),
      radius: quantity(system.star.radius),
      mass: quantity(system.star.mass),
    },
    planets: system.planets.map(planet),
    provenance: provenance(system.provenance),
  };
}
