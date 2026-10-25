"""Compact views of catalog data for Gemma.

Gemma 4 on the Gemini API is free-tier only (16k input tokens per minute per model), so the
model sees numbers, uncertainties, units and provenance, but not reference links or the full
System JSON. The browser still receives the full records through TurnData.
"""

from exoscope.catalog import System
from exoscope.catalog.models import Measured, Quantity

LIMITS = {"upper": "<", "lower": ">"}


def quantity(q: Quantity) -> str:
    """'1.116 (+0.014/-0.012) R_earth', '< 2.1 M_earth', or 'missing'."""
    if not isinstance(q, Measured):
        return "missing"
    unit = f" {q.unit}" if q.unit else ""
    if q.limit:
        return f"{LIMITS[q.limit]} {q.value:g}{unit}"
    if q.err_lo is None and q.err_hi is None:
        return f"{q.value:g}{unit}"
    if q.err_lo == q.err_hi:
        return f"{q.value:g} ±{q.err_hi:g}{unit}"
    return f"{q.value:g} (+{q.err_hi or 0:g}/-{q.err_lo or 0:g}){unit}"


def system(s: System) -> dict[str, object]:
    p = s.provenance
    when = p.fetched_at.isoformat(timespec="minutes") if p.mode == "live" else str(p.snapshot_date)
    star = s.star
    return {
        "hostname": s.hostname,
        "provenance": f"{p.mode} ({when})",
        "star": {
            "teff": quantity(star.effective_temperature),
            "radius": quantity(star.radius),
            "mass": quantity(star.mass),
            "distance": quantity(star.distance),
        },
        "planets": [
            {
                "name": planet.name,
                "period": quantity(planet.orbital_period),
                "semi_major_axis": quantity(planet.semi_major_axis),
                "radius": quantity(planet.radius),
                "mass": quantity(planet.mass)
                + (
                    f" [{planet.mass_provenance}]"
                    if planet.mass_provenance not in (None, "Mass")
                    else ""
                ),
                "insolation": quantity(planet.insolation),
                "equilibrium_temperature": quantity(planet.equilibrium_temperature),
                "eccentricity": quantity(planet.eccentricity),
            }
            for planet in s.planets
        ],
        "notes": s.notes,
        "sources": "Source papers are shown in the app; values may come from different papers.",
    }
