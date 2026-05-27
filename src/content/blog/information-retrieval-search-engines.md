---
title: 'A Real Search Engine: Information Retrieval Fundamentals from Scratch'
description: 'From linear search to RAG: build intuition behind indexing, ranking, relevance, and semantic search. With Python examples and a didactic mini search engine from scratch.'
pubDate: 2026-05-12
tags: ['Information Retrieval', 'Search', 'RAG', 'LLMs', 'NLP', 'Machine Learning']
lang: 'en'
---

You train a model, generate embeddings, wire up a RAG pipeline. The demo works. In production, the LLM starts hallucinating about things that are clearly in your documents. The problem isn't the LLM — it's search. The right documents simply aren't making it into the context.

Information Retrieval (IR) is the field that studies exactly this: given a set of documents and a query, how do you find and rank the most relevant ones? It's the silent foundation of every search system — from Google to OpenSearch to your RAG pipeline.

This guide is problem-driven. Each section opens with something that breaks — a real failure mode in a search system — and shows *why* it breaks before introducing the fix. The goal is intuition, not recipes.

Here's the full map of what we'll cover:

| Concept | What it is |
|---|---|
| **Inverted index** | The data structure that makes fast search possible — maps terms to the documents that contain them |
| **Text analysis pipeline** | How raw text is cleaned, tokenized, and normalized before indexing |
| **TF-IDF** | A ranking formula that weighs term frequency against how rare the term is across the corpus |
| **BM25** | The standard lexical ranking algorithm — handles document length and term saturation better than TF-IDF |
| **Evaluation metrics** | P@k, Recall@k, MRR, NDCG — how to measure whether your search is actually good |
| **Semantic search** | Embedding-based search that finds documents by meaning, not just matching words |
| **ANN (Approximate Nearest Neighbor)** | Algorithms like HNSW that make vector search fast enough for millions of documents |
| **Hybrid search + RRF** | Combining lexical and semantic rankings so each method covers the other's blind spots |
| **HyDE + query expansion** | LLM-assisted techniques that bridge the gap between short queries and long documents |
| **Chunking** | Splitting documents into indexable pieces — and why the size matters more than you'd expect |
| **Two-stage retrieval + reranking** | Using a fast retriever to get candidates, then a precise cross-encoder to reorder them |
| **Metadata filtering** | Hard filters (tenant, date, status, ACL) that prevent semantically right but operationally wrong results |
| **RAG-specific metrics** | Context Recall, Faithfulness, Answer Correctness — what to measure when the consumer is an LLM |

By the end, you won't just know how to wire up a search pipeline — you'll know where to look when it returns garbage, and why each layer of a production RAG system exists.

> **Note:** The code examples are didactic, optimized for clarity. Real production systems use far more sophisticated implementations. I cover that in the last section. You can run the examples cell by cell in the **[Jupyter Notebook](/blog/information-retrieval-search-engines/information-retrieval-search-engines.ipynb)**.

---

## Problem 1: You have 10,000 documents. How do you find the right one?

Imagine a simple corpus: meeting notes, technical documentation, blog posts. The user types a query. You need to return the most relevant documents.

The most direct approach: iterate over all documents and check whether they contain the query words.

```python
docs = [
    "Neural networks learn hierarchical representations of data",
    "Gradient descent minimizes the loss function iteratively",
    "Transformers use attention to capture long-range dependencies",
    "Random forests combine multiple decision trees",
    # ... 9,996 more documents
]

def linear_search(query: str, docs: list[str]) -> list[str]:
    query_lower = query.lower()
    return [doc for doc in docs if query_lower in doc.lower()]

results = linear_search("neural networks", docs)
```

This works for 10 documents. For 10 million — the size of any serious corpus — scanning everything on every query is infeasible. With 10M documents of 1KB each, that's 10GB of data to scan per search.

But the problem goes beyond performance. This search doesn't know *how relevant* a document is — only whether it contains the query or not. There's no ranking. No notion of which result is better.

**What we need:** a structure that lets us find documents containing a term without scanning the entire corpus, and a way to rank results by relevance.

---

## Concept 1: The Inverted Index

A search engine doesn't search documents — it searches an **index**. The index is built once (or updated incrementally) and enables fast query responses.

The central structure is the **inverted index**: a mapping of term → list of documents that contain it.

```
term            → documents
───────────────────────────────
"neural"        → [doc_0, doc_7, doc_42, ...]
"gradient"      → [doc_1, doc_8, doc_19, ...]
"transformer"   → [doc_2, doc_7, doc_55, ...]
"tree"          → [doc_3, doc_99, ...]
```

It's the inversion of the natural index (document → terms). Hence the name.

```python
from collections import defaultdict
import re

def tokenize(text: str) -> list[str]:
    # Lowercase + alphanumeric words only
    return re.findall(r'\b[a-záéíóúàâêôãõüç]+\b', text.lower())

def build_index(docs: list[str]) -> dict[str, set[int]]:
    index = defaultdict(set)
    for doc_id, doc in enumerate(docs):
        for term in tokenize(doc):
            index[term].add(doc_id)
    return dict(index)

def search(query: str, index: dict, docs: list[str]) -> list[str]:
    terms = tokenize(query)
    # Intersection: documents that contain ALL terms
    if not terms:
        return []
    result = index.get(terms[0], set())
    for term in terms[1:]:
        result = result & index.get(term, set())
    return [docs[i] for i in result]

docs = [
    "Neural networks learn hierarchical representations",
    "Gradient descent optimizes neural networks",
    "Transformers are neural networks with attention",
    "Random forests do not use gradients",
]

index = build_index(docs)
print(search("neural networks", index, docs))
# ['Neural networks learn...', 'Gradient descent optimizes...', 'Transformers are...']
```

Now search is O(1) per term (dictionary lookup) + O(k) to intersect posting lists, where k is the number of documents containing the term — much smaller than the entire corpus.

**But a new problem emerged:** are the three documents about neural networks equally relevant for the query "neural networks"? Intuitively, no — some are *about* the topic, others just mention it. We need ranking.

---

## Problem 2: Not every occurrence counts the same

Consider two documents about "machine learning":

- **Doc A:** "Machine learning is a subfield of artificial intelligence. Machine learning uses data to learn patterns. Machine learning algorithms include neural networks and decision trees."
- **Doc B:** "Python is used in machine learning, but also in web development and automation."

For the query "machine learning", Doc A is clearly more relevant — the term appears 3 times and is the central theme. Doc B mentions it once, in passing.

**Term Frequency (TF):** how many times the term appears in the document.

But TF alone has a problem: the word "the" appears in almost every document. High frequency of "the" doesn't indicate relevance.

**Inverse Document Frequency (IDF):** words that appear in few documents are more informative.

```
IDF(term) = log(N / df(term))

where:
  N = total number of documents
  df = number of documents that contain the term
```

"Machine learning" appears in 100 of 10,000 docs → IDF = log(100) ≈ 4.6  
"the" appears in 9,999 of 10,000 docs → IDF ≈ 0.0001

Multiply the two: **TF-IDF**.

```python
import math
from collections import Counter

def calculate_tf(doc_tokens: list[str]) -> dict[str, float]:
    counts = Counter(doc_tokens)
    total = len(doc_tokens)
    return {term: freq / total for term, freq in counts.items()}

def calculate_idf(docs_tokens: list[list[str]]) -> dict[str, float]:
    N = len(docs_tokens)
    df = defaultdict(int)
    for tokens in docs_tokens:
        for term in set(tokens):
            df[term] += 1
    return {term: math.log(N / freq) for term, freq in df.items()}

def score_tfidf(query: str, doc: str, idf: dict) -> float:
    query_tokens = tokenize(query)
    doc_tokens = tokenize(doc)
    tf = calculate_tf(doc_tokens)
    return sum(tf.get(t, 0) * idf.get(t, 0) for t in query_tokens)

# Example
docs = [
    "Machine learning is a subfield of AI. Machine learning uses data. Machine learning algorithms include neural networks.",
    "Python is used in machine learning, but also in web and automation.",
    "Deep learning is a subfield of machine learning with multiple layers.",
]

docs_tokens = [tokenize(d) for d in docs]
idf = calculate_idf(docs_tokens)

query = "machine learning"
scores = [(score_tfidf(query, doc, idf), doc[:50]) for doc in docs]
scores.sort(reverse=True)
for score, doc in scores:
    print(f"{score:.4f} | {doc}")

# 0.0812 | Machine learning is a subfield of AI...   ← more relevant
# 0.0271 | Deep learning is a subfield of machine...
# 0.0108 | Python is used in machine learning...     ← less relevant
```

TF-IDF has been the standard search ranking for decades. But it has known limitations:

1. **Length normalization is incomplete:** our TF formula divides by document length, but a long document that repeatedly mentions "ML" in passing can still outscore a short document where "ML" is the central theme. BM25 addresses this more robustly.
2. **TF grows linearly without saturation:** 10 occurrences isn't 10× more relevant than 1, but TF-IDF treats it that way.

---

## Concept 2: BM25 — The standard ranking algorithm

**BM25** (Best Matching 25) emerged in the 1990s and remains the standard lexical retrieval baseline — widely used in Lucene-based systems like OpenSearch and Elasticsearch.

BM25 addresses exactly the problems of TF-IDF with two parameters:

- **k1** (typically 1.2–2.0): controls term frequency saturation. Higher values let repeated occurrences keep contributing; lower values make the score saturate faster. Unlike TF, the contribution never grows linearly without bound.
- **b** (typically 0.75): controls length normalization.

```
BM25(q, d) = Σ IDF(t) × [TF(t,d) × (k1 + 1)] / [TF(t,d) + k1 × (1 - b + b × |d|/avgdl)]

where:
  |d|    = document length
  avgdl  = average document length in the corpus
```

```python
class BM25:
    def __init__(self, docs: list[str], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.docs_tokens = [tokenize(d) for d in docs]
        self.N = len(docs)
        self.avgdl = sum(len(t) for t in self.docs_tokens) / self.N

        # IDF for each term
        df = defaultdict(int)
        for tokens in self.docs_tokens:
            for term in set(tokens):
                df[term] += 1
        self.idf = {
            t: math.log((self.N - freq + 0.5) / (freq + 0.5) + 1)
            for t, freq in df.items()
        }

    def score(self, query: str, doc_id: int) -> float:
        query_tokens = tokenize(query)
        doc_tokens = self.docs_tokens[doc_id]
        dl = len(doc_tokens)
        tf_map = Counter(doc_tokens)

        total = 0.0
        for term in query_tokens:
            if term not in self.idf:
                continue
            tf = tf_map.get(term, 0)
            idf = self.idf[term]
            numerator = tf * (self.k1 + 1)
            denominator = tf + self.k1 * (1 - self.b + self.b * dl / self.avgdl)
            total += idf * (numerator / denominator)
        return total

    def search(self, query: str, docs: list[str], top_k: int = 5) -> list[tuple]:
        # Scores all documents for clarity. A real BM25 engine would use the
        # inverted index to score only documents containing query terms.
        scores = [(self.score(query, i), docs[i]) for i in range(self.N)]
        return sorted(scores, reverse=True)[:top_k]
```

The practical difference between TF-IDF and BM25 becomes clear with documents of varying lengths:

```python
docs = [
    # Short and focused
    "BM25 is the standard ranking algorithm in modern search engines.",
    # Long with many mentions, but diluted
    "This is a very long document about many things. It talks about NLP, IR, machine learning, Python, statistics, linear algebra, and neural networks. BM25 appears here too, but it is a minor detail among all of that. We keep talking about other topics for many more paragraphs.",
    # Relevant but without mentioning exactly "BM25"
    "Okapi BM25 extends the probabilistic model by Robertson and Spärck Jones.",
]

bm25 = BM25(docs)
results = bm25.search("BM25 ranking", docs)
for score, doc in results:
    print(f"{score:.4f} | {doc[:60]}...")
# The short, focused document ranks above the long one with many mentions
```

---

## Problem 3: How do we know if our search is good?

We built a system. But how do we know it works well? "Looks right" isn't a metric. Before adding more complexity — embeddings, hybrid search, reranking — we need a way to measure whether each new layer actually improves retrieval.

IR has a well-established set of evaluation metrics, all based on a simple concept: **judged relevance**.

To evaluate, we need a **test set**: a set of queries where humans have judged which documents are relevant. With that, we compare what our system returned with what it should have returned.

### Precision and Recall

```
Precision@k = (relevant documents in top-k) / k
Recall@k    = (relevant documents in top-k) / (total relevant documents)
```

```python
def precision_at_k(retrieved: list, relevant: set, k: int) -> float:
    top_k = retrieved[:k]
    return len(set(top_k) & relevant) / k

def recall_at_k(retrieved: list, relevant: set, k: int) -> float:
    top_k = retrieved[:k]
    return len(set(top_k) & relevant) / len(relevant)

# Example
retrieved = ["doc_2", "doc_5", "doc_1", "doc_8", "doc_3"]
relevant   = {"doc_1", "doc_2", "doc_4", "doc_7"}

print(f"P@3 = {precision_at_k(retrieved, relevant, 3):.2f}")  # 2/3 = 0.67
print(f"R@3 = {recall_at_k(retrieved, relevant, 3):.2f}")     # 2/4 = 0.50
print(f"P@5 = {precision_at_k(retrieved, relevant, 5):.2f}")  # 2/5 = 0.40
print(f"R@5 = {recall_at_k(retrieved, relevant, 5):.2f}")     # 2/4 = 0.50
```

There's a natural trade-off: increasing k increases recall (more relevant documents captured), but usually decreases precision (more irrelevant ones included).

### Mean Reciprocal Rank (MRR)

For cases where there's only *one* correct document (e.g., factual answer search), we use MRR: what position is the first relevant result in?

```python
def reciprocal_rank(retrieved: list, relevant: set) -> float:
    for i, doc in enumerate(retrieved, 1):
        if doc in relevant:
            return 1 / i
    return 0.0

def mean_reciprocal_rank(results: list[tuple[list, set]]) -> float:
    return sum(reciprocal_rank(r, rel) for r, rel in results) / len(results)

query_results = [
    (["doc_3", "doc_1", "doc_2"], {"doc_1"}),  # RR = 1/2
    (["doc_5", "doc_4", "doc_2"], {"doc_4"}),  # RR = 1/2
    (["doc_1", "doc_2", "doc_3"], {"doc_1"}),  # RR = 1/1
]
print(f"MRR = {mean_reciprocal_rank(query_results):.3f}")  # (0.5 + 0.5 + 1.0) / 3 ≈ 0.667
```

### NDCG (Normalized Discounted Cumulative Gain)

MRR and Precision treat relevance as binary (relevant/irrelevant). NDCG supports **degrees of relevance** (e.g., highly relevant = 3, relevant = 2, marginal = 1, irrelevant = 0).

The idea: a highly relevant document in position 1 is worth more than in position 5.

```python
def dcg_at_k(scores: list[int], k: int) -> float:
    """scores[i] = relevance grade of the i-th result"""
    return sum(s / math.log2(i + 2) for i, s in enumerate(scores[:k]))

def ndcg_at_k(retrieved_scores: list[int], ideal_scores: list[int], k: int) -> float:
    dcg = dcg_at_k(retrieved_scores, k)
    idcg = dcg_at_k(sorted(ideal_scores, reverse=True), k)
    return dcg / idcg if idcg > 0 else 0.0

# retrieved: relevance scores of the returned documents in order
retrieved_scores = [3, 1, 2, 0, 3]
ideal_scores     = [3, 3, 2, 1, 0]  # best possible ordering

print(f"NDCG@5 = {ndcg_at_k(retrieved_scores, ideal_scores, 5):.3f}")
```

**For RAG specifically:** Recall@k is usually the first metric to optimize — the answer cannot be grounded if the evidence never reaches the LLM. But precision also matters: irrelevant or conflicting chunks can dilute the context and lead to wrong answers, even when the right chunk is present.

---

## Problem 4: "Car" and "automobile" — lexical search doesn't understand synonyms

BM25 is powerful, but has a fundamental limitation: it operates on the textual surface. It doesn't know that "car" and "automobile" mean the same thing. It doesn't know that "ML engineer" and "machine learning engineer" are equivalent.

```python
docs = [
    "How to rent an automobile in Brazil",
    "Maintenance guide for your vehicle",
    "The best electric cars of 2024",
]

bm25 = BM25(docs)
results = bm25.search("rent car", docs)
# "How to rent an automobile" ranks LOW — contains "rent" but not "car"
# "The best electric cars" ranks HIGH — contains "cars" but not "rent"
```

This problem is called **vocabulary mismatch** — the query vocabulary doesn't match the document vocabulary.

The solution: instead of comparing words, compare **meanings** — represented as vectors in a semantic space.

---

## Concept 3: Semantic Search with Embeddings

An **embedding** is a vector of real numbers representing the meaning of a text. Models like `sentence-transformers` are trained so that semantically similar texts produce nearby vectors in vector space.

> **Note on embedding models:** `all-MiniLM-L6-v2` is used here for simplicity. In production, prefer models trained specifically for retrieval — such as E5, BGE, or BGE-M3 — which use contrastive training on query-document pairs and often perform significantly better on IR benchmarks like BEIR and MTEB.

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

docs = [
    "How to rent an automobile in Brazil",
    "Maintenance guide for your vehicle",
    "The best electric cars of 2024",
    "Transformers revolutionized natural language processing",
]

# Indexing: generate embeddings for all docs once
doc_embeddings = model.encode(docs)  # shape: (4, 384)

def semantic_search(query: str, top_k: int = 3) -> list[tuple]:
    query_embedding = model.encode([query])[0]
    # Cosine similarity. For L2-normalized vectors this is equivalent to dot
    # product — which is why production systems (FAISS, OpenSearch) normalize
    # vectors at index time and use inner product for fast ANN search.
    similarities = np.dot(doc_embeddings, query_embedding) / (
        np.linalg.norm(doc_embeddings, axis=1) * np.linalg.norm(query_embedding)
    )
    indices = np.argsort(similarities)[::-1][:top_k]
    return [(similarities[i], docs[i]) for i in indices]

results = semantic_search("rent car")
# Now "How to rent an automobile" appears at the top
# even without containing the word "car"
```

Semantic search captures intent and synonyms. But it has its own weaknesses:

**When lexical search is better:**
- Queries with exact technical terms: `NullPointerException`, `CVE-2024-1234`, `config.yaml`
- Proper names and acronyms: `GPT-4`, `BERT`, `Fernando Wittmann`
- Product/code-specific searches: `SELECT * FROM users WHERE id = 42`

**When semantic search is better:**
- Natural language queries: "how do I...?"
- Synonyms and paraphrases
- Multilingual queries (question in PT, doc in EN)
- Intent without specific keywords

---

## Concept 4: Hybrid Search — the best of both worlds

In production, we rarely use just one method. The modern approach combines **BM25 + semantic search** via rank fusion.

The simplest and most effective method is **Reciprocal Rank Fusion (RRF)**:

```
RRF_score(d) = Σ 1 / (k + rank_i(d))

where rank_i(d) is the position of document d in ranking i
and k is a constant (typically 60)
```

```python
def reciprocal_rank_fusion(
    rankings: list[list[int]],
    k: int = 60
) -> list[tuple[int, float]]:
    """
    rankings: list of doc_id lists, in relevance order
    returns: list of (doc_id, score) ordered by score
    """
    scores = defaultdict(float)
    for ranking in rankings:
        for position, doc_id in enumerate(ranking, 1):
            scores[doc_id] += 1.0 / (k + position)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)

# Example: combine BM25 and semantic search
def hybrid_search(query: str, docs: list[str], top_k: int = 5):
    # BM25 ranking
    bm25 = BM25(docs)
    bm25_scores = [(bm25.score(query, i), i) for i in range(len(docs))]
    bm25_ranking = [i for _, i in sorted(bm25_scores, reverse=True)]

    # Semantic ranking (simplified — production uses ANN)
    query_emb = model.encode([query])[0]
    doc_embs = model.encode(docs)
    sims = np.dot(doc_embs, query_emb) / (
        np.linalg.norm(doc_embs, axis=1) * np.linalg.norm(query_emb)
    )
    semantic_ranking = list(np.argsort(sims)[::-1])

    # RRF fusion
    fused = reciprocal_rank_fusion([bm25_ranking, semantic_ranking])
    return [(docs[doc_id], score) for doc_id, score in fused[:top_k]]
```

Empirical research consistently shows that hybrid search outperforms any single method on IR benchmarks. The intuition: the two methods fail in different cases, and fusion cancels out the errors. That said, hybrid search doesn't rescue a bad embedding model, noisy OCR text, or poor chunking — it amplifies whatever quality each branch already has.

---

## The Engine Underneath: Approximate Nearest Neighbor (ANN)

There's a practical problem hidden in semantic search: to find the k vectors most similar to a query, we'd need to compute similarity with all N documents — O(N × d), where d is the embedding dimension (typically 768–1536).

For 10M documents with 768-dimensional embeddings, that's ~7.68 billion operations per query. Infeasible.

The solution: **Approximate Nearest Neighbor (ANN)** — algorithms that find the k nearest neighbors *approximately*, with a small precision sacrifice in exchange for absurd speed.

The most widely used:

- **HNSW** (Hierarchical Navigable Small World): hierarchical navigation graph. Standard in modern systems. Behaves sublinearly in practice — often close to O(log N) — though actual latency and memory depend heavily on index parameters, vector dimension, and recall target.
- **IVF** (Inverted File Index): divides vector space into clusters, searches only in the nearest clusters.
- **Product Quantization**: compresses vectors to reduce memory.

```
Brute force:  O(N × d)   — infeasible for N > 100k
HNSW:         ~O(log N)  — fast in practice; billions of vectors typically
                           require distributed infrastructure or quantization
```

Libraries like `faiss` (Meta) and `hnswlib` implement these algorithms. OpenSearch and Elasticsearch have native support via k-NN plugins.

```python
import faiss
import numpy as np

d = 128  # embedding dimension
N = 100_000

# Generate example embeddings
embeddings = np.random.rand(N, d).astype('float32')
faiss.normalize_L2(embeddings)  # normalize for cosine similarity

# Build HNSW index
index = faiss.IndexHNSWFlat(d, 32)  # 32 = number of connections per node
index.add(embeddings)

# Search: find the 10 most similar vectors to the query
query = np.random.rand(1, d).astype('float32')
faiss.normalize_L2(query)

distances, indices = index.search(query, k=10)
# Milliseconds, not seconds
```

---

## Concept 5: How documents are processed before indexing

Before indexing, every search engine applies a **text analysis** pipeline that transforms raw documents into indexable tokens. Each step has a purpose:

```
raw text → tokenization → normalization → stopwords → stemming/lemmatization → index
```

```python
import re
from typing import Optional

STOPWORDS_EN = {
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'to', 'was',
    'were', 'with'
}

def analyze_text(text: str, remove_stopwords: bool = True) -> list[str]:
    # 1. Lowercase
    text = text.lower()

    # 2. Normalize accents (simplified)
    accent_map = str.maketrans('áéíóúàâêôãõüç', 'aeiouaaeoaouc')
    text = text.translate(accent_map)

    # 3. Tokenize
    tokens = re.findall(r'\b\w+\b', text)

    # 4. Remove stopwords
    if remove_stopwords:
        tokens = [t for t in tokens if t not in STOPWORDS_EN]

    # 5. Simple stemming (common English suffixes)
    stems = []
    for token in tokens:
        if token.endswith('ing'):
            token = token[:-3]  # "learning" → "learn"
        elif token.endswith('tion'):
            token = token[:-4] + 't'
        stems.append(token)

    return stems

print(analyze_text("Neural networks are learning representations from data"))
# ['neural', 'networks', 'learn', 'representations', 'data']
```

**Stemming vs Lemmatization:**
- **Stemming:** mechanically strips suffixes. Fast, but imprecise (`"studies"` → `"studi"`).
- **Lemmatization:** uses a dictionary to find the base form. Accurate, but slower (`"studies"` → `"study"`).

In production, the choice depends on language and the performance/quality trade-off.

---

## Tying It All Together: IR in RAG and LLM Agents

Now that you understand the fundamentals, let's see how this connects to modern LLM systems.

### RAG (Retrieval-Augmented Generation)

RAG is essentially IR + text generation:

```
user query
       ↓
[RETRIEVAL] → top-k relevant documents
       ↓
[AUGMENTATION] → query + documents build the context
       ↓
[GENERATION] → LLM generates an answer based on context
```

**The bottleneck is almost always retrieval.** If the right documents don't reach the LLM, generation can't be correct — and the LLM may hallucinate or simply answer "I don't know."

```python
def simple_rag_pipeline(
    query: str,
    corpus: list[str],
    llm_client,
    top_k: int = 5
) -> str:
    # 1. Retrieval: find relevant documents
    bm25 = BM25(corpus)
    scores = [(bm25.score(query, i), i) for i in range(len(corpus))]
    top_indices = [i for _, i in sorted(scores, reverse=True)[:top_k]]
    documents = [corpus[i] for i in top_indices]

    # 2. Augmentation: build the context
    context = "\n\n".join(f"[{i+1}] {doc}" for i, doc in enumerate(documents))
    prompt = f"""Based on the documents below, answer: {query}

Documents:
{context}

Answer:"""

    # 3. Generation
    return llm_client.generate(prompt)
```

### Query Rewriting and HyDE

LLMs can improve retrieval *before* searching:

**Query Expansion:** expand the query with synonyms and related terms.

```python
def expand_query(query: str, llm_client) -> str:
    prompt = f"""Given the search query: "{query}"
Generate an expanded version with synonyms and related terms.
Return only the expanded query, with no explanations.
Example: "car" → "car automobile vehicle transportation"
"""
    return llm_client.generate(prompt)
```

**HyDE (Hypothetical Document Embeddings):** instead of embedding the query directly, ask the LLM to generate a hypothetical document that would answer the query, and embed that document. It works because user queries are short, informal, and fragmentary, while corpus documents are longer and written in a different register. Generating a hypothetical answer bridges that distributional gap — the resulting embedding lands closer to real documents in vector space.

```python
def hyde(query: str, llm_client, embedding_model) -> np.ndarray:
    # Generate a hypothetical document
    prompt = f"Write a paragraph that directly answers: {query}"
    hypothetical_doc = llm_client.generate(prompt)

    # Embed the hypothetical document, not the query
    return embedding_model.encode([hypothetical_doc])[0]
```

### Agents with search tools

In agent systems, the search engine becomes a **tool**. The agent decides when and how to search:

```python
tools = [
    {
        "name": "search_documents",
        "description": "Searches relevant documents in the knowledge base",
        "parameters": {
            "query": "string — what you want to find",
            "top_k": "int — how many documents to return (default: 5)",
            "filters": "dict — optional metadata filters (date, author, type)"
        }
    },
    {
        "name": "search_code",
        "description": "Searches code snippets in the repository",
        "parameters": {
            "query": "string — description of the code or function being searched for"
        }
    }
]
```

In this context, retrieval quality directly affects the agent's ability to reason and act correctly. An agent that searches poorly, reasons poorly.

### Chunking: splitting documents for indexing

Long documents need to be split into chunks before indexing. This deeply affects retrieval quality:

```python
def chunk_by_sentence(
    text: str,
    max_tokens: int = 512,
    overlap: int = 50
) -> list[str]:
    """
    Split text into chunks while respecting sentences,
    with overlap to avoid losing context at the edges.
    """
    sentences = text.split('. ')
    chunks = []
    current_chunk = []
    current_tokens = 0

    for sentence in sentences:
        sentence_tokens = len(sentence.split())
        if current_tokens + sentence_tokens > max_tokens and current_chunk:
            chunks.append('. '.join(current_chunk) + '.')
            # Overlap: keep the last sentences
            overlap_words = ' '.join(current_chunk[-2:]).split()
            current_chunk = [' '.join(overlap_words[-overlap:])]
            current_tokens = overlap
        current_chunk.append(sentence)
        current_tokens += sentence_tokens

    if current_chunk:
        chunks.append('. '.join(current_chunk))

    return chunks
```

**Chunk size vs quality:**
- Chunks too small (< 100 tokens): lose context, make generation harder
- Chunks too large (> 1000 tokens): dilute the relevance signal
- Starting point: 256–512 tokens, with 10–20% overlap

The right size depends on the embedding model's context window, document structure, and query type. Treat it as a starting point and validate with retrieval metrics — don't cargo-cult the number.

---

## Re-ranking: refining after retrieval

A common production pattern is **two-stage retrieval**:

1. **Candidate retrieval:** fast search (BM25 or ANN) returns top-100 candidates
2. **Re-ranking:** a more precise model (cross-encoder) reorders the top-100

```
query → [BM25/ANN] → top-100 candidates → [Cross-Encoder] → reranked top-10
```

**Why two stages?** Cross-encoders analyze query and document *together* — full attention over both. They're much more accurate than bi-encoders (separate embeddings), but also much slower. Using them on 100 candidates, not 10 million, is feasible.

```python
from sentence_transformers import CrossEncoder

# Cross-encoder for re-ranking
reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

def two_stage_retrieval(query: str, candidates: list[str], top_k: int = 10):
    # Stage 1: candidates already come from BM25/ANN

    # Stage 2: re-ranking with cross-encoder
    pairs = [[query, doc] for doc in candidates]
    scores = reranker.predict(pairs)

    result = sorted(zip(scores, candidates), reverse=True)
    return [doc for _, doc in result[:top_k]]
```

### Problem 5: Semantically right, operationally wrong

Imagine a RAG system over company documentation. A user asks about the vacation policy. Semantic search returns several highly relevant chunks — but they're from the 2021 policy, since the 2024 version uses slightly different wording and lives in a different folder.

The retrieval was semantically correct. The answer is wrong.

This is a class of failure that ranking alone can't fix. The solution is **metadata filtering**: attach structured attributes to every document at index time, and apply hard filters before or after ranking.

```python
from dataclasses import dataclass
from datetime import date

@dataclass
class Document:
    id: str
    content: str
    metadata: dict  # source, date, tenant, doc_type, version, status, ...

corpus = [
    Document("p1", "Employees get 15 days of vacation per year.", {
        "doc_type": "policy", "status": "active", "version": "2024", "tenant": "acme"
    }),
    Document("p2", "Employees get 10 days of vacation per year.", {
        "doc_type": "policy", "status": "deprecated", "version": "2021", "tenant": "acme"
    }),
    Document("p3", "Vacation policy for contractors.", {
        "doc_type": "policy", "status": "active", "version": "2024", "tenant": "globex"
    }),
]

def filtered_search(query: str, docs: list[Document], filters: dict, top_k: int = 5):
    candidates = [
        d for d in docs
        if all(d.metadata.get(k) == v for k, v in filters.items())
    ]
    bm25 = BM25([d.content for d in candidates])
    scores = [(bm25.score(query, i), candidates[i]) for i in range(len(candidates))]
    return [doc for _, doc in sorted(scores, reverse=True)[:top_k]]

results = filtered_search(
    "vacation days",
    corpus,
    filters={"tenant": "acme", "status": "active"}
)
# Returns only the 2024 active policy for the correct tenant
```

Common metadata fields in production RAG: `tenant`, `user_permissions`, `doc_type`, `status` (active/deprecated), `date`, `source`, `language`, `product_version`. Without these, you can retrieve semantically relevant but operationally wrong documents — the wrong client's data, deprecated policies, or content the user doesn't have permission to see.

---

### RAG-specific evaluation metrics

The generic IR metrics (P@k, Recall@k, MRR, NDCG) measure whether relevant documents were retrieved. In RAG, we also need to measure whether the retrieved chunks actually support correct generation.

| Metric | What it measures |
|---|---|
| **Context Recall** | Did we retrieve the chunks that contain the answer evidence? |
| **Context Precision** | Are the retrieved chunks actually useful for the answer? |
| **Faithfulness** | Is the generated answer supported by the retrieved context? |
| **Answer Correctness** | Is the final answer factually correct? |
| **Citation Accuracy** | Do the citations point to the chunks that actually support the claim? |

Frameworks like [RAGAS](https://github.com/explodinggradients/ragas) automate most of these evaluations using an LLM judge. The key distinction from classic IR: a document can be relevant but still not contain enough evidence. A chunk that mentions "vacation policy" in passing doesn't help the LLM answer "how many days do I get." **Context Recall** specifically measures whether the evidence-bearing chunk made it into the top-k — which is why it's often the first metric to optimize in a RAG system.

---

## What separates the didactic from the real

The examples in this article are intentionally simplified. Real production systems — OpenSearch, Elasticsearch, Weaviate, Qdrant — solve additional problems that would be articles on their own:

| Aspect | Didactic | Production |
|---|---|---|
| **Scale** | In-memory, MB | Distributed, TB+ |
| **Indexing** | Synchronous, full rebuild | Incremental, online |
| **ANN** | FAISS/HNSW in-memory | FAISS/Qdrant/Weaviate/OpenSearch with tuning, persistence, sharding, filters |
| **Text** | Simple tokenizer | Language-specific analyzers, stemmer, synonyms |
| **Ranking** | Standard BM25 | BM25 + learning-to-rank |
| **Resilience** | No fault tolerance | Replication, sharding |
| **Security** | No authentication | RBAC, field-level security |
| **Monitoring** | None | p99 latency, relevance drift |

When you use OpenSearch or Elasticsearch, BM25 is there — just implemented in Java with decades of optimizations. When you use Weaviate or Qdrant, HNSW is there — implemented in Go/Rust with managed memory.

**The point of understanding the fundamentals:** when your RAG system returns garbage, you know where to look. When precision@k metrics drop, you know how to investigate. When the user says "search can't find X", you know whether it's a vocabulary problem (BM25), an embedding problem (semantic), chunking, or text analysis.

---

## Summary: the IR trail

```
Problem                     →  Introduced solution
────────────────────────────────────────────────────────
Slow O(N) search            →  Inverted index
No ranking                  →  TF-IDF
Doc length/saturation       →  BM25
How to measure quality?     →  P@k, Recall@k, MRR, NDCG
Vocabulary mismatch         →  Embeddings + cosine similarity
ANN too slow at scale       →  HNSW / FAISS
Lexical vs semantic         →  Hybrid search + RRF
Short queries vs docs       →  HyDE, query expansion
Top-100 → Top-10 precision  →  Two-stage + cross-encoder
Wrong doc despite relevance →  Metadata filters (tenant, status, date, ACL)
Did retrieval help the LLM? →  RAG-specific metrics (Context Recall, Faithfulness)
```

The field of Information Retrieval has 60+ years of research. LLMs are new; search isn't. Understanding IR well is what separates RAG pipelines that work in demos from those that work in production.

---

## Retrieval debugging checklist

When retrieval breaks in production, most failures fall into one of these patterns:

| Symptom | Likely cause | What to inspect |
|---|---|---|
| Exact term not found | Analyzer/tokenization issue | Token stream, stemming, stopword list |
| Synonyms not found | Vocabulary mismatch | Embeddings, hybrid search, synonym expansion |
| Old or deprecated docs retrieved | Missing freshness/status filter | Metadata filters, `status` field |
| Wrong tenant/client docs returned | Permission or filter bug | ACL filters, tenant isolation |
| Related chunks retrieved but answer is wrong | Chunk doesn't contain the evidence | Chunk boundaries, chunk size, Context Recall metric |
| Top result looks right but LLM answer is wrong | Generation or context issue | Prompt, faithfulness metric, conflicting chunks |
| Good results in testing, bad in production | Distribution shift | Query logs, embedding model mismatch, index staleness |

---

## Going further

- **Executable notebook:** full implementation of the concepts above, available as a [Jupyter Notebook](/blog/information-retrieval-search-engines/information-retrieval-search-engines.ipynb).
- **BEIR benchmark:** IR evaluation suite with 18 heterogeneous datasets — the standard for comparing retrieval systems.
- **BM25 paper:** Robertson & Zaragoza (2009), "The Probabilistic Relevance Framework: BM25 and Beyond."
- **MTEB:** Massive Text Embedding Benchmark — evaluates embedding models on retrieval tasks.
- **ColBERT:** late interaction — an efficient alternative to cross-encoders that maintains precision with reasonable latency.
- **SPLADE and learned sparse models:** neural models that produce sparse representations with vocabulary expansion — combining lexical interpretability with semantic coverage. A middle ground between BM25 and dense embeddings worth exploring for domain-specific corpora.
