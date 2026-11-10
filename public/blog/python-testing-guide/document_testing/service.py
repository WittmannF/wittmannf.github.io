"""Application workflow: domain behavior composed through explicit ports."""

from .domain import DocumentInput, DocumentOutput, normalize_name, route_for_review
from .ports import DocumentRepository, Extractor


class DocumentService:
    def __init__(self, extractor: Extractor, repository: DocumentRepository):
        self.extractor = extractor
        self.repository = repository

    def process(self, document: DocumentInput) -> DocumentOutput:
        name = normalize_name(document.raw_name)
        days = self.extractor.payment_days(document.text)
        output = DocumentOutput(
            document_id=document.document_id,
            borrower_name=name,
            payment_days=days,
            review_route=route_for_review(days),
        )
        self.repository.save(output)
        return output

    def get(self, document_id: str) -> DocumentOutput | None:
        return self.repository.get(document_id)
