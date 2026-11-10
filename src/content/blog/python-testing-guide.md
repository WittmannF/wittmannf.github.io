---
title: 'Python Testing That Actually Catches Bugs: From Your First Unit Test to TDD and Beyond'
description: 'Learn what unit, integration, contract, E2E, regression and property-based tests really mean by evolving one Python function into a layered FastAPI service, with runnable pytest examples and TDD.'
pubDate: 2026-11-10
tags: ['Python', 'Testing', 'pytest', 'TDD', 'FastAPI', 'Software Engineering', 'LLMs']
lang: 'en'
draft: true
---

You wrote a Python function. It works. Then a customer sends unusual input and it breaks. You add a test, but as the project grows you hear terms like **unit**, **integration**, **contract**, **E2E**, and **regression**. Some developers mock everything; others recommend running a database in CI; still others suggest TDD.

Where do you start, and **what kind of test are you actually writing**?

We will answer that question by doing what this blog usually does: **start with the smallest useful implementation, encounter a real problem, and introduce one concept to solve it**. We will not begin with a layered application or a complete testing pyramid. The architecture and the test suite will grow together.

Our running example is a tiny **document processing service**. It normalizes names, extracts a simple payment term, decides whether a record needs review, saves results, and eventually exposes an API. These are synthetic rules, not a production lending or contract-processing system.

By the end, you will understand both **how to write tests** and **why a particular boundary deserves a particular type of test**. If you already build APIs, data pipelines, or LLM systems, this is designed to be a reference you can reuse during code reviews.

> **Run it yourself:** The [companion project](https://github.com/WittmannF/wittmannf.github.io/tree/main/public/blog/python-testing-guide) contains the one-file starting snapshot, the final layered implementation, and tests grouped by scope. No paid API, AWS account, or secrets are required.

---

## Before We Start: Three Different Ways to Classify a Test

People mix these terms together, which creates unnecessary confusion. **A test has a scope, may pursue an objective, and uses one or more techniques.**

| Dimension | Examples | The question |
|---|---|---|
| **Scope** | Unit, integration, end-to-end | **What boundary does this test exercise?** |
| **Objective** | Regression, contract, smoke, performance | **What risk does this test try to detect?** |
| **Technique** | Example-based, parametrized, property-based, mocks/fakes, TDD workflow | **How do we design or execute it?** |

For example, a **unit test** can be written using a **property-based technique** and protect against a **regression**. These labels do not compete with each other. TDD is a *development workflow*, not a fourth test scope.

Keep this map in mind. At every step below, I will name the scope explicitly and explain **why the test belongs there**. Organizing folders by scope can help, but merely placing a test in a folder called unit does not make it one.

### The journey, at a glance

| Stage | Our application gains... | Main testing lesson |
|---|---|---|
| **1. One function** | A simple normalization rule | **Unit test** |
| **2. More business rules** | Validation and review routing | **Unit tests, parametrization, TDD** |
| **3. Dependencies** | Extraction and persistence interfaces | **Unit tests with fakes** |
| **4. Real storage** | SQLite | **Integration test** |
| **5. HTTP** | FastAPI and Pydantic | **API integration + contract** |
| **6. Running server** | Real HTTP boundary | **E2E + smoke** |
| **7. Past incidents and strange inputs** | Golden fixtures and generated inputs | **Regression objective + property-based technique** |
| **8. Operational maturity** | CI, coverage, and AI extraction | **Suite strategy + LLM evaluations** |

These are not maturity levels where every team must reach Stage 8. A script with no external dependencies might only need Stage 1 and 2.

---

## Stage 1: "I Changed One Line and Broke a Working Function"

**Test type: UNIT.** We test a single deterministic behavior without HTTP, storage, network, or an external service.

We begin with one file. No architecture diagram is necessary yet.

~~~text
document-project/
  app.py
  test_app.py
~~~

Suppose we receive borrower names with inconsistent whitespace. We want to normalize them:

~~~python
# app.py
def normalize_name(raw: str) -> str:
    cleaned = " ".join(raw.split())
    if not cleaned:
        raise ValueError("borrower_name cannot be blank")
    return cleaned
~~~

Run it manually:

~~~python
>>> normalize_name("  Ana    Silva ")
'Ana Silva'
~~~

This proves one example works right now. It does not protect that behavior when someone changes the function next week.

### Solution: your first pytest test

~~~python
# test_app.py
from app import normalize_name

def test_normalize_name_collapses_whitespace():
    # Arrange
    raw = "  Ana    Silva "

    # Act
    actual = normalize_name(raw)

    # Assert
    assert actual == "Ana Silva"
~~~

Run it with pytest:

~~~bash
uv run pytest -q
~~~

You have written a **unit test** because the behavior under test is self-contained and all execution stays inside that small unit. It would still be a unit test if you ran it inside a large application.

Three useful habits begin here:

1. **Arrange–Act–Assert:** make the input, action, and expected behavior obvious.
2. **Meaningful names:** state the behavior, not the function name alone.
3. **Observable assertions:** verify the result that the caller depends on, not private implementation details.

**Why not integration or E2E?** There are no component boundaries to integrate and no user journey to execute. Adding FastAPI, Docker, or a database to this test would add cost without testing a new risk.

The [one-file snapshot](https://github.com/WittmannF/wittmannf.github.io/tree/main/public/blog/python-testing-guide/walkthrough/stage01_one_file.py) keeps this simple version for comparison.

---

## Stage 2: "One Example Passes, but the Real Input Space Is Bigger"

**Test type: still UNIT. Technique: PARAMETRIZATION.** The scope has not changed. We are learning how to select better inputs.

What if the name contains tabs? Is a single word valid? What about whitespace-only input?

~~~python
import pytest

@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  Ana    Silva ", "Ana Silva"),
        ("José\tSantos", "José Santos"),
        ("One", "One"),
    ],
)
def test_normalize_name(raw, expected):
    assert normalize_name(raw) == expected

def test_blank_name_is_rejected():
    with pytest.raises(ValueError, match="cannot be blank"):
        normalize_name(" \t ")
~~~

Parametrization means **one assertion pattern, several meaningful scenarios**. Do not generate 100 arbitrary rows just to inflate a test count; prefer inputs that expose distinct risks.

### A new business rule: should this document be reviewed?

We now want a synthetic rule:

- Payment terms from 1 to 60 days: automatic acceptance.
- Missing, non-positive, or more than 60 days: manual review.

This is a chance to learn **test-driven development (TDD)** without changing test scope.

### Solution: Red → Green → Refactor

**RED — express one missing behavior in a failing unit test:**

~~~python
def test_long_payment_terms_need_review():
    assert route_for_review(90) == "manual_review"
~~~

Run pytest. It should fail because the function does not exist yet. A failure due to a broken import environment is *not* the useful red you want.

**GREEN — implement the least needed to pass:**

~~~python
def route_for_review(days):
    return "manual_review"
~~~

The test passes, but the behavior is incomplete. Add a second test:

~~~python
def test_normal_terms_can_be_auto_accepted():
    assert route_for_review(30) == "auto_accept"
~~~

It fails. Change the function:

~~~python
def route_for_review(days):
    return "manual_review" if days > 60 else "auto_accept"
~~~

Now write tests for **None, 0, negative values, and the exact boundary 60**. They reveal a gap in that implementation.

**REFACTOR — arrive at a clear rule, keeping tests green:**

~~~python
def route_for_review(payment_days: int | None) -> str:
    if payment_days is None or not 1 <= payment_days <= 60:
        return "manual_review"
    return "auto_accept"
~~~

Notice what did *not* change: this is still a **unit test suite**. TDD determines **when the tests are written** relative to the code, not what layer the tests exercise.

**When is TDD useful?** Particularly when expected behavior is reasonably clear and can be expressed in small increments: business rules, bug fixes, parsers, validation, and API contracts. For a research spike with unknown requirements, writing exploratory code and adding tests afterward can be entirely reasonable.

Our little application still does not need a layered architecture. Do not split one pure function into five files just because a diagram says so.

---

## Stage 3: "Now the Function Must Call Something Outside Itself"

**Test type: UNIT, using FAKES.** This is our first architectural turning point.

The service must extract payment terms and save a processed document. In a real product, extraction might call OCR or Bedrock and persistence might use Databricks or PostgreSQL. If the service constructs those clients internally, every business-rule test becomes slow, expensive, or dependent on credentials.

The problem is no longer pytest syntax. It is **coupling**.

### Solution: separate business behavior from infrastructure through ports

We introduce a few responsibilities, only because a new requirement makes them useful:

~~~text
document_testing/
  domain.py           # pure rules + request/output models
  ports.py            # interfaces the application expects
  service.py          # process a document
~~~

In the [actual companion code](https://github.com/WittmannF/wittmannf.github.io/tree/main/public/blog/python-testing-guide/document_testing), ports are Python Protocols:

~~~python
# ports.py
from typing import Protocol

class Extractor(Protocol):
    def payment_days(self, text: str) -> int | None: ...

class DocumentRepository(Protocol):
    def save(self, document: DocumentOutput) -> None: ...
    def get(self, document_id: str) -> DocumentOutput | None: ...
~~~

The application service accepts those dependencies:

~~~python
# service.py (abbreviated)
class DocumentService:
    def __init__(self, extractor: Extractor, repository: DocumentRepository):
        self.extractor = extractor
        self.repository = repository

    def process(self, document: DocumentInput) -> DocumentOutput:
        name = normalize_name(document.raw_name)
        days = self.extractor.payment_days(document.text)
        output = DocumentOutput(
            document_id=document.document_id,
            borrower_name=name,
            payment_days=days,
            review_route=route_for_review(days),
        )
        self.repository.save(output)
        return output
~~~

### A unit test can now use fakes

~~~python
class FakeExtractor:
    def payment_days(self, text: str) -> int:
        return 45

class FakeRepository:
    def __init__(self):
        self.records = {}

    def save(self, document):
        self.records[document.document_id] = document

    def get(self, document_id):
        return self.records.get(document_id)

def test_service_processes_and_saves_document():
    repository = FakeRepository()
    service = DocumentService(FakeExtractor(), repository)

    result = service.process(
        DocumentInput(document_id="D-1", raw_name=" Ana  Silva ", text="anything")
    )

    assert result.borrower_name == "Ana Silva"
    assert result.review_route == "auto_accept"
    assert repository.get("D-1") == result
~~~

**Why is this a unit test even though it uses several objects?** We are verifying the service's behavior in a controlled, isolated environment. The fake repository and extractor are in-memory stand-ins with no real external boundary.

A fake implements a useful simplified behavior. A stub returns predetermined values. A spy records calls. A mock often configures responses and verifies interactions. They are all **test doubles**, not separate types of tests.

**What this test does not prove:** that SQLite writes successfully, that Bedrock accepts your request, or that credentials are valid. This distinction is essential; otherwise a large mocked test suite can create a false sense of security.

We have introduced the **dependency inversion** idea: the service depends on stable interfaces, not concrete providers. This is the first genuinely useful architectural improvement in our journey.

---

## Stage 4: "The Fake Repository Works. But Does the Database?"

**Test type: INTEGRATION.** We now test the real boundary between our application and a persistence implementation.

A fake never executes SQL, handles a transaction, or verifies round-trip data types. If your production failure is "NULL was stored incorrectly" or "the upsert overwrote the wrong row," fake-based unit tests cannot detect it.

### Solution: introduce a real SQLite adapter

~~~text
document_testing/
  domain.py
  ports.py
  service.py
  infrastructure.py    # NEW: SQLite repository + simple regex extractor

tests/
  unit/
  integration/          # NEW
~~~

Our companion uses a real SQLite file. The repository creates a table and exposes **save** and **get**. This is still a deliberately modest system: we have not introduced ORM mappings, migrations, or containers, because SQLite can demonstrate a real storage boundary with almost no setup.

The important test is:

~~~python
from document_testing.domain import DocumentOutput
from document_testing.infrastructure import SQLiteDocumentRepository

def test_sqlite_round_trip(tmp_path):
    db_path = tmp_path / "documents.sqlite3"
    repository = SQLiteDocumentRepository(db_path)

    expected = DocumentOutput(
        document_id="D-1",
        borrower_name="Ada Lovelace",
        payment_days=None,
        review_route="manual_review",
    )
    repository.save(expected)

    # Read through a new instance to verify actual persistence.
    reopened = SQLiteDocumentRepository(db_path)
    assert reopened.get("D-1") == expected
    assert reopened.get("missing") is None
~~~

**Why integration, not unit?** We exercise the real adapter plus the SQLite database engine, including SQL, serialization, and disk persistence. We test them *together*.

For PostgreSQL, a similar test could use Testcontainers or a dedicated test database. For AWS or Databricks, use a controlled sandbox and carefully manage credentials and costs. **Do not replace a real integration test with a mock and keep calling it integration.**

**When is this additional test worth it?** Whenever correctness depends on a driver, query, schema, adapter, file format, or serialization boundary. Keep the fast domain tests, and add this narrower real integration test rather than turning every unit test into a database test.

---

## Stage 5: "The Service Works in Python. Does Its HTTP API Work?"

**Test types: INTEGRATION + CONTRACT objective.** We are adding another architectural boundary: HTTP.

The application is now exposed through FastAPI:

~~~text
Client
  |
  v
api.py                  HTTP validation and serialization
  |
  v
service.py              Business workflow
  |            |
  v            v
Extractor    Repository    External dependencies behind ports
~~~

The request and response are Pydantic models. The route delegates to the service and returns a structured result:

~~~python
@app.post("/documents/process", response_model=DocumentOutput, status_code=201)
def process_document(
    document: DocumentInput,
    service: DocumentService = Depends(get_service),
) -> DocumentOutput:
    return service.process(document)
~~~

An apparently correct service may still fail because the endpoint uses the wrong status code, request field, dependency, or JSON serialization.

### Solution: exercise the in-process HTTP boundary with TestClient

We want a test that uses **real FastAPI routing, request validation, Pydantic serialization, and temporary SQLite persistence**, while replacing only the external extraction behavior.

~~~python
@pytest.fixture
def client(tmp_path):
    db_path = tmp_path / "api.sqlite3"
    app.dependency_overrides[get_service] = lambda: DocumentService(
        FakeExtractor(), SQLiteDocumentRepository(db_path)
    )
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
~~~

Now test the whole in-process request and the public contract:

~~~python
def test_create_and_retrieve_document_with_contract(client):
    response = client.post(
        "/documents/process",
        json={"document_id": "D-2", "raw_name": "Ada Lovelace", "text": "anything"},
    )
    assert response.status_code == 201
    assert response.json() == {
        "document_id": "D-2",
        "borrower_name": "Ada Lovelace",
        "payment_days": 90,
        "review_route": "manual_review",
    }
    assert client.get("/documents/D-2").json() == response.json()
~~~

This assumes the companion test's FakeExtractor returns 90 days.

**Why integration?** Multiple real application components participate: route, dependency wiring, validation, service, and storage. **Why contract?** We assert externally visible JSON field names, types/values, and HTTP behavior.

**Why not E2E?** TestClient runs the ASGI app **in-process**. It does not prove that a real server is reachable, that a container is correctly configured, or that deployed infrastructure works. A local TestClient check is valuable precisely because it is cheaper than a deployed E2E check.

Add a case for missing required fields (HTTP 422), missing documents (HTTP 404), and a minimal health check. Do not write one giant test for all validation permutations.

---

## Stage 6: "All Local Tests Pass, but the Deployed Service Fails"

**Test type: E2E for the real HTTP journey; SMOKE as a narrower objective.** This is where we cross the process/network boundary.

An end-to-end test should be designed around a **user-visible workflow**. For this tutorial, it means starting the real API process, POSTing a document over HTTP, and GETting it back through the same public interface.

Run the API in one terminal:

~~~bash
uv run uvicorn document_testing.api:app --port 8000
~~~

In another terminal:

~~~bash
TEST_BASE_URL=http://127.0.0.1:8000 uv run pytest tests/e2e -q
~~~

The [E2E example](https://github.com/WittmannF/wittmannf.github.io/tree/main/public/blog/python-testing-guide/tests/e2e) uses a unique document ID, real HTTP calls, and real SQLite persistence. It is **opt-in** and skipped in ordinary local/CI runs unless a base URL is supplied.

This locally running E2E proves more than TestClient, but it still does not validate cloud deployment permissions or production networking. For those, run a representative E2E against an appropriately configured staging environment.

A **smoke test** is a quick check that critical functionality is alive, such as GET /health or a tiny happy-path operation after deployment. A smoke test can be implemented at different scopes: the word smoke describes the *purpose*, not a new test layer.

**Trade-off:** E2E tests are useful but expensive and frequently flaky. Prefer a small number of high-value journeys, and test the bulk of business logic at narrower, faster scopes.

---

## Stage 7: "The Same Bug Returns, or an Input We Never Imagined Appears"

Here we introduce two terms often mistaken for new layers. They are **not**.

### 7A. Regression testing: an objective that can span scopes

**Objective: REGRESSION. Scope in this example: integration with the real extraction adapter.**

Suppose a document with uppercase payment terms caused a bug. Preserve the input and independently specified expected output:

~~~json
[
  {"id": "standard-terms", "text": "Payment Terms: 30 days", "expected_payment_days": 30},
  {"id": "case-insensitive", "text": "PAYMENT TERMS: 45 DAYS", "expected_payment_days": 45},
  {"id": "missing-field", "text": "No payment terms provided", "expected_payment_days": null}
]
~~~

We parameterize the test from the fixture:

~~~python
@pytest.mark.parametrize("case", CASES, ids=lambda case: case["id"])
def test_extraction_regression(case):
    assert RegexExtractor().payment_days(case["text"]) == case["expected_payment_days"]
~~~

The purpose is to **prevent known failures from returning**. A regression test could also be a pure unit test or a full E2E; we choose the narrowest boundary that captures the original failure.

In real document-processing systems, preserve reviewed gold labels, source/version metadata, and sanitized cases. Never infer ground truth from the output of the implementation you are testing.

### 7B. Property-based testing: a technique that generates inputs

**Technique: PROPERTY-BASED. Scope in this example: unit.**

Instead of enumerating examples, Hypothesis generates many inputs for an invariant. Our normalizer should be **idempotent**: normalizing a value twice should equal normalizing it once.

~~~python
from hypothesis import given, strategies as st

@given(st.text())
def test_normalization_is_idempotent(raw):
    if not raw.split():
        with pytest.raises(ValueError):
            normalize_name(raw)
    else:
        normalized = normalize_name(raw)
        assert normalize_name(normalized) == normalized
~~~

Hypothesis explores strings, Unicode, and edge cases, and shrinks a failing example. Property-based tests complement example-based ones; they do not tell you which business invariants are correct.

The structure has evolved again, but only to make tests easier to navigate:

~~~text
tests/
  unit/            pure rules + service with fakes
  integration/     SQLite + FastAPI in-process
  e2e/             opt-in real HTTP
  regression/      example fixtures protecting past behavior
  property/        generated-input invariants
  fixtures/        reviewed synthetic cases
~~~

**Important:** regression and property-based directories are optional pedagogical groupings, not mandatory architectural layers. In many teams, the property test would live beside the other unit tests and the regression next to the adapter test.

---

## Stage 8: "My Suite Is Green. Is the System Actually Reliable?"

We have tests at different boundaries. Now we need a **strategy**, not simply more test files.

### Choose the test by the failure you want to catch

| If the risk is... | Start with... | Add... |
|---|---|---|
| Wrong domain rule or transformation | **Unit** | Parametrization / properties for edge cases |
| An internal refactor changes observable behavior | **Unit** | Regression examples for bugs |
| SQL/query/serialization behaves differently in reality | **Integration** | Real database or temporary container |
| API consumers might break | **Contract check** | Consumer-driven contracts if teams deploy independently |
| A whole critical journey could fail | **E2E** | Narrow smoke checks after deployment |
| A provider adapter changes | **Integration** | Controlled sandbox contract checks |
| A prompt/model produces incorrect content | **LLM evaluation** | Independent golden datasets + quality/cost/latency gates |

### Do not confuse coverage with test quality

Run:

~~~bash
uv run pytest --cov=document_testing --cov-report=term-missing
~~~

Coverage tells you **which code executed**, not whether your assertions would detect a wrong result. Even 100% coverage can coexist with ineffective assertions.

For important deterministic rules, mutation testing can provide a stronger check by introducing code changes and observing whether tests fail. Do not use a single percentage as a proxy for correctness.

### Avoid flaky and slow tests

Common causes of flakiness: shared mutable state, order-dependent fixtures, network requests in unit tests, fixed sleeps, real wall-clock time, and reused databases. Prefer temporary paths, injected clocks/clients, explicit cleanup, and small tests with one clear reason to fail.

A pragmatic CI split:

~~~bash
# Every PR: deterministic tests, without external live server
uv run pytest -q -m "not e2e"

# A controlled environment with the API already running:
TEST_BASE_URL=http://127.0.0.1:8000 uv run pytest -q -m e2e
~~~

In larger systems, use separate markers or CI jobs for live cloud integrations, load tests, and expensive evaluations.

### One last boundary: code correctness is not LLM quality

The biggest trap in AI applications is assuming valid JSON means the answer is correct.

Consider two distinct questions:

| Software correctness | AI output quality |
|---|---|
| Is the response a valid Pydantic object? | Did extraction identify the right payment term? |
| Are retries, timeouts, and failures handled? | Did it invent an answer for an absent field? |
| Are citation IDs preserved and returned? | Does each citation support the answer? |
| Are model calls bounded and logged? | Did accuracy or completeness regress? |

The left column is mostly testable through deterministic unit/integration/contract tests. The right requires **independently reviewed examples, appropriate metrics, and model/prompt version comparisons**. For a document extraction pipeline, an evaluation dataset might record expected fields, evidence location, abstentions, and completeness labels.

An LLM judge can help score some dimensions, but its results need calibration against human-reviewed data. A model grading its own generated "golden answers" is not independent evidence.

**When coding agents write tests**, start with independently described requirements and failure modes. A coding agent can easily generate 30 passing tests that merely echo an incorrect implementation. For a bug fix, ask to see the regression test fail before the fix and pass afterward.

---

## The Final Architecture: Why We Ended Up with These Files

At the start, a single module was enough. Only later did we introduce HTTP, dependencies, and persistence. Here is the final runnable structure:

~~~text
python-testing-guide/
  pyproject.toml
  walkthrough/
    stage01_one_file.py      # the initial one-file implementation
  document_testing/
    domain.py                # business rules / data types
    ports.py                 # expected dependency interfaces
    service.py               # use case orchestration
    infrastructure.py        # SQLite + regex adapters
    api.py                   # FastAPI transport
  tests/
    unit/
      test_domain.py
      test_service.py
    integration/
      test_sqlite_repository.py
      test_api.py
    e2e/
      test_live_api.py
    regression/
      test_extractor_regressions.py
    property/
      test_name_properties.py
    fixtures/
      golden_cases.json
~~~

The important architectural idea is not the exact folder names. It is that **domain decisions are testable without HTTP or SQL**, while infrastructure and transport are separately verifiable at their real boundaries.

This echoes the progression from a single Python file to application, domain, and infrastructure layers: **don't add layers because a pattern exists; add boundaries because the code has acquired new responsibilities**.

### Run each category separately

~~~bash
cd public/blog/python-testing-guide
uv sync

uv run pytest tests/unit -q
uv run pytest tests/integration -q
uv run pytest tests/regression -q
uv run pytest tests/property -q
uv run pytest -q -m "not e2e"
~~~

For the opt-in live E2E test, start uvicorn and supply TEST_BASE_URL as shown in Stage 6.

## A Checklist for Your Next PR

Before adding a test, ask:

1. **Which failure would this test detect?** Write that down before the implementation.
2. **What is its scope: unit, integration, or E2E?** Name the real boundary exercised.
3. **What is its objective?** Contract, regression, smoke, performance, or another risk.
4. **Are the expected results independently specified?** Avoid tests that just echo the code.
5. **Could a smaller test detect this more cheaply?** Prefer a narrower boundary when sufficient.
6. **Am I hiding the actual risk with mocks?** Keep a real adapter/integration check where necessary.
7. **Will this stay readable after a refactor?** Assert behavior, not incidental private calls.
8. **Does the suite run reproducibly?** Isolate files, time, state, network, and databases.
9. **For LLM output, do I have evaluation data?** Software tests alone cannot certify semantic correctness.

## Recapping the Journey

We started with **one function and a unit test**. Edge cases motivated parametrization and TDD. External calls motivated interfaces and fake-backed unit tests. Real persistence introduced an integration test. HTTP introduced contract checks. A running server introduced E2E tests. Historical bugs motivated regression fixtures. Unimagined inputs motivated property-based testing. Finally, model output quality required a different type of evaluation.

We did not need all those pieces on day one. Each appeared when a concrete problem justified it. That is how you build a test suite that remains useful as an application grows.

---

## References and Further Reading

- [pytest](https://docs.pytest.org/en/stable/) — assertions, fixtures, parametrization.
- [Hypothesis](https://hypothesis.readthedocs.io/en/latest/) — property-based testing and shrinking.
- [FastAPI: testing dependencies](https://fastapi.tiangolo.com/advanced/testing-dependencies/) — dependency overrides with TestClient.
- [Architecture Patterns with Python](https://www.cosmicpython.com/) — service layers, ports/adapters, fakes, and repositories.
- [Test-Driven Development with Python](https://www.obeythetestinggoat.com/pages/book.html) — long-form TDD walkthrough.
- [Python Testing with pytest, 2nd edition](https://pragprog.com/titles/bopytest2/) — deeper pytest reference.
- [My uv guide](https://fernandowittmann.com/blog/uv-guide/) — managing Python environments.

*This is the practical overview. Separate deep dives can cover architecture-first TDD and LLM/agent evaluations without turning the introduction into a 15,000-word reference manual.*
