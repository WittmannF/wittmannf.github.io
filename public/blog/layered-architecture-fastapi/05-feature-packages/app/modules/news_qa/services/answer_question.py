from app.modules.news_qa.clients.embedding_client import EmbeddingClient
from app.modules.news_qa.clients.llm_client import LLMClient
from app.modules.news_qa.repositories.article_repository import ArticleRepository
from app.modules.news_qa.schemas.responses import AnswerResponse


class AnswerQuestion:
    def __init__(
        self,
        article_repository: ArticleRepository,
        embedding_client: EmbeddingClient,
        llm_client: LLMClient,
    ) -> None:
        self.article_repository = article_repository
        self.embedding_client = embedding_client
        self.llm_client = llm_client

    def execute(self, question: str) -> AnswerResponse:
        sources = self.article_repository.retrieve(self.embedding_client.embed(question))
        return AnswerResponse(
            answer=self.llm_client.answer(question, sources),
            sources=sources,
        )
