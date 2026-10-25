import httpx
import pytest

from exoscope.catalog.errors import CatalogUnavailableError
from exoscope.catalog.fields import PLANET_FIELDS, STAR_FIELDS, FieldSpec
from exoscope.catalog.models import Measured
from exoscope.catalog.parse import parse_reference, quantity
from exoscope.catalog.tap import query_tap

REFLINK = (
    "<a refstr=AGOL_ET_AL__2021 href=https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A"
    "/abstract target=ref>Agol et al. 2021</a>"
)


def spec(column: str) -> FieldSpec:
    return next(s for s in (*PLANET_FIELDS, *STAR_FIELDS) if s.column == column)


def test_reflink_becomes_label_and_url() -> None:
    ref = parse_reference(REFLINK)
    assert ref is not None
    assert ref.label == "Agol et al. 2021"
    assert ref.url == "https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract"


def test_errors_are_positive_sizes_and_limits_are_flagged() -> None:
    row = {"pl_rade": 1.0, "pl_radeerr1": 0.1, "pl_radeerr2": -0.2, "pl_radelim": 1}
    value = quantity(row, spec("pl_rade"))
    assert isinstance(value, Measured)
    assert (value.err_lo, value.err_hi, value.limit) == (0.2, 0.1, "upper")


def test_argument_of_periastron_is_normalised_into_0_360() -> None:
    for raw, expected in ((-8.73, 351.27), (368.81, 8.81)):
        value = quantity({"pl_orblper": raw}, spec("pl_orblper"))
        assert isinstance(value, Measured)
        assert value.value == pytest.approx(expected)


def test_stellar_luminosity_is_converted_from_log10() -> None:
    row = {"st_lum": -3.0, "st_lumerr1": 0.1, "st_lumerr2": -0.1}
    value = quantity(row, spec("st_lum"))
    assert isinstance(value, Measured)
    assert value.value == pytest.approx(1e-3)
    assert value.err_hi == pytest.approx(10**-2.9 - 1e-3)
    assert value.err_lo == pytest.approx(1e-3 - 10**-3.1)
    assert value.note


def test_non_json_archive_response_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    def blocked(*_args: object, **_kwargs: object) -> httpx.Response:
        request = httpx.Request("GET", "https://example.test")
        return httpx.Response(200, text="<html>Attention Required</html>", request=request)

    monkeypatch.setattr(httpx, "get", blocked)
    with pytest.raises(CatalogUnavailableError):
        query_tap("select 1")


def test_network_failure_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    def timeout(*_args: object, **_kwargs: object) -> httpx.Response:
        raise httpx.ReadTimeout("timed out")

    monkeypatch.setattr(httpx, "get", timeout)
    with pytest.raises(CatalogUnavailableError):
        query_tap("select 1")
