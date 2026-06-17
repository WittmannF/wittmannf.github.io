from app.modules.news_qa.clients.embedding_client import EmbeddingClient
from app.modules.news_qa.clients.news_client import NewsClient
from app.modules.news_qa.repositories.article_repository import ArticleRepository


class IngestArticles:
    def __init__(
        self,
        article_repository: ArticleRepository,
        news_client: NewsClient,
        embedding_client: EmbeddingClient,
    ) -> None:
        self.article_repository = article_repository
        self.news_client = news_client
        self.embedding_client = embedding_client

    def execute(self, topic: str) -> int:
        added = 0
        for article in self.news_client.fetch(topic):
            embedding = self.embedding_client.embed(article)
            if self.article_repository.add(article, embedding):
                added += 1
        return added
