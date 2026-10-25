// PROTOTYPE (issue #5): play/pause, speed and date readout for simulated time.
/* eslint-disable react-refresh/only-export-components -- PROTOTYPE helpers live beside components */
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dateFromJd } from "./PROTOTYPE_orbits";
import { useProto } from "./PROTOTYPE_store";

const SPEEDS = [0.1, 0.5, 2, 10];

export function formatDate(jd: number): string {
  return dateFromJd(jd).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function TimeControls({ className = "" }: { className?: string }) {
  const jd = useProto((s) => s.jd);
  const playing = useProto((s) => s.playing);
  const dps = useProto((s) => s.daysPerSecond);
  const { setPlaying, setDaysPerSecond, resetToNow } = useProto.getState();
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-xs text-white/80 backdrop-blur ${className}`}
    >
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => {
          setPlaying(!playing);
        }}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      {SPEEDS.map((s) => (
        <Button
          key={s}
          size="xs"
          variant={s === dps ? "secondary" : "ghost"}
          onClick={() => {
            setDaysPerSecond(s);
          }}
        >
          {s} d/s
        </Button>
      ))}
      <Button size="icon-xs" variant="ghost" aria-label="Back to now" onClick={resetToNow}>
        <RotateCcw />
      </Button>
      <span className="ml-1 font-mono tabular-nums">{formatDate(jd)}</span>
    </div>
  );
}
