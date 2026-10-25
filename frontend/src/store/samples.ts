import type { Sample, TurnResponse } from "../api/client";

export interface SavedSample {
  id: number;
  sample: Sample;
}
export type DrawerView = "comparison" | "sample";
export interface SampleState {
  /** Samples build up across the Project; the drawer shows the active one. */
  samples: SavedSample[];
  activeSampleId: number | null;
  drawerView: DrawerView;
  drawerOpen: boolean;
}

/** A new Sample joins the Project, becomes the drawer's view and opens it. */
export function addSample(
  state: Pick<SampleState, "samples">,
  response: TurnResponse,
): Partial<SampleState> {
  const sample = response.data?.sample;
  if (!sample) return {}; // Leave the drawer to whatever else this turn produced.
  const id = (state.samples.at(-1)?.id ?? 0) + 1;
  return {
    samples: [...state.samples, { id, sample }],
    activeSampleId: id,
    drawerView: "sample",
    drawerOpen: true,
  };
}
