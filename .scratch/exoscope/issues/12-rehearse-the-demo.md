# 12: Rehearse the demo

**What to build:** The six-beat demo in `docs/intent.md` runs end to end, twice, without intervention: open TRAPPIST-1, control the scene, compare, the liquid-water question with web search, the live Sample search, and the Report.

The Playwright smoke script is extended to click through the typed version of the demo and capture a screenshot after each beat. The TOI-700 backup System is checked to load and render.

**Blocked by:** 05, 06, 07, 09, 10, 11

**Status:** ready-for-agent

- [ ] Two full spoken run-throughs succeed; any failure is fixed or written into the demo script as a known workaround
- [ ] The liquid-water beat cites a Web source in both runs and never states habitability as fact
- [ ] The Playwright run captures a screenshot per beat
- [ ] TOI-700 loads and renders as the backup
