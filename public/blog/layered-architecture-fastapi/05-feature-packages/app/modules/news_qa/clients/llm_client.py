class LLMClient:
    def answer(self, question: str, sources: list[str]) -> str:
        return f"{question} -> {sources}"
