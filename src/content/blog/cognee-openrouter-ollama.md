---
title: 'Run Cognee Locally with Ollama Embeddings and OpenRouter'
description: 'A practical guide to running Cognee on your Mac with local Ollama embeddings while sending only generative LLM calls to OpenRouter.'
pubDate: 2026-09-18
tags: ['AI', 'LLMs', 'Cognee', 'OpenRouter', 'Ollama', 'RAG', 'Knowledge Graphs', 'Python']
lang: 'en'
---

I wanted to experiment with [Cognee](https://github.com/topoteretes/cognee), an open-source memory layer for AI agents, but I did not want the quality of a small local LLM to become part of the experiment.

At the same time, running embeddings through a cloud API felt unnecessary. Embeddings are relatively lightweight, Ollama handles them well locally, and I already had Ollama installed on my Mac.

So I ended up with a hybrid setup:

```text
                           MacBook
                              |
                         Cognee
                              |
              +---------------+---------------+
              |               |               |
         Local storage   Local graph     Local vectors
                                              |
                                              v
                                            Ollama
                                              |
                                      nomic-embed-text

                         Cognee LLM calls
                              |
                              v
                          OpenRouter
                              |
                         Remote LLM
```

The result is a useful compromise:

- Cognee runs locally.
- Cognee's default storage runs locally, without requiring a separate database server for this experiment.
- Embeddings are generated locally with Ollama and `nomic-embed-text`.
- Only generative LLM calls go to OpenRouter.
- You can change the LLM without changing the rest of the stack.

This guide walks through the setup from scratch and explains why each component is there.

> This article was written against Cognee's current `main` branch in September 2026. Cognee is evolving quickly, so check the official repository if a configuration variable changes in a future release.

---

## Why Cognee needs both an embedding model and an LLM

The first important concept is that embeddings and generative LLMs have different jobs.

An embedding model turns text into a numerical representation:

```text
"Alice works at Acme as a machine learning engineer."

                    ↓

[0.021, -0.184, 0.092, ..., 0.337]
```

That vector is useful for similarity search. If a later query has a nearby vector, a vector database can retrieve the relevant chunk.

A generative LLM does something different. Cognee uses an LLM while building and querying memory, including tasks such as entity extraction, relationship extraction, summarization, structured output, and some query-time reasoning.

For example, from this sentence:

```text
During the architecture meeting, Alice proposed replacing Redis with PostgreSQL
because the team wanted to reduce the number of infrastructure components.
```

an LLM can help derive a structure closer to:

```text
Alice
  |
  +-- proposed --> Replace Redis with PostgreSQL
                         |
                         +-- reason --> Reduce infrastructure components
                         |
                         +-- context --> Architecture meeting
```

That distinction matters. A weak embedding model can hurt retrieval, but a weak generative model can also hurt the structure of the memory before you even ask the first question.

This is why I prefer to evaluate Cognee first with a capable remote LLM while keeping embeddings local.

---

## The architecture we are building

The setup in this tutorial looks like this:

```text
                     INPUT DOCUMENTS
                           |
                           v
                         Cognee
                           |
             +-------------+-------------+
             |                           |
             v                           v
       Local embeddings             Generative LLM
             |                           |
           Ollama                    OpenRouter
             |                           |
    nomic-embed-text              model of choice
             |                           |
             v                           v
      Local vector data       entities, relations,
                             summaries, reasoning
             \                           /
              \                         /
               +------ Cognee memory --+
```

A useful mental model is:

| Component | Where it runs | Purpose |
|---|---|---|
| Cognee | Local | Memory pipeline and retrieval |
| Metadata/storage | Local | Cognee state and data |
| Vector storage | Local | Semantic retrieval |
| Graph storage | Local | Relationships and structured memory |
| Ollama | Local | Embedding inference |
| `nomic-embed-text` | Local | Text embeddings |
| OpenRouter | Remote | Unified API for the generative LLM |
| Generative LLM | Remote | Extraction, summarization, reasoning |

For a first experiment, this avoids Docker, Neo4j, PostgreSQL, Redis, CUDA, and a large local generative model.

---

## What remains local, and what leaves your machine

There is one privacy distinction worth making before we start.

This setup keeps the storage and embedding computation local, but it is **not a fully local AI pipeline**.

When Cognee needs the LLM for extraction, summarization, or completion, relevant text is sent to OpenRouter and then to the selected model provider.

So this statement is true:

```text
Embeddings are generated locally.
```

But this statement is not necessarily true:

```text
No document content ever leaves my machine.
```

If your requirement is that document content must never leave the computer, you should also run the generative model locally through Ollama or another local inference server.

For sensitive workloads, review OpenRouter's privacy controls and the policies of the model provider you select before sending production data.

---

## Requirements

For the setup below you need:

- macOS or Linux
- Python 3.10 to 3.14
- [`uv`](https://docs.astral.sh/uv/)
- [Ollama](https://ollama.com/)
- an [OpenRouter](https://openrouter.ai/) account and API key
- a few gigabytes of free disk space

I will use Python 3.12 in the examples.

You do not need an NVIDIA GPU. On Apple Silicon, Ollama can use Apple's local hardware acceleration for supported workloads.

You also do not need a local generative model such as Llama, Qwen, or Gemma for this specific setup. Ollama will only serve embeddings.

---

## Step 1: verify Ollama

First check that Ollama is installed:

```bash
ollama --version
```

Then list the models already available locally:

```bash
ollama list
```

If `nomic-embed-text` is missing, download it:

```bash
ollama pull nomic-embed-text
```

Check the list again:

```bash
ollama list
```

You should see an entry for `nomic-embed-text`.

Ollama normally exposes its local API on port `11434`. Verify that the server is reachable:

```bash
curl http://localhost:11434/api/tags
```

If the request fails, open the Ollama application or start the server manually:

```bash
ollama serve
```

---

## Step 2: test the embedding endpoint directly

Before adding Cognee, I like to test each dependency independently.

Send a small embedding request directly to Ollama:

```bash
curl http://localhost:11434/api/embed \
  -d '{
    "model": "nomic-embed-text",
    "input": "Cognee creates persistent memory for AI applications."
  }'
```

You should receive JSON containing an `embeddings` array with a long list of floating-point values.

Conceptually:

```json
{
  "embeddings": [
    [0.0123, -0.0841, 0.1932, 0.0417]
  ]
}
```

The real vector is much larger. `nomic-embed-text` uses 768-dimensional embeddings in this configuration.

At this point we know the local embedding service works independently of Cognee.

---

## Step 3: create the Python project

Create a new project with `uv`:

```bash
uv init --python 3.12 cognee-openrouter
cd cognee-openrouter
```

Install Cognee with its Ollama extra:

```bash
uv add "cognee[ollama]"
```

Verify the import:

```bash
uv run python -c "import cognee; print('Cognee imported successfully')"
```

A minimal project now looks roughly like this:

```text
cognee-openrouter/
├── .python-version
├── README.md
├── main.py
├── pyproject.toml
└── uv.lock
```

---

## Step 4: create an OpenRouter API key

OpenRouter exposes an OpenAI-compatible API in front of many model providers.

Instead of changing SDKs whenever you want to compare models, you can keep the same endpoint and change the model slug.

Create an API key from the OpenRouter dashboard and store it outside your source code.

OpenRouter keys typically look like:

```text
sk-or-v1-...
```

Create a `.env` file and make sure it will not be committed:

```bash
touch .env
echo ".env" >> .gitignore
```

On macOS or Linux you can also restrict local permissions:

```bash
chmod 600 .env
```

---

## Step 5: choose a model

Cognee benefits from a model that is good at:

- instruction following
- entity and relationship extraction
- JSON and structured output
- summarization
- consistent schema adherence

For the first test, I would not start with the most expensive model available. The goal is to verify the architecture, not maximize benchmark scores.

As of September 2026, a reasonable low-cost example on OpenRouter is:

```text
openai/gpt-5.6-luna
```

It supports structured outputs and is inexpensive enough for experimentation. If memory extraction quality is not good enough, you can later move to a stronger model such as GPT-5.6 Terra, GPT-5.6 Sol, Claude, Gemini, or another model available on OpenRouter.

There is one naming detail that is easy to miss.

The OpenRouter model slug is:

```text
openai/gpt-5.6-luna
```

But Cognee uses LiteLLM internally for this integration, so the Cognee model value includes the `openrouter/` prefix:

```text
openrouter/openai/gpt-5.6-luna
```

This difference will matter in the next steps.

---

## Step 6: configure Cognee

Create the `.env` file with the following configuration:

```dotenv
# Generative LLM through OpenRouter
LLM_PROVIDER="custom"
LLM_MODEL="openrouter/openai/gpt-5.6-luna"
LLM_ENDPOINT="https://openrouter.ai/api/v1"
LLM_API_KEY="sk-or-v1-YOUR-KEY-HERE"

# Local embeddings through Ollama
EMBEDDING_PROVIDER="ollama"
EMBEDDING_MODEL="nomic-embed-text:latest"
EMBEDDING_ENDPOINT="http://localhost:11434/api/embed"
EMBEDDING_API_KEY="ollama"
EMBEDDING_DIMENSIONS=768

# Tokenizer used by Cognee for chunk sizing
HUGGINGFACE_TOKENIZER="nomic-ai/nomic-embed-text-v1.5"
```

This is the core of the hybrid setup.

### Why `LLM_PROVIDER="custom"`?

OpenRouter exposes an OpenAI-compatible endpoint, and Cognee's current configuration uses the custom provider path for OpenRouter.

```dotenv
LLM_PROVIDER="custom"
LLM_ENDPOINT="https://openrouter.ai/api/v1"
```

### Why does the model start with `openrouter/`?

LiteLLM uses the prefix to select the OpenRouter routing logic:

```dotenv
LLM_MODEL="openrouter/openai/gpt-5.6-luna"
```

### Why configure embeddings separately?

This is one of the most important details in the entire setup.

Cognee treats the LLM and embedding model as independent providers.

Configuring only:

```dotenv
LLM_PROVIDER="custom"
```

does not automatically move embeddings to Ollama.

If you forget the `EMBEDDING_*` variables, Cognee can continue using its default embedding configuration and you may get an OpenAI authentication error during ingestion even though the OpenRouter LLM is configured correctly.

### Why `EMBEDDING_DIMENSIONS=768`?

The vector store needs the embedding dimensionality to remain consistent. The `nomic-embed-text` setup used here produces 768-dimensional vectors.

### Why specify `HUGGINGFACE_TOKENIZER`?

Cognee needs a tokenizer compatible with the embedding model to size chunks correctly.

The actual embedding inference still happens locally through Ollama. However, the tokenizer files may be downloaded from Hugging Face the first time they are needed and then cached locally.

So the setup is local for embedding inference, but the very first run may still make a small network request to obtain tokenizer assets.

---

## Step 7: test OpenRouter directly

Now validate the remote side independently of Cognee.

Export your key temporarily in the shell:

```bash
export OPENROUTER_API_KEY="sk-or-v1-YOUR-KEY-HERE"
```

Then call OpenRouter directly:

```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-5.6-luna",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: OpenRouter works"
      }
    ]
  }'
```

Notice that this direct OpenRouter request uses:

```text
openai/gpt-5.6-luna
```

not:

```text
openrouter/openai/gpt-5.6-luna
```

The `openrouter/` prefix is for LiteLLM inside Cognee, not for OpenRouter's own HTTP API.

If this request succeeds, both external pieces are now independently verified:

```text
Ollama embeddings    OK
OpenRouter LLM       OK
```

That makes Cognee much easier to debug.

---

## Step 8: build the first memory

Replace `main.py` with:

```python
import asyncio

import cognee


DATASET = "architecture_demo"

TEXT = """
Acme is building an internal document intelligence platform.

Alice leads the machine learning team.

During an architecture meeting, Alice suggested replacing Redis with PostgreSQL
to reduce the number of infrastructure components.

Bob is responsible for deploying the new architecture.

The migration is expected to happen in October 2026.
"""


async def main():
    await cognee.remember(TEXT, dataset_name=DATASET)

    questions = [
        "Who leads the machine learning team?",
        "What infrastructure change did Alice propose?",
        "Why was PostgreSQL proposed?",
        "Who is responsible for the deployment?",
        "When should the migration happen?",
    ]

    for question in questions:
        print(f"\nQuestion: {question}")
        results = await cognee.recall(question)

        for result in results:
            print(result)


if __name__ == "__main__":
    asyncio.run(main())
```

Run it:

```bash
uv run python main.py
```

The first ingestion can take noticeably longer than adding text to a plain vector database. That is expected because Cognee is doing more than embedding chunks.

---

## What happens inside `remember()`?

At a high level, the memory-oriented Cognee API follows a pipeline like:

```text
remember()
    |
    v
ingest data
    |
    v
chunk text
    |
    +--------------------------+
    |                          |
    v                          v
embeddings                LLM extraction
    |                          |
    v                          v
vector data         entities + relationships
                               |
                               v
                         structured memory
                               |
                               v
                           enrichment
```

This is the main reason model quality matters.

In a basic RAG system, the generative LLM often appears mostly after retrieval:

```text
documents -> embeddings -> retrieval -> LLM answer
```

In Cognee, the LLM can also participate while the memory is being constructed:

```text
documents -> LLM extraction -> structured memory -> retrieval -> LLM answer
```

A poor model can therefore degrade the memory representation itself, not just the final wording of the answer.

---

## Re-running experiments cleanly

When comparing models, use a controlled dataset and reset memory between runs instead of repeatedly appending the same facts.

Cognee exposes `forget()` for deletion. For disposable local experiments, you can explicitly clear everything before rebuilding:

```python
await cognee.forget(everything=True)
```

Do not put that line into production code casually. It is useful for a benchmark script where deleting the local test memory is intentional.

A simple experimental loop is:

```text
clear test memory
      |
      v
ingest same documents
      |
      v
run same questions
      |
      v
record quality, time, cost
      |
      v
change only the LLM
```

This makes model comparisons much more meaningful.

---

## How to choose a better OpenRouter model

Once the pipeline works, model selection becomes an empirical question.

I would evaluate at least these dimensions:

| Dimension | Why it matters |
|---|---|
| Structured output reliability | Cognee needs schema-consistent output |
| Entity extraction | Determines what concepts enter memory |
| Relationship extraction | Determines graph quality |
| Instruction following | Reduces malformed or irrelevant extraction |
| Latency | Affects ingestion and interactive queries |
| Cost | Extraction may run many times across chunks |

A useful progression is:

```text
Stage 1
one inexpensive capable model for everything

Stage 2
compare against a stronger model

Stage 3
measure whether the quality difference justifies the cost
```

Do not assume the most expensive model is automatically the best architecture choice. The important question is whether a stronger model improves your actual memory and retrieval tasks enough to justify the extra cost.

---

## Advanced: use different models for different stages

Cognee also supports per-stage model routing.

This is useful because extraction, summarization, and query reasoning have different cost and quality profiles.

Conceptually:

```text
                    Cognee
                       |
          +------------+------------+
          |            |            |
          v            v            v
     Extraction   Summarization    Query
          |            |            |
     cheap/good      medium       strongest
```

For example:

```dotenv
# Base model remains the fallback
LLM_PROVIDER="custom"
LLM_MODEL="openrouter/openai/gpt-5.6-luna"
LLM_ENDPOINT="https://openrouter.ai/api/v1"
LLM_API_KEY="sk-or-v1-YOUR-KEY-HERE"

# Extraction
LLM_EXTRACTION_PROVIDER="custom"
LLM_EXTRACTION_MODEL="openrouter/openai/gpt-5.6-luna"
LLM_EXTRACTION_ENDPOINT="https://openrouter.ai/api/v1"
LLM_EXTRACTION_API_KEY="sk-or-v1-YOUR-KEY-HERE"

# Summarization
LLM_SUMMARIZATION_PROVIDER="custom"
LLM_SUMMARIZATION_MODEL="openrouter/openai/gpt-5.6-luna"
LLM_SUMMARIZATION_ENDPOINT="https://openrouter.ai/api/v1"
LLM_SUMMARIZATION_API_KEY="sk-or-v1-YOUR-KEY-HERE"

# Query-time reasoning
LLM_QUERY_PROVIDER="custom"
LLM_QUERY_MODEL="openrouter/openai/gpt-5.6-terra"
LLM_QUERY_ENDPOINT="https://openrouter.ai/api/v1"
LLM_QUERY_API_KEY="sk-or-v1-YOUR-KEY-HERE"
```

A common optimization is to keep a cost-efficient model for extraction, which may run once per chunk, and reserve a stronger model for lower-volume query-time reasoning.

I would not start with this configuration. Get the single-model version working first, create a repeatable evaluation set, and only then optimize per stage.

---

## Troubleshooting

### Cognee asks for an OpenAI API key during ingestion

This often means the LLM was configured but the embedding provider was not.

Check that all of these exist:

```dotenv
EMBEDDING_PROVIDER="ollama"
EMBEDDING_MODEL="nomic-embed-text:latest"
EMBEDDING_ENDPOINT="http://localhost:11434/api/embed"
EMBEDDING_API_KEY="ollama"
EMBEDDING_DIMENSIONS=768
```

The LLM and embedding configurations are independent.

### Ollama connection refused

Test the server directly:

```bash
curl http://localhost:11434/api/tags
```

If it fails:

```bash
ollama serve
```

Then try again.

### `nomic-embed-text` is missing

```bash
ollama pull nomic-embed-text
ollama list
```

### Vector dimension mismatch

Make sure you are consistently using:

```dotenv
EMBEDDING_DIMENSIONS=768
```

If you previously created test data using another embedding model with a different dimensionality, deleting the disposable test memory and rebuilding it is usually simpler than mixing incompatible embeddings.

### OpenRouter returns `401 Unauthorized`

Verify your API key and test OpenRouter directly with `curl` before debugging Cognee.

### OpenRouter says the model does not exist

Model slugs change over time. List the current catalog:

```bash
curl -s https://openrouter.ai/api/v1/models | jq -r '.data[].id'
```

Remember:

```text
OpenRouter HTTP API:
openai/gpt-5.6-luna

Cognee through LiteLLM:
openrouter/openai/gpt-5.6-luna
```

### Structured output or extraction errors

Not every model follows strict schemas equally well.

If the HTTP request itself works but Cognee repeatedly fails during structured extraction, test a model with stronger structured-output support before assuming the Cognee pipeline is broken.

---

## A better way to benchmark Cognee

Once the setup is running, I would build a small fixed evaluation instead of immediately ingesting thousands of documents.

For example:

```text
20 to 50 representative documents
20 direct factual questions
10 relationship questions
10 multi-hop questions
```

Track:

```text
entity extraction quality
relationship quality
retrieval quality
answer correctness
ingestion time
query latency
LLM cost
```

Then compare configurations while keeping everything else fixed:

```text
Configuration A
nomic-embed-text + GPT-5.6 Luna

Configuration B
nomic-embed-text + GPT-5.6 Terra

Configuration C
nomic-embed-text + another OpenRouter model

Configuration D
nomic-embed-text + local Ollama LLM
```

This isolates the effect of the generative model.

That is much more useful than asking whether one model is "better" in the abstract.

---

## Final project structure

The project can remain very small:

```text
cognee-openrouter/
├── .env
├── .gitignore
├── .python-version
├── main.py
├── pyproject.toml
└── uv.lock
```

Your `.gitignore` should contain at least:

```gitignore
.env
.venv/
__pycache__/
```

Never commit your OpenRouter key.

---

## Complete setup, condensed

Install Cognee:

```bash
uv init --python 3.12 cognee-openrouter
cd cognee-openrouter
uv add "cognee[ollama]"
```

Install the local embedding model:

```bash
ollama pull nomic-embed-text
```

Configure `.env`:

```dotenv
LLM_PROVIDER="custom"
LLM_MODEL="openrouter/openai/gpt-5.6-luna"
LLM_ENDPOINT="https://openrouter.ai/api/v1"
LLM_API_KEY="sk-or-v1-YOUR-KEY-HERE"

EMBEDDING_PROVIDER="ollama"
EMBEDDING_MODEL="nomic-embed-text:latest"
EMBEDDING_ENDPOINT="http://localhost:11434/api/embed"
EMBEDDING_API_KEY="ollama"
EMBEDDING_DIMENSIONS=768
HUGGINGFACE_TOKENIZER="nomic-ai/nomic-embed-text-v1.5"
```

Then run your application:

```bash
uv run python main.py
```

The resulting architecture is:

```text
Cognee              local
Storage              local
Graph memory         local
Vector storage       local
Embedding inference  local through Ollama
Generative LLM       remote through OpenRouter
```

---

## Final thoughts

This hybrid setup is a good way to evaluate Cognee without turning local model performance into a confounding variable.

Embeddings are inexpensive and straightforward to run locally. The more semantically difficult work, such as extracting entities, relationships, summaries, and structured outputs, can use a higher-quality remote model.

OpenRouter also makes the experiment easy to iterate on because the rest of the architecture remains fixed while the model changes.

That gives us a clean progression:

```text
1. Validate Cognee with a capable remote LLM
2. Benchmark different OpenRouter models
3. Split models by extraction, summarization, and query if useful
4. Compare the best remote setup against a fully local Ollama setup
```

The interesting question is no longer just "Can Cognee run locally?"

It becomes: **how much does LLM quality affect the memory Cognee builds, and what is the cheapest model that preserves the quality we actually need?**

## References

- [Cognee repository](https://github.com/topoteretes/cognee)
- [Cognee documentation](https://docs.cognee.ai/)
- [Cognee local Ollama guide](https://docs.cognee.ai/guides/local-ollama)
- [OpenRouter documentation](https://openrouter.ai/docs)
- [OpenRouter model catalog](https://openrouter.ai/models)
- [Ollama](https://ollama.com/)
- [`nomic-embed-text` on Ollama](https://ollama.com/library/nomic-embed-text)
