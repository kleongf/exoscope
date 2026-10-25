# ExoScope

A voice-operated exoplanet research workbench for students and educators: investigate planetary systems in 3D using NASA Exoplanet Archive data, and export what was found with its evidence.

## Language

**Investigation**:
The top-level unit of work, framed by one research question. It holds the Samples, Analyses, Artifacts, scene state and Evidence gathered while answering that question, and may span several Systems.
_Avoid_: Session, project, workspace

**Report**:
A point-in-time export of an Investigation. It can be regenerated many times and is never edited directly.
_Avoid_: Research brief, summary, writeup

**System**:
One host star together with its known planets, as catalogued by the archive.
_Avoid_: Planetary system (in identifiers), star system, host

**System view**:
The 3D scene: exactly one System at a time, with its planets on their orbits. Only one System is ever shown in 3D.
_Avoid_: Orrery, star map, galaxy view

## Data

**Sample**:
A set of planets selected from the catalog by explicit, visible filters, possibly spanning many Systems. Samples appear in the table and chart, never in the System view.
_Avoid_: Search results, query, list

**Interpretation**:
An explicit, stated reading of a vague word in a student's request as a concrete filter (e.g. "small" read as radius under 2 Earth radii). Loaded words such as "Earth-like" or "habitable" always carry a caveat that the catalog cannot establish them.
_Avoid_: Assumption, mapping, default

**Live result**:
Data fetched from the NASA archive during the current Investigation, stamped with its fetch time.
_Avoid_: Real-time data

**Web source**:
A web page found by search and cited in an answer or Report, with its URL, title and retrieval time. Web sources can be cited but never feed the table, chart or System view, which show archive data only.
_Avoid_: Reference (reserved for the archive's source papers), link, citation

**Snapshot**:
A timestamped, pre-fetched copy of archive data, used when a live fetch fails. Anything that comes from a Snapshot is always labelled as cached, never presented as live.
_Avoid_: Cache (in user-facing text), offline data
