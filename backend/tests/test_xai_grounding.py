"""Citation-placement tests, not semantic fact-checking."""

from datetime import timedelta
from typing import Any

import pytest

from exoscope.websearch.grounding import grounded_result
from tests.xai_fixtures import OTHER_URL, URL, annotation, block, response


def test_completed_shape_preserves_text_urls_and_retrieved_only_sources() -> None:
    payload = response()
    result = grounded_result("water", payload)
    assert result.status == "ok"
    assert result.grounded_text == payload["output"][1]["content"][0]["text"]
    assert [source.url for source in result.sources] == [URL, OTHER_URL]
    assert [source.domain for source in result.sources] == ["science.nasa.gov", "www.esa.int"]
    assert result.sources[0].title == "NASA Exoplanets"
    assert result.sources[1].title == "www.esa.int"
    assert result.supports[0].text == "Water remains uncertain."
    assert result.supports[0].source_ids == [result.sources[0].id]
    assert result.sources[1].id not in result.supports[0].source_ids
    assert len({source.retrieved_at for source in result.sources}) == 1
    assert result.sources[0].retrieved_at.utcoffset() == timedelta(0)
    assert result.search_suggestions_html is None


def test_unicode_indices_are_python_characters_and_exclusive() -> None:
    text_block = block("🪐 Café 水: water is uncertain. ")
    citation = text_block["annotations"][0]
    assert citation["start_index"] < len("🪐 Café 水: water is uncertain. ".encode())
    result = grounded_result("water", response(text_block))
    assert result.supports[0].text == "🪐 Café 水: water is uncertain."
    citation["start_index"] = len("🪐 Café 水: water is uncertain. ".encode())
    with pytest.raises(ValueError):
        grounded_result("water", response(text_block))


@pytest.mark.parametrize("marker", [f"[[1]]({URL})", f"[1]({URL})", f"[NASA](<{URL}>)"])
def test_normal_citation_formats(marker: str) -> None:
    text = "Uncertain water. " + marker
    result = grounded_result(
        "water",
        response(
            {
                "type": "output_text",
                "text": text,
                "annotations": [annotation(text, marker)],
            }
        ),
    )
    assert result.supports[0].text == "Uncertain water."


def test_adjacent_citations_deduplicate_and_share_nearby_original_text() -> None:
    one, two = f"[[1]]({URL})", f"[[2]]({OTHER_URL})"
    text = f"Prior paragraph without a citation.\n\nWater is uncertain.{one} {two}"
    annotations = [annotation(text, two, OTHER_URL), annotation(text, one)]
    result = grounded_result(
        "water",
        response(
            {
                "type": "output_text",
                "text": text,
                "annotations": annotations + annotations,
            }
        ),
    )
    assert len(result.supports) == 1
    assert result.supports[0].text == "Water is uncertain."
    assert result.supports[0].source_ids == [source.id for source in result.sources]


def test_multiblocks_local_offsets_stable_ids_deduped_sources_and_timestamp() -> None:
    first, second = block("🪐 Water uncertain."), block("Other claim.")
    payload = response(first, second)
    payload["output"][0]["action"]["sources"].append({"url": URL, "title": "1"})
    result = grounded_result("water", payload)
    assert result.grounded_text == first["text"] + "\n\n" + second["text"]
    assert [support.text for support in result.supports] == ["🪐 Water uncertain.", "Other claim."]
    assert len(result.sources) == 2
    again = response(second)
    again["output"][0]["action"]["sources"].reverse()
    other = grounded_result("different query", again)
    assert {source.url: source.id for source in result.sources} == {
        source.url: source.id for source in other.sources
    }


def test_annotation_only_source_and_numeric_title_fallback() -> None:
    payload = response()
    payload["output"][0]["action"]["sources"] = []
    result = grounded_result("water", payload)
    assert len(result.sources) == 1
    assert result.sources[0].title == "science.nasa.gov"


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "file:///etc/passwd",
        "https://user:pass@example.org/",
        "https:///",
        "https://example.org:invalid",
        "https://example.org:0/",
        "https://example.org/white space",
        "https://example.org/\x00",
        "https://example.org/\x7f",
        "https://example.org\\@evil.org/",
        "https://[invalid/",
    ],
)
def test_unsafe_urls_cannot_create_evidence(url: str) -> None:
    payload = response(block(url=url))
    payload["output"][0]["action"]["sources"] = [{"url": url}]
    with pytest.raises(ValueError):
        grounded_result("water", payload)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("start_index", -1),
        ("start_index", True),
        ("start_index", 1.0),
        ("start_index", "23"),
        ("start_index", None),
        ("end_index", 0),
        ("end_index", 100000),
        ("end_index", False),
        ("url", OTHER_URL),
        ("type", "other"),
    ],
)
def test_malformed_indices_or_markers_never_invent_support(field: str, value: Any) -> None:
    text_block = block()
    text_block["annotations"][0][field] = value
    with pytest.raises(ValueError):
        grounded_result("water", response(text_block))


@pytest.mark.parametrize("annotations", [[], None, {}, [{"type": "url_citation", "url": URL}]])
def test_links_and_retrieval_alone_never_become_citations(annotations: Any) -> None:
    text_block = block()
    text_block["annotations"] = annotations
    with pytest.raises(ValueError):
        grounded_result("water", response(text_block))


@pytest.mark.parametrize("prefix", ["", "\n\n", "!", "Some claim.\n\n"])
def test_orphan_and_image_markers_do_not_attach_to_earlier_paragraph(prefix: str) -> None:
    marker = f"[[1]]({URL})"
    text = prefix + marker
    with pytest.raises(ValueError):
        grounded_result(
            "water",
            response(
                {
                    "type": "output_text",
                    "text": text,
                    "annotations": [annotation(text, marker)],
                }
            ),
        )


def test_invalid_annotation_does_not_discard_other_valid_citations() -> None:
    text_block = block()
    text_block["annotations"].append({"type": "url_citation", "start_index": -1})
    assert grounded_result("water", response(text_block)).status == "ok"


def test_separate_claims_use_text_after_previous_marker() -> None:
    one, two = f"[[1]]({URL})", f"[[2]]({OTHER_URL})"
    text = f"First claim.{one} Second claim.{two}"
    result = grounded_result(
        "water",
        response(
            {
                "type": "output_text",
                "text": text,
                "annotations": [annotation(text, one), annotation(text, two, OTHER_URL)],
            }
        ),
    )
    assert [item.text for item in result.supports] == ["First claim.", "Second claim."]


def test_numbers_are_preserved_without_a_semantic_factchecker() -> None:
    result = grounded_result("water", response(block("The model says 42 °C.")))
    assert result.supports[0].text == "The model says 42 °C."


@pytest.mark.parametrize(
    "marker",
    [
        f"[[1]({URL})",
        f"[1]]({URL})",
        f"[broken]label]({URL})",
        f"[ ]({URL})",
    ],
)
def test_malformed_bracket_markers_cannot_create_support(marker: str) -> None:
    text = "Water uncertain." + marker
    with pytest.raises(ValueError):
        grounded_result(
            "water",
            response(
                {
                    "type": "output_text",
                    "text": text,
                    "annotations": [annotation(text, marker)],
                }
            ),
        )


def test_adjacent_citations_wrapped_on_one_newline_share_text() -> None:
    one, two = f"[[1]]({URL})", f"[[2]]({OTHER_URL})"
    text = f"Water uncertain.{one}\n{two}"
    result = grounded_result(
        "water",
        response(
            {
                "type": "output_text",
                "text": text,
                "annotations": [annotation(text, one), annotation(text, two, OTHER_URL)],
            }
        ),
    )
    assert result.supports[0].source_ids == [source.id for source in result.sources]
