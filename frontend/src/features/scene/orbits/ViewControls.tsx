/** Labels and colour-by controls, plus the legend for the active colouring. */
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { COLOR_OPTIONS, MISSING_COLOR, type ColorLegend, type ColorProperty } from "./colorBy";

interface ViewControlsProps {
  showLabels: boolean;
  colorBy: ColorProperty;
  onShowLabelsChange: (visible: boolean) => void;
  onColorByChange: (property: ColorProperty) => void;
}

export function ViewControls(props: ViewControlsProps) {
  return (
    <div className="flex w-64 flex-col gap-2 rounded-lg border border-white/10 bg-black/75 p-3 text-xs text-white/85 backdrop-blur">
      <label className="flex cursor-pointer items-center gap-2">
        <Switch
          size="sm"
          checked={props.showLabels}
          onCheckedChange={props.onShowLabelsChange}
          aria-label="Planet labels"
        />
        Planet labels
      </label>
      <div>
        <div className="mb-1 text-white/60">Colour planets by</div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Colour planets by">
          {COLOR_OPTIONS.map(({ value, label }) => (
            <Button
              key={value}
              size="xs"
              variant={props.colorBy === value ? "secondary" : "ghost"}
              aria-pressed={props.colorBy === value}
              onClick={() => {
                props.onColorByChange(value);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

const number = (v: number) => v.toLocaleString(undefined, { maximumSignificantDigits: 3 });

export function Legend({ legend }: { legend: ColorLegend }) {
  const gradient = `linear-gradient(to right, ${legend.ramp.join(", ")})`;
  return (
    <div
      className="w-56 rounded-lg border border-white/10 bg-black/75 p-2 text-[11px] text-white/85 backdrop-blur"
      data-testid="color-legend"
    >
      <div className="mb-1 font-semibold">
        {legend.label}
        {legend.unit ? ` (${legend.unit})` : ""}
      </div>
      <div className="h-2 rounded" style={{ background: gradient }} />
      <div className="mt-0.5 flex justify-between font-mono tabular-nums text-white/70">
        <span>{number(legend.min)}</span>
        <span>{number(legend.max)}</span>
      </div>
      {legend.missing > 0 && (
        <div className="mt-1 flex items-center gap-1 text-white/60">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: MISSING_COLOR }}
          />
          {legend.missing} missing in the archive
        </div>
      )}
    </div>
  );
}
