class ArticleRepository:
    def __init__(self) -> None:
        self._articles: list[tuple[str, set[str]]] = []

    def add(self, text: str, embedding: set[str]) -> bool:
        if any(article == text for article, _ in self._articles):
            return False
        self._articles.append((text, embedding))
        return True

    def retrieve(self, embedding: set[str], top_k: int = 2) -> list[str]:
        ranked = sorted(
            self._articles,
            key=lambda item: len(embedding.intersection(item[1])),
            reverse=True,
        )
        return [text for text, _ in ranked[:top_k]]
