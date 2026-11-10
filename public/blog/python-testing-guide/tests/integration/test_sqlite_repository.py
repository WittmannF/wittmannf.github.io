"""Stage 5: a real SQLite boundary, not a mocked repository."""

from document_testing.domain import DocumentOutput
from document_testing.infrastructure import SQLiteDocumentRepository

def test_sqlite_persists_and_reads_across_repository_instances(tmp_path):
    database = tmp_path / "documents.sqlite3"
    first = SQLiteDocumentRepository(database)
    expected = DocumentOutput(
        document_id="D-1", borrower_name="Ada Lovelace",
        payment_days=None, review_route="manual_review",
    )
    first.save(expected)
    second = SQLiteDocumentRepository(database)
    assert second.get("D-1") == expected
    assert second.get("unknown") is None

def test_sqlite_upsert_updates_existing_document(tmp_path):
    repo = SQLiteDocumentRepository(tmp_path / "documents.sqlite3")
    original = DocumentOutput(
        document_id="D-2", borrower_name="Ada", payment_days=30, review_route="auto_accept",
    )
    updated = original.model_copy(update={"payment_days": 90, "review_route": "manual_review"})
    repo.save(original)
    repo.save(updated)
    assert repo.get("D-2") == updated
