import { useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColouredQuantity, PropertyLabel } from "@/features/scene/QuantityParts";
import { axisTitle, exclusionText, valueParts } from "./format";
import type {
  AxisView,
  ComparisonRowView,
  ComparisonView,
  LinkedSelection,
  ValueView,
} from "./types";

function ValueCell({ value, property }: { value: ValueView; property?: string | undefined }) {
  const parts = valueParts(value);
  if (value.status === "missing") {
    return (
      <TableCell>
        <ColouredQuantity parts={parts} />
      </TableCell>
    );
  }
  return (
    <TableCell className="font-mono tabular-nums">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help underline decoration-dotted underline-offset-2 decoration-qty-err">
            <ColouredQuantity parts={parts} property={property} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Source: {value.reference?.label ?? "not given by the archive"}
        </TooltipContent>
      </Tooltip>
    </TableCell>
  );
}

const SELECTED =
  "data-[state=selected]:bg-sky-500/20 data-[state=selected]:shadow-[inset_3px_0_0_#38bdf8] data-[state=selected]:opacity-100";

function Row({
  row,
  axes,
  selected,
  onSelectPlanet,
}: { row: ComparisonRowView; axes: [AxisView, AxisView] } & LinkedSelection) {
  const ref = useRef<HTMLTableRowElement>(null);
  const isSelected = row.planet === selected;
  useEffect(() => {
    // Keep the selected planet visible when it was chosen in the chart or the System view.
    if (isSelected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [isSelected]);
  return (
    <TableRow
      ref={ref}
      data-state={isSelected ? "selected" : undefined}
      aria-selected={isSelected}
      data-planet={row.planet}
      className={`cursor-pointer ${SELECTED} ${row.excluded ? "opacity-60" : ""}`}
      onClick={() => {
        onSelectPlanet(row.planet);
      }}
    >
      <TableCell className={isSelected ? "font-semibold text-sky-300" : "font-medium"}>
        {row.planet}
      </TableCell>
      <ValueCell value={row.x} property={axes[0].property} />
      <ValueCell value={row.y} property={axes[1].property} />
      <TableCell className="text-xs text-muted-foreground">
        {row.excluded ? `Excluded: ${exclusionText(row.excluded)}` : "Plotted"}
      </TableCell>
    </TableRow>
  );
}

/** The comparison's values as a table; same rows as the chart, missing shown as "missing". */
export function CompareTable({
  comparison,
  selected,
  onSelectPlanet,
}: { comparison: ComparisonView } & LinkedSelection) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-1" data-testid="compare-table">
      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Planet</TableHead>
              <TableHead>
                <PropertyLabel property={comparison.x.property} label={axisTitle(comparison.x)} />
              </TableHead>
              <TableHead>
                <PropertyLabel property={comparison.y.property} label={axisTitle(comparison.y)} />
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.rows.map((row) => (
              <Row
                key={row.planet}
                row={row}
                axes={[comparison.x, comparison.y]}
                selected={selected}
                onSelectPlanet={onSelectPlanet}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {[...comparison.provenance, ...comparison.notes].join(" · ")}
      </p>
    </div>
  );
}
