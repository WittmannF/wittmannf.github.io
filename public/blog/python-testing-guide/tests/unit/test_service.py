"""Stage 4: unit test service behavior with fakes for external boundaries."""

import pytest
from document_testing.domain import DocumentInput, DocumentOutput
from document_testing.service import DocumentService

class FakeExtractor:
    def __init__(self, days=30):
        self.days = days
        self.calls = []

    def payment_days(self, text: str) -> int | None:
        self.calls.append(text)
        return self.days

class FakeRepository:
    def __init__(self):
        self.records: dict[str, DocumentOutput] = {}

    def save(self, document: DocumentOutput) -> None:
        self.records[document.document_id] = document

    def get(self, document_id: str) -> DocumentOutput | None:
        return self.records.get(document_id)

def test_service_processes_and_saves_using_fakes():
    extractor = FakeExtractor(days=45)
    repository = FakeRepository()
    service = DocumentService(extractor, repository)
    result = service.process(
        DocumentInput(document_id="doc-1", raw_name=" Ana  Silva ", text="some text")
    )
    assert result.borrower_name == "Ana Silva"
    assert result.payment_days == 45
    assert result.review_route == "auto_accept"
    assert service.get("doc-1") == result
    assert extractor.calls == ["some text"]

def test_extraction_failure_does_not_persist_partial_record():
    class FailingExtractor:
        def payment_days(self, text: str) -> int | None:
            raise RuntimeError("provider temporarily unavailable")

    repository = FakeRepository()
    service = DocumentService(FailingExtractor(), repository)
    with pytest.raises(RuntimeError, match="unavailable"):
        service.process(DocumentInput(document_id="bad", raw_name="Ada", text="any"))
    assert repository.records == {}
