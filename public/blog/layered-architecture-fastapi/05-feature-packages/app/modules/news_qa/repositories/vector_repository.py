class VectorRepository:
    def __init__(self) -> None:
        self._items: list[tuple[str, set[str]]] = []

    def add(self, text: str, embedding: set[str]) -> bool:
        if any(existing_text == text for existing_text, _ in self._items):
            return False
        self._items.append((text, embedding))
        return True

    def search(self, embedding: set[str], top_k: int) -> list[str]:
        ranked = sorted(
            self._items,
            key=lambda item: len(embedding.intersection(item[1])),
            reverse=True,
        )
        return [text for text, _ in ranked[:top_k]]
