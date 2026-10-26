import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fixtureSystem } from "./voice-fixtures.mjs";
import { webResult } from "./web-fixtures.mjs";

const backend = fileURLToPath(new URL("../../backend/", import.meta.url));
const python = process.env.EXOSCOPE_TEST_PYTHON ?? `${backend}.venv/bin/python`;

// Real canonical ProjectStore files and typed turn records; no /turn/provider mocks.
function fixture(script, input) {
  return JSON.parse(
    execFileSync(python, ["-c", script], {
      cwd: backend,
      input: JSON.stringify(input),
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    }),
  );
}

const imports = `
import json, sys
from datetime import UTC, datetime
from pathlib import Path
from exoscope.catalog.models import System
from exoscope.project import ProjectStore, StepRecord, record_turn
data = json.load(sys.stdin)
store = ProjectStore(Path(data["dir"]))
now = datetime.now(UTC)
`;

export function seedReportProject(dir) {
  return fixture(
    imports +
      `
from exoscope.catalog.sample_models import Sample
from exoscope.catalog.models import SnapshotProvenance
from exoscope.catalog.parse import build_system
from exoscope.catalog.snapshot import SnapshotFile
from exoscope.compare import compare
from exoscope.websearch.models import WebSearchResult
system = System.model_validate(data["system"])
snapshot = SnapshotFile.model_validate_json(
    Path("exoscope/catalog/snapshots/toi-700.json").read_text()
)
other = build_system(snapshot.rows, SnapshotProvenance(
    source="NASA Exoplanet Archive pscomppars", snapshot_date=snapshot.snapshot_date))
sample = Sample.model_validate({
    "filters": [{"field": "radius", "op": "<", "value": 2}],
    "interpretations": [{"term": "small", "as": "radius under 2 Earth radii",
        "caveat": "Size alone establishes no habitability"}],
    "sort": None, "limit": 10,
    "fields": [
        {"name": "radius", "label": "Radius", "unit": "Earth radii"},
        {"name": "insolation", "label": "Insolation", "unit": "Earth flux"}],
    "planets": [{"name": p.name, "hostname": system.hostname,
        "values": {"radius": p.radius, "insolation": p.insolation}}
        for p in system.planets],
    "matched": 2, "truncated": False,
    "excluded": {"count": 1, "by_field": {"radius": 1}, "reason": "missing radius"},
    "provenance": system.provenance, "notes": ["Explicit browser fixture"]
})
project = store.create("Smoke: immutable Report evidence", now=now)
def step(name):
    return StepRecord(name=name, status="completed", detail="Explicit browser fixture",
        elapsed_ms=12.5)
record_turn(project, "Open TOI-700", "Saved backup System.", now=now,
    system=other, steps=[step("load_system")])
record_turn(project, "Open TRAPPIST-1", "Saved radius evidence.", now=now,
    system=system, steps=[step("load_system")])
record_turn(project, "Compare radius and irradiation", "Saved comparison.", now=now,
    comparison=compare(system, "radius", "insolation"), steps=[step("compare")])
record_turn(project, "Find small planets", "Saved Sample.", now=now,
    sample=sample, steps=[step("search_catalog")])
record_turn(project, "Does any of these have liquid water?",
    "The archive cannot establish liquid water; see the saved Web sources.", now=now,
    web_search=WebSearchResult.model_validate(data["web"]), steps=[step("web_search")])
store.save(project)
print(store.load(project.id).model_dump_json())
`,
    { dir, system: fixtureSystem, web: webResult },
  );
}

export function advanceReportProject(dir, id) {
  return fixture(
    imports +
      `
project = store.load(data["id"])
system = next(s.system for s in project.systems if s.system.hostname == "TRAPPIST-1")
system = system.model_copy(deep=True)
system.planets[0].radius.value = 9.99
record_turn(project, "Later explicitly seeded Project work", "Updated saved evidence.",
    now=now, system=system,
    steps=[StepRecord(name="load_system", status="completed",
        detail="Changed source evidence after writing Reports", elapsed_ms=1)])
store.save(project)
print(store.load(project.id).model_dump_json())
`,
    { dir, id },
  );
}
