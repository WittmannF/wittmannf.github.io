"""HTTP adapter: translate web requests into application calls."""

import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException

from .domain import DocumentInput, DocumentOutput
from .infrastructure import RegexExtractor, SQLiteDocumentRepository
from .service import DocumentService


app = FastAPI(title="Testable Document Processing")


def get_service() -> DocumentService:
    db_path = Path(os.environ.get("DOCUMENT_DB_PATH", "documents-demo.sqlite3"))
    return DocumentService(RegexExtractor(), SQLiteDocumentRepository(db_path))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/documents/process", response_model=DocumentOutput, status_code=201)
def process_document(
    document: DocumentInput, service: DocumentService = Depends(get_service)
) -> DocumentOutput:
    return service.process(document)


@app.get("/documents/{document_id}", response_model=DocumentOutput)
def get_document(
    document_id: str, service: DocumentService = Depends(get_service)
) -> DocumentOutput:
    record = service.get(document_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return record
