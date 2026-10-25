# 05: Honest orbits

**What to build:** The System view becomes scientifically honest. Orbits are Keplerian ellipses at true relative scale, using each planet's eccentricity and ω. Planets are placed by propagating from their transit epochs, and time can play. The default camera looks down on the orbital plane.

Planet sizes are exaggerated and labelled with the factor. A persistent badge reads: "View rotated: system is edge-on from Earth · Positions extrapolated from transit epochs · Planet sizes ×N · Not an N-body simulation."

Clicking a planet selects it and fills the right panel with its properties. Each value shows its unit and uncertainty; its source paper appears in a Radix tooltip. Missing values say "missing".

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Orbit sizes and periods match the loaded values (checked by a unit test on the orbit maths)
- [ ] The badge is always visible and states the size factor in use
- [ ] Selecting a planet fills the property panel, and every value has a source-paper tooltip
- [ ] A planet missing a needed orbital element is drawn on a clearly schematic orbit and labelled, never invented
