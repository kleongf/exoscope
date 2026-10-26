"""Tables use saved archive quantities, including missing values, limits and papers."""

from html import escape

from exoscope.catalog.models import Measured, Missing, Planet, Provenance, Quantity, Star
from exoscope.catalog.sample_models import Sample, SampleField, SampleValue, TextValue
from exoscope.compare.models import Comparison
from exoscope.report.html import link


def quantity(value: Quantity) -> str:
    unit = escape(value.unit or "unit not supplied")
    if not isinstance(value, Measured):
        return f"Missing ({unit})"
    low = f"lower -{value.err_lo}" if value.err_lo is not None else "lower missing"
    high = f"upper +{value.err_hi}" if value.err_hi is not None else "upper missing"
    errors = f"{low} / {high}"
    paper = (
        link(value.reference.label, value.reference.url)
        if value.reference
        else "Source paper missing"
    )
    limit = f" · {value.limit} limit" if value.limit else ""
    note = f" · {escape(value.note)}" if value.note else ""
    return f"<mark>{value.value} {unit}</mark> ({errors}){limit}<br><small>{paper}{note}</small>"


def table(headings: list[str], rows: list[list[str]]) -> str:
    head = "".join(f"<th>{escape(heading)}</th>" for heading in headings)
    body = "".join("<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>" for row in rows)
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def object_table(item: Planet | Star) -> str:
    rows: list[list[str]] = []
    for name in type(item).model_fields:
        value = getattr(item, name)
        if isinstance(value, Measured | Missing):
            rows.append([escape(name.replace("_", " ")), quantity(value)])
        else:
            rows.append(
                [
                    escape(name.replace("_", " ")),
                    escape(str(value)) if value is not None else "Missing",
                ]
            )
    return table(["Property", "Value, uncertainty and source paper"], rows)


def comparison_table(comparison: Comparison) -> str:
    stamps = {p.hostname: provenance(p.provenance) for p in comparison.provenance}
    return table(
        [
            "Planet",
            "System",
            comparison.x.label,
            comparison.y.label,
            "Chart inclusion",
            "Provenance",
        ],
        [
            [
                escape(row.planet),
                escape(row.hostname),
                quantity(row.x),
                quantity(row.y),
                escape(row.excluded or "plotted"),
                stamps.get(row.hostname, "Provenance unavailable"),
            ]
            for row in comparison.rows
        ],
    )


def _sample_value(value: SampleValue) -> str:
    if isinstance(value, TextValue):
        paper = (
            link(value.reference.label, value.reference.url)
            if value.reference
            else "Source paper missing"
        )
        return f"{escape(value.value)}<br><small>{paper}</small>"
    return quantity(value)


def sample_table(sample: Sample, statuses: list[str]) -> str:
    fields = {field.name: field for field in sample.fields}
    for planet in sample.planets:
        for name, value in planet.values.items():
            if name not in fields:
                unit = value.unit if not isinstance(value, TextValue) else None
                fields[name] = SampleField(name=name, label=name.replace("_", " "), unit=unit)
    headings = ["Planet", "System"] + [
        f"{f.label} ({f.unit or 'unit not supplied'})" for f in fields.values()
    ]
    rows: list[list[str]] = []
    for index, planet in enumerate(sample.planets):
        cells = [escape(planet.name), escape(planet.hostname)]
        cells += [
            _sample_value(planet.values.get(field.name, Missing(unit=field.unit)))
            for field in fields.values()
        ]
        rows.append([*cells, escape(statuses[index])])
    return table([*headings, "Chart inclusion"], rows)


def provenance(value: Provenance) -> str:
    if value.mode == "live":
        return escape(f"Live · fetched {value.fetched_at.isoformat()} · {value.source}")
    return escape(f"Cached · Snapshot {value.snapshot_date} · {value.source}")
