/** Which honesty layers are drawn, and the simulated-time speeds on offer. */

export interface Layers {
  orbitBands: boolean;
  positionSpread: boolean;
  assumptions: boolean;
  trueSizes: boolean;
}

export const DEFAULT_LAYERS: Layers = {
  orbitBands: true,
  positionSpread: true,
  assumptions: true,
  trueSizes: false,
};

export const LAYER_ROWS: { key: keyof Layers; label: string; hint: string }[] = [
  { key: "orbitBands", label: "Orbit uncertainty", hint: "band = ±1σ in semi-major axis" },
  {
    key: "positionSpread",
    label: "Position uncertainty",
    hint: "±2σ from propagating the transit epoch to now",
  },
  { key: "assumptions", label: "Assumptions", hint: "assumed line of nodes, direction of Earth" },
  { key: "trueSizes", label: "True sizes", hint: "planets and star at real scale (tiny)" },
];

/** Simulated days per real second. */
export const SPEEDS = [0.1, 0.5, 2, 10] as const;
