from hashlib import sha256

from fastapi import FastAPI
from pydantic import BaseModel


app = FastAPI(title="News QA - Single File")
ARTICLE_STORE: list[str] = []


class QuestionRequest(BaseModel):
    question: str


class AnswerResponse(BaseModel):
    answer: str
    sources: list[str]


class IngestRequest(BaseModel):
    topic: str


def fetch_news(topic: str) -> list[str]:
    return [
        f"{topic}: central banks signal caution on rates",
        f"{topic}: chip makers announce new AI accelerators",
        f"{topic}: startups expand infrastructure spending",
    ]


def fingerprint(text: str) -> str:
    return sha256(text.encode("utf-8")).hexdigest()


def ingest_articles(topic: str) -> int:
    existing = {fingerprint(article) for article in ARTICLE_STORE}
    added = 0
    for article in fetch_news(topic):
        if fingerprint(article) not in existing:
            ARTICLE_STORE.append(article)
            added += 1
    return added


def retrieve(question: str, top_k: int = 2) -> list[str]:
    terms = set(question.lower().split())
    ranked = sorted(
        ARTICLE_STORE,
        key=lambda article: len(terms.intersection(article.lower().split())),
        reverse=True,
    )
    return ranked[:top_k]


def answer_with_llm(question: str, context: list[str]) -> str:
    joined_context = " | ".join(context) or "no context"
    return f"Answering '{question}' using: {joined_context}"


@app.post("/ingest")
def ingest(request: IngestRequest) -> dict[str, int]:
    return {"added": ingest_articles(request.topic)}


@app.post("/answer", response_model=AnswerResponse)
def answer(request: QuestionRequest) -> AnswerResponse:
    sources = retrieve(request.question)
    return AnswerResponse(
        answer=answer_with_llm(request.question, sources),
        sources=sources,
    )
