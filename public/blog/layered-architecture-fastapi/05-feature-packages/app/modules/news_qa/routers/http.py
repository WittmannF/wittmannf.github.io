from fastapi import APIRouter

from app.modules.news_qa.clients.embedding_client import EmbeddingClient
from app.modules.news_qa.clients.llm_client import LLMClient
from app.modules.news_qa.clients.news_client import NewsClient
from app.modules.news_qa.repositories.article_repository import ArticleRepository
from app.modules.news_qa.repositories.vector_repository import VectorRepository
from app.modules.news_qa.schemas.requests import IngestRequest, QuestionRequest
from app.modules.news_qa.schemas.responses import AnswerResponse
from app.modules.news_qa.services.answer_question import AnswerQuestion
from app.modules.news_qa.services.ingest_articles import IngestArticles


router = APIRouter()
vector_repository = VectorRepository()
article_repository = ArticleRepository(vector_repository=vector_repository)
embedding_client = EmbeddingClient()


@router.post("/ingest")
def ingest(request: IngestRequest) -> dict[str, int]:
    use_case = IngestArticles(
        article_repository=article_repository,
        news_client=NewsClient(),
        embedding_client=embedding_client,
    )
    return {"added": use_case.execute(request.topic)}


@router.post("/answer", response_model=AnswerResponse)
def answer(request: QuestionRequest) -> AnswerResponse:
    use_case = AnswerQuestion(
        article_repository=article_repository,
        embedding_client=embedding_client,
        llm_client=LLMClient(),
    )
    return use_case.execute(request.question)
