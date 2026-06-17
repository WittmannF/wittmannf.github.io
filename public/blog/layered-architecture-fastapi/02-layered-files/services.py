from repositories import ArticleRepository, NewsRepository
from schemas import AnswerResponse


class NewsQAService:
    def __init__(
        self,
        article_repo: ArticleRepository,
        news_repo: NewsRepository,
    ) -> None:
        self.article_repo = article_repo
        self.news_repo = news_repo

    def ingest(self, topic: str) -> int:
        added = 0
        for article in self.news_repo.fetch(topic):
            if self.article_repo.add(article):
                added += 1
        return added

    def answer(self, question: str) -> AnswerResponse:
        sources = self.article_repo.retrieve(question)
        joined_context = " | ".join(sources) or "no context"
        return AnswerResponse(
            answer=f"Answering '{question}' using: {joined_context}",
            sources=sources,
        )
