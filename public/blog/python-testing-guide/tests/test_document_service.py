import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from hypothesis import given, strategies as st

from document_service import (
    DocumentInput,
    DocumentService,
    RegexExtractor,
    app,
    get_service,
    load_document,
    normalize_name,
    route_for_review,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  Ana    Silva ", "Ana Silva"),
        ("José\tSantos", "José Santos"),
        ("One", "One"),
    ],
)
def test_normalize_name(raw, expected):
    assert normalize_name(raw) == expected


def test_blank_names_are_rejected():
    with pytest.raises(ValueError, match="cannot be blank"):
        normalize_name(" \t  ")


@pytest.mark.parametrize(
    ("days", "route"),
    [(30, "auto_accept"), (61, "manual_review"), (None, "manual_review"), (0, "manual_review")],
)
def test_review_route(days, route):
    assert route_for_review(days) == route


@pytest.mark.parametrize(
    ("text", "expected"),
    [("Payment Terms: 30 days", 30), ("payment terms: 1 day", 1), ("No payment terms provided", None)],
)
def test_regex_extraction(text, expected):
    assert RegexExtractor().payment_days(text) == expected


class FakeExtractor:
    def __init__(self, days=30):
        self.days = days
        self.received = []

    def payment_days(self, text):
        self.received.append(text)
        return self.days


def test_service_uses_extractor_contract_not_its_implementation():
    fake = FakeExtractor(days=45)
    document = DocumentInput(document_id="doc-1", raw_name="  Ana  Silva ", text="any input")
    result = DocumentService(fake).process(document)
    assert result.borrower_name == "Ana Silva"
    assert result.payment_days == 45
    assert result.review_route == "auto_accept"
    assert fake.received == ["any input"]


@pytest.fixture
def client():
    app.dependency_overrides[get_service] = lambda: DocumentService(FakeExtractor(days=90))
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def test_api_contract_with_dependency_override(client):
    response = client.post(
        "/documents/process",
        json={"document_id": "doc-2", "raw_name": "Ada Lovelace", "text": "irrelevant"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "document_id": "doc-2", "borrower_name": "Ada Lovelace",
        "payment_days": 90, "review_route": "manual_review",
    }


def test_api_rejects_invalid_request(client):
    response = client.post("/documents/process", json={"raw_name": "Ada", "text": "something"})
    assert response.status_code == 422


def test_tmp_path_isolated_files(tmp_path):
    path = tmp_path / "incoming.txt"
    path.write_text("Payment Terms: 30 days", encoding="utf-8")
    assert load_document(path) == "Payment Terms: 30 days"


@given(st.text())
def test_name_normalization_is_idempotent(raw):
    if not raw.split():
        with pytest.raises(ValueError):
            normalize_name(raw)
    else:
        cleaned = normalize_name(raw)
        assert normalize_name(cleaned) == cleaned


CASES = json.loads((Path(__file__).parent / "fixtures" / "golden_cases.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["id"])
def test_regression_cases(case):
    assert RegexExtractor().payment_days(case["text"]) == case["expected_payment_days"]
