---
title: 'Arquitetura em Camadas com FastAPI: Um Guia Prático para Engenheiros de ML'
description: 'Você sabe treinar modelos. Agora precisa colocá-los em produção. Este guia constrói intuição real para arquitetura em camadas através de um app RAG funcional — começando com um monólito e extraindo camadas só quando a dor justifica.'
pubDate: 2026-06-16
tags: ['FastAPI', 'Python', 'LLMs', 'Architecture', 'AI Engineering']
lang: 'pt'
---

Existem centenas de tutoriais que listam as camadas de uma arquitetura "limpa". Router. Service. Repository. Schema. Eles desenham o diagrama, explicam o que cada caixa faz, e mostram o código pronto.

Você copia, funciona, e continua sem saber quando usar isso.

Este guia segue um caminho diferente. Vamos começar com um app RAG real — um único arquivo, funcional, do tipo que você colocaria em produção para uma demonstração rápida. Depois vamos receber pedidos reais de um time real e observar o que começa a doer. Cada camada que introduzirmos será uma resposta a uma dor concreta, não uma prescrição.

No final, você terá construído a intuição. Não apenas o padrão.

---

## Antes do código: o que as camadas separam?

Quando falamos em arquitetura em camadas, normalmente estamos falando de uma separação lógica entre três tipos de preocupação:

- **Apresentação**: como o mundo externo fala com o sistema. Em uma API, isso é HTTP, status code, validação de request, autenticação e serialização.
- **Aplicação/domínio**: o que o sistema realmente faz. Aqui vivem os casos de uso, regras, orquestração e decisões.
- **Dados/infraestrutura**: como o sistema busca, grava ou chama coisas fora dele. Banco de dados, APIs externas, cache, filas, vector stores e clientes de LLM entram aqui ou orbitam essa fronteira.

Martin Fowler chama isso de [Presentation-Domain-Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html). O benefício mais subestimado não é "organização bonita"; é reduzir o escopo mental. Quando você está mexendo na lógica da aplicação, idealmente não precisa pensar em `HTTPException`. Quando está mexendo no armazenamento, idealmente não precisa pensar no formato da resposta HTTP.

Também vale uma distinção importante: camada não é necessariamente tier. Você pode ter router, service e repository rodando no mesmo processo, no mesmo container, no mesmo arquivo Python se quiser. A separação é conceitual antes de ser física. O ponto é criar fronteiras que ajudem o código a mudar com menos atrito.

Com isso em mente, vamos começar errado do jeito certo: tudo em um arquivo só.

---

## O app: um assistente de notícias com Q&A

Vamos construir um app RAG simples sobre artigos de notícias. O usuário faz uma pergunta, buscamos notícias recentes, geramos embeddings dos artigos, recuperamos os mais relevantes e enviamos ao LLM junto com a pergunta.

Aqui está o app completo em um único arquivo.

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

# "Vector store" em memória: lista de tuplas (texto_artigo, embedding)
article_store: list[tuple[str, list[float]]] = []


class QuestionRequest(BaseModel):
    question: str


class AnswerResponse(BaseModel):
    answer: str
    sources: list[str]


def fetch_news(topic: str) -> list[str]:
    """Busca headlines e resumos de artigos de uma news API."""
    resp = httpx.get(
        "https://newsapi.org/v2/everything",
        params={"q": topic, "pageSize": 10, "language": "pt"},
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
    """Embedding simples baseado em hash — substitua por um modelo real em produção."""
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
    """Retorna os top_k artigos mais relevantes para uma pergunta."""
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
        f"Você é um assistente de notícias. Use os artigos abaixo para responder "
        f"a pergunta do usuário. Se os artigos não tiverem informação suficiente, "
        f"diga isso.\n\nArtigos:\n{context}\n\nPergunta: {question}"
    )


@app.post("/ingest/{topic}")
def ingest_news(topic: str):
    """Busca e embeda artigos de notícias para um tópico."""
    articles = fetch_news(topic)
    for text in articles:
        emb = embed_text(text)
        article_store.append((text, emb))
    return {"ingested": len(articles), "total": len(article_store)}


@app.post("/ask", response_model=AnswerResponse)
def ask_question(req: QuestionRequest):
    """Responde uma pergunta usando contexto de notícias recuperado."""
    relevant = retrieve_relevant(req.question)
    if not relevant:
        raise HTTPException(status_code=400, detail="Nenhum artigo ingerido ainda.")

    prompt = build_prompt(req.question, relevant)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    answer = message.content[0].text
    return AnswerResponse(answer=answer, sources=relevant)
```

Funciona. Dá para rodar, demonstrar, e cobre o caso de uso inicial com cerca de 80 linhas.

Com o tempo, a equipe começa a usar o sistema.

---

## Pedido #1: "Troque o Claude pelo OpenAI"

O gerente de produto diz que o tier do OpenAI é mais barato para esse caso de uso. Dá para trocar o LLM?

Abra o `main.py`. A chamada ao LLM está dentro de `ask_question`, acoplada diretamente ao cliente da Anthropic. O cliente é inicializado no nível do módulo. O nome do modelo está embutido dentro da função. A construção do prompt está em uma função auxiliar diretamente acoplada ao formato de mensagem da Anthropic.

Para trocar o LLM você precisa:
1. Adicionar um novo import e inicialização de cliente
2. Mudar o formato das mensagens (Anthropic e OpenAI têm estruturas diferentes)
3. Mudar como você extrai o texto da resposta
4. Possivelmente reformular o prompt para funcionar melhor com o novo modelo
5. Decidir se mantém o cliente antigo para fallback

Nenhuma dessas etapas é difícil. Mas todas estão entrelaçadas em um mesmo lugar com a lógica de embedding, a lógica de recuperação e os endpoints HTTP. Mexe em uma coisa, quebra outra.

Esse é o momento em que uma **camada de serviço** começa a se pagar.

O trabalho da camada de serviço é conter a lógica de "o que esse app faz de fato": monta o prompt, chama o LLM, retorna a resposta. Ela não sabe nada sobre HTTP. Não importa se está sendo chamada por um endpoint do FastAPI, um job em background ou um teste. Quando você quer trocar o LLM, você muda o serviço — e apenas o serviço.

Em termos mais formais, a [Service Layer](https://martinfowler.com/eaaCatalog/serviceLayer.html) define a fronteira da aplicação: quais operações ela oferece e como coordena a resposta de cada operação. No nosso caso, `answer(question)` e `ingest(topic)` são operações da aplicação. O router só expõe essas operações via HTTP.

Essa distinção parece pequena, mas muda o design: o endpoint deixa de ser o lugar onde o caso de uso acontece e passa a ser apenas um adaptador de entrada. Ele traduz HTTP para uma chamada de aplicação.

Vamos chegar lá. Primeiro, a próxima dor.

---

## Pedido #2: "Adicione um cache — estamos gerando embeddings dos mesmos artigos várias vezes"

A news API às vezes retorna o mesmo artigo para queries diferentes. Você está gerando embeddings dele várias vezes, gastando processamento — e em produção, créditos de API.

Onde você adiciona o cache? Em `ingest_news`, antes da chamada para `embed_text`. Você precisaria verificar se esse texto de artigo já está no `article_store`.

Mas `article_store` é uma lista de tuplas no nível do módulo. Para deduplicar, você teria que buscar por texto, o que significa iterar a lista inteira. E agora seu endpoint de ingest concentra lógica de deduplicação, lógica de embedding e lógica de armazenamento tudo misturado.

O que você realmente quer é algo que possa responder: "você já tem esse artigo?" — uma interface limpa sobre o seu armazenamento. Isso é um **repositório**.

O repositório esconde *como* as coisas são armazenadas. Você pede dados, solicita o armazenamento de dados, e não precisa saber se é uma lista em memória, um cache Redis ou uma tabela PostgreSQL. Quando o requisito de cache aparece, você adiciona dentro do repositório, não espalhado pelos seus endpoints.

Na definição clássica de Fowler, um [Repository](https://martinfowler.com/eaaCatalog/repository.html) se comporta como uma coleção em memória sobre objetos persistidos. Essa imagem é útil: de fora, você quer pensar em `articles.add(text)` e `articles.retrieve(question)`, não em `INSERT`, índices vetoriais, TTL de cache ou chamadas para um serviço remoto.

Uma nuance: nem toda classe que chama algo externo precisa ser chamada de repositório. `ArticleRepository` encaixa bem porque representa uma coleção pesquisável de artigos. `NewsRepository`, por outro lado, também poderia ser chamado de `NewsClient` ou `NewsGateway`, porque ele não representa uma coleção interna do domínio; ele encapsula uma API externa. O nome importa menos que a fronteira: o serviço não deve conhecer detalhes da News API.

---

## Pedido #3: "Escreva um teste para a recuperação sem chamar a API real"

Seu tech lead quer um teste unitário para `retrieve_relevant`. Parece simples.

Mas `retrieve_relevant` lê de `article_store`, uma variável global no nível do módulo. Para testar, você precisa ou:
- Mutar o global diretamente no teste (o que significa que os testes podem vazar estado entre si)
- Refatorar `retrieve_relevant` para aceitar o store como parâmetro (o que quebra todos os pontos que a chamam)
- Patchear o global com `monkeypatch` (funciona, mas parece cirurgia)

E o problema maior: sua lógica de recuperação e a chamada ao LLM estão no mesmo fluxo. Para testar a recuperação, você precisa mockar o LLM. Para testar o prompt do LLM, você precisa configurar o estado da recuperação. Estão acoplados.

Quando as responsabilidades estão separadas, é possível testar a recuperação com um store falso em memória, testar a construção do prompt com um resultado de recuperação falso, e testar a chamada ao LLM com um cliente mockado — cada peça de forma isolada.

Esse é o argumento real para as camadas — não organização, mas testabilidade.

---

## Pedido #4: "Rode isso em um job em background, não só no endpoint"

Você quer um job noturno que ingere as últimas notícias automaticamente. Seria possível duplicar a lógica do endpoint em um script. Mas aí são duas cópias para manter.

A lógica principal — busca notícias, gera embeddings, armazena — precisa ser chamável tanto de um handler HTTP quanto de um cron job. Hoje ela só é acessível através da maquinaria de endpoints do FastAPI.

Esse é o segundo argumento para as camadas: **reusabilidade**. Quando a lógica vive em um serviço, qualquer ponto do sistema pode utilizá-la. Endpoint HTTP, job em background, script de CLI, teste — mesmo serviço, mesmo comportamento.

---

## Construindo as camadas

Já sentimos o atrito. Agora vamos extrair as camadas, uma por vez, motivadas pela dor que acabamos de viver.

### Schemas primeiro

São formas de dados puras. Sem lógica, só modelos Pydantic. Ficam no próprio arquivo porque todas as outras camadas precisam referenciá-los, e você não quer imports circulares.

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
            raise ValueError("pergunta não pode ser vazia")
        return v


class AnswerResponse(BaseModel):
    answer: str
    sources: list[str]


class IngestResponse(BaseModel):
    ingested: int
    total: int
```

### A camada de repositório

O repositório é responsável por duas coisas: as fontes externas de dados (API de notícias) e o armazenamento interno (article store). Em apps com LLM, o repositório frequentemente também é o "embedding store" — a peça que sabe como os artigos estão indexados e como recuperá-los.

Em um sistema maior, eu provavelmente separaria isso em dois conceitos: um `ArticleRepository` para a coleção/index vetorial e um `NewsClient` ou `NewsGateway` para a API externa. Aqui mantenho ambos no mesmo arquivo para o artigo ficar menor, mas a fronteira conceitual continua a mesma: o serviço fala com interfaces de alto nível, não com detalhes de transporte, storage ou vendor.

```python
# repositories.py
import hashlib
import os
import httpx


def _embed_text(text: str) -> list[float]:
    """Embedding determinístico baseado em hash (substitua por modelo real em produção)."""
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
        # Pares (texto, embedding) — em produção, substitua por um banco vetorial
        self._store: list[tuple[str, list[float]]] = []
        self._seen: set[str] = set()  # cache de deduplicação

    def add(self, text: str) -> bool:
        """Adiciona um artigo. Retorna False se já estava presente."""
        if text in self._seen:
            return False
        emb = _embed_text(text)
        self._store.append((text, emb))
        self._seen.add(text)
        return True

    def retrieve(self, question: str, top_k: int = 3) -> list[str]:
        """Retorna os top_k artigos mais relevantes para uma pergunta."""
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
        """Busca artigos para um tópico. Retorna lista de strings 'título\\ndescrição'."""
        resp = httpx.get(
            "https://newsapi.org/v2/everything",
            params={"q": topic, "pageSize": page_size, "language": "pt"},
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

Observe o que foi para cá: o cache de deduplicação (`_seen`), a lógica de embedding, a lógica de recuperação e a busca de notícias. O serviço não precisará saber nem se importar com como os artigos são armazenados — ele simplesmente consulta o repositório.

### A camada de serviço

O serviço contém a lógica de aplicação: "como esse app faz o que faz de verdade?" Ele coordena repositórios e encapsula a chamada ao LLM.

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
        """Busca e armazena artigos para um tópico."""
        raw_articles = self._news.fetch(topic)
        ingested = sum(1 for a in raw_articles if self._articles.add(a))
        return IngestResponse(ingested=ingested, total=self._articles.count())

    def _build_prompt(self, question: str, context: list[str]) -> str:
        joined = "\n\n---\n\n".join(context)
        return (
            "Você é um assistente de notícias. Use os artigos abaixo para responder "
            "a pergunta do usuário. Se os artigos não tiverem informação suficiente, "
            "diga isso.\n\n"
            f"Artigos:\n{joined}\n\n"
            f"Pergunta: {question}"
        )

    def answer(self, question: str) -> AnswerResponse:
        """Recupera artigos relevantes e responde uma pergunta."""
        sources = self._articles.retrieve(question)
        if not sources:
            raise ValueError("Nenhum artigo ingerido ainda.")

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

Observe o que trocar o LLM significa agora: você passa um cliente diferente para o `__init__`. Só isso. Quem chama o serviço não muda. O router não muda. O repositório não muda. Você alterou uma dependência em um único lugar.

### A camada de router

O router é enxuto. Ele lida com HTTP. Não sabe nada de lógica de negócio. Seu único trabalho é receber uma requisição, chamar o serviço e retornar uma resposta.

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
        raise RuntimeError("Serviço não inicializado")
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

### Conectando tudo

```python
# main.py
import os
from fastapi import FastAPI
from repositories import ArticleRepository, NewsRepository
from services import NewsQAService
from router import router, set_service

app = FastAPI(title="Assistente de Notícias Q&A")

# Injeção de dependências — acontece uma vez na inicialização
article_repo = ArticleRepository()
news_repo = NewsRepository(api_key=os.environ.get("NEWS_API_KEY"))
service = NewsQAService(article_repo=article_repo, news_repo=news_repo)
set_service(service)

app.include_router(router)
```

O `main.py` agora é só a cola que une as peças. Nenhuma lógica vive aqui.

Esse arquivo é o que muitos autores chamam de **composition root**: o lugar onde as dependências concretas são montadas. É aqui que você decide: Anthropic ou OpenAI, repositório em memória ou pgvector, News API real ou fake de teste.

Esse é o coração prático da inversão de dependência. O caso de uso recebe dependências prontas; ele não cria diretamente tudo que usa. Assim, a política da aplicação fica mais estável, e os detalhes externos ficam plugáveis.

No FastAPI real, você provavelmente trocaria o `set_service` global por `Depends()`. A documentação oficial de [aplicações maiores com múltiplos arquivos](https://fastapi.tiangolo.com/tutorial/bigger-applications/) mostra `APIRouter` como a ferramenta natural para organizar endpoints, e a documentação de [dependency overrides em testes](https://fastapi.tiangolo.com/advanced/testing-dependencies/) mostra `app.dependency_overrides` para trocar dependências em testes. Usei `set_service` aqui porque deixa a mecânica visível sem introduzir mais uma abstração no meio da explicação.

---

## O quadro completo

Aqui está o que construímos:

```
main.py          ← cola que une tudo
router.py        ← HTTP entra, HTTP sai, chama o serviço
services.py      ← lógica da aplicação, construção de prompt, chamadas ao LLM
repositories.py  ← armazenamento, fontes externas de dados
schemas.py       ← formas de dados compartilhadas
```

É o mesmo app. Mesmo comportamento, mesmos endpoints, mesmos resultados. Mas agora:

- **Trocar o LLM?** Passe um cliente diferente para `NewsQAService.__init__`.
- **Adicionar um cache?** Atualize `ArticleRepository.add` — nada mais muda.
- **Testar a recuperação?** Crie um `ArticleRepository`, adicione artigos de teste, chame `retrieve`. Sem mocks necessários.
- **Rodar de um job em background?** Importe `NewsQAService`, chame `.ingest("tecnologia")`. Sem FastAPI necessário.

Cada pedido de mudança mapeia para um único lugar no código. Essa é a promessa real da arquitetura em camadas — não organização, mas um mapeamento direto entre "o que mudou no mundo" e "o que você precisa tocar".

---

## Como isso cresceria em um FastAPI real?

Uma coisa importante: FastAPI não prescreve uma arquitetura oficial com `schemas`, `services` e `repositories`. O que ele oferece são as peças de framework: `APIRouter` para dividir endpoints, modelos Pydantic para request/response, `Depends()` para injeção de dependências e `app.dependency_overrides` para testes.

`Service Layer` e `Repository` vêm de padrões de arquitetura de aplicação, não do FastAPI. Então uma estrutura realista combina os dois mundos: deixa HTTP e dependências no lado FastAPI, e move casos de uso e persistência para camadas próprias.

O primeiro crescimento natural do nosso app não muda a ideia. Só transforma arquivos em pastas:

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

Essa estrutura ainda é a mesma arquitetura que acabamos de construir:

- `api/routers/` é o antigo `router.py`: HTTP entra, HTTP sai.
- `schemas/` é o antigo `schemas.py`: contratos Pydantic de request e response.
- `services/` é o antigo `services.py`: casos de uso e orquestração.
- `repositories/` é o antigo `repositories.py`: persistência e recuperação de dados internos.
- `clients/` separa integrações externas que não são exatamente repositórios, como LLM, embeddings e News API.
- `api/deps.py` substitui o `set_service`: aqui entram `Depends()` e a montagem das dependências usadas pelos routers.

Essa distinção entre `repositories` e `clients` evita um nome ruim que aparece muito em backends pequenos. Um `ArticleRepository` representa uma coleção de artigos que o seu app controla. Um `OpenAIClient` não é uma coleção do domínio; é um cliente para um serviço externo. Ambos ficam fora do serviço, mas não precisam ter o mesmo nome.

Quando o app cresce de verdade, o problema deixa de ser "tenho muitos arquivos?" e passa a ser "tenho muitos domínios?". Se você tiver `news_qa`, `users`, `billing`, `notifications` e `admin`, pastas globais como `services/` e `repositories/` viram gavetas grandes demais. Nesse ponto, faz sentido agrupar por feature e manter as camadas dentro de cada módulo:

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

E, se uma feature específica crescer, ela pode virar pacotes internos:

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

Repare que isso não é trocar de arquitetura no meio do caminho. É a mesma ideia crescendo em duas etapas:

1. Primeiro, arquivos viram pastas: `router.py` vira `routers/`, `schemas.py` vira `schemas/`, `repositories.py` vira `repositories/`.
2. Depois, quando há muitos domínios, você agrupa por feature e mantém as camadas dentro de cada feature.

Essa progressão também evita uma armadilha comum: começar com "Clean Architecture" demais para um app que ainda nem sentiu dor suficiente. O desenho deve ficar mais explícito conforme as mudanças reais pedem fronteiras mais claras.

---

## O insight específico de LLM: onde fica a chamada ao modelo?

Isso confunde a maioria dos engenheiros de ML. Chamar o LLM é uma operação de "serviço" ou de "repositório"?

O enquadramento útil: **depende de como você modela**.

RAG deixa essa fronteira ainda mais interessante. O paper original de [Retrieval-Augmented Generation](https://arxiv.org/abs/2005.11401) descreve a combinação entre memória paramétrica do modelo e memória não-paramétrica, normalmente um índice externo recuperável. Traduzindo para arquitetura: o modelo e o índice mudam por razões diferentes. O índice muda quando os dados mudam. O prompt muda quando o comportamento desejado muda. O provedor de LLM muda por custo, latência, qualidade ou política.

Essas razões de mudança são um bom guia para desenhar fronteiras.

Se o LLM é *um componente da sua lógica* — você constrói um prompt, envia, interpreta a resposta — isso é uma operação de serviço. O serviço é responsável pelo prompt, pela escolha do modelo, pela política de retry.

Se o LLM é *uma fonte externa de dados* — você está buscando uma completion da mesma forma que buscaria de um banco de dados — então faz sentido encapsulá-lo em um repositório. Isso é comum quando o LLM é apenas uma das muitas fontes de dados, ao lado de um banco vetorial, um banco SQL ou uma API de notícias.

No nosso app, o LLM faz parte da lógica de forma profunda (construímos o prompt, interpretamos o resultado), então ele fica no serviço. Se depois adicionássemos um passo de "recuperar respostas pré-computadas de um cache construído por um batch job de LLM", essa recuperação do cache ficaria no repositório.

A fronteira é nebulosa. Não vale a pena agonizar sobre isso. Na dúvida: se parece "buscar algo externo", é repositório. Se parece "computar algo usando a lógica do seu domínio", é serviço.

Outra forma de pensar: RAG não é só "colocar contexto no prompt". A própria documentação da OpenAI sobre [otimização de precisão](https://developers.openai.com/api/docs/guides/optimizing-llm-accuracy) trata prompt engineering, retrieval e fine-tuning como alavancas diferentes. Se retrieval é uma alavanca separada, ele merece uma superfície separada no código. Isso facilita testar qualidade de recuperação sem ter que testar geração ao mesmo tempo.

---

## Testando: o retorno

Veja como fica uma suíte de testes com a versão em camadas:

Aqui entram os **test doubles**. Um fake é uma implementação simples que funciona de verdade, como um repositório em memória. Um mock é um objeto usado para verificar interação, como "o cliente do LLM foi chamado com um prompt contendo Tesla". Martin Fowler usa [Test Double](https://www.martinfowler.com/bliki/TestDouble.html) como termo guarda-chuva para esses substitutos.

A arquitetura em camadas ajuda porque cada dependência externa fica substituível no ponto certo. Você não precisa fingir HTTP para testar retrieval. Não precisa chamar a News API para testar prompt. Não precisa gastar tokens para testar que a orquestração chamou o modelo com o contexto certo.

```python
# test_retrieval.py
from repositories import ArticleRepository


def test_recuperacao_retorna_mais_relevante():
    repo = ArticleRepository()
    repo.add("Apple anuncia novo MacBook com chip M4")
    repo.add("Google lança novo telefone Pixel")
    repo.add("Microsoft lança Windows 12")

    results = repo.retrieve("notebook Apple", top_k=1)
    assert len(results) == 1
    assert "Apple" in results[0]


def test_deduplicacao():
    repo = ArticleRepository()
    adicionado_primeiro = repo.add("Texto de algum artigo")
    adicionado_segundo = repo.add("Texto de algum artigo")
    assert adicionado_primeiro is True
    assert adicionado_segundo is False
    assert repo.count() == 1
```

```python
# test_service.py
from unittest.mock import MagicMock
from repositories import ArticleRepository
from services import NewsQAService


def test_resposta_usa_contexto_recuperado():
    article_repo = ArticleRepository()
    article_repo.add("Ações da Tesla sobem 10% após resultado do trimestre")

    mock_llm = MagicMock()
    mock_llm.messages.create.return_value = MagicMock(
        content=[MagicMock(text="A Tesla teve resultados fortes.")]
    )

    mock_news = MagicMock()
    service = NewsQAService(
        article_repo=article_repo,
        news_repo=mock_news,
        llm_client=mock_llm,
    )

    result = service.answer("Como foi a Tesla?")
    assert "Tesla" in result.answer
    # O LLM foi chamado com contexto contendo o artigo
    call_args = mock_llm.messages.create.call_args
    assert "Tesla" in call_args.kwargs["messages"][0]["content"]
```

Sem HTTP. Sem chamadas reais de API. Cada teste é rápido, isolado e expressivo. Esse é o retorno que a arquitetura oferece.

---

## Quando NÃO usar camadas

Uma prova de conceito com dois endpoints e prazo de um dia? Não use camadas.

Uma ferramenta pessoal que só você usa? Um único arquivo funciona bem.

Um protótipo que você vai demonstrar na sexta e descartar na segunda? Otimize para velocidade, não para estrutura.

Camadas têm um custo real. Mais arquivos para navegar. Mais indireção para rastrear. Mais conexões para manter. Esse custo vale a pena quando:
- Vários engenheiros estão trabalhando na mesma base de código
- Você espera que os componentes troquem (diferentes LLMs, diferentes fontes de dados)
- Você precisa de testes que rodem de forma isolada
- A mesma lógica precisa ser chamada de vários lugares

Uma regra prática: se você fez o mesmo tipo de mudança duas vezes no mesmo bloco de lógica, é hora de extrair. Não crie camadas por prevenção. Crie-as sob demanda, quando a dor for real.

---

## O que vem depois

Este guia manteve as coisas simples de propósito: armazenamento em memória, um único serviço, sem async. Em um app de LLM em produção, você adicionaria:

- **Serviços assíncronos** — `async def answer(...)` com `await client.messages.create(...)` para requisições concorrentes
- **Injeção de dependências** — o sistema `Depends()` do FastAPI em vez do padrão global `set_service` que usamos
- **Um banco vetorial de verdade** — substitua `ArticleRepository` por uma implementação apoiada em Qdrant, Chroma ou pgvector sem tocar em mais nada
- **Lógica de retry** — no serviço, envolva a chamada ao LLM com backoff exponencial e lógica de fallback de modelo
- **Respostas em streaming** — `StreamingResponse` no router, `stream=True` no serviço, sem alterar o repositório

Cada um desses se encaixa na camada onde pertence. É assim que você sabe que a arquitetura está funcionando: novos requisitos têm um lugar óbvio.

Se você continuar evoluindo esse desenho, provavelmente vai encontrar termos como **Ports and Adapters**, **Hexagonal Architecture**, **Onion Architecture** e **Clean Architecture**. Eles não são a mesma coisa em todos os detalhes, mas compartilham uma intuição: a aplicação fica no centro, e o mundo externo conversa com ela por adaptadores. Alistair Cockburn descreve a [arquitetura hexagonal](https://alistair.cockburn.us/hexagonal-architecture) como uma aplicação no lado de dentro se comunicando por portas com coisas do lado de fora.

No nosso exemplo, HTTP é um adaptador de entrada. Um job noturno seria outro. News API, vector store e LLM são adaptadores de saída. A camada de serviço é onde esses adaptadores se encontram para realizar um caso de uso.

Você começou com um arquivo. Terminou com cinco. O app faz exatamente a mesma coisa. Mas agora, quando algo muda — e algo sempre muda — você sabe onde ir.
