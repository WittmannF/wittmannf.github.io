"""Ports express what the application needs, without choosing infrastructure."""

from typing import Protocol

from .domain import DocumentOutput


class Extractor(Protocol):
    def payment_days(self, text: str) -> int | None: ...


class DocumentRepository(Protocol):
    def save(self, document: DocumentOutput) -> None: ...
    def get(self, document_id: str) -> DocumentOutput | None: ...
