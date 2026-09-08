from functools import lru_cache

from app.modules.news_qa.clients import EmbeddingClient, LLMClient, NewsClient
from app.modules.news_qa.repositories import ArticleRepository
from app.modules.news_qa.service import NewsQAService


@lru_cache
def get_news_qa_service() -> NewsQAService:
    return NewsQAService(
        article_repo=ArticleRepository(),
        news_client=NewsClient(),
        embedding_client=EmbeddingClient(),
        llm_client=LLMClient(),
    )
