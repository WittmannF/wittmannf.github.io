from app.repositories.vector_store import VectorStore


class ArticleRepository:
    def __init__(self, vector_store: VectorStore) -> None:
        self.vector_store = vector_store

    def add(self, article: str, embedding: set[str]) -> bool:
        return self.vector_store.add(article, embedding)

    def retrieve(self, embedding: set[str], top_k: int = 2) -> list[str]:
        return self.vector_store.search(embedding, top_k=top_k)
