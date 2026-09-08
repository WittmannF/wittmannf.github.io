---
title: 'Layered Architecture in FastAPI: A Practical Guide for ML Engineers'
description: 'You know how to train models. Now you need to deploy them. This guide builds gut-level intuition for layered architecture through a real RAG app — starting with a working monolith and extracting layers only when the pain justifies it.'
pubDate: 2026-06-16
tags: ['FastAPI', 'Python', 'LLMs', 'Architecture', 'AI Engineering']
lang: 'en'
---

There are a hundred tutorials that list the layers of a "clean" backend architecture. Router. Service. Repository. Schema. They draw the diagram, they explain what each box does, and then they show you the finished code.

You copy it, it works, and you still have no idea when to use it.

This guide takes a different approach. We're going to start with a real RAG app — one file, fully runnable, the kind of thing you'd actually ship for a quick demo. Then we're going to take real requests from a real team and feel what breaks. Each layer we introduce will be a response to genuine pain, not a prescription.

By the end, you'll have built the intuition. Not just the pattern.

---

## The app: a news Q&A assistant

We're building a simple RAG app over news articles. The user asks a question, we fetch recent news, embed the articles, retrieve the most relevant ones, and send them to an LLM with the question.

Here's the whole thing in one file.

```python
# main.py
import os
import httpx
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import anthropic

app = FastAPI()
client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# In-memory "vector store": list of (article_text, embedding) tuples
article_store: list[tuple[str, list[float]]] = []


class QuestionRequest(BaseModel):
    question: str


class AnswerResponse(BaseModel):
    answer: str
    sources: list[str]


def fetch_news(topic: str) -> list[str]:
    """Fetch article headlines and summaries from a news API."""
    resp = httpx.get(
        "https://newsapi.org/v2/everything",
        params={"q": topic, "pageSize": 10, "language": "en"},
        headers={"X-Api-Key": os.environ["NEWS_API_KEY"]},
        timeout=10.0,
    )
    resp.raise_for_status()
    articles = resp.json().get("articles", [])
    return [
        f"{a['title']}\n{a['description'] or ''}"
        for a in articles
        if a.get("title")
    ]


def embed_text(text: str) -> list[float]:
    """Get a simple embedding via Claude's token probabilities (stub for real embedder)."""
    # In practice, use a dedicated embedding model. Here we use a cheap heuristic
    # to keep deps minimal: hash words into a fixed-size float vector.
    import hashlib
    words = text.lower().split()
    vec = [0.0] * 64
    for i, word in enumerate(words[:64]):
        h = int(hashlib.md5(word.encode()).hexdigest(), 16)
        vec[i % 64] += (h % 1000) / 1000.0
    norm = sum(x ** 2 for x in vec) ** 0.5 or 1.0
    return [x / norm for x in vec]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x ** 2 for x in a) ** 0.5
    norm_b = sum(x ** 2 for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def retrieve_relevant(question: str, top_k: int = 3) -> list[str]:
    """Return the top_k most relevant articles for a question."""
    if not article_store:
        return []
    q_emb = embed_text(question)
    scored = [
        (cosine_similarity(q_emb, emb), text)
        for text, emb in article_store
    ]
    scored.sort(reverse=True)
    return [text for _, text in scored[:top_k]]


def build_prompt(question: str, context_articles: list[str]) -> str:
    context = "\n\n---\n\n".join(context_articles)
    return (
        f"You are a helpful news assistant. Use the following articles to answer "
        f"the user's question. If the articles don't contain enough information, "
        f"say so.\n\nArticles:\n{context}\n\nQuestion: {question}"
    )


@app.post("/ingest/{topic}")
def ingest_news(topic: str):
    """Fetch and embed news articles for a topic."""
    articles = fetch_news(topic)
    for text in articles:
        emb = embed_text(text)
        article_store.append((text, emb))
    return {"ingested": len(articles), "total": len(article_store)}


@app.post("/ask", response_model=AnswerResponse)
def ask_question(req: QuestionRequest):
    """Answer a question using retrieved news context."""
    relevant = retrieve_relevant(req.question)
    if not relevant:
        raise HTTPException(status_code=400, detail="No articles ingested yet.")

    prompt = build_prompt(req.question, relevant)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    answer = message.content[0].text
    return AnswerResponse(answer=answer, sources=relevant)
```

This works. You can run it, demo it, and your tech lead will be pleased. About 80 lines, clear enough to read in one sitting.

Now the team starts using it.

---

## Change request #1: "Swap Claude for OpenAI"

The product manager says the OpenAI tier is cheaper for this use case. Can we swap the LLM?

Open `main.py`. The LLM call is in `ask_question`, hardwired to the Anthropic client. The client is initialized at module level. The model string is embedded in the function. The prompt construction is in a helper that's tightly coupled to the Anthropic message format.

To swap the LLM you need to:
1. Add a new import and client initialization
2. Change the messages format (Anthropic and OpenAI have different structures)
3. Change how you extract the response text
4. Potentially change the prompt phrasing to work better with the new model
5. Decide whether to keep the old client around for fallback

None of these steps is hard. All of them are tangled together in one place with your embedding logic, your retrieval logic, and your HTTP endpoints. Touch one thing, break another.

This is the moment when a **service layer** starts to earn its keep.

The service layer's job is to contain the "what does this app do" logic: build the prompt, call the LLM, return the answer. It knows nothing about HTTP. It doesn't care whether it's being called by a FastAPI endpoint or a background job or a test. When you want to swap the LLM, you change the service — and only the service.

We'll build up to it. First, let's see the next pain.

---

## Change request #2: "Add a cache — we're re-embedding identical articles"

The news API sometimes returns the same article for different queries. You're embedding it multiple times, burning compute (and in production, API credits).

Where do you add the cache? In `ingest_news`, before the `embed_text` call. You need to check whether this article text is already in `article_store`.

But `article_store` is a module-level list of tuples. To deduplicate, you'd need to search it by text. That means iterating the whole list. And now your ingest endpoint has deduplication logic, embedding logic, and storage logic all jumbled together.

What you actually want is a thing you can ask: "do you already have this article?" — something with a clean interface over your storage. That's a **repository**.

The repository hides *how* things are stored. You ask it for data, you tell it to store data, and you don't care whether it's an in-memory list, a Redis cache, or a PostgreSQL table. When the cache requirement arrives, you add it inside the repository, not scattered across your endpoints.

---

## Change request #3: "Write a test for retrieval without hitting the real API"

Your tech lead wants a unit test for `retrieve_relevant`. Seems simple.

But `retrieve_relevant` reads from `article_store`, a module-level global. To test it, you have to either:
- Mutate the global directly in your test (which means tests can leak state into each other)
- Refactor `retrieve_relevant` to accept the store as a parameter (which breaks all callers)
- Patch the global with `monkeypatch` (which works but feels like surgery)

And the bigger problem: your retrieval logic and your LLM call are in the same flow. To test retrieval, you have to mock the LLM. To test the LLM prompt, you have to set up retrieval state. They're coupled.

When things are properly separated, you can test retrieval with a fake in-memory store. You can test prompt construction with a fake retrieval result. You can test the LLM call with a mock client. Each piece in isolation.

This is the real argument for layers — not cleanliness, but testability.

---

## Change request #4: "Run this from a background job, not just the endpoint"

You want a nightly job that ingests the latest news automatically. You could duplicate the logic from the endpoint into a script. But that's two copies to maintain.

The core logic — fetch news, embed, store — needs to be callable from both an HTTP handler and a cron job. Right now it's only reachable through FastAPI's endpoint machinery.

This is the second argument for layers: **reusability**. When logic lives in a service, any caller can use it. HTTP endpoint, background job, CLI script, test — same service, same behavior.

---

## Building the layers

Now we've felt the friction. Let's extract the layers, one at a time, motivated by the pain we just walked through.

### Schemas first

These are pure data shapes. No logic, just Pydantic models. They belong in their own file because every other layer needs to reference them, and you don't want circular imports.

```python
# schemas.py
from pydantic import BaseModel, field_validator


class QuestionRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}
    question: str

    @field_validator("question")
    @classmethod
    def question_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("question cannot be empty")
        return v


class AnswerResponse(BaseModel):
    answer: str
    sources: list[str]


class IngestResponse(BaseModel):
    ingested: int
    total: int
```

### The repository layer

The repository owns two things: the external data sources (news API) and the internal storage (article store). In an LLM app, the repository is also often the "embedding store" — the thing that knows how articles are indexed and retrieved.

```python
# repositories.py
import hashlib
import os
import httpx


def _embed_text(text: str) -> list[float]:
    """Deterministic hash-based embedding (replace with a real model in production)."""
    words = text.lower().split()
    vec = [0.0] * 64
    for i, word in enumerate(words[:64]):
        h = int(hashlib.md5(word.encode()).hexdigest(), 16)
        vec[i % 64] += (h % 1000) / 1000.0
    norm = sum(x ** 2 for x in vec) ** 0.5 or 1.0
    return [x / norm for x in vec]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x ** 2 for x in a) ** 0.5
    norm_b = sum(x ** 2 for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class ArticleRepository:
    def __init__(self) -> None:
        # (text, embedding) pairs — in production, replace with a vector DB
        self._store: list[tuple[str, list[float]]] = []
        self._seen: set[str] = set()  # deduplication cache

    def add(self, text: str) -> bool:
        """Add an article. Returns False if it was already present."""
        if text in self._seen:
            return False
        emb = _embed_text(text)
        self._store.append((text, emb))
        self._seen.add(text)
        return True

    def retrieve(self, question: str, top_k: int = 3) -> list[str]:
        """Return the top_k most relevant articles for a question."""
        if not self._store:
            return []
        q_emb = _embed_text(question)
        scored = [
            (_cosine_similarity(q_emb, emb), text)
            for text, emb in self._store
        ]
        scored.sort(reverse=True)
        return [text for _, text in scored[:top_k]]

    def count(self) -> int:
        return len(self._store)


class NewsRepository:
    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or os.environ["NEWS_API_KEY"]

    def fetch(self, topic: str, page_size: int = 10) -> list[str]:
        """Fetch articles for a topic. Returns list of 'title\\ndescription' strings."""
        resp = httpx.get(
            "https://newsapi.org/v2/everything",
            params={"q": topic, "pageSize": page_size, "language": "en"},
            headers={"X-Api-Key": self._api_key},
            timeout=10.0,
        )
        resp.raise_for_status()
        articles = resp.json().get("articles", [])
        return [
            f"{a['title']}\n{a['description'] or ''}"
            for a in articles
            if a.get("title")
        ]
```

Notice what moved here: the deduplication cache (`_seen`), the embedding logic, the retrieval logic, and the news fetching. The service won't know or care how articles are stored — it just asks the repository.

### The service layer

The service contains application logic: "how does this app actually do its job?" It orchestrates repositories and wraps the LLM call.

```python
# services.py
import os
import anthropic
from repositories import ArticleRepository, NewsRepository
from schemas import AnswerResponse, IngestResponse


class NewsQAService:
    def __init__(
        self,
        article_repo: ArticleRepository,
        news_repo: NewsRepository,
        llm_client: anthropic.Anthropic | None = None,
        model: str = "claude-haiku-4-5-20251001",
    ) -> None:
        self._articles = article_repo
        self._news = news_repo
        self._llm = llm_client or anthropic.Anthropic(
            api_key=os.environ["ANTHROPIC_API_KEY"]
        )
        self._model = model

    def ingest(self, topic: str) -> IngestResponse:
        """Fetch and store articles for a topic."""
        raw_articles = self._news.fetch(topic)
        ingested = sum(1 for a in raw_articles if self._articles.add(a))
        return IngestResponse(ingested=ingested, total=self._articles.count())

    def _build_prompt(self, question: str, context: list[str]) -> str:
        joined = "\n\n---\n\n".join(context)
        return (
            "You are a helpful news assistant. Use the following articles to answer "
            "the user's question. If the articles don't contain enough information, "
            "say so.\n\n"
            f"Articles:\n{joined}\n\n"
            f"Question: {question}"
        )

    def answer(self, question: str) -> AnswerResponse:
        """Retrieve relevant articles and answer a question."""
        sources = self._articles.retrieve(question)
        if not sources:
            raise ValueError("No articles ingested yet.")

        prompt = self._build_prompt(question, sources)
        message = self._llm.messages.create(
            model=self._model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        return AnswerResponse(
            answer=message.content[0].text,
            sources=sources,
        )
```

Now look at what swapping the LLM means: you pass a different client to `__init__`. That's it. The caller doesn't change. The router doesn't change. The repository doesn't change. You changed one dependency in one place.

### The router layer

The router is thin. It knows HTTP. It knows nothing about business logic. Its only job is to take an HTTP request, call the service, and return a response.

```python
# router.py
from fastapi import APIRouter, HTTPException
from schemas import AnswerResponse, IngestResponse, QuestionRequest
from services import NewsQAService

router = APIRouter()
_service: NewsQAService | None = None


def set_service(svc: NewsQAService) -> None:
    global _service
    _service = svc


def get_service() -> NewsQAService:
    if _service is None:
        raise RuntimeError("Service not initialized")
    return _service


@router.post("/ingest/{topic}", response_model=IngestResponse)
def ingest_news(topic: str):
    return get_service().ingest(topic)


@router.post("/ask", response_model=AnswerResponse)
def ask_question(req: QuestionRequest):
    try:
        return get_service().answer(req.question)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

### Wiring it together

```python
# main.py
import os
from fastapi import FastAPI
from repositories import ArticleRepository, NewsRepository
from services import NewsQAService
from router import router, set_service

app = FastAPI(title="News Q&A Assistant")

# Dependency wiring — happens once at startup
article_repo = ArticleRepository()
news_repo = NewsRepository(api_key=os.environ.get("NEWS_API_KEY"))
service = NewsQAService(article_repo=article_repo, news_repo=news_repo)
set_service(service)

app.include_router(router)
```

The `main.py` is now just wiring. It creates the pieces and connects them. No logic lives here.

---

## The full picture

Here's what we ended up with:

```
main.py          ← wiring only
router.py        ← HTTP in, HTTP out, calls service
services.py      ← application logic, prompt construction, LLM calls
repositories.py  ← storage, external data sources
schemas.py       ← shared data shapes
```

And here's the same app. Same behavior, same endpoints, same results. But now:

- **Swap the LLM?** Pass a different client to `NewsQAService.__init__`.
- **Add a cache?** Update `ArticleRepository.add` — nothing else changes.
- **Test retrieval?** Create an `ArticleRepository`, add test articles, call `retrieve`. No mocks needed.
- **Run from a background job?** Import `NewsQAService`, call `.ingest("climate")`. No FastAPI required.

Each change request maps to exactly one place in the code. That's the real promise of layered architecture — not cleanliness, but a one-to-one mapping between "what changed in the world" and "what you have to touch."

---

## The LLM-specific insight: where does calling the model live?

This confuses most ML engineers. Is calling the LLM a "service" operation or a "repository" operation?

Here's the useful frame: **it depends on how you model it.**

If the LLM is *a component of your logic* — you're building a prompt, sending it, interpreting the response — that's a service operation. The service owns the prompt, the model choice, the retry policy.

If the LLM is *an external source of data* — you're fetching a completion the same way you'd fetch from a database — then wrapping it in a repository makes sense. This is common when the LLM is just one of many data sources (alongside a vector DB, a SQL database, a news API).

In our app, the LLM is deeply part of the logic (we build the prompt, we interpret the result), so it lives in the service. If we later added a step where we "retrieve" pre-computed answers from a cache that was itself built by an LLM batch job, that cache retrieval would belong in a repository.

The boundary is fuzzy. Don't agonize over it. When in doubt: if it's shaped like "fetch something external," it's a repository. If it's shaped like "compute something using your domain logic," it's a service.

---

## Testing: the payoff

Here's what a test suite looks like with the layered version:

```python
# test_retrieval.py
from repositories import ArticleRepository


def test_retrieval_returns_most_relevant():
    repo = ArticleRepository()
    repo.add("Apple announces new MacBook with M4 chip")
    repo.add("Google launches new Pixel phone")
    repo.add("Microsoft releases Windows 12")

    results = repo.retrieve("Apple laptop", top_k=1)
    assert len(results) == 1
    assert "Apple" in results[0]


def test_deduplication():
    repo = ArticleRepository()
    added_first = repo.add("Some article text")
    added_second = repo.add("Some article text")
    assert added_first is True
    assert added_second is False
    assert repo.count() == 1
```

```python
# test_service.py
from unittest.mock import MagicMock
from repositories import ArticleRepository
from services import NewsQAService


def test_answer_uses_retrieved_context():
    article_repo = ArticleRepository()
    article_repo.add("Tesla stock rises 10% after earnings report")

    mock_llm = MagicMock()
    mock_llm.messages.create.return_value = MagicMock(
        content=[MagicMock(text="Tesla had strong earnings.")]
    )

    mock_news = MagicMock()
    service = NewsQAService(
        article_repo=article_repo,
        news_repo=mock_news,
        llm_client=mock_llm,
    )

    result = service.answer("How did Tesla do?")
    assert "Tesla" in result.answer
    # The LLM was called with context containing the article
    call_args = mock_llm.messages.create.call_args
    assert "Tesla stock" in call_args.kwargs["messages"][0]["content"]
```

No HTTP. No real API calls. Each test is fast, isolated, and expressive. This is the dividend that architecture pays.

---

## Why this pattern exists: a brief history

Layered architecture wasn't invented for REST APIs. The idea of separating concerns into distinct levels traces back to Edsger Dijkstra, who argued in the 1960s that software complexity is only manageable when a system can be understood one layer at a time. The principle became known as *separation of concerns* — and it remains the central justification for everything we built in this guide.

The concrete form we used here — presentation, business logic, data access — became widespread in the 1990s with the growth of corporate web applications. Martin Fowler formalized it in *Patterns of Enterprise Application Architecture* (2002) under the name **Presentation-Domain-Data Layering**, and his argument is still the clearest I know:

> The primary benefit isn't substitutability or testability — it's **reduced cognitive scope**. When you're working in the service layer, you can treat the repository as a black box. That's already worth it on its own.

Substitutability and testability are real bonuses, but the core argument is simple: you can think about one thing at a time.

---

## Layered, Hexagonal, Clean: what's the difference?

You'll encounter all three names in the literature and they look similar. The distinction is worth understanding.

**Layered Architecture** is what we built here. Dependencies flow downward: router → service → repository. The upper layer knows the lower one. Works well for most backends.

**Hexagonal Architecture** (Alistair Cockburn, 2005) and **Clean Architecture** (Robert C. Martin, 2012) start from the same problem but add a stronger constraint: the domain cannot depend on anything external — not the web framework, not the database. Dependencies always point inward, toward the center.

The practical difference:

| | Layered | Clean/Hexagonal |
|---|---|---|
| Dependency direction | Always downward | Always inward |
| Does the service know the repository? | Yes, directly | No — depends on an interface |
| Framework (FastAPI) in the core? | Can be | Never |
| Implementation cost | Lower | Higher |
| When it's worth it | Most backends | Complex domains, large teams |

In practice, the difference shows up like this: in layered architecture, `NewsQAService` imports `ArticleRepository` directly. In Clean Architecture, `NewsQAService` would depend on an `AbstractArticleRepository` interface, and the concrete implementation would be injected from outside. The service would never know whether the repository uses an in-memory list, Postgres, or Qdrant.

For most LLM projects, the layered architecture we built here is the right point on the spectrum. Clean Architecture makes sense when the domain needs to survive independent of any infrastructure — useful in large systems, overkill for medium-sized APIs.

If you want to go deeper, the reference book for Python is *Architecture Patterns with Python* (Harry Percival and Bob Gregory, O'Reilly) — it covers the Repository Pattern, Unit of Work, and ports/adapters with real examples.

---

## The dependency rule

Regardless of which variant you use, there's one rule that cannot be broken:

**Dependencies always point in one direction. Never back.**

In our app: the router knows the service, but the service doesn't know the router. The service knows the repository, but the repository doesn't know the service.

If you break this rule — say, by importing something from the router inside the service — the separation collapses. The service now depends on HTTP details. You can no longer test it without spinning up a server. You can no longer call it from a background job. The layers become decoration.

A practical way to verify: try running `python services.py` without importing FastAPI. If it works, the rule is being respected.

---

## When NOT to layer

A proof of concept with two endpoints and a one-day deadline? Don't layer it.

A personal tool you're the only user of? Single file is fine.

A prototype you're demoing Friday and throwing away Monday? Optimize for speed, not structure.

Layering costs something. Files to navigate. Indirection to trace. Wiring to maintain. That cost is worth it when:
- Multiple engineers are working on the codebase
- You expect the components to swap (different LLMs, different data sources)
- You need tests that run in isolation
- The same logic needs to be called from multiple places

A rule of thumb: if you've had to make the same kind of change twice in the same blob of logic, it's time to extract. Don't layer prophylactically. Layer reactively, when the pain is real.

---

## What comes next

This guide deliberately kept things simple: in-memory storage, a single service, no async. In a production LLM app you'd layer in:

- **Async services** — `async def answer(...)` with `await client.messages.create(...)` for concurrent requests
- **Dependency injection** — FastAPI's `Depends()` system instead of the global `set_service` pattern we used
- **A real vector store** — swap `ArticleRepository` for one backed by Qdrant, Chroma, or pgvector without touching anything else
- **Retry logic** — in the service, wrap the LLM call with exponential backoff and fallback model logic
- **Streaming responses** — `StreamingResponse` in the router, `stream=True` in the service, without changing the repository at all

Each of these fits cleanly into the layer where it belongs. That's how you know the architecture is working: new requirements have obvious homes.

You started with one file. You ended with five. The app does exactly the same thing. But now when something changes — and something always changes — you know where to go.
