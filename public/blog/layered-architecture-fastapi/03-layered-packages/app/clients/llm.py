class LLMClient:
    def answer(self, question: str, context: list[str]) -> str:
        joined_context = " | ".join(context) or "no context"
        return f"Answering '{question}' using: {joined_context}"
