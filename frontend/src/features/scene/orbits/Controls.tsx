/** 2D overlays on the System view: honesty-layer switches, time controls and the caveat badge. */
import { Pause, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatJd } from "./format";
import { LAYER_ROWS, SPEEDS, type Layers } from "./layers";
import type { SizeFactors } from "./layout";

export function LayerPanel({
  layers,
  onChange,
}: {
  layers: Layers;
  onChange: (next: Layers) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {LAYER_ROWS.map(({ key, label, hint }) => (
        <label key={key} className="flex cursor-pointer items-start gap-2">
          <Switch
            size="sm"
            className="mt-0.5"
            checked={layers[key]}
            onCheckedChange={(checked) => {
              onChange({ ...layers, [key]: checked });
            }}
            aria-label={label}
          />
          <span>
            {label}
            <span className="block text-[10px] text-white/50">{hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

interface TimeControlsProps {
  jd: number;
  playing: boolean;
  daysPerSecond: number;
  onPlayingChange: (playing: boolean) => void;
  onSpeedChange: (daysPerSecond: number) => void;
  onResetToNow: () => void;
}

export function TimeControls(props: TimeControlsProps) {
  const { jd, playing, daysPerSecond } = props;
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-xs text-white/80 backdrop-blur">
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => {
          props.onPlayingChange(!playing);
        }}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      {!(SPEEDS as readonly number[]).includes(daysPerSecond) && (
        <Badge variant="secondary" className="text-[10px]" title="Set by a request">
          {daysPerSecond} d/s
        </Badge>
      )}
      {SPEEDS.map((s) => (
        <Button
          key={s}
          size="xs"
          variant={s === daysPerSecond ? "secondary" : "ghost"}
          onClick={() => {
            props.onSpeedChange(s);
          }}
        >
          {s} d/s
        </Button>
      ))}
      <Button size="icon-xs" variant="ghost" aria-label="Back to now" onClick={props.onResetToNow}>
        <RotateCcw />
      </Button>
      <span className="ml-1 font-mono tabular-nums">{formatJd(jd)}</span>
    </div>
  );
}

/** Where the numbers came from: Live result or dated Snapshot. */
export function CaveatBadge({ provenance }: { sizes?: SizeFactors; provenance: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-1" data-testid="caveat-badge">
      <Badge variant="secondary" className="text-[10px]">
        {provenance}
      </Badge>
    </div>
  );
}
