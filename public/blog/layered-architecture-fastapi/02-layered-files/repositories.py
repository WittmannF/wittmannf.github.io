from hashlib import sha256


class NewsRepository:
    def fetch(self, topic: str) -> list[str]:
        return [
            f"{topic}: central banks signal caution on rates",
            f"{topic}: chip makers announce new AI accelerators",
            f"{topic}: startups expand infrastructure spending",
        ]


class ArticleRepository:
    def __init__(self) -> None:
        self._articles: list[str] = []
        self._fingerprints: set[str] = set()

    def add(self, article: str) -> bool:
        key = sha256(article.encode("utf-8")).hexdigest()
        if key in self._fingerprints:
            return False
        self._fingerprints.add(key)
        self._articles.append(article)
        return True

    def retrieve(self, question: str, top_k: int = 2) -> list[str]:
        terms = set(question.lower().split())
        ranked = sorted(
            self._articles,
            key=lambda article: len(terms.intersection(article.lower().split())),
            reverse=True,
        )
        return ranked[:top_k]
