"""A deliberately small, deterministic document-processing example."""

from pathlib import Path
import re
from typing import Protocol

from fastapi import Depends, FastAPI
from pydantic import BaseModel, Field


class DocumentInput(BaseModel):
    document_id: str = Field(min_length=1)
    raw_name: str
    text: str


class DocumentOutput(BaseModel):
    document_id: str
    borrower_name: str
    payment_days: int | None
    review_route: str


def normalize_name(value: str) -> str:
    """Collapse whitespace while preserving the name's original capitalization."""
    normalized = " ".join(value.split())
    if not normalized:
        raise ValueError("borrower_name cannot be blank")
    return normalized


def route_for_review(payment_days: int | None) -> str:
    """Synthetic business rule for the tutorial, not a lending policy."""
    if payment_days is None or not 1 <= payment_days <= 60:
        return "manual_review"
    return "auto_accept"


def load_document(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class Extractor(Protocol):
    def payment_days(self, text: str) -> int | None: ...


class RegexExtractor:
    def payment_days(self, text: str) -> int | None:
        match = re.search(r"\bpayment terms\s*:\s*(\d+)\s+days?\b", text, flags=re.I)
        return int(match.group(1)) if match else None


class DocumentService:
    def __init__(self, extractor: Extractor):
        self.extractor = extractor

    def process(self, document: DocumentInput) -> DocumentOutput:
        days = self.extractor.payment_days(document.text)
        return DocumentOutput(
            document_id=document.document_id,
            borrower_name=normalize_name(document.raw_name),
            payment_days=days,
            review_route=route_for_review(days),
        )


def get_service() -> DocumentService:
    return DocumentService(RegexExtractor())


app = FastAPI(title="Document Processing Tutorial")


@app.post("/documents/process", response_model=DocumentOutput)
def process_document(document: DocumentInput, service: DocumentService = Depends(get_service)) -> DocumentOutput:
    return service.process(document)
