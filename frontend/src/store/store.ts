import { create } from "zustand";
import type { UiCommand } from "../api/client";

/** The single app store. State changes only via applyCommand or user interaction actions. */
export interface ExoState {
  focusedPlanetId: string | null;
  daysPerSecond: number;
  drawerOpen: boolean;
  applyCommand: (command: UiCommand) => void;
  setDrawerOpen: (open: boolean) => void;
}

export function reduceCommand(
  state: Pick<ExoState, "focusedPlanetId" | "daysPerSecond">,
  command: UiCommand,
): Pick<ExoState, "focusedPlanetId" | "daysPerSecond"> {
  switch (command.kind) {
    case "focus_planet":
      return { ...state, focusedPlanetId: command.planet_id };
    case "set_time_scale":
      return { ...state, daysPerSecond: command.days_per_second };
  }
}

export const useExoStore = create<ExoState>()((set) => ({
  focusedPlanetId: null,
  daysPerSecond: 1,
  drawerOpen: false,
  applyCommand: (command) => {
    set((state) => reduceCommand(state, command));
  },
  setDrawerOpen: (open) => {
    set({ drawerOpen: open });
  },
}));
