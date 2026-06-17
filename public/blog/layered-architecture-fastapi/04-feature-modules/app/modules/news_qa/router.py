from fastapi import APIRouter, Depends

from app.api.deps import get_news_qa_service
from app.modules.news_qa.schemas import AnswerResponse, IngestRequest, QuestionRequest
from app.modules.news_qa.service import NewsQAService


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
