# Python Testing That Actually Catches Bugs

Companion for the [draft article](../../../src/content/blog/python-testing-guide.md). The example progresses from a one-file function to a small application with distinct domain, service, persistence, and HTTP boundaries.

**This is synthetic teaching code** and does not implement a production extraction or financial decision system. No credentials or paid services are required.

## Install and run

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/).

~~~bash
cd public/blog/python-testing-guide
uv sync
uv run pytest -q -m "not e2e"
uv run pytest tests/unit -q
uv run pytest tests/integration -q
uv run pytest tests/regression -q
uv run pytest tests/property -q
uv run pytest --cov=document_testing --cov-report=term-missing
~~~

## The progression

| Stage | New problem | Architectural change | Test category |
|---|---|---|---|
| 1 | A simple rule could regress | One-file function | Unit |
| 2 | More rules and edge cases | TDD and parametrization | Unit (techniques) |
| 3 | External dependencies enter the service | Interfaces / dependency injection | Unit using fakes |
| 4 | We must know persistence works | A real SQLite adapter | Integration |
| 5 | The service is exposed over HTTP | FastAPI routes and schemas | In-process integration + contract |
| 6 | We need proof the running service works | Run a server and call it via HTTP | E2E |
| 7 | Previously missed cases must be caught | Golden fixtures and Hypothesis | Regression objective + property technique |
| 8 | LLM output introduces uncertain correctness | Independently reviewed dataset | Evaluation (conceptual) |

### File layout

~~~text
walkthrough/stage01_one_file.py    # minimal first version
document_testing/
  domain.py                        # pure business rules
  ports.py                         # Extractor and DocumentRepository interfaces
  service.py                       # business workflow
  infrastructure.py                # regex and real SQLite adapters
  api.py                           # FastAPI / dependency wiring
tests/
  unit/
  integration/
  e2e/
  regression/
  property/
  fixtures/golden_cases.json
~~~

This grouping is pedagogical, not a mandatory production convention: regression is a test objective, and property-based testing a technique. Both can be applied at multiple test scopes.

## Opt-in real HTTP E2E

In terminal 1:

~~~bash
uv run uvicorn document_testing.api:app --port 8000
~~~

In terminal 2:

~~~bash
TEST_BASE_URL=http://127.0.0.1:8000 uv run pytest tests/e2e -q
~~~

The E2E test skips by default. It sends a real HTTP POST and GET against the running server and exercises normal SQLite persistence. For production CI, run it in a controlled environment.

## Limitations

- Tests against fakes do not prove that an external provider works.
- FastAPI TestClient tests cannot prove deployed infrastructure works.
- Regression fixtures are synthetic and are not a representative quality benchmark.
- Regex and review-routing rules are illustrative, not valid contractual or financial policies.
- LLM quality needs dedicated, independently scored evaluations.
