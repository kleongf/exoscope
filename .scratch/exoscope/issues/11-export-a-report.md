# 11: Export a Report

**What to build:** "Make a report" (or an export button) produces one self-contained HTML Report of the Investigation. It contains:

- the research question
- a numbered log of the tool calls
- the interactive chart, with its data embedded
- a screenshot of the System view
- the data table with units, uncertainties and source papers
- Live/Cached provenance for every dataset
- the Interpretations and Web sources, when the Investigation has any
- a Limitations section, including that `pscomppars` values may come from different papers

A template fills in every number and table from saved data. Gemma writes only the short summary and the limitations prose.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] The exported file opens offline and shows every section listed above that applies
- [ ] Every number in the Report matches the saved data (checked by a test)
- [ ] The Interpretation and Web source sections appear only when there is something to show
- [ ] Exporting twice produces two Reports; neither is edited after export
