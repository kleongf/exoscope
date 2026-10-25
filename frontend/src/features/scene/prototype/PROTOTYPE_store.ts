// PROTOTYPE (issue #5): in-memory state shared by the orbit variants and the planet panel.
import { useEffect } from "react";
import { create } from "zustand";
import { jdFromDate } from "./PROTOTYPE_orbits";

export interface ProtoState {
  selectedId: string | null;
  hoveredId: string | null;
  jd: number;
  playing: boolean;
  daysPerSecond: number;
  sizeScale: number;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setPlaying: (playing: boolean) => void;
  setDaysPerSecond: (v: number) => void;
  setSizeScale: (v: number) => void;
  resetToNow: () => void;
  advance: (seconds: number) => void;
}

export const useProto = create<ProtoState>()((set) => ({
  selectedId: null,
  hoveredId: null,
  jd: jdFromDate(new Date()),
  playing: true,
  daysPerSecond: 0.5,
  sizeScale: 60,
  select: (id) => {
    set({ selectedId: id });
  },
  hover: (id) => {
    set({ hoveredId: id });
  },
  setPlaying: (playing) => {
    set({ playing });
  },
  setDaysPerSecond: (v) => {
    set({ daysPerSecond: v });
  },
  setSizeScale: (v) => {
    set({ sizeScale: v });
  },
  resetToNow: () => {
    set({ jd: jdFromDate(new Date()) });
  },
  advance: (seconds) => {
    set((s) => (s.playing ? { jd: s.jd + seconds * s.daysPerSecond } : {}));
  },
}));

// Exposed for the PROTOTYPE screenshot script (dev only).
if (import.meta.env.DEV) Object.assign(window, { __protoStore: useProto });

/** Drives simulated time with requestAnimationFrame while mounted. */
export function useProtoClock(): void {
  useEffect(() => {
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      useProto.getState().advance((now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);
}
