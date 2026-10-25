// Generated from the backend: compare(TRAPPIST-1 Snapshot, "radius", "insolation").
// Dev preview data only; the real app gets comparisons through /turn.
import type { ComparisonView } from "@/features/compare/types";

export const trappist1RadiusVsInsolation: ComparisonView = {
  x: {
    label: "Planet radius",
    unit: "Earth radii",
  },
  y: {
    label: "Insolation",
    unit: "Earth flux",
  },
  rows: [
    {
      planet: "TRAPPIST-1 b",
      hostname: "TRAPPIST-1",
      x: {
        status: "measured",
        value: 1.116,
        errLo: 0.012,
        errHi: 0.014,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      y: {
        status: "measured",
        value: 4.153,
        errLo: 0.159,
        errHi: 0.161,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      excluded: null,
    },
    {
      planet: "TRAPPIST-1 c",
      hostname: "TRAPPIST-1",
      x: {
        status: "measured",
        value: 1.097,
        errLo: 0.012,
        errHi: 0.014,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      y: {
        status: "measured",
        value: 2.214,
        errLo: 0.085,
        errHi: 0.086,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      excluded: null,
    },
    {
      planet: "TRAPPIST-1 d",
      hostname: "TRAPPIST-1",
      x: {
        status: "measured",
        value: 0.788,
        errLo: 0.01,
        errHi: 0.011,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      y: {
        status: "measured",
        value: 1.115,
        errLo: 0.043,
        errHi: 0.043,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      excluded: null,
    },
    {
      planet: "TRAPPIST-1 e",
      hostname: "TRAPPIST-1",
      x: {
        status: "measured",
        value: 0.92,
        errLo: 0.012,
        errHi: 0.013,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      y: {
        status: "measured",
        value: 0.646,
        errLo: 0.025,
        errHi: 0.025,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      excluded: null,
    },
    {
      planet: "TRAPPIST-1 f",
      hostname: "TRAPPIST-1",
      x: {
        status: "measured",
        value: 1.045,
        errLo: 0.012,
        errHi: 0.013,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      y: {
        status: "measured",
        value: 0.373,
        errLo: 0.014,
        errHi: 0.015,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      excluded: null,
    },
    {
      planet: "TRAPPIST-1 g",
      hostname: "TRAPPIST-1",
      x: {
        status: "measured",
        value: 1.129,
        errLo: 0.013,
        errHi: 0.015,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      y: {
        status: "measured",
        value: 0.252,
        errLo: 0.01,
        errHi: 0.01,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      excluded: null,
    },
    {
      planet: "TRAPPIST-1 h",
      hostname: "TRAPPIST-1",
      x: {
        status: "measured",
        value: 0.755,
        errLo: 0.014,
        errHi: 0.014,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      y: {
        status: "measured",
        value: 0.144,
        errLo: 0.006,
        errHi: 0.006,
        limit: null,
        reference: {
          label: "Agol et al. 2021",
          url: "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract",
        },
      },
      excluded: null,
    },
  ],
  provenance: ["TRAPPIST-1 · Cached · Snapshot 2026-10-25"],
  notes: [
    "pscomppars combines values from different publications; they may not be mutually consistent.",
  ],
};
