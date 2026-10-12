from fastapi import APIRouter, HTTPException

from schemas import AnswerResponse, IngestRequest, QuestionRequest
from services import NewsQAService


router = APIRouter()
_service: NewsQAService | None = None


def set_service(service: NewsQAService) -> None:
    global _service
    _service = service


def get_service() -> NewsQAService:
    if _service is None:
        raise HTTPException(status_code=500, detail="Service not configured")
    return _service


@router.post("/ingest")
def ingest(request: IngestRequest) -> dict[str, int]:
    return {"added": get_service().ingest(request.topic)}


@router.post("/answer", response_model=AnswerResponse)
def answer(request: QuestionRequest) -> AnswerResponse:
    return get_service().answer(request.question)
