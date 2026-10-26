import type { Data, Layout, PlotMouseEvent } from "plotly.js";
import Plotly from "plotly.js-basic-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
import { PropertyLabel } from "@/features/scene/QuantityParts";
import { propertyHex, tokenColor } from "@/lib/palette";
import { axisTitle, countRows, shortName } from "./format";
import type { ComparisonRowView, ComparisonView, LinkedSelection, ValueView } from "./types";

const Plot = createPlotlyComponent(Plotly);

/** Chart colours come from the theme tokens in index.css, resolved for Plotly at render. */
function colours(c: ComparisonView) {
  return {
    x: propertyHex(c.x.property),
    y: propertyHex(c.y.property),
    selected: tokenColor("qty-value"),
    muted: tokenColor("qty-err"),
    grid: tokenColor("plot-grid"),
    zero: tokenColor("plot-zero"),
  };
}
type Colours = ReturnType<typeof colours>;

type Measured = Extract<ValueView, { status: "measured" }>;
interface PlottedRow extends ComparisonRowView {
  x: Measured;
  y: Measured;
}

function isPlotted(r: ComparisonRowView): r is PlottedRow {
  return r.excluded === null && r.x.status === "measured" && r.y.status === "measured";
}

function errorBars(values: Measured[], color: string) {
  return {
    type: "data" as const,
    symmetric: false,
    array: values.map((v) => v.errHi ?? 0),
    arrayminus: values.map((v) => v.errLo ?? 0),
    color,
    thickness: 1,
    width: 3,
  };
}

const MAX_LABELLED = 20;

function trace(rows: PlottedRow[], selected: string | null, k: Colours): Data {
  const isSel = rows.map((r) => r.planet === selected);
  return {
    type: "scatter",
    // Label points only when they stay legible; hover still names every point.
    mode: rows.length > MAX_LABELLED ? "markers" : "text+markers",
    x: rows.map((r) => r.x.value),
    y: rows.map((r) => r.y.value),
    customdata: rows.map((r) => r.planet),
    text: rows.map((r) => shortName(r.planet, r.hostname)),
    textposition: "top right",
    textfont: { color: k.muted, size: 11 },
    hovertemplate: "%{customdata}<br>x %{x}<br>y %{y}<extra></extra>",
    error_x: errorBars(
      rows.map((r) => r.x),
      k.muted,
    ),
    error_y: errorBars(
      rows.map((r) => r.y),
      k.muted,
    ),
    marker: {
      size: isSel.map((s) => (s ? 14 : 9)),
      // Markers wear the y property's hue; the selected planet is bright, ringed in the x hue.
      color: isSel.map((s) => (s ? k.selected : k.y)),
      line: { color: isSel.map((s) => (s ? k.x : k.y)), width: isSel.map((s) => (s ? 3 : 1)) },
    },
  };
}

function layout(c: ComparisonView, k: Colours): Partial<Layout> {
  const axis = { gridcolor: k.grid, zerolinecolor: k.zero, color: k.muted };
  return {
    autosize: true,
    margin: { l: 56, r: 16, t: 8, b: 44 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: k.muted, size: 11 },
    xaxis: { ...axis, title: { text: axisTitle(c.x), font: { color: k.x, size: 12 } } },
    yaxis: { ...axis, title: { text: axisTitle(c.y), font: { color: k.y, size: 12 } } },
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
  const k = colours(comparison);
  const { plotted, excluded } = countRows(comparison);
  const onClick = (e: Readonly<PlotMouseEvent>) => {
    const planet = e.points[0]?.customdata;
    if (typeof planet === "string") onSelectPlanet(planet);
  };
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="compare-chart">
      <div className="flex items-baseline justify-between px-1 text-xs text-muted-foreground">
        <span className="flex items-baseline gap-1">
          <PropertyLabel property={comparison.y.property} label={comparison.y.label} />
          <span>vs</span>
          <PropertyLabel property={comparison.x.property} label={comparison.x.label} />
        </span>
        <span data-testid="compare-counts">
          {plotted} plotted · {excluded} excluded
        </span>
      </div>
      <Plot
        className="min-h-0 flex-1"
        data={[trace(rows, selected, k)]}
        layout={layout(comparison, k)}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler
        onClick={onClick}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
