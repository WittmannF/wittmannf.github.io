"""Stage 1-3: unit tests exercise pure business behavior."""

import pytest
from document_testing.domain import normalize_name, route_for_review
from walkthrough.stage01_one_file import process_document

def test_first_behavior_one_file():
    assert process_document("doc-1", "  Ana    Silva ", 30) == {
        "document_id": "doc-1", "borrower_name": "Ana Silva",
        "payment_days": 30, "review_route": "auto_accept",
    }

@pytest.mark.parametrize(
    ("raw", "expected"),
    [(" Ana  Silva ", "Ana Silva"), ("José\tSantos", "José Santos"), ("One", "One")],
)
def test_normalize_name(raw, expected):
    assert normalize_name(raw) == expected

def test_blank_names_raise_a_meaningful_error():
    with pytest.raises(ValueError, match="cannot be blank"):
        normalize_name(" \t ")

@pytest.mark.parametrize(
    ("days", "expected"),
    [(1, "auto_accept"), (30, "auto_accept"), (60, "auto_accept"),
     (61, "manual_review"), (0, "manual_review"), (-1, "manual_review"), (None, "manual_review")],
)
def test_review_route(days, expected):
    assert route_for_review(days) == expected
