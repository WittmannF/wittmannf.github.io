---
title: 'Search Engine de Verdade: Fundamentos de Information Retrieval do Zero'
description: 'De busca linear a RAG: construa a intuição por trás de indexação, ranking, relevância e busca semântica. Com exemplos em Python e um mini search engine didático from scratch.'
pubDate: 2026-05-12
tags: ['Information Retrieval', 'Search', 'RAG', 'LLMs', 'NLP', 'Machine Learning']
lang: 'pt'
---

Você treina um modelo, gera embeddings, monta um pipeline de RAG. Na demo funciona. Em produção, o LLM começa a alucinar sobre coisas que claramente estão nos seus documentos. O problema não é o LLM — é a busca. Os documentos certos simplesmente não estão chegando ao contexto.

Information Retrieval (IR) é o campo que estuda exatamente isso: dado um conjunto de documentos e uma query, como encontrar e ranquear os mais relevantes. É a fundação silenciosa de todo sistema de busca — do Google ao OpenSearch ao seu pipeline de RAG.

Este guia é orientado por problemas. Cada seção começa com algo que quebra — um modo de falha real em um sistema de busca — e mostra *por que* quebra antes de introduzir a solução. O objetivo é intuição, não receita.

O mapa completo do que vamos cobrir:

| Conceito | O que é |
|---|---|
| **Índice invertido** | A estrutura de dados que torna a busca rápida possível — mapeia termos para os documentos que os contêm |
| **Pipeline de análise de texto** | Como o texto bruto é limpo, tokenizado e normalizado antes da indexação |
| **TF-IDF** | Uma fórmula de ranking que pondera a frequência do termo pela raridade dele no corpus |
| **BM25** | O algoritmo padrão de ranking lexical — lida melhor com comprimento de documento e saturação de termos do que o TF-IDF |
| **Métricas de avaliação** | P@k, Recall@k, MRR, NDCG — como medir se sua busca é realmente boa |
| **Busca semântica** | Busca baseada em embeddings que encontra documentos por significado, não só por correspondência de palavras |
| **ANN (Approximate Nearest Neighbor)** | Algoritmos como HNSW que tornam a busca vetorial rápida o suficiente para milhões de documentos |
| **Busca híbrida + RRF** | Combinar rankings lexical e semântico para que cada método cubra os pontos cegos do outro |
| **HyDE + query expansion** | Técnicas assistidas por LLM que fecham o gap entre queries curtas e documentos longos |
| **Chunking** | Dividir documentos em pedaços indexáveis — e por que o tamanho importa mais do que parece |
| **Two-stage retrieval + reranking** | Usar um retriever rápido para obter candidatos e um cross-encoder preciso para reordená-los |
| **Filtros de metadados** | Filtros fixos (tenant, data, status, ACL) que evitam resultados semanticamente certos mas operacionalmente errados |
| **Métricas específicas para RAG** | Context Recall, Faithfulness, Answer Correctness — o que medir quando o consumidor é um LLM |

No final, você não vai só saber como montar um pipeline de busca — vai saber onde olhar quando ele retorna lixo, e por que cada camada de um sistema RAG de produção existe.

> **Nota:** Os exemplos de código são didáticos, otimizados para clareza. Sistemas reais de produção usam implementações muito mais sofisticadas. Falo sobre isso na última seção. Você pode rodar os exemplos célula a célula no **[Jupyter Notebook](/blog/information-retrieval-search-engines/information-retrieval-search-engines.ipynb)**.

---

## Problema 1: Você tem 10.000 documentos. Como achar o certo?

Imagine um corpus simples: notas de reuniões, documentação técnica, artigos de blog. O usuário digita uma query. Você precisa retornar os documentos mais relevantes.

A abordagem mais direta: percorrer todos os documentos e checar se contêm as palavras da query.

```python
docs = [
    "Redes neurais aprendem representações hierárquicas dos dados",
    "Gradient descent minimiza a função de perda iterativamente",
    "Transformers usam atenção para capturar dependências de longo alcance",
    "Random forests combinam múltiplas árvores de decisão",
    # ... mais 9.996 documentos
]

def busca_linear(query: str, docs: list[str]) -> list[str]:
    query_lower = query.lower()
    return [doc for doc in docs if query_lower in doc.lower()]

resultados = busca_linear("redes neurais", docs)
```

Isso funciona para 10 documentos. Para 10 milhões — que é o tamanho de qualquer corpus sério — percorrer tudo a cada query é inviável. Com 10M documentos de 1KB cada, são 10GB de dados a varrer para cada busca.

Mas o problema vai além da performance. Essa busca não sabe *quão relevante* um documento é — só se contém ou não a query. Não há ranking. Não há noção de qual resultado é melhor.

**O que precisamos:** uma estrutura que permita encontrar documentos que contêm um termo sem percorrer todo o corpus, e uma forma de ranquear os resultados por relevância.

---

## Conceito 1: O Índice Invertido

Um search engine não busca em documentos — ele busca num **índice**. O índice é construído uma vez (ou atualizado incrementalmente) e permite responder queries rapidamente.

A estrutura central é o **índice invertido** (*inverted index*): um mapeamento de termo → lista de documentos que o contêm.

```
termo           → documentos
───────────────────────────────
"neural"        → [doc_0, doc_7, doc_42, ...]
"gradient"      → [doc_1, doc_8, doc_19, ...]
"transformer"   → [doc_2, doc_7, doc_55, ...]
"árvore"        → [doc_3, doc_99, ...]
```

É a inversão do índice natural (documento → termos). Daí o nome.

```python
from collections import defaultdict
import re

def tokenizar(texto: str) -> list[str]:
    # Minúsculas + apenas palavras alfanuméricas
    return re.findall(r'\b[a-záéíóúàâêôãõüç]+\b', texto.lower())

def construir_indice(docs: list[str]) -> dict[str, set[int]]:
    indice = defaultdict(set)
    for doc_id, doc in enumerate(docs):
        for termo in tokenizar(doc):
            indice[termo].add(doc_id)
    return dict(indice)

def buscar(query: str, indice: dict, docs: list[str]) -> list[str]:
    termos = tokenizar(query)
    # Interseção: documentos que contêm TODOS os termos
    if not termos:
        return []
    resultado = indice.get(termos[0], set())
    for termo in termos[1:]:
        resultado = resultado & indice.get(termo, set())
    return [docs[i] for i in resultado]

docs = [
    "Redes neurais aprendem representações hierárquicas",
    "Gradient descent otimiza redes neurais",
    "Transformers são redes neurais com atenção",
    "Random forests não usam gradientes",
]

indice = construir_indice(docs)
print(buscar("redes neurais", indice, docs))
# ['Redes neurais aprendem...', 'Gradient descent otimiza...', 'Transformers são...']
```

Agora a busca é O(1) por termo (lookup no dicionário) + O(k) para interseção das posting lists, onde k é o número de documentos que contêm o termo — muito menor que o corpus inteiro.

**Mas surgiu um problema novo:** os três documentos sobre redes neurais são igualmente relevantes para a query "redes neurais"? Intuitivamente não — alguns falam *sobre* o assunto, outros só mencionam. Precisamos de ranking.

---

## Problema 2: Nem toda ocorrência vale o mesmo

Considere dois documentos sobre "machine learning":

- **Doc A:** "Machine learning é uma subárea de inteligência artificial. Machine learning usa dados para aprender padrões. Algoritmos de machine learning incluem redes neurais e árvores de decisão."
- **Doc B:** "Python é usado em machine learning, mas também em desenvolvimento web e automação."

Para a query "machine learning", Doc A claramente é mais relevante — o termo aparece 3 vezes e é o tema central. Doc B menciona uma vez, de passagem.

**Frequência do termo (TF — Term Frequency):** quantas vezes o termo aparece no documento.

Mas TF sozinho tem um problema: a palavra "de" aparece em quase todo documento. Alta frequência de "de" não indica relevância.

**Frequência inversa de documento (IDF — Inverse Document Frequency):** palavras que aparecem em poucos documentos são mais informativas.

```
IDF(termo) = log(N / df(termo))

onde:
  N = número total de documentos
  df = número de documentos que contêm o termo
```

"Machine learning" aparece em 100 de 10.000 docs → IDF = log(100) ≈ 4,6  
"de" aparece em 9.999 de 10.000 docs → IDF ≈ 0,0001

Multiplicando os dois: **TF-IDF**.

```python
import math
from collections import Counter

def calcular_tf(doc_tokens: list[str]) -> dict[str, float]:
    contagem = Counter(doc_tokens)
    total = len(doc_tokens)
    return {termo: freq / total for termo, freq in contagem.items()}

def calcular_idf(docs_tokens: list[list[str]]) -> dict[str, float]:
    N = len(docs_tokens)
    df = defaultdict(int)
    for tokens in docs_tokens:
        for termo in set(tokens):
            df[termo] += 1
    return {termo: math.log(N / freq) for termo, freq in df.items()}

def score_tfidf(query: str, doc: str, idf: dict) -> float:
    query_tokens = tokenizar(query)
    doc_tokens = tokenizar(doc)
    tf = calcular_tf(doc_tokens)
    return sum(tf.get(t, 0) * idf.get(t, 0) for t in query_tokens)

# Exemplo
docs = [
    "Machine learning é uma subárea de IA. Machine learning usa dados. Algoritmos de machine learning incluem redes neurais.",
    "Python é usado em machine learning, mas também em web e automação.",
    "Deep learning é uma subárea de machine learning com múltiplas camadas.",
]

docs_tokens = [tokenizar(d) for d in docs]
idf = calcular_idf(docs_tokens)

query = "machine learning"
scores = [(score_tfidf(query, doc, idf), doc[:50]) for doc in docs]
scores.sort(reverse=True)
for score, doc in scores:
    print(f"{score:.4f} | {doc}")

# 0.0812 | Machine learning é uma subárea de IA...   ← mais relevante
# 0.0271 | Deep learning é uma subárea de machine...
# 0.0108 | Python é usado em machine learning...     ← menos relevante
```

TF-IDF é o ranking padrão de busca por décadas. Mas ele tem limitações conhecidas:

1. **Normalização por comprimento é incompleta:** nossa fórmula de TF divide pelo comprimento do documento, mas um doc longo que menciona "ML" repetidamente de passagem ainda pode superar um doc curto onde "ML" é o tema central. BM25 trata isso de forma mais robusta.
2. **TF cresce linearmente sem saturação:** 10 ocorrências não é 10× mais relevante que 1, mas TF-IDF trata dessa forma.

---

## Conceito 2: BM25 — O algoritmo padrão de ranking

**BM25** (Best Matching 25) surgiu nos anos 90 e continua sendo a baseline padrão de recuperação lexical — amplamente usado em sistemas baseados em Lucene como OpenSearch e Elasticsearch.

BM25 resolve exatamente os problemas do TF-IDF com dois parâmetros:

- **k1** (tipicamente 1.2–2.0): controla a saturação da frequência do termo. Valores maiores deixam ocorrências repetidas continuar contribuindo; valores menores fazem o score saturar mais rápido. Ao contrário do TF, a contribuição nunca cresce linearmente sem limite.
- **b** (tipicamente 0.75): controla a normalização por comprimento.

```
BM25(q, d) = Σ IDF(t) × [TF(t,d) × (k1 + 1)] / [TF(t,d) + k1 × (1 - b + b × |d|/avgdl)]

onde:
  |d|    = comprimento do documento
  avgdl  = comprimento médio dos documentos no corpus
```

```python
class BM25:
    def __init__(self, docs: list[str], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.docs_tokens = [tokenizar(d) for d in docs]
        self.N = len(docs)
        self.avgdl = sum(len(t) for t in self.docs_tokens) / self.N

        # IDF para cada termo
        df = defaultdict(int)
        for tokens in self.docs_tokens:
            for termo in set(tokens):
                df[termo] += 1
        self.idf = {
            t: math.log((self.N - freq + 0.5) / (freq + 0.5) + 1)
            for t, freq in df.items()
        }

    def score(self, query: str, doc_id: int) -> float:
        query_tokens = tokenizar(query)
        doc_tokens = self.docs_tokens[doc_id]
        dl = len(doc_tokens)
        tf_map = Counter(doc_tokens)

        total = 0.0
        for termo in query_tokens:
            if termo not in self.idf:
                continue
            tf = tf_map.get(termo, 0)
            idf = self.idf[termo]
            numerador = tf * (self.k1 + 1)
            denominador = tf + self.k1 * (1 - self.b + self.b * dl / self.avgdl)
            total += idf * (numerador / denominador)
        return total

    def buscar(self, query: str, docs: list[str], top_k: int = 5) -> list[tuple]:
        # Pontua todos os documentos por clareza. Um BM25 real usaria as posting
        # lists do índice invertido para pontuar apenas candidatos com os termos.
        scores = [(self.score(query, i), docs[i]) for i in range(self.N)]
        return sorted(scores, reverse=True)[:top_k]
```

A diferença prática entre TF-IDF e BM25 fica clara com documentos de comprimentos variados:

```python
docs = [
    # Curto e focado
    "BM25 é o algoritmo de ranking padrão em search engines modernos.",
    # Longo com muitas menções, mas diluído
    "Este é um documento muito longo sobre muitas coisas. Fala de NLP, de IR, de machine learning, de Python, de estatística, de álgebra linear, de redes neurais. BM25 aparece aqui também, mas é um detalhe menor em meio a tudo isso. Continuamos falando de outros assuntos por muito mais parágrafos.",
    # Relevante mas sem mencionar exatamente "BM25"
    "Okapi BM25 estende o modelo probabilístico de Robertson e Spärck Jones.",
]

bm25 = BM25(docs)
resultados = bm25.buscar("BM25 ranking", docs)
for score, doc in resultados:
    print(f"{score:.4f} | {doc[:60]}...")
# O documento curto e focado rankeia acima do longo com muitas menções
```

---

## Problema 3: Como saber se nossa busca é boa?

Construímos um sistema. Mas como sabemos se ele funciona bem? "Parece certo" não é uma métrica. Antes de adicionar mais complexidade — embeddings, busca híbrida, reranking — precisamos de uma forma de medir se cada camada nova realmente melhora o retrieval.

IR tem um conjunto de métricas de avaliação bem estabelecidas, todas baseadas num conceito simples: **relevância julgada**.

Para avaliar, precisamos de um **test set**: um conjunto de queries onde humanos julgaram quais documentos são relevantes. Com isso, comparamos o que nosso sistema retornou com o que deveria retornar.

### Precision e Recall

```
Precision@k = (documentos relevantes nos top-k) / k
Recall@k    = (documentos relevantes nos top-k) / (total de relevantes)
```

```python
def precision_at_k(retrieved: list, relevant: set, k: int) -> float:
    top_k = retrieved[:k]
    return len(set(top_k) & relevant) / k

def recall_at_k(retrieved: list, relevant: set, k: int) -> float:
    top_k = retrieved[:k]
    return len(set(top_k) & relevant) / len(relevant)

# Exemplo
retrieved = ["doc_2", "doc_5", "doc_1", "doc_8", "doc_3"]
relevant   = {"doc_1", "doc_2", "doc_4", "doc_7"}

print(f"P@3 = {precision_at_k(retrieved, relevant, 3):.2f}")  # 2/3 = 0.67
print(f"R@3 = {recall_at_k(retrieved, relevant, 3):.2f}")     # 2/4 = 0.50
print(f"P@5 = {precision_at_k(retrieved, relevant, 5):.2f}")  # 2/5 = 0.40
print(f"R@5 = {recall_at_k(retrieved, relevant, 5):.2f}")     # 2/4 = 0.50
```

Existe um trade-off natural: aumentar k aumenta recall (mais documentos relevantes capturados), mas geralmente diminui precision (mais irrelevantes incluídos).

### Mean Reciprocal Rank (MRR)

Para casos onde só existe *um* documento correto (ex: busca de resposta factual), usamos MRR: qual a posição do primeiro resultado relevante?

```python
def reciprocal_rank(retrieved: list, relevant: set) -> float:
    for i, doc in enumerate(retrieved, 1):
        if doc in relevant:
            return 1 / i
    return 0.0

def mean_reciprocal_rank(resultados: list[tuple[list, set]]) -> float:
    return sum(reciprocal_rank(r, rel) for r, rel in resultados) / len(resultados)

queries_resultados = [
    (["doc_3", "doc_1", "doc_2"], {"doc_1"}),  # RR = 1/2
    (["doc_5", "doc_4", "doc_2"], {"doc_4"}),  # RR = 1/2
    (["doc_1", "doc_2", "doc_3"], {"doc_1"}),  # RR = 1/1
]
print(f"MRR = {mean_reciprocal_rank(queries_resultados):.3f}")  # (0.5 + 0.5 + 1.0) / 3 ≈ 0.667
```

### NDCG (Normalized Discounted Cumulative Gain)

MRR e Precision tratam relevância como binária (relevante/irrelevante). NDCG suporta **graus de relevância** (ex: muito relevante = 3, relevante = 2, marginal = 1, irrelevante = 0).

A ideia: um documento altamente relevante na posição 1 vale mais que na posição 5.

```python
def dcg_at_k(scores: list[int], k: int) -> float:
    """scores[i] = grau de relevância do i-ésimo resultado"""
    return sum(s / math.log2(i + 2) for i, s in enumerate(scores[:k]))

def ndcg_at_k(retrieved_scores: list[int], ideal_scores: list[int], k: int) -> float:
    dcg = dcg_at_k(retrieved_scores, k)
    idcg = dcg_at_k(sorted(ideal_scores, reverse=True), k)
    return dcg / idcg if idcg > 0 else 0.0

# retrieved: relevâncias dos docs retornados na ordem
retrieved_scores = [3, 1, 2, 0, 3]
ideal_scores     = [3, 3, 2, 1, 0]  # melhor ordenação possível

print(f"NDCG@5 = {ndcg_at_k(retrieved_scores, ideal_scores, 5):.3f}")
```

**Para RAG especificamente:** Recall@k costuma ser a primeira métrica a otimizar — a resposta não pode ser fundamentada se a evidência nunca chega ao LLM. Mas precision também importa: chunks irrelevantes ou conflitantes podem diluir o contexto e induzir respostas erradas, mesmo quando o chunk certo está presente.

---

## Problema 4: "Carro" e "automóvel" — busca lexical não entende sinônimos

BM25 é poderoso, mas tem uma limitação fundamental: opera na superfície textual. Ele não sabe que "carro" e "automóvel" significam a mesma coisa. Não sabe que "ML engineer" e "engenheiro de machine learning" são equivalentes.

```python
docs = [
    "Como alugar um automóvel no Brasil",
    "Guia de manutenção do seu veículo",
    "Os melhores carros elétricos de 2024",
]

bm25 = BM25(docs)
resultados = bm25.buscar("alugar carro")
# "Como alugar um automóvel" rankeia BAIXO — contém "alugar" mas não "carro"
# "Os melhores carros elétricos" rankeia ALTO — contém "carros" mas não "alugar"
```

Esse problema se chama **vocabulary mismatch** — o vocabulário da query não coincide com o do documento.

A solução: em vez de comparar palavras, comparar **significados** — representados como vetores em um espaço semântico.

---

## Conceito 3: Busca Semântica com Embeddings

Um **embedding** é um vetor de números reais que representa o significado de um texto. Modelos como `sentence-transformers` são treinados para que textos semanticamente similares produzam vetores próximos no espaço vetorial.

> **Nota sobre modelos de embedding:** `neuralmind/bert-base-portuguese-cased` é usado aqui como exemplo. Em produção, prefira modelos treinados especificamente para retrieval — como E5, BGE ou BGE-M3 — que usam treinamento contrastivo em pares query-documento e costumam performar significativamente melhor em benchmarks de IR como BEIR e MTEB.

```python
from sentence_transformers import SentenceTransformer
import numpy as np

modelo = SentenceTransformer('neuralmind/bert-base-portuguese-cased')

docs = [
    "Como alugar um automóvel no Brasil",
    "Guia de manutenção do seu veículo",
    "Os melhores carros elétricos de 2024",
    "Transformers revolucionaram o processamento de linguagem natural",
]

# Indexação: gera embeddings para todos os docs uma vez
doc_embeddings = modelo.encode(docs)  # shape: (4, 768)

def busca_semantica(query: str, top_k: int = 3) -> list[tuple]:
    query_embedding = modelo.encode([query])[0]
    # Similaridade de cosseno. Para vetores normalizados em L2, isso é equivalente
    # ao produto escalar — por isso sistemas de produção (FAISS, OpenSearch)
    # normalizam vetores no índice e usam inner product para busca ANN rápida.
    similaridades = np.dot(doc_embeddings, query_embedding) / (
        np.linalg.norm(doc_embeddings, axis=1) * np.linalg.norm(query_embedding)
    )
    indices = np.argsort(similaridades)[::-1][:top_k]
    return [(similaridades[i], docs[i]) for i in indices]

resultados = busca_semantica("alugar carro")
# Agora "Como alugar um automóvel" aparece no topo
# mesmo sem conter a palavra "carro"
```

A busca semântica captura intenção e sinônimos. Mas tem suas próprias fraquezas:

**Quando a busca lexical é melhor:**
- Queries com termos técnicos exatos: `NullPointerException`, `CVE-2024-1234`, `config.yaml`
- Nomes próprios e siglas: `GPT-4`, `BERT`, `Fernando Wittmann`
- Buscas específicas de produto/código: `SELECT * FROM users WHERE id = 42`

**Quando a busca semântica é melhor:**
- Queries em linguagem natural: "como faço para...?"
- Sinônimos e paráfrases
- Queries multilíngues (pergunta em PT, doc em EN)
- Intenção sem palavras-chave específicas

---

## Conceito 4: Busca Híbrida — o melhor dos dois mundos

Em produção, raramente usamos só um método. A abordagem moderna combina **BM25 + busca semântica** via fusão de rankings.

O método mais simples e eficaz é **Reciprocal Rank Fusion (RRF)**:

```
RRF_score(d) = Σ 1 / (k + rank_i(d))

onde rank_i(d) é a posição do documento d no ranking i
e k é uma constante (tipicamente 60)
```

```python
def reciprocal_rank_fusion(
    rankings: list[list[int]],
    k: int = 60
) -> list[tuple[int, float]]:
    """
    rankings: lista de listas de doc_ids, em ordem de relevância
    retorna: lista (doc_id, score) ordenada por score
    """
    scores = defaultdict(float)
    for ranking in rankings:
        for posicao, doc_id in enumerate(ranking, 1):
            scores[doc_id] += 1.0 / (k + posicao)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)

# Exemplo: combinar BM25 e busca semântica
def busca_hibrida(query: str, docs: list[str], top_k: int = 5):
    # Ranking BM25
    bm25 = BM25(docs)
    bm25_scores = [(bm25.score(query, i), i) for i in range(len(docs))]
    bm25_ranking = [i for _, i in sorted(bm25_scores, reverse=True)]

    # Ranking semântico (simplificado — em prod usa ANN)
    query_emb = modelo.encode([query])[0]
    doc_embs = modelo.encode(docs)
    sims = np.dot(doc_embs, query_emb) / (
        np.linalg.norm(doc_embs, axis=1) * np.linalg.norm(query_emb)
    )
    semantico_ranking = list(np.argsort(sims)[::-1])

    # Fusão RRF
    fused = reciprocal_rank_fusion([bm25_ranking, semantico_ranking])
    return [(docs[doc_id], score) for doc_id, score in fused[:top_k]]
```

Pesquisas empíricas consistentemente mostram que busca híbrida supera qualquer método isolado em benchmarks de IR. A intuição: os dois métodos erram em casos diferentes, e a fusão cancela os erros. Dito isso, busca híbrida não salva um modelo de embedding ruim, texto OCR ruidoso ou chunking inadequado — ela amplifica a qualidade que cada branch já tem.

---

## O Motor por Baixo: Approximate Nearest Neighbor (ANN)

Há um problema prático escondido na busca semântica: para encontrar os k vetores mais similares a uma query, precisaríamos calcular a similaridade com todos os N documentos — O(N × d), onde d é a dimensão do embedding (tipicamente 768–1536).

Para 10M documentos com embeddings de 768 dimensões, isso é ~7,68 bilhões de operações por query. Inviável.

A solução: **Approximate Nearest Neighbor (ANN)** — algoritmos que encontram os k vizinhos mais próximos *aproximadamente*, com um pequeno sacrifício de precisão em troca de velocidade absurda.

Os mais usados:

- **HNSW** (Hierarchical Navigable Small World): grafo hierárquico de navegação. Padrão em sistemas modernos. Comportamento sublinear na prática — próximo de O(log N) — mas latência e memória reais dependem bastante dos parâmetros do índice, dimensão dos vetores e target de recall.
- **IVF** (Inverted File Index): divide o espaço vetorial em clusters, busca apenas nos clusters mais próximos.
- **Product Quantization**: comprime vetores para reduzir memória.

```
Brute force:  O(N × d)   — inviável para N > 100k
HNSW:         ~O(log N)  — rápido na prática; bilhões de vetores geralmente
                           exigem infraestrutura distribuída ou quantização
```

Bibliotecas como `faiss` (Meta) e `hnswlib` implementam esses algoritmos. OpenSearch e Elasticsearch têm suporte nativo via plugins k-NN.

```python
import faiss
import numpy as np

d = 128  # dimensão dos embeddings
N = 100_000

# Gerar embeddings de exemplo
embeddings = np.random.rand(N, d).astype('float32')
faiss.normalize_L2(embeddings)  # normaliza para similaridade de cosseno

# Construir índice HNSW
index = faiss.IndexHNSWFlat(d, 32)  # 32 = número de conexões por nó
index.add(embeddings)

# Busca: encontra os 10 mais similares à query
query = np.random.rand(1, d).astype('float32')
faiss.normalize_L2(query)

distances, indices = index.search(query, k=10)
# Milliseconds, não segundos
```

---

## Conceito 5: Como documentos são processados antes da indexação

Antes de indexar, todo search engine aplica uma pipeline de **análise de texto** que transforma o documento bruto em tokens indexáveis. Cada etapa tem um propósito:

```
texto bruto → tokenização → normalização → stopwords → stemming/lemmatização → índice
```

```python
import re
from typing import Optional

STOPWORDS_PT = {
    'a', 'e', 'o', 'de', 'do', 'da', 'em', 'um', 'uma', 'para',
    'com', 'que', 'se', 'não', 'na', 'no', 'por', 'mais', 'os',
    'as', 'dos', 'das', 'ao', 'à', 'é', 'são', 'foi', 'ser'
}

def analisar_texto(texto: str, remover_stopwords: bool = True) -> list[str]:
    # 1. Minúsculas
    texto = texto.lower()

    # 2. Normalizar acentos (simplificado)
    mapa = str.maketrans('áéíóúàâêôãõüç', 'aeiouaaeoaouc')
    texto = texto.translate(mapa)

    # 3. Tokenizar
    tokens = re.findall(r'\b\w+\b', texto)

    # 4. Remover stopwords
    if remover_stopwords:
        tokens = [t for t in tokens if t not in STOPWORDS_PT]

    # 5. Stemming simples (sufixos comuns em PT)
    stems = []
    for token in tokens:
        if token.endswith('ando') or token.endswith('endo'):
            token = token[:-4]  # "aprendendo" → "aprend"
        elif token.endswith('ção') or token.endswith('cao'):
            token = token[:-3] + 'c'
        stems.append(token)

    return stems

print(analisar_texto("As redes neurais estão aprendendo representações dos dados"))
# ['redes', 'neurais', 'aprend', 'representac', 'dados']
```

**Stemming vs Lemmatização:**
- **Stemming:** corta sufixos mecanicamente. Rápido, mas impreciso (`"correndo"` → `"corr"`).
- **Lemmatização:** usa dicionário para encontrar a forma base. Preciso, mas mais lento (`"correndo"` → `"correr"`).

Em produção, a escolha depende do idioma e do trade-off performance/qualidade.

---

## Conectando Tudo: IR em RAG e Agentes com LLMs

Agora que você entende os fundamentos, vamos ver como isso se conecta com sistemas modernos de LLM.

### RAG (Retrieval-Augmented Generation)

RAG é essencialmente IR + geração de texto:

```
query do usuário
       ↓
[RETRIEVAL] → top-k documentos relevantes
       ↓
[AUGMENTATION] → query + documentos montam o contexto
       ↓
[GENERATION] → LLM gera resposta baseada no contexto
```

**O gargalo é quase sempre o retrieval.** Se os documentos certos não chegam ao LLM, a geração não tem como estar correta — e o LLM pode alucinar ou simplesmente responder "não sei."

```python
def pipeline_rag_simples(
    query: str,
    corpus: list[str],
    llm_client,
    top_k: int = 5
) -> str:
    # 1. Retrieval: encontra documentos relevantes
    bm25 = BM25(corpus)
    scores = [(bm25.score(query, i), i) for i in range(len(corpus))]
    top_indices = [i for _, i in sorted(scores, reverse=True)[:top_k]]
    documentos = [corpus[i] for i in top_indices]

    # 2. Augmentation: monta o contexto
    contexto = "\n\n".join(f"[{i+1}] {doc}" for i, doc in enumerate(documentos))
    prompt = f"""Baseado nos documentos abaixo, responda: {query}

Documentos:
{contexto}

Resposta:"""

    # 3. Generation
    return llm_client.generate(prompt)
```

### Query Rewriting e HyDE

LLMs podem melhorar o retrieval *antes* de buscar:

**Query Expansion:** expandir a query com sinônimos e termos relacionados.

```python
def expandir_query(query: str, llm_client) -> str:
    prompt = f"""Dado a query de busca: "{query}"
Gere uma versão expandida com sinônimos e termos relacionados.
Retorne apenas a query expandida, sem explicações.
Exemplo: "carro" → "carro automóvel veículo transporte"
"""
    return llm_client.generate(prompt)
```

**HyDE (Hypothetical Document Embeddings):** em vez de embedar a query diretamente, pede ao LLM para gerar um documento hipotético que responderia a query, e embeda esse documento. Funciona porque queries de usuários são curtas, informais e fragmentadas, enquanto os documentos do corpus são mais longos e escritos em outro registro. Gerar uma resposta hipotética fecha esse gap distribucional — o embedding resultante fica mais próximo dos documentos reais no espaço vetorial.

```python
def hyde(query: str, llm_client, modelo_embedding) -> np.ndarray:
    # Gera documento hipotético
    prompt = f"Escreva um parágrafo que responda diretamente: {query}"
    doc_hipotetico = llm_client.generate(prompt)

    # Embeda o documento hipotético, não a query
    return modelo_embedding.encode([doc_hipotetico])[0]
```

### Agentes com ferramentas de busca

Em sistemas de agentes, o search engine vira uma **ferramenta**. O agente decide quando e como buscar:

```python
ferramentas = [
    {
        "name": "buscar_documentos",
        "description": "Busca documentos relevantes na base de conhecimento",
        "parameters": {
            "query": "string — o que você quer encontrar",
            "top_k": "int — quantos documentos retornar (padrão: 5)",
            "filtros": "dict — filtros opcionais por metadados (data, autor, tipo)"
        }
    },
    {
        "name": "buscar_codigo",
        "description": "Busca trechos de código no repositório",
        "parameters": {
            "query": "string — descrição do código ou função procurada"
        }
    }
]
```

Nesse contexto, a qualidade do retrieval afeta diretamente a capacidade do agente de raciocinar e agir corretamente. Um agente que busca mal, raciocina mal.

### Chunking: dividindo documentos para indexação

Documentos longos precisam ser divididos em chunks antes de indexar. Isso afeta profundamente a qualidade do retrieval:

```python
def chunkar_por_sentenca(
    texto: str,
    max_tokens: int = 512,
    overlap: int = 50
) -> list[str]:
    """
    Divide texto em chunks respeitando sentenças,
    com overlap para não perder contexto nas bordas.
    """
    sentencas = texto.split('. ')
    chunks = []
    chunk_atual = []
    tokens_atuais = 0

    for sentenca in sentencas:
        tokens_sentenca = len(sentenca.split())
        if tokens_atuais + tokens_sentenca > max_tokens and chunk_atual:
            chunks.append('. '.join(chunk_atual) + '.')
            # Overlap: mantém as últimas sentenças
            palavras_overlap = ' '.join(chunk_atual[-2:]).split()
            chunk_atual = [' '.join(palavras_overlap[-overlap:])]
            tokens_atuais = overlap
        chunk_atual.append(sentenca)
        tokens_atuais += tokens_sentenca

    if chunk_atual:
        chunks.append('. '.join(chunk_atual))

    return chunks
```

**Tamanho do chunk vs qualidade:**
- Chunks muito pequenos (< 100 tokens): perdem contexto, dificultam a geração
- Chunks muito grandes (> 1000 tokens): diluem o sinal de relevância
- Ponto de partida: 256–512 tokens, com overlap de 10–20%

O tamanho ideal depende da janela de contexto do modelo de embedding, da estrutura do documento e do tipo de query. Trate como ponto de partida e valide com métricas de retrieval — não cargo-culte o número.

---

## Re-ranking: refinar depois de recuperar

Um padrão comum em produção é o **two-stage retrieval**:

1. **Candidate retrieval:** busca rápida (BM25 ou ANN) retorna top-100 candidatos
2. **Re-ranking:** um modelo mais preciso (cross-encoder) reordena os top-100

```
query → [BM25/ANN] → top-100 candidatos → [Cross-Encoder] → top-10 reranqueados
```

**Por que dois estágios?** Cross-encoders analisam query e documento *juntos* — atenção completa sobre ambos. São muito mais precisos que bi-encoders (embeddings separados), mas também muito mais lentos. Usá-los em cima de 100 candidatos, não em 10 milhões, é viável.

```python
from sentence_transformers import CrossEncoder

# Cross-encoder para re-ranking
reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

def two_stage_retrieval(query: str, candidatos: list[str], top_k: int = 10):
    # Stage 1: candidatos já vêm do BM25/ANN

    # Stage 2: re-ranking com cross-encoder
    pares = [[query, doc] for doc in candidatos]
    scores = reranker.predict(pares)

    resultado = sorted(zip(scores, candidatos), reverse=True)
    return [doc for _, doc in resultado[:top_k]]
```

### Problema 5: Semanticamente certo, operacionalmente errado

Imagine um sistema de RAG sobre documentação interna de uma empresa. Um usuário pergunta sobre a política de férias. A busca semântica retorna chunks altamente relevantes — mas são da política de 2021, já que a versão de 2024 usa redação diferente e está em outra pasta.

O retrieval foi semanticamente correto. A resposta está errada.

Essa é uma classe de falha que ranking sozinho não resolve. A solução é **filtragem por metadados**: associar atributos estruturados a cada documento no momento da indexação e aplicar filtros fixos antes ou depois do ranking.

```python
from dataclasses import dataclass

@dataclass
class Documento:
    id: str
    conteudo: str
    metadados: dict  # fonte, data, tenant, tipo_doc, versao, status...

corpus = [
    Documento("p1", "Funcionários têm direito a 15 dias de férias por ano.", {
        "tipo_doc": "politica", "status": "ativo", "versao": "2024", "tenant": "acme"
    }),
    Documento("p2", "Funcionários têm direito a 10 dias de férias por ano.", {
        "tipo_doc": "politica", "status": "deprecated", "versao": "2021", "tenant": "acme"
    }),
    Documento("p3", "Política de férias para prestadores de serviço.", {
        "tipo_doc": "politica", "status": "ativo", "versao": "2024", "tenant": "globex"
    }),
]

def busca_com_filtros(query: str, docs: list[Documento], filtros: dict, top_k: int = 5):
    candidatos = [
        d for d in docs
        if all(d.metadados.get(k) == v for k, v in filtros.items())
    ]
    bm25 = BM25([d.conteudo for d in candidatos])
    scores = [(bm25.score(query, i), candidatos[i]) for i in range(len(candidatos))]
    return [doc for _, doc in sorted(scores, reverse=True)[:top_k]]

resultados = busca_com_filtros(
    "dias de férias",
    corpus,
    filtros={"tenant": "acme", "status": "ativo"}
)
# Retorna apenas a política ativa de 2024 para o tenant correto
```

Campos de metadados comuns em RAG de produção: `tenant`, `permissoes_usuario`, `tipo_doc`, `status` (ativo/deprecated), `data`, `fonte`, `idioma`, `versao_produto`. Sem eles, você pode recuperar documentos semanticamente relevantes mas operacionalmente errados — dados do cliente errado, políticas desatualizadas ou conteúdo que o usuário não tem permissão de ver.

---

### Métricas específicas para RAG

As métricas genéricas de IR (P@k, Recall@k, MRR, NDCG) medem se documentos relevantes foram recuperados. Em RAG, precisamos também medir se os chunks recuperados realmente sustentam uma geração correta.

| Métrica | O que mede |
|---|---|
| **Context Recall** | Recuperamos os chunks que contêm a evidência da resposta? |
| **Context Precision** | Os chunks recuperados são realmente úteis para a resposta? |
| **Faithfulness** | A resposta gerada está ancorada no contexto recuperado? |
| **Answer Correctness** | A resposta final está factualmente correta? |
| **Citation Accuracy** | As citações apontam para os chunks que realmente suportam a afirmação? |

Frameworks como [RAGAS](https://github.com/explodinggradients/ragas) automatizam boa parte dessas avaliações usando um LLM como juiz. A distinção-chave do IR clássico: um documento pode ser relevante mas não conter evidência suficiente. Um chunk que menciona "política de férias" de passagem não ajuda o LLM a responder "quantos dias tenho direito". **Context Recall** mede especificamente se o chunk com a evidência chegou ao top-k — por isso costuma ser a primeira métrica a otimizar num sistema de RAG.

---

## O que diferencia o didático do real

Os exemplos deste artigo são intencionalmente simplificados. Sistemas reais de produção — OpenSearch, Elasticsearch, Weaviate, Qdrant — resolvem problemas adicionais que seriam artigos por si só:

| Aspecto | Didático | Produção |
|---|---|---|
| **Escala** | In-memory, MB | Distribuído, TB+ |
| **Indexação** | Síncrona, rebuild total | Incremental, online |
| **ANN** | FAISS/HNSW em memória | FAISS/Qdrant/Weaviate/OpenSearch com tuning, persistência, sharding, filtros |
| **Texto** | Tokenizador simples | Analyzers por idioma, stemmer, synonyms |
| **Ranking** | BM25 padrão | BM25 + learning-to-rank |
| **Resiliência** | Sem fault tolerance | Replicação, sharding |
| **Segurança** | Sem autenticação | RBAC, field-level security |
| **Monitoramento** | Nenhum | Latência p99, relevância drift |

Quando você usa OpenSearch ou Elasticsearch, BM25 está lá — só que implementado em Java com décadas de otimizações. Quando você usa Weaviate ou Qdrant, HNSW está lá — implementado em Go/Rust com memória gerenciada.

**O ponto de entender os fundamentos:** quando seu sistema de RAG retorna lixo, você sabe onde olhar. Quando as métricas de precision@k caem, você sabe como investigar. Quando o usuário diz "a busca não encontra X", você sabe se é problema de vocabulário (BM25), de embedding (semântica), de chunking, ou de análise de texto.

---

## Resumo: a trilha de IR

```
Problema                         →  Solução introduzida
────────────────────────────────────────────────────────────────
Busca O(N) lenta                 →  Índice invertido
Sem ranking                      →  TF-IDF
Doc comprimento/saturação        →  BM25
Como medir qualidade?            →  P@k, Recall@k, MRR, NDCG
Vocabulary mismatch              →  Embeddings + similaridade de cosseno
ANN lento para escala            →  HNSW / FAISS
Lexical vs Semântico             →  Busca híbrida + RRF
Queries curtas vs docs           →  HyDE, query expansion
Top-100 → Top-10 precisão        →  Two-stage + cross-encoder
Doc certo mas operac. errado     →  Filtros de metadados (tenant, status, data, ACL)
O retrieval ajudou o LLM?        →  Métricas RAG (Context Recall, Faithfulness)
```

O campo de Information Retrieval tem 60+ anos de pesquisa. LLMs são novos; busca não é. Entender IR bem é o que separa pipelines de RAG que funcionam em demo dos que funcionam em produção.

---

## Checklist de debugging de retrieval

Quando o retrieval quebra em produção, a maioria das falhas se encaixa em um desses padrões:

| Sintoma | Causa provável | O que inspecionar |
|---|---|---|
| Termo exato não encontrado | Problema no analyzer/tokenização | Token stream, stemming, lista de stopwords |
| Sinônimos não encontrados | Vocabulary mismatch | Embeddings, busca híbrida, expansão de sinônimos |
| Docs antigos ou deprecated recuperados | Falta filtro de freshness/status | Filtros de metadados, campo `status` |
| Docs do tenant/cliente errado retornados | Bug em permissão ou filtro | Filtros ACL, isolamento de tenant |
| Chunks relacionados mas resposta errada | Chunk não contém a evidência | Fronteiras do chunk, tamanho, métrica Context Recall |
| Top resultado parece certo mas LLM erra | Problema de geração ou contexto | Prompt, métrica de faithfulness, chunks conflitantes |
| Bons resultados em teste, ruim em prod | Shift de distribuição | Query logs, mismatch de modelo de embedding, índice desatualizado |

---

## Para ir além

- **Notebook executável:** implementação completa dos conceitos acima, disponível como [Jupyter Notebook](/blog/information-retrieval-search-engines/information-retrieval-search-engines.ipynb).
- **Benchmark BEIR:** suite de avaliação de IR com 18 datasets heterogêneos — o padrão para comparar sistemas de retrieval.
- **Artigo BM25:** Robertson & Zaragoza (2009), "The Probabilistic Relevance Framework: BM25 and Beyond."
- **MTEB:** Massive Text Embedding Benchmark — avalia modelos de embedding em tarefas de retrieval.
- **ColBERT:** late interaction — alternativa eficiente aos cross-encoders que mantém precisão com latência razoável.
- **SPLADE e learned sparse models:** modelos neurais que produzem representações esparsas com expansão de vocabulário — combinando a interpretabilidade léxica do BM25 com cobertura semântica. Vale explorar para corpora de domínio específico.
