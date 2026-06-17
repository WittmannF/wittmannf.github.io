from app.modules.news_qa.clients import EmbeddingClient, LLMClient, NewsClient
from app.modules.news_qa.repositories import ArticleRepository
from app.modules.news_qa.schemas import AnswerResponse


class NewsQAService:
    def __init__(
        self,
        article_repo: ArticleRepository,
        news_client: NewsClient,
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
            if self.article_repo.add(article, self.embedding_client.embed(article)):
                added += 1
        return added

    def answer(self, question: str) -> AnswerResponse:
        sources = self.article_repo.retrieve(self.embedding_client.embed(question))
        return AnswerResponse(
            answer=self.llm_client.answer(question, sources),
            sources=sources,
        )
