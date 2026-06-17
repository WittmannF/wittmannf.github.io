class NewsAPIClient:
    def fetch(self, topic: str) -> list[str]:
        return [
            f"{topic}: central banks signal caution on rates",
            f"{topic}: chip makers announce new AI accelerators",
            f"{topic}: startups expand infrastructure spending",
        ]
