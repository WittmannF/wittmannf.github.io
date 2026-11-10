# Python Testing That Actually Catches Bugs — Companion Project

This folder accompanies the draft [Python testing + TDD guide](../../../src/content/blog/python-testing-guide.md).

The example is a deliberately small, **synthetic** document-processing FastAPI service. It normalizes names, extracts a simple payment-terms pattern with regex, applies a demo review rule, and returns a structured response. It does not call any paid provider and requires no credentials.

## Run

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/).

~~~bash
cd public/blog/python-testing-guide
uv sync
uv run pytest -q
uv run pytest --cov=document_service --cov-report=term-missing
uv run uvicorn document_service:app --reload  # optional; install uvicorn if using this command
~~~

The API can also be tested via FastAPI's TestClient without starting a server.

## What each test demonstrates

- **Unit + parametrization**: name cleanup, error handling, and routing boundaries.
- **Test double**: a fake extractor injected into the service rather than patched private methods.
- **API integration / local contract**: TestClient with a dependency override and JSON contract assertion.
- **Filesystem isolation**: pytest's tmp_path fixture.
- **Regression**: independently specified synthetic cases in tests/fixtures/golden_cases.json.
- **Property-based**: Hypothesis checks an idempotence invariant.

## Important limitations

- A FastAPI TestClient test is **not** an end-to-end test of a deployed application.
- A fake extractor verifies our service integration with an interface, **not** the behavior of an actual external provider.
- The regex extractor and review routing are teaching examples, not recommendations for extracting real contractual obligations.
- The golden cases are synthetic, not statistically representative of production.
- The example focuses on deterministic testing. A separate LLM evaluation suite would be needed for AI extraction quality.

No CI workflow or repository-wide dependencies are changed by this companion.
