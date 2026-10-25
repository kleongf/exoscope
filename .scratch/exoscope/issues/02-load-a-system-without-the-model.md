# 02: Load a System without the model

**What to build:** `load_system(name)` works as a plain, model-free tool, so it can be tested and reused without Gemma. Given a name like "trappist-1" it returns the System: the host star and every planet, with each value carrying its unit, uncertainty, limit flag and source paper. Missing values are explicitly missing, never zero.

It queries the NASA archive (`pscomppars`) live, with a ~5 s timeout. If that fails it falls back to a bundled Snapshot. The result always says which it was: a Live result with its fetch time, or a Snapshot with its date.

Known archive quirks are handled: stellar luminosity is stored as log10, and the argument of periastron can fall outside 0–360°.

Name lookup is case- and spacing-insensitive. A name matching several Systems, or none, returns an explicit error rather than a guess.

Snapshots are included for TRAPPIST-1 and the backup, TOI-700.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Loading TRAPPIST-1 live returns 7 planets with period, semi-major axis, radius, mass, insolation, eccentricity, inclination, transit epoch and ω, each with unit and source paper
- [ ] With the network blocked, the same call returns the Snapshot, labelled as cached with its date
- [ ] An unknown name and an ambiguous name each return a distinct, explicit error
- [ ] A missing field in the archive comes back as missing, not 0
- [ ] Tests cover all of the above without network access
