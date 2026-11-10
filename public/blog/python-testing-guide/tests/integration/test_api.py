"""Stage 6: in-process HTTP, Pydantic contract, and real temporary persistence."""

import pytest
from fastapi.testclient import TestClient
from document_testing.api import app, get_service
from document_testing.infrastructure import SQLiteDocumentRepository
from document_testing.service import DocumentService

class FakeExtractor:
    def payment_days(self, text: str) -> int:
        return 90

@pytest.fixture
def client(tmp_path):
    database = tmp_path / "api.sqlite3"
    app.dependency_overrides[get_service] = lambda: DocumentService(
        FakeExtractor(), SQLiteDocumentRepository(database)
    )
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()

def test_create_and_retrieve_document_with_contract(client):
    response = client.post(
        "/documents/process",
        json={"document_id": "doc-2", "raw_name": "Ada Lovelace", "text": "anything"},
    )
    assert response.status_code == 201
    expected = {
        "document_id": "doc-2", "borrower_name": "Ada Lovelace",
        "payment_days": 90, "review_route": "manual_review",
    }
    assert response.json() == expected
    stored = client.get("/documents/doc-2")
    assert stored.status_code == 200
    assert stored.json() == expected

def test_request_validation_rejects_missing_id(client):
    response = client.post("/documents/process", json={"raw_name": "Ada", "text": "hello"})
    assert response.status_code == 422

def test_missing_document_is_404(client):
    response = client.get("/documents/not-found")
    assert response.status_code == 404

def test_health_smoke_check(client):
    assert client.get("/health").json() == {"status": "ok"}
