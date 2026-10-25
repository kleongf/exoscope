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
import { axisTitle, exclusionText, formatValue } from "./format";
import type { ComparisonRowView, ComparisonView, LinkedSelection, ValueView } from "./types";

function ValueCell({ value }: { value: ValueView }) {
  const text = formatValue(value);
  if (value.status === "missing") {
    return <TableCell className="text-muted-foreground italic">{text}</TableCell>;
  }
  return (
    <TableCell className="font-mono tabular-nums">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help underline decoration-dotted underline-offset-2">{text}</span>
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

function Row({ row, selected, onSelectPlanet }: { row: ComparisonRowView } & LinkedSelection) {
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
      <ValueCell value={row.x} />
      <ValueCell value={row.y} />
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
              <TableHead>{axisTitle(comparison.x)}</TableHead>
              <TableHead>{axisTitle(comparison.y)}</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.rows.map((row) => (
              <Row key={row.planet} row={row} selected={selected} onSelectPlanet={onSelectPlanet} />
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
