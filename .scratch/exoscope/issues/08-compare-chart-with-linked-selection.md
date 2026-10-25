# 08: Compare chart with linked selection

**What to build:** "Compare radius and irradiation" makes Gemma call `compare`. The bottom drawer opens with a Plotly scatter and a shadcn table of the same planets, using archive values only. Axes and columns show units. Uncertainties appear as error bars and in the table. Planets missing a value are listed as excluded with the reason, not plotted at zero.

Selection is linked: clicking a chart point or table row focuses that planet in the System view, and selecting a planet in 3D highlights its point and row.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] The chart and table show identical values for the same planets
- [ ] Missing values are excluded and counted, never plotted as 0
- [ ] Clicking a point focuses the planet in 3D; clicking a planet in 3D highlights the point
- [ ] Only allowlisted properties can be compared; others give an explicit tool error
