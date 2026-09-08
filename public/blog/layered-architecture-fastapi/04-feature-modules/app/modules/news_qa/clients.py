class NewsClient:
    def fetch(self, topic: str) -> list[str]:
        return [f"{topic}: market update", f"{topic}: AI infrastructure update"]


class EmbeddingClient:
    def embed(self, text: str) -> set[str]:
        return set(text.lower().split())


class LLMClient:
    def answer(self, question: str, sources: list[str]) -> str:
        return f"{question} -> {sources}"
