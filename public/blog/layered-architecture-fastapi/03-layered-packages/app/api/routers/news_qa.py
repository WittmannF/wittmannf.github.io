from fastapi import APIRouter, Depends

from app.api.deps import get_news_qa_service
from app.schemas.news_qa import AnswerResponse, IngestRequest, QuestionRequest
from app.services.news_qa import NewsQAService


router = APIRouter()


@router.post("/ingest")
def ingest(
    request: IngestRequest,
    service: NewsQAService = Depends(get_news_qa_service),
) -> dict[str, int]:
    return {"added": service.ingest(request.topic)}


@router.post("/answer", response_model=AnswerResponse)
def answer(
    request: QuestionRequest,
    service: NewsQAService = Depends(get_news_qa_service),
) -> AnswerResponse:
    return service.answer(request.question)
