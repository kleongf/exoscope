"""A local Plotly runtime and saved JSON rows make charts usable offline."""

import re
from html import escape
from pathlib import Path

from exoscope.catalog.models import Measured
from exoscope.compare.models import Comparison
from exoscope.report.html import safe_json
from exoscope.report.selection import ReportError


def chart(comparison: Comparison, identifier: str) -> str:
    rows = [
        row
        for row in comparison.rows
        if row.excluded is None
        and isinstance(row.x, Measured)
        and isinstance(row.y, Measured)
        and row.x.limit is None
        and row.y.limit is None
    ]
    points = [
        (row.planet, row.x, row.y)
        for row in rows
        if isinstance(row.x, Measured) and isinstance(row.y, Measured)
    ]
    return scatter(
        f"{comparison.x.label} ({comparison.x.unit or 'unit not supplied'})",
        f"{comparison.y.label} ({comparison.y.unit or 'unit not supplied'})",
        points,
        identifier,
    )


def scatter(
    x_label: str, y_label: str, points: list[tuple[str, Measured, Measured]], identifier: str
) -> str:
    xs = [point[1] for point in points]
    ys = [point[2] for point in points]
    trace = {
        "type": "scatter",
        "mode": "markers",
        "text": [escape(point[0]) for point in points],
        "x": [q.value for q in xs],
        "y": [q.value for q in ys],
        "error_x": {
            "type": "data",
            "symmetric": False,
            "array": [q.err_hi for q in xs],
            "arrayminus": [q.err_lo for q in xs],
        },
        "error_y": {
            "type": "data",
            "symmetric": False,
            "array": [q.err_hi for q in ys],
            "arrayminus": [q.err_lo for q in ys],
        },
    }
    layout = {
        "xaxis": {"title": {"text": escape(x_label)}},
        "yaxis": {"title": {"text": escape(y_label)}},
        "height": 400,
        "margin": {"t": 20},
    }
    return (
        f'<div class="chart" id="{identifier}"></div><script>'
        f'Plotly.newPlot("{identifier}",{safe_json([trace])},{safe_json(layout)},'
        "{responsive:true,displayModeBar:false});</script>"
    )


def runtime() -> str:
    directory = Path(__file__).resolve().parents[3] / "frontend/node_modules"
    for relative in (
        "plotly.js-basic-dist-min/plotly-basic.min.js",
        "plotly.js/dist/plotly-basic.min.js",
    ):
        path = directory / relative
        if path.is_file():
            script = re.sub(r"</script", r"<\\/script", path.read_text(), flags=re.IGNORECASE)
            return "<script>" + script + "</script>"
    raise ReportError(
        "The local Plotly runtime is unavailable. Install frontend dependencies; "
        "no Report was written."
    )
