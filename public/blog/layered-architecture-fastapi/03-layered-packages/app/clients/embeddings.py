class EmbeddingClient:
    def embed(self, text: str) -> set[str]:
        return set(text.lower().split())
