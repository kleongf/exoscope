"""Enforce the archive/Web source boundary independently of model instructions."""

import re
from contextvars import ContextVar
from dataclasses import dataclass

from exoscope.catalog import System
from exoscope.catalog.models import Quantity
from exoscope.websearch.models import WebSearchResult

ARCHIVE_FIELDS = re.compile(
    r"\b(radius|radii|size|sizes|period|periods|orbit|orbits|orbital|distance|distances|"
    r"semi[ -]?major|mass|masses|insolation|irradiation|equilibrium|eccentricity|"
    r"inclination|inclinations|transit midpoint|periastron|luminosity|temperature|"
    r"temperatures|right ascension|declination|coordinates|hostname|"
    r"discovery year|discovery method)\b",
    re.I,
)
EXTERNAL_EVIDENCE = re.compile(
    r"\b(water|liquid|surface|ocean|oceans|atmosphere|atmospheric|habitability|habitable|"
    r"life|biosignature|biosignatures|weather|climate|formation|formed|history|"
    r"paper|papers|literature|research|study|studies|news|telescope|"
    r"observation|observations|spectra|spectrum|spectroscopy|interior|composition|"
    r"heating|heated|tides|tidal|causes?|mechanisms?)\b",
    re.I,
)
SYSTEM_METADATA = re.compile(
    r"\b(how many|number of|count(?: of)?)\b.{0,60}\bplanets?\b|"
    r"\bplanets?\s+count\b|"
    r"\b(list|name|names)\b.{0,30}\b(planets?|system|star)\b|"
    r"\b(planets?|system|star)\b.{0,30}\b(names?|called|identity|identities)\b|"
    r"\b(which|what)\s+(planets?|system|star)\b.{0,30}\b(in|is|are|belong)\b|"
    r"\b(current|selected|loaded)\s+(system|planets?)\b",
    re.I,
)
ARCHIVE_LIMITATION = "The archive cannot establish surface liquid water."
UNAVAILABLE = "Web search is unavailable; no Web sources were obtained."


@dataclass
class WebPolicy:
    question: str
    attempted: bool = False
    refusal: str | None = None

    def reserve(self, has_system: bool) -> str | None:
        """Reserve before validation/dispatch, including failures and batched calls."""
        if self.attempted:
            return "Only one web_search attempt is allowed per turn; it was already used."
        self.attempted = True
        if archive_only(self.question):
            self.refusal = (
                "Use archive measurements for this question. Missing archive values stay missing; "
                "Web sources cannot replace them."
            )
        elif not has_system:
            self.refusal = (
                "Load or refresh the relevant archive System before searching for Web sources."
            )
        return self.refusal


# Each synchronous turn gets its own policy, including concurrent worker threads.
CURRENT_WEB_POLICY: ContextVar[WebPolicy | None] = ContextVar("web_policy", default=None)


def archive_only(text: str) -> bool:
    """Comparisons may need both kinds of evidence; a field mention alone is no veto."""
    return bool(ARCHIVE_FIELDS.search(text) or SYSTEM_METADATA.search(text)) and not (
        EXTERNAL_EVIDENCE.search(text)
    )


def unavailable(query: str) -> WebSearchResult:
    return WebSearchResult(status="unavailable", query=query, error=UNAVAILABLE)


def validated_evidence(value: WebSearchResult, query: str) -> WebSearchResult:
    """Source-free or unsupported output cannot become a cited spoken claim."""
    source_ids = {source.id for source in value.sources}
    supported = any(
        support.text.strip()
        and support.text in value.grounded_text
        and support.source_ids
        and set(support.source_ids) <= source_ids
        for support in value.supports
    )
    if value.status != "ok" or not value.grounded_text.strip() or not supported:
        return unavailable(query)
    return value


def _measurement_summary(label: str, quantities: list[tuple[str, Quantity]]) -> str:
    measured = [(q.value, name, q) for name, q in quantities if q.status == "measured"]
    if not measured:
        return f"{label}: missing for all planets."
    low = min(measured, key=lambda item: item[:2])
    high = max(measured, key=lambda item: item[:2])

    def describe(item: tuple[float, str, Quantity]) -> str:
        value, name, quantity = item
        limit = (
            f" [{quantity.limit} limit]" if quantity.status == "measured" and quantity.limit else ""
        )
        return f"{value:g} {quantity.unit or ''} ({name}){limit}".replace("  ", " ")

    summary = f"{label}: {describe(low)}"
    if high != low:
        summary += f" to {describe(high)}"
    if len(measured) != len(quantities):
        summary += "; missing values remain missing"
    papers = sorted({q.reference.label for _, _, q in measured if q.reference})
    if papers:
        summary += f"; source papers: {', '.join(papers)}"
    return f"{summary}."


def archive_finding(system: System | None, question: str) -> str:
    """Summarize only requested typed measurements, independently of Web text."""
    if system is None:
        return ""
    fields = (
        (
            r"\b(radius|radii|size|sizes)\b",
            "Radius",
            [(p.name, p.radius) for p in system.planets],
        ),
        (
            r"\b(period|periods)\b",
            "Orbital period",
            [(p.name, p.orbital_period) for p in system.planets],
        ),
        (
            r"\b(semi[ -]?major(?: axis| axes)?|distance|distances)\b",
            "Semi-major axis",
            [(p.name, p.semi_major_axis) for p in system.planets],
        ),
        (
            r"\b(mass|masses)\b",
            "Mass",
            [(p.name, p.mass) for p in system.planets],
        ),
        (
            r"\b(insolation|irradiation)\b",
            "Insolation",
            [(p.name, p.insolation) for p in system.planets],
        ),
        (
            r"\bequilibrium(?: temperature)?\b",
            "Equilibrium temperature",
            [(p.name, p.equilibrium_temperature) for p in system.planets],
        ),
        (
            r"\beccentricit(?:y|ies)\b",
            "Eccentricity",
            [(p.name, p.eccentricity) for p in system.planets],
        ),
    )
    summaries = [
        _measurement_summary(label, measurements)
        for pattern, label, measurements in fields
        if re.search(pattern, question, re.I)
    ]
    if not summaries:
        return ""
    provenance = system.provenance
    stamp = (
        f"Snapshot {provenance.snapshot_date}"
        if provenance.mode == "snapshot"
        else f"Live result fetched {provenance.fetched_at.isoformat()}"
    )
    return f"NASA Exoplanet Archive ({stamp}): {' '.join(summaries)}"


def web_finding(
    result: WebSearchResult,
    question: str,
    system: System | None = None,
    synthesis: str | None = None,
) -> str:
    """Keep Gemma's synthesis distinct from unchanged provider citation evidence."""
    limitation = (
        ARCHIVE_LIMITATION
        if re.search(r"\b(water|liquid|ocean|oceans)\b", question, re.I)
        else "The archive alone cannot establish this external evidence."
    )
    archive = archive_finding(system, question)
    if result.status != "ok":
        finding = UNAVAILABLE
    elif synthesis and synthesis.strip():
        finding = synthesis.strip()
    else:
        finding = (
            "Gemma could not synthesize a reply from the Web sources. "
            "Original provider support remains available for inspection; it is not a final answer."
        )
    return f"{limitation} {finding} {archive}".strip()
