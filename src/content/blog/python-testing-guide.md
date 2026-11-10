---
title: 'Python Testing That Actually Catches Bugs: From pytest to TDD'
description: 'A problem-driven guide to choosing the right Python tests: unit, integration, contract, E2E, regression, property-based, and LLM evaluations. With pytest, TDD, and a reproducible document-processing API.'
pubDate: 2026-11-10
tags: ['Python', 'Testing', 'pytest', 'TDD', 'FastAPI', 'Software Engineering', 'LLMs']
lang: 'en'
draft: true
---

Your Python service passes all its tests. The pull request is green. Then a real document arrives with a missing field, your external provider returns an unexpected response, and production breaks.

What went wrong? Perhaps nothing was wrong with the test runner. You tested the wrong risks.

This guide is for developers who already know Python and want to become better at **deciding what to test, designing tests that survive refactoring, and knowing when test-driven development (TDD) is useful**. We will not spend ten pages testing a calculator.

We will build a deliberately small **document-processing API** and encounter problems in the same order that they tend to arise in real projects. The examples apply equally well to data pipelines, backend services, ML applications, and LLM systems.

> **Hands-on companion:** The [complete runnable project](https://github.com/WittmannF/wittmannf.github.io/tree/main/public/blog/python-testing-guide) contains the final service, tests, and regression fixtures. It runs locally without credentials or paid services. The sample business rules are synthetic and exist only for teaching purposes.

## First, Know What a Test Is Supposed to Protect

A test is a claim about *observable behavior*, backed by an input, an expected result, and a repeatable execution. Its value is not proportional to how many methods it calls or how many lines it executes.

Three questions are more useful than "Should I mock this?":

1. **What could break?** A business rule, an API contract, a dependency boundary, or an entire workflow?
2. **What would detect that failure?** A deterministic assertion, a real integration, or a dataset-based quality metric?
3. **What is the cheapest reliable test at that boundary?** Use the smallest scope that still detects the failure you care about.

### The testing map: scope, objective, and technique are different axes

| Name | What it establishes | Example in our service |
|---|---|---|
| **Unit** | An isolated behavior is correct | Normalize a borrower's name |
| **Integration** | Components cooperate across a real boundary | FastAPI request validation + service + serialization |
| **End-to-end (E2E)** | A representative user journey works through the deployed system | Upload document, process, retrieve result |
| **Contract** | Producer and consumer agree on an interface | API request/response schema |
| **Regression** | Previously failing behavior stays fixed | A document with missing payment terms |
| **Smoke** | The critical path is alive after deployment | Service starts and responds |
| **Property-based** | An invariant holds across many generated inputs | Name normalization is idempotent |
| **Performance / load** | A measurable latency or throughput objective holds | Process N documents under a defined load |
| **LLM evaluation** | A probabilistic output meets quality criteria | Correctness and completeness of extracted answers |

These are **not mutually exclusive test categories**. A regression test may be a unit test. A contract check may run as an integration test. Property-based testing is a *technique*, not another layer in the test pyramid.

The "unit vs. integration" distinction is about the boundary being exercised, not whether you used pytest or placed the test in a particular directory. Likewise, a test using a mocked HTTP response is **not evidence that the live provider integration works**.

---

## Our Starting Point: A Small Document Processing Service

Imagine an endpoint that accepts an identifier, a borrower name, and a short document. It extracts payment terms and assigns a synthetic review route.

~~~text
POST /documents/process
    -> validate input
    -> normalize name
    -> extract payment terms
    -> apply review rule
    -> return structured JSON
~~~

A minimal input:

~~~json
{
  "document_id": "DOC-001",
  "raw_name": "  Ana   Silva ",
  "text": "Payment Terms: 30 days"
}
~~~

Expected output:

~~~json
{
  "document_id": "DOC-001",
  "borrower_name": "Ana Silva",
  "payment_days": 30,
  "review_route": "auto_accept"
}
~~~

A document with missing terms is routed to manual review rather than getting a fabricated number. In a production application, the extraction could call Bedrock, an OCR engine, or a database; for now we keep it deterministic. That makes the mechanics of testing visible before introducing model uncertainty.

### Run the companion project

Download the [project folder](https://github.com/WittmannF/wittmannf.github.io/tree/main/public/blog/python-testing-guide), then from that folder:

~~~bash
uv sync
uv run pytest -q
uv run pytest --cov=document_service --cov-report=term-missing
~~~

The project uses Python 3.12+, FastAPI, pytest, Hypothesis, httpx, and pytest-cov. The final implementation is already present, but the TDD chapter shows how to *arrive* at one of its functions test-first.

---

## Problem 1: "I Changed One Line and Broke Something Else"

### Solution: Start with a behavior-focused unit test

Our service needs to remove extra whitespace from a name. Here is a pure function:

~~~python
def normalize_name(value: str) -> str:
    normalized = " ".join(value.split())
    if not normalized:
        raise ValueError("borrower_name cannot be blank")
    return normalized
~~~

Its test is almost self-explanatory:

~~~python
from document_service import normalize_name

def test_normalize_name_collapses_whitespace():
    # Arrange
    raw = "  Ana    Silva "

    # Act
    actual = normalize_name(raw)

    # Assert
    assert actual == "Ana Silva"
~~~

This is the **Arrange–Act–Assert** pattern. There is no need to mimic the function's private implementation, inspect internal variables, or patch the string methods.

What makes this a useful test?

- It has a meaningful scenario and a clear failure message.
- It checks the observable contract.
- It runs quickly and requires no network, database, or credentials.
- You can completely rewrite the implementation and keep the test unchanged.

**When to use it:** deterministic domain logic, transformations, validation, routing, and calculations. But do not make everything a "unit" by mocking away the behavior you are supposed to verify.

---

## Problem 2: "The Happy Path Works, but Real Data Is Messy"

### Solution: Parametrization, exceptions, and boundary cases

One successful input is weak protection. Real documents have tabs, unusual whitespace, missing fields, and unexpected capitalization.

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
~~~

Parametrization keeps the test's logic in one place while making its scenarios explicit. Use cases that express distinct **risks**, not hundreds of arbitrary examples that prove the same thing.

What about invalid input?

~~~python
def test_blank_names_are_rejected():
    with pytest.raises(ValueError, match="cannot be blank"):
        normalize_name(" \t  ")
~~~

The exact error wording is not always a stable public contract. Assert the exception type, and match the message only when that message matters to the caller.

**Testing heuristic:** for each important behavior, think about a normal case, a boundary, an invalid case, and an absence/null case. In document processing, **absence** is especially important: "not found" should not silently become zero or a guessed value.

---

## Problem 3: "My Function Calls an LLM, Database, or External API"

### Solution: Inject a dependency and use a fake at the right boundary

A service that creates its own Bedrock or database client deep inside a method is hard to test. The problem is architectural: the business rule is coupled to infrastructure.

A small protocol gives the service a stable interface:

~~~python
from typing import Protocol

class Extractor(Protocol):
    def payment_days(self, text: str) -> int | None: ...

class DocumentService:
    def __init__(self, extractor: Extractor):
        self.extractor = extractor

    def process(self, document):
        days = self.extractor.payment_days(document.text)
        # Normalize, route, and construct the response...
~~~

We can test the service with a **fake** that implements that interface:

~~~python
class FakeExtractor:
    def __init__(self, days=30):
        self.days = days
        self.received = []

    def payment_days(self, text):
        self.received.append(text)
        return self.days

def test_service_uses_extractor_contract_not_its_implementation():
    fake = FakeExtractor(days=45)
    document = DocumentInput(
        document_id="doc-1",
        raw_name="  Ana  Silva ",
        text="any input",
    )

    result = DocumentService(fake).process(document)

    assert result.borrower_name == "Ana Silva"
    assert result.payment_days == 45
    assert result.review_route == "auto_accept"
    assert fake.received == ["any input"]
~~~

A fake is a lightweight working implementation of an interface. A stub supplies predefined responses. A spy records interactions. A mock typically lets us configure and assert calls. People sometimes use "mock" for all of them, but the distinction helps clarify *what we are testing*.

**The anti-pattern:** patch every private helper, assert the exact sequence of internal calls, and declare success. Such tests mirror implementation details. A harmless refactor breaks them, while a wrong business output might not.

Prefer asserting returned behavior. Verify calls only when the interaction *is* part of the contract, for example "send exactly one notification" or "never call the paid provider on a cache hit."

**When to use it:** isolate expensive, slow, nondeterministic, or unavailable dependencies. But maintain separate tests for the real adapter. Fakes prove your logic works against the interface, **not that AWS, Databricks, or a provider implemented it correctly**.

---

## Problem 4: "All My Mocked Tests Pass, but the API Still Breaks"

### Solution: Integration tests and explicit contracts

Pure unit tests cannot catch incorrect HTTP validation, dependency wiring, response serialization, or mismatched schemas.

FastAPI's TestClient exercises the application stack in-process. We override the *external extraction dependency* while keeping actual API validation and serialization.

~~~python
import pytest
from fastapi.testclient import TestClient
from document_service import app, get_service

@pytest.fixture
def client():
    app.dependency_overrides[get_service] = (
        lambda: DocumentService(FakeExtractor(days=90))
    )
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
~~~

The final cleanup matters: without it, a global override can leak between tests.

~~~python
def test_api_contract_with_dependency_override(client):
    response = client.post(
        "/documents/process",
        json={
            "document_id": "doc-2",
            "raw_name": "Ada Lovelace",
            "text": "irrelevant",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "document_id": "doc-2",
        "borrower_name": "Ada Lovelace",
        "payment_days": 90,
        "review_route": "manual_review",
    }
~~~

A second test can verify invalid requests receive HTTP 422. This is a **local API integration/contract check**; it is not an end-to-end test of an actual deployment.

A contract is more than "the endpoint returns 200." It includes field names, required versus optional fields, types, allowed values, and backwards compatibility. If another team consumes your schema, consider consumer-driven contract tests in addition to locally validating a Pydantic model.

For **real external integrations**, create a separate suite that hits a test database, sandbox account, or disposable container. Keep credentials out of pull-request workflows when possible; run integration suites with explicit, controlled environments.

**When to use it:** boundaries whose wiring and serialization matter. Mocks are not a substitute for checking that the components actually work together.

---

## Problem 5: "The Components Work, but the Entire Workflow Doesn't"

### Solution: A few representative E2E and smoke tests

An E2E test sends a representative input through the *deployed* service and observes the result at the external boundary. For our hypothetical production workflow:

~~~text
upload -> queue -> parse -> extract -> validate -> persist -> retrieve
~~~

A proper E2E check verifies the whole path and, where relevant, the final stored record. It might detect a broken IAM permission, queue subscription, migration, or container configuration that unit tests never exercise.

These tests are generally slower and costlier. Start with one or two critical happy paths and an important failure path, not an E2E for every permutation. Smoke checks are even narrower: can the application start, connect to required infrastructure, and perform a minimal operation after deployment?

**Do not call the in-process TestClient example an E2E test.** Its purpose is to test the application boundary quickly, not the deployed infrastructure.

---

## Problem 6: "We Fixed This Bug Last Month. Why Is It Back?"

### Solution: Regression fixtures built from actual incidents

When a document breaks extraction, preserve a minimal, anonymized reproduction and the *expected behavior* as a fixture. The [companion project](https://github.com/WittmannF/wittmannf.github.io/tree/main/public/blog/python-testing-guide/tests/fixtures) includes a few synthetic cases:

~~~json
[
  {"id": "standard-terms", "text": "Payment Terms: 30 days", "expected_payment_days": 30},
  {"id": "case-insensitive", "text": "PAYMENT TERMS: 45 DAYS", "expected_payment_days": 45},
  {"id": "missing-field", "text": "No payment terms provided", "expected_payment_days": null}
]
~~~

The test loads the cases and checks each example by ID. The important distinction is that **the expected answer is reviewed independently**. Do not generate both the output and the ground truth using the same code or model, then call that a regression suite.

In ML or LLM systems, retain metadata when useful: source-document version, model/prompt version, expected fields, evidence, and why the case exists. Never commit sensitive production documents without authorization and appropriate sanitization.

**When to use it:** whenever you fix a real bug. A regression fixture is often more valuable than adding another generic happy-path assertion.

---

## Problem 7: "I Can Think of Five Edge Cases. What About the Other Five Thousand?"

### Solution: Property-based testing with Hypothesis

Example-based tests ask: "Does this input produce that output?" Property-based tests ask: "Does this *invariant* hold across many generated inputs?"

For normalization, a useful invariant is **idempotence**: once a name has been normalized, normalizing it again must not change it.

~~~python
from hypothesis import given, strategies as st

@given(st.text())
def test_name_normalization_is_idempotent(raw):
    if not raw.split():
        with pytest.raises(ValueError):
            normalize_name(raw)
    else:
        cleaned = normalize_name(raw)
        assert normalize_name(cleaned) == cleaned
~~~

Hypothesis generates Unicode and whitespace combinations you would not remember to write manually, and shrinks failures into simpler counterexamples.

Other valuable properties include encode/decode round trips, serialization stability, order invariance, deduplication idempotence, and "no output references IDs absent from the input."

Property-based testing **complements**, rather than replaces, well-selected examples. It also requires a meaningful invariant: "the function never crashes" is occasionally useful, but much weaker than a business-level guarantee.

---

## Problem 8: "What if I Write the Test Before the Implementation?"

### Solution: TDD in a real Red–Green–Refactor cycle

**Test-driven development is a development workflow, not a test type.** Its central loop is:

1. **Red:** write a small test for a desired behavior and confirm it fails for the expected reason.
2. **Green:** write the simplest implementation that passes.
3. **Refactor:** improve the design while preserving the behavior, keeping the suite green.

Let's add a synthetic routing policy: missing, non-positive, or greater-than-60-day payment terms need manual review. Values from 1 to 60 are automatically accepted.

**Red: first behavior**

~~~python
def test_long_terms_require_review():
    assert route_for_review(90) == "manual_review"
~~~

At this point, route_for_review does not yet exist. Run pytest and inspect the failure; don't skip this verification.

**Green: minimal implementation**

~~~python
def route_for_review(payment_days):
    return "manual_review"
~~~

The test passes. That implementation is intentionally incomplete. Add another test:

~~~python
def test_normal_terms_are_accepted():
    assert route_for_review(30) == "auto_accept"
~~~

It fails. Make it green:

~~~python
def route_for_review(payment_days):
    return "manual_review" if payment_days > 60 else "auto_accept"
~~~

Now test the missing and invalid boundaries, which reveal another gap:

~~~python
@pytest.mark.parametrize("days", [None, 0, -5, 61])
def test_missing_or_out_of_range_terms_require_review(days):
    assert route_for_review(days) == "manual_review"
~~~

**Refactor to a final, explicit rule:**

~~~python
def route_for_review(payment_days: int | None) -> str:
    if payment_days is None or not 1 <= payment_days <= 60:
        return "manual_review"
    return "auto_accept"
~~~

The progression matters. TDD works best when a requirement can be expressed as observable behavior and incrementally discovered through examples. You do **not** have to use TDD for every spike, exploratory notebook, third-party integration, or uncertain research problem. And writing tests after coding may be a perfectly valid engineering choice; it is simply not test-first development.

TDD can improve design because difficult-to-test code often reveals hidden coupling. But it is not proof of good architecture by itself: poorly chosen assertions can still drive a bad design.

---

## Problem 9: "My Tests Are Slow, Flaky, and Still Miss Bugs"

### Solution: Isolate state, manage fixtures, and measure what matters

Flaky tests intermittently fail without a change in the behavior they claim to verify. Common causes: shared mutable state, timing assumptions, dependence on test order, real network calls, floating clocks, and nonisolated files or databases.

Use pytest's temporary-directory fixture for filesystem operations:

~~~python
def test_tmp_path_isolated_files(tmp_path):
    path = tmp_path / "incoming.txt"
    path.write_text("Payment Terms: 30 days", encoding="utf-8")
    assert load_document(path) == "Payment Terms: 30 days"
~~~

A few habits pay off disproportionately:

- Give every test independent setup and cleanup; avoid depending on test order.
- Inject time, randomness, clients, and IDs at boundaries when deterministic control matters.
- Keep fast unit tests separate from explicitly marked, slower real integrations.
- Prefer fixtures that express reusable *domain state*, not inscrutable chains of global fixture magic.
- Assert outcomes and important side effects, not incidental private call ordering.
- In CI, start with the small deterministic suite on every pull request; run heavier suites according to risk and infrastructure availability.

### Why 95% coverage is not a safety guarantee

Coverage measures executed code, not whether assertions detect incorrect behavior. A test that calls every branch but asserts nothing can produce impressive coverage.

Use coverage to *find suspiciously untested areas*, not as a proxy for quality:

~~~bash
uv run pytest --cov=document_service --cov-report=term-missing
~~~

For critical deterministic rules, **mutation testing** can give a stronger signal by deliberately changing code and checking whether the suite catches the change. It is slower, so start with important modules rather than treating it as another vanity metric.

### What about performance tests?

A performance test needs an explicit workload, metric, environment, and threshold (for example p95 latency under a fixed concurrency). A single wall-clock assertion inside CI is usually noisy. Treat performance and load as specialized suites with controlled conditions and meaningful baselines.

---

## Problem 10: "The JSON Is Valid, but the LLM Answer Is Wrong"

### Solution: Separate software tests from model evaluations

This is where traditional testing reaches an important boundary. In an AI extraction pipeline, there are **two independent correctness questions**:

| Software behavior (mostly deterministic) | Model behavior (statistical / semantic) |
|---|---|
| Request and response schemas validate | Extracted answers match the source |
| Retries and timeouts behave as specified | Missing fields are not hallucinated |
| Provenance IDs are preserved | Evidence supports the answer |
| Dependencies are called correctly | Completeness and accuracy meet targets |
| Costs and token budgets are bounded | Quality does not regress across models/prompts |

A unit test can assert that the service handles a malformed provider response. It cannot establish that a model extracts payment terms correctly across thousands of real contracts.

For model behavior, build a **reviewed golden dataset**, run the actual extraction process over those cases, and score exact fields where appropriate plus semantic dimensions such as factual correctness, completeness, abstention, and citation fidelity. Record prompt/model versions and cost/latency alongside quality. Use human review for ambiguous cases and evaluate changes against a stable baseline.

**Avoid this circular evaluation:** using the same model and prompt to generate both predictions and their supposedly independent expected answers. An LLM judge can assist, but calibrate it against human-reviewed examples rather than treating its scores as ground truth.

A good operational split:

- On every PR: deterministic units, API contracts, fakes, regression fixtures, and offline checks.
- On controlled integration runs: actual provider connectivity, schema compatibility, permission and error handling.
- Before a model or prompt rollout: golden-set evals, quality thresholds, cost/latency comparison, and review of failures.

That is a more defensible quality strategy than calling every system check an "LLM unit test."

### What changes when coding agents write tests?

A coding agent can generate dozens of green tests for the implementation it just wrote. That does not guarantee the *specification* is right. Ask it to work from independently defined acceptance criteria, enumerate failure modes before implementation, and demonstrate a regression test failing before the fix. Review surprising assertions and tests that mirror implementation details.

The goal is to make tests **evidence of requirements**, not evidence that a model can agree with its own code.

---

## A Practical Test Selection Checklist

Use this order when a feature or bug reaches your desk:

1. **Write down the failure risk** in plain language.
2. **Choose the smallest boundary** where that risk becomes observable.
3. **List representative inputs**, including invalid and missing values.
4. **Assert externally meaningful behavior**, not private helper calls.
5. **Isolate expensive dependencies**, but verify the real boundary separately.
6. **Preserve actual failures** as reviewed regression examples.
7. **Escalate scope only when needed**: unit -> local integration -> real integration -> E2E.
8. **For LLM behavior, define evaluation criteria**, not just a schema assertion.
9. **Confirm the test fails when the behavior is broken.**
10. **Make the suite repeatable in CI**, with explicit ownership of flaky tests.

### Quick command reference

~~~bash
uv sync
uv run pytest -q                            # fast feedback
uv run pytest -x                            # stop on first failure
uv run pytest -k name                       # select matching tests
uv run pytest tests/test_document_service.py
uv run pytest --cov=document_service --cov-report=term-missing
~~~

### When to choose what

| Situation | Start here | Add when needed |
|---|---|---|
| New deterministic rule | Unit test, table of examples | Property-based invariants |
| Previously seen bug | Focused regression case | Wider integration check if root cause crossed boundaries |
| New FastAPI route | Request/response test | Consumer contract test, deployed E2E |
| New AWS/database adapter | Fake-based service test | Real sandbox/container integration test |
| Multi-step business workflow | Units for each rule | Few E2E critical paths |
| Model or prompt change | Schema and error-path tests | Golden-set model evaluation and cost/latency gates |
| Code written by an agent | Independent acceptance tests | Mutation testing / manual review of failure modes |

## Recapping the Journey

We started with a document-processing service that could work on a developer's machine and still fail in production. Each problem justified a specific technique rather than introducing tools for their own sake:

**pytest** made behavior executable. **Parametrization** exposed cases beyond the happy path. **Dependency injection and fakes** isolated domain decisions from providers. **Integration and contract tests** verified actual interfaces. **Regression fixtures** kept old failures from returning. **Hypothesis** searched for inputs we did not anticipate. **TDD** showed how tests can guide implementation. **Coverage** helped locate gaps without claiming to measure correctness. And **LLM evaluations** covered a fundamentally different kind of failure.

You do not need to test everything at every level. You need a test suite that detects the failures that matter, explains them quickly, and stays useful as the system evolves.

---

## References and Further Reading

- [pytest documentation](https://docs.pytest.org/en/stable/) — fixtures, parametrization, assertions, and best practices.
- [Hypothesis documentation](https://hypothesis.readthedocs.io/en/latest/) — property-based tests and shrinking counterexamples.
- [FastAPI testing and dependency overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/) — in-process API tests.
- [Architecture Patterns with Python (Cosmic Python)](https://www.cosmicpython.com/) — ports, adapters, fakes, and testable architecture.
- [Test-Driven Development with Python, 3rd edition](https://www.obeythetestinggoat.com/pages/book.html) — a longer test-first development walkthrough.
- [Python Testing with pytest, 2nd edition](https://pragprog.com/titles/bopytest2/) — a dedicated pytest reference.
- [My uv guide](https://fernandowittmann.com/blog/uv-guide/) — setting up and running modern Python projects.

*This article intentionally prioritizes choosing and designing tests over encyclopedic coverage of every pytest plugin. A follow-up can go deeper into TDD architecture; another can cover LLM evaluations and agent reliability in production.*
