import type { Data, Layout, PlotMouseEvent } from "plotly.js";
import Plotly from "plotly.js-basic-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
import { axisTitle, countRows, shortName } from "./format";
import type { ComparisonRowView, ComparisonView, LinkedSelection, ValueView } from "./types";

const Plot = createPlotlyComponent(Plotly);

const ACCENT = "#38bdf8";
const POINT = "#e2e8f0";
const MUTED = "#94a3b8";

type Measured = Extract<ValueView, { status: "measured" }>;
interface PlottedRow extends ComparisonRowView {
  x: Measured;
  y: Measured;
}

function isPlotted(r: ComparisonRowView): r is PlottedRow {
  return r.excluded === null && r.x.status === "measured" && r.y.status === "measured";
}

function errorBars(values: Measured[]) {
  return {
    type: "data" as const,
    symmetric: false,
    array: values.map((v) => v.errHi ?? 0),
    arrayminus: values.map((v) => v.errLo ?? 0),
    color: MUTED,
    thickness: 1,
    width: 3,
  };
}

function trace(rows: PlottedRow[], selected: string | null): Data {
  const isSel = rows.map((r) => r.planet === selected);
  return {
    type: "scatter",
    mode: "text+markers",
    x: rows.map((r) => r.x.value),
    y: rows.map((r) => r.y.value),
    customdata: rows.map((r) => r.planet),
    text: rows.map((r) => shortName(r.planet, r.hostname)),
    textposition: "top right",
    textfont: { color: MUTED, size: 11 },
    hovertemplate: "%{customdata}<br>x %{x}<br>y %{y}<extra></extra>",
    error_x: errorBars(rows.map((r) => r.x)),
    error_y: errorBars(rows.map((r) => r.y)),
    marker: {
      size: isSel.map((s) => (s ? 14 : 9)),
      color: isSel.map((s) => (s ? ACCENT : POINT)),
      line: { color: isSel.map((s) => (s ? "#ffffff" : POINT)), width: 1 },
    },
  };
}

function layout(c: ComparisonView): Partial<Layout> {
  const axis = { gridcolor: "#1e293b", zerolinecolor: "#334155", color: MUTED };
  return {
    autosize: true,
    margin: { l: 56, r: 16, t: 8, b: 44 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: MUTED, size: 11 },
    xaxis: { ...axis, title: { text: axisTitle(c.x) } },
    yaxis: { ...axis, title: { text: axisTitle(c.y) } },
    showlegend: false,
    hovermode: "closest",
  };
}

/** Scatter of archive values with error bars; clicking a point selects that planet. */
export function CompareChart({
  comparison,
  selected,
  onSelectPlanet,
}: { comparison: ComparisonView } & LinkedSelection) {
  const rows = comparison.rows.filter(isPlotted);
  const { plotted, excluded } = countRows(comparison);
  const onClick = (e: Readonly<PlotMouseEvent>) => {
    const planet = e.points[0]?.customdata;
    if (typeof planet === "string") onSelectPlanet(planet);
  };
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="compare-chart">
      <div className="flex items-baseline justify-between px-1 text-xs text-muted-foreground">
        <span>
          {comparison.y.label} vs {comparison.x.label}
        </span>
        <span data-testid="compare-counts">
          {plotted} plotted · {excluded} excluded
        </span>
      </div>
      <Plot
        className="min-h-0 flex-1"
        data={[trace(rows, selected)]}
        layout={layout(comparison)}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler
        onClick={onClick}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
