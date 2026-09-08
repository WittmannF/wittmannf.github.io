from app.modules.news_qa.repositories.vector_repository import VectorRepository


class ArticleRepository:
    def __init__(self, vector_repository: VectorRepository) -> None:
        self.vector_repository = vector_repository

    def add(self, article: str, embedding: set[str]) -> bool:
        return self.vector_repository.add(article, embedding)

    def retrieve(self, embedding: set[str], top_k: int = 2) -> list[str]:
        return self.vector_repository.search(embedding, top_k=top_k)
