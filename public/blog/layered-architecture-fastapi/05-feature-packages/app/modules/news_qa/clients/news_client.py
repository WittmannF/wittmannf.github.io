class NewsClient:
    def fetch(self, topic: str) -> list[str]:
        return [f"{topic}: earnings update", f"{topic}: product launch update"]
