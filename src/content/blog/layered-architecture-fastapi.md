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

## Before the code: what do layers separate?

When people talk about layered architecture, they usually mean a logical separation between three kinds of concerns:

- **Presentation**: how the outside world talks to the system. In an API, that's HTTP, status codes, request validation, authentication, and serialization.
- **Application/domain**: what the system actually does. This is where use cases, rules, orchestration, and decisions live.
- **Data/infrastructure**: how the system fetches, stores, or calls things outside itself. Databases, external APIs, caches, queues, vector stores, and LLM clients live here or orbit this boundary.

Martin Fowler calls this [Presentation-Domain-Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html). The most underrated benefit is not "tidier folders"; it's reducing mental scope. When you're changing application logic, ideally you don't have to think about `HTTPException`. When you're changing storage, ideally you don't have to think about the response model.

One more important distinction: a layer is not necessarily a tier. Your router, service, and repository can all run in the same process, in the same container, even in the same Python file if you want. The separation is conceptual before it's physical. The point is to create boundaries that help the code change with less friction.

With that in mind, let's start wrong in the useful way: everything in one file.

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
    """Get a simple hash-based embedding (stub for a real embedder)."""
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

More formally, a [Service Layer](https://martinfowler.com/eaaCatalog/serviceLayer.html) defines the application's boundary: which operations it offers and how it coordinates each operation's response. In our app, `answer(question)` and `ingest(topic)` are application operations. The router only exposes those operations over HTTP.

That distinction looks small, but it changes the design: the endpoint stops being the place where the use case happens and becomes an input adapter. It translates HTTP into an application call.

We'll build up to it. First, let's see the next pain.

---

## Change request #2: "Add a cache — we're re-embedding identical articles"

The news API sometimes returns the same article for different queries. You're embedding it multiple times, burning compute (and in production, API credits).

Where do you add the cache? In `ingest_news`, before the `embed_text` call. You need to check whether this article text is already in `article_store`.

But `article_store` is a module-level list of tuples. To deduplicate, you'd need to search it by text. That means iterating the whole list. And now your ingest endpoint has deduplication logic, embedding logic, and storage logic all jumbled together.

What you actually want is a thing you can ask: "do you already have this article?" — something with a clean interface over your storage. That's a **repository**.

The repository hides *how* things are stored. You ask it for data, you tell it to store data, and you don't care whether it's an in-memory list, a Redis cache, or a PostgreSQL table. When the cache requirement arrives, you add it inside the repository, not scattered across your endpoints.

In Fowler's classic definition, a [Repository](https://martinfowler.com/eaaCatalog/repository.html) behaves like an in-memory collection over persisted objects. That's a useful image: from the outside, you want to think in terms of `articles.add(text)` and `articles.retrieve(question)`, not `INSERT`, vector indexes, cache TTLs, or calls to a remote service.

One nuance: not every class that calls something external has to be called a repository. `ArticleRepository` fits well because it represents a searchable collection of articles. `NewsRepository`, on the other hand, could also be called `NewsClient` or `NewsGateway`, because it doesn't represent an internal domain collection; it wraps an external API. The name matters less than the boundary: the service shouldn't know News API transport details.

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

In a larger system, I would probably split this into two concepts: an `ArticleRepository` for the searchable vector collection, and a `NewsClient` or `NewsGateway` for the external API. Here I keep both in the same file to keep the article short, but the conceptual boundary is the same: the service talks to high-level interfaces, not transport, storage, or vendor details.

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

This file is what many authors call the **composition root**: the place where concrete dependencies are assembled. This is where you decide: Anthropic or OpenAI, in-memory repository or pgvector, real News API or a fake for tests.

This is the practical heart of dependency inversion. The use case receives ready-made dependencies; it doesn't create everything it uses directly. The application policy stays more stable, and external details become pluggable.

In a real FastAPI app, you'd probably replace the global `set_service` with `Depends()`. The official docs for [bigger applications with multiple files](https://fastapi.tiangolo.com/tutorial/bigger-applications/) show `APIRouter` as the natural tool for organizing endpoints, and the docs for [dependency overrides in tests](https://fastapi.tiangolo.com/advanced/testing-dependencies/) show `app.dependency_overrides` for swapping dependencies in tests. I used `set_service` here because it keeps the mechanics visible without introducing one more abstraction in the middle of the explanation.

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

## How this grows in a real FastAPI app

One important point: FastAPI does not prescribe an official architecture with `schemas`, `services`, and `repositories`. What it gives you are framework pieces: `APIRouter` for splitting endpoints, Pydantic models for request/response contracts, `Depends()` for dependency injection, and `app.dependency_overrides` for tests.

`Service Layer` and `Repository` come from application architecture patterns, not from FastAPI itself. A realistic structure combines both worlds: keep HTTP and dependency wiring on the FastAPI side, and move use cases and persistence behind application layers.

The first natural growth step for our app does not change the idea. It just turns files into folders:

```text
app/
  main.py

  core/
    config.py
    logging.py

  api/
    deps.py
    routers/
      news_qa.py

  schemas/
    news_qa.py

  services/
    news_qa.py

  repositories/
    articles.py
    vector_store.py

  clients/
    news_api.py
    llm.py
    embeddings.py
```

This is still the same architecture we just built:

- `api/routers/` is the old `router.py`: HTTP in, HTTP out.
- `schemas/` is the old `schemas.py`: Pydantic request and response contracts.
- `services/` is the old `services.py`: use cases and orchestration.
- `repositories/` is the old `repositories.py`: persistence and retrieval of internal data.
- `clients/` separates external integrations that are not exactly repositories, like LLMs, embeddings, and the News API.
- `api/deps.py` replaces `set_service`: this is where `Depends()` and dependency wiring live.

That distinction between `repositories` and `clients` avoids a naming problem that shows up in many small backends. An `ArticleRepository` represents a collection of articles your app controls. An `OpenAIClient` is not a domain collection; it is a client for an external service. Both sit outside the service, but they do not need the same name.

When the app truly grows, the problem stops being "do I have too many files?" and becomes "do I have too many domains?" If you have `news_qa`, `users`, `billing`, `notifications`, and `admin`, global folders like `services/` and `repositories/` become drawers that are too large. At that point, it often makes sense to group by feature and keep the layers inside each module:

```text
app/
  main.py
  core/
    config.py

  modules/
    news_qa/
      router.py
      schemas.py
      service.py
      repositories.py
      clients.py

    users/
      router.py
      schemas.py
      service.py
      repositories.py

  api/
    deps.py
```

And if one feature grows on its own, it can become internal packages:

```text
app/
  modules/
    news_qa/
      routers/
        http.py
      schemas/
        requests.py
        responses.py
      services/
        answer_question.py
        ingest_articles.py
      repositories/
        article_repository.py
        vector_repository.py
      clients/
        news_client.py
        llm_client.py
        embedding_client.py
```

Notice that this is not switching architectures midway. It is the same idea growing in two steps:

1. First, files become folders: `router.py` becomes `routers/`, `schemas.py` becomes `schemas/`, `repositories.py` becomes `repositories/`.
2. Later, when there are many domains, you group by feature and keep the layers inside each feature.

This progression also avoids a common trap: starting with too much "Clean Architecture" before the app has felt enough pain to justify it. The design should become more explicit as real changes ask for clearer boundaries.

---

## The LLM-specific insight: where does calling the model live?

This confuses most ML engineers. Is calling the LLM a "service" operation or a "repository" operation?

Here's the useful frame: **it depends on how you model it.**

RAG makes this boundary even more interesting. The original [Retrieval-Augmented Generation](https://arxiv.org/abs/2005.11401) paper describes a combination of the model's parametric memory and non-parametric memory, usually a retrievable external index. Translated into architecture: the model and the index change for different reasons. The index changes when the data changes. The prompt changes when desired behavior changes. The LLM provider changes because of cost, latency, quality, or policy.

Those reasons for change are a good guide for drawing boundaries.

If the LLM is *a component of your logic* — you're building a prompt, sending it, interpreting the response — that's a service operation. The service owns the prompt, the model choice, the retry policy.

If the LLM is *an external source of data* — you're fetching a completion the same way you'd fetch from a database — then wrapping it in a repository makes sense. This is common when the LLM is just one of many data sources (alongside a vector DB, a SQL database, a news API).

In our app, the LLM is deeply part of the logic (we build the prompt, we interpret the result), so it lives in the service. If we later added a step where we "retrieve" pre-computed answers from a cache that was itself built by an LLM batch job, that cache retrieval would belong in a repository.

The boundary is fuzzy. Don't agonize over it. When in doubt: if it's shaped like "fetch something external," it's a repository. If it's shaped like "compute something using your domain logic," it's a service.

Another way to think about it: RAG is not just "put context in the prompt." OpenAI's [accuracy optimization guidance](https://developers.openai.com/api/docs/guides/optimizing-llm-accuracy) treats prompt engineering, retrieval, and fine-tuning as different levers. If retrieval is a separate lever, it deserves a separate surface in the code. That lets you test retrieval quality without testing generation at the same time.

---

## Testing: the payoff

Here's what a test suite looks like with the layered version:

This is where **test doubles** enter the picture. A fake is a simple implementation that really works, like an in-memory repository. A mock is an object used to verify interaction, like "the LLM client was called with a prompt containing Tesla." Martin Fowler uses [Test Double](https://www.martinfowler.com/bliki/TestDouble.html) as the umbrella term for these substitutes.

Layered architecture helps because each external dependency becomes replaceable at the right point. You don't have to fake HTTP to test retrieval. You don't have to call the News API to test prompting. You don't have to spend tokens to test that orchestration called the model with the right context.

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

If you keep evolving this design, you'll eventually run into terms like **Ports and Adapters**, **Hexagonal Architecture**, **Onion Architecture**, and **Clean Architecture**. They don't mean exactly the same thing in every detail, but they share an intuition: the application lives in the center, and the outside world talks to it through adapters. Alistair Cockburn describes [hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture) as an application on the inside communicating through ports with things on the outside.

In our example, HTTP is an input adapter. A nightly job would be another. The News API, vector store, and LLM are output adapters. The service layer is where those adapters meet to perform a use case.

You started with one file. You ended with five. The app does exactly the same thing. But now when something changes — and something always changes — you know where to go.
