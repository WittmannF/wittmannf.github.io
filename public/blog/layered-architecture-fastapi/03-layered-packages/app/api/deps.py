from functools import lru_cache

from app.clients.embeddings import EmbeddingClient
from app.clients.llm import LLMClient
from app.clients.news_api import NewsAPIClient
from app.repositories.articles import ArticleRepository
from app.repositories.vector_store import VectorStore
from app.services.news_qa import NewsQAService


@lru_cache
def get_article_repository() -> ArticleRepository:
    return ArticleRepository(vector_store=VectorStore())


@lru_cache
def get_news_client() -> NewsAPIClient:
    return NewsAPIClient()


def get_news_qa_service() -> NewsQAService:
    return NewsQAService(
        article_repo=get_article_repository(),
        news_client=get_news_client(),
        embedding_client=EmbeddingClient(),
        llm_client=LLMClient(),
    )
