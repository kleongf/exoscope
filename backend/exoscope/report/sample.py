"""Readable Sample methods and chart axes from saved filters and fields."""

from html import escape

from exoscope.catalog.models import Measured
from exoscope.catalog.sample_models import Sample
from exoscope.report.charts import scatter
from exoscope.report.tables import provenance


def axes(sample: Sample) -> list[str]:
    numeric = {field.name for field in sample.fields if field.name != "discovery_method"}
    names = [f.field for f in sample.filters] + ["radius", "orbital_period", "insolation", "mass"]
    return list(dict.fromkeys(name for name in names if name in numeric))[:2]


def chart_status(sample: Sample, values: dict[str, object]) -> str:
    names = axes(sample)
    if len(names) < 2:
        return "Chart unavailable: fewer than two numeric axes"
    x, y = (values.get(name) for name in names)
    if not isinstance(x, Measured) or not isinstance(y, Measured):
        return "Excluded from chart: missing axis value"
    if x.limit or y.limit:
        return "Excluded from chart: limit only"
    return "plotted"


def sample_chart(sample: Sample, identifier: str) -> str:
    names = axes(sample)
    if len(names) < 2:
        return "<p>Chart unavailable: fewer than two numeric axes were saved.</p>"
    fields = {field.name: field for field in sample.fields}
    labels = [
        f"{fields[name].label} ({fields[name].unit or 'unit not supplied'})" for name in names
    ]
    points: list[tuple[str, Measured, Measured]] = []
    for planet in sample.planets:
        x, y = (planet.values.get(name) for name in names)
        if isinstance(x, Measured) and isinstance(y, Measured) and not x.limit and not y.limit:
            points.append((planet.name, x, y))
    return scatter(labels[0], labels[1], points, identifier)


def method(sample: Sample) -> str:
    units = {f.name: f.unit or "unit not supplied" for f in sample.fields}
    filters = "".join(
        f"<li>{escape(f.field)} {escape(f.op)} {escape(str(f.value))}"
        + (f" to {f.upper}" if f.upper is not None else "")
        + f" ({escape(units.get(f.field, 'unit not supplied'))})</li>"
        for f in sample.filters
    )
    interpretations = "".join(
        f"<li>{escape(i.term)}: {escape(i.meaning)} · {escape(i.caveat or 'No caveat saved')}</li>"
        for i in sample.interpretations
    )
    excluded = ", ".join(f"{escape(k)}: {v}" for k, v in sample.excluded.by_field.items())
    sort = f"{sample.sort.field} {sample.sort.direction}" if sample.sort else "No sort saved"
    plotted = sum(chart_status(sample, dict(p.values)) == "plotted" for p in sample.planets)
    return (
        f"<p>{provenance(sample.provenance)} · NASA Exoplanet Archive pscomppars</p>"
        f"<p>{len(sample.planets)} saved rows of {sample.matched} matched; limit {sample.limit}; "
        f"truncated: {sample.truncated}. Sort: {escape(sort)}.</p>"
        f"<p>{plotted} plotted; {len(sample.planets) - plotted} saved rows excluded from chart. "
        f"{sample.excluded.count} excluded from search for missing values: {excluded}. "
        f"{escape(sample.excluded.reason)}</p>"
        f"<h4>Filters</h4><ul>{filters}</ul><h4>Interpretations</h4><ul>{interpretations}</ul>"
    )
