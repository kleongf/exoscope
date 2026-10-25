"""Catalog: the only module that talks to the NASA archive (TAP) or a Snapshot."""

from exoscope.catalog.errors import (
    AmbiguousSystemError,
    CatalogError,
    CatalogUnavailableError,
    InvalidSearchError,
    UnknownFieldError,
    UnknownSystemError,
)
from exoscope.catalog.load_system import load_system
from exoscope.catalog.models import System
from exoscope.catalog.sample_models import Filter, Interpretation, Sample, Sort
from exoscope.catalog.search import search_catalog

__all__ = [
    "AmbiguousSystemError",
    "CatalogError",
    "CatalogUnavailableError",
    "Filter",
    "Interpretation",
    "InvalidSearchError",
    "Sample",
    "Sort",
    "System",
    "UnknownFieldError",
    "UnknownSystemError",
    "load_system",
    "search_catalog",
]
