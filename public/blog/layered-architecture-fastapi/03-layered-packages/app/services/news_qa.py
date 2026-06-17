from app.clients.embeddings import EmbeddingClient
from app.clients.llm import LLMClient
from app.clients.news_api import NewsAPIClient
from app.repositories.articles import ArticleRepository
from app.schemas.news_qa import AnswerResponse


class NewsQAService:
    def __init__(
        self,
        article_repo: ArticleRepository,
        news_client: NewsAPIClient,
        embedding_client: EmbeddingClient,
        llm_client: LLMClient,
    ) -> None:
        self.article_repo = article_repo
        self.news_client = news_client
        self.embedding_client = embedding_client
        self.llm_client = llm_client

    def ingest(self, topic: str) -> int:
        added = 0
        for article in self.news_client.fetch(topic):
            embedding = self.embedding_client.embed(article)
            if self.article_repo.add(article, embedding):
                added += 1
        return added

    def answer(self, question: str) -> AnswerResponse:
        embedding = self.embedding_client.embed(question)
        sources = self.article_repo.retrieve(embedding)
        return AnswerResponse(
            answer=self.llm_client.answer(question, sources),
            sources=sources,
        )
