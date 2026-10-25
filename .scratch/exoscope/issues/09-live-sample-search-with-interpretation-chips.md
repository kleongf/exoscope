# 09: Live Sample search with Interpretation chips

**What to build:** "Find small planets with periods under 10 days" makes Gemma call `search_catalog` against the archive live. Filters can only use the allowlisted fields and operators, and the backend builds the query; the model never writes SQL.

Gemma states its Interpretation of each vague word aloud ("I'm reading 'small' as radius under 2 Earth radii"). Each Interpretation appears in the left panel as a shadcn Badge that the student can edit in a popover to re-run the search. Loaded words like "Earth-like" always carry a caveat.

The resulting Sample fills the table and chart, with a count of excluded rows and a Live/Cached label. Clicking a planet from another System loads that System live and focuses it.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] The search runs live and returns a Sample with an excluded-row count
- [ ] Each Interpretation is spoken, shown as a chip, and editable; editing re-runs the search
- [ ] A filter on a non-allowlisted field is rejected with an explicit error
- [ ] Clicking a planet from another System switches the System view to it
