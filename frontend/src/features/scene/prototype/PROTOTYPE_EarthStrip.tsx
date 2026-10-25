// PROTOTYPE (issue #5) Variant B helper: the system "as seen from Earth" — an edge-on strip
// where transits line up, plus the next predicted transit of each planet with its uncertainty.
import {
  AU_PER_REARTH,
  AU_PER_RSUN,
  elementsOf,
  nextTransit,
  positionAt,
  skyProjection,
} from "./PROTOTYPE_orbits";
import { TRAPPIST1 } from "./PROTOTYPE_trappist1";
import { useProto } from "./PROTOTYPE_store";
import { planetColor, planetsWithElements } from "./PROTOTYPE_sceneParts";
import { formatDate } from "./PROTOTYPE_TimeControls";

const HALF_WIDTH_AU = 0.066;
const W = 1000;
const H = 120;
const Y_EXAGGERATION = 10;
const PX_PER_AU = W / 2 / HALF_WIDTH_AU;

function toX(au: number): number {
  return W / 2 + (au / HALF_WIDTH_AU) * (W / 2);
}

export function EarthStrip() {
  const jd = useProto((s) => s.jd);
  const sizeScale = useProto((s) => s.sizeScale);
  const starR = (TRAPPIST1.star.radius.value ?? 0.12) * AU_PER_RSUN;
  const starPx = starR * PX_PER_AU;
  const planets = planetsWithElements();
  const transiting: string[] = [];

  const dots = planets.map((p) => {
    const el = elementsOf(p);
    if (el === null) return null;
    const sky = skyProjection(positionAt(el, jd), el);
    const front = sky.depth > 0;
    if (front && Math.hypot(sky.sx, sky.sy) < starR) transiting.push(p.letter);
    const r = Math.max((p.radius.value ?? 1) * AU_PER_REARTH * sizeScale * PX_PER_AU, 2);
    return (
      <circle
        key={p.id}
        cx={toX(sky.sx)}
        cy={H / 2 + sky.sy * PX_PER_AU * Y_EXAGGERATION}
        r={Math.min(r, 9)}
        fill={front ? planetColor(p) : "none"}
        stroke={planetColor(p)}
        strokeWidth={1.5}
        opacity={front ? 1 : 0.55}
        className="cursor-pointer"
        onClick={() => {
          useProto.getState().select(p.id);
        }}
      />
    );
  });

  return (
    <div className="flex h-full min-h-0 border-t border-white/10 bg-[#03040a]">
      <div className="relative min-w-0 flex-1">
        <div className="absolute top-1.5 left-2 text-[10px] font-semibold tracking-wide text-sky-300 uppercase">
          As seen from Earth (edge-on)
        </div>
        <div className="absolute top-1.5 right-2 text-[10px] text-white/50">
          filled = in front of the star · hollow = behind · star ×3 · vertical ×{Y_EXAGGERATION} ·
          distances to scale
        </div>
        <svg
          viewBox={`0 0 ${String(W)} ${String(H)}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="rgba(255,255,255,0.08)" />
          <circle
            cx={W / 2}
            cy={H / 2}
            r={Math.max(starPx * 3, 3)}
            fill={transiting.length > 0 ? "#ffd29a" : "#ff7a3d"}
          />
          {dots}
        </svg>
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-amber-200">
          {transiting.length > 0 ? `Transit in progress: ${transiting.join(", ")}` : " "}
        </div>
      </div>
      <NextTransits jd={jd} />
    </div>
  );
}

function NextTransits({ jd }: { jd: number }) {
  return (
    <div className="w-60 shrink-0 overflow-y-auto border-l border-white/10 p-2 text-[10.5px] text-white/75">
      <div className="mb-1 font-semibold text-white/90">Next predicted transits</div>
      {planetsWithElements().map((p) => {
        const t = nextTransit(p, jd);
        if (t === null) return null;
        return (
          <div key={p.id} className="flex justify-between gap-2 font-mono tabular-nums">
            <span style={{ color: planetColor(p) }}>{p.letter}</span>
            <span>{formatDate(t.jd).slice(5, 16)}</span>
            <span className="text-white/50">
              ±{t.sigmaHours === null ? "?" : t.sigmaHours.toFixed(t.sigmaHours < 1 ? 2 : 1)} h
            </span>
          </div>
        );
      })}
      <div className="mt-1.5 leading-snug text-white/45">
        Linear ephemeris from the archive epoch; ignores TTVs, so real transits drift further.
      </div>
    </div>
  );
}
