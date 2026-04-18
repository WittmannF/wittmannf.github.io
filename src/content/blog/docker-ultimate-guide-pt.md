---
title: 'Docker: O Guia Definitivo — Do Zero à Produção'
description: 'Aprenda Docker construindo: uma API FastAPI com modelo de ML que começa rodando local e termina pronta para produção. Cada problema leva ao próximo conceito — Dockerfile, Compose, volumes, networking, segurança e deploy.'
pubDate: 2026-04-17
tags: ['Docker', 'DevOps', 'Containers', 'FastAPI', 'Python']
lang: 'pt'
---

Você treinou um modelo de ML. Funciona no seu notebook. Agora precisa servir ele como API para o resto do time consumir. Você monta uma API com FastAPI, roda localmente, tudo lindo. Aí manda o repositório para um colega e...

*"Que versão do Python tu tá usando? Aqui dá erro no numpy. E o modelo .pkl, tá onde?"*

Este guia vai te levar dessa situação — uma API que só funciona na sua máquina — até uma aplicação containerizada, com banco de dados, cache, segurança e pronta para produção. Cada seção resolve um problema real que naturalmente cria o próximo.

Vamos usar como exemplo uma API FastAPI que serve predições de um modelo de ML. Se você trabalha com backend para aplicações de IA, vai se sentir em casa.

> **Quer acompanhar na prática?** Todos os arquivos do exemplo estão [disponíveis no GitHub](https://github.com/WittmannF/wittmannf.github.io/tree/main/public/blog/docker-ultimate-guide). Clone, instale as dependências com `pip install -r requirements.txt`, rode `python train_model.py` para gerar o modelo, e siga junto.

---

## O Ponto de Partida: Uma API que Funciona (na sua máquina)

Temos uma API simples: recebe dados, roda um modelo treinado e retorna a predição.

```python
# app/main.py
from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np

app = FastAPI(title="ML Prediction API")
model = joblib.load("models/model.pkl")

class PredictionRequest(BaseModel):
    features: list[float]

class PredictionResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    prediction: float
    model_version: str = "1.0.0"

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    X = np.array(request.features).reshape(1, -1)
    prediction = model.predict(X)[0]
    return PredictionResponse(prediction=float(prediction))
```

Para rodar localmente:

```bash
pip install fastapi uvicorn joblib scikit-learn numpy
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Funciona. Mas tente replicar isso em outra máquina. Python 3.11 vs 3.12, versão do scikit-learn diferente, numpy incompatível, modelo treinado com outra versão da lib. Caos.

**Primeiro problema: como garantir que essa API roda igual em qualquer lugar?**

---

## O Que É Docker (e Por Que Resolve Esse Problema)

Docker é uma plataforma que empacota sua aplicação junto com **tudo** que ela precisa — código, runtime, bibliotecas, modelo, configurações — em um **container**. Um container é um ambiente isolado e portátil: funciona na sua máquina, na do colega, no servidor de staging, em produção na AWS.

A analogia mais útil: antes dos containers de carga, cada tipo de mercadoria exigia um método diferente de transporte. Containers padronizaram tudo — qualquer mercadoria, qualquer navio, qualquer porto. Docker fez o mesmo com software.

### Conceitos Essenciais (só o que você precisa agora)

- **Imagem**: um template read-only com tudo que sua app precisa. Pense como um snapshot do ambiente
- **Container**: uma instância em execução de uma imagem. Pense como um processo isolado
- **Dockerfile**: a receita para construir uma imagem
- **Registry**: onde imagens ficam armazenadas (Docker Hub é o padrão público)

Mais conceitos vão aparecer conforme a necessidade. Vamos ao que interessa.

---

## Problema 1: "Na Minha Máquina Funciona"

### Solução: Seu Primeiro Dockerfile

Crie um arquivo chamado `Dockerfile` (sem extensão) na raiz do projeto:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Linha por linha:

| Instrução | O que faz |
|-----------|-----------|
| `FROM python:3.12-slim` | Parte de uma imagem Python oficial (versão slim, ~150MB) |
| `WORKDIR /app` | Cria e entra no diretório `/app` dentro do container |
| `COPY requirements.txt .` | Copia o arquivo de dependências para dentro da imagem |
| `RUN pip install ...` | Instala as dependências (durante o build, não em runtime) |
| `COPY . .` | Copia todo o código da aplicação |
| `EXPOSE 8000` | Documenta que a app escuta na porta 8000 |
| `CMD [...]` | Comando executado quando o container iniciar |

Agora construa e rode:

```bash
# Construir a imagem (o ponto final é o contexto de build — diretório atual)
docker build -t ml-api:v1 .

# Rodar o container
docker run -d --name ml-api -p 8000:8000 ml-api:v1

# Testar
curl http://localhost:8000/health
# {"status": "healthy"}

curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"features": [1.5, 2.3, 0.8, 4.1]}'
# {"prediction": 42.7, "model_version": "1.0.0"}
```

Pronto. Qualquer pessoa com Docker instalado roda `docker run` e tem a API funcionando. Mesma versão do Python, mesmas libs, mesmo modelo.

### Comandos Básicos que Você Vai Usar o Tempo Todo

```bash
docker ps                    # Containers rodando
docker ps -a                 # Todos (incluindo parados)
docker logs ml-api           # Ver logs
docker logs -f ml-api        # Seguir logs em tempo real
docker exec -it ml-api bash  # Abrir shell dentro do container
docker stop ml-api           # Parar
docker rm ml-api             # Remover
```

Mas tem um problema...

---

## Problema 2: A Imagem Ficou Enorme

```bash
docker image ls
# REPOSITORY  TAG   SIZE
# ml-api      v1    1.2GB
```

1.2GB para servir uma API simples? Cada push para um registry, cada pull em CI/CD, cada deploy — tudo demora. Modelos de ML já são grandes; a imagem não precisa ser.

### Solução: Multi-Stage Build

A ideia: use um estágio para instalar dependências (que pode precisar de compiladores, headers, etc.) e um segundo estágio — limpo — só com o resultado final.

```dockerfile
# Estágio 1: Instalar dependências
FROM python:3.12-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt

# Estágio 2: Imagem de produção (limpa)
FROM python:3.12-slim
WORKDIR /app

COPY --from=builder /install /usr/local
COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

O `gcc` e `g++` ficam apenas no estágio de build. A imagem final não tem compiladores — só o Python, as libs instaladas e seu código.

```bash
docker build -t ml-api:v2 .
docker image ls
# REPOSITORY  TAG   SIZE
# ml-api      v1    1.2GB
# ml-api      v2    450MB
```

Ainda grande por causa do scikit-learn/numpy, mas quase 3x menor. Para modelos realmente pesados (PyTorch, transformers), a diferença é ainda mais dramática.

> **Por que `-slim` e não Alpine?** Imagens Alpine usam `musl` em vez de `glibc`. Muitas libs de ML (numpy, scipy, pandas) dependem de `glibc` e precisam ser compiladas do zero no Alpine — build lento e imagem às vezes até maior. Para Python/ML, `-slim` (Debian) é o melhor padrão.

---

## Problema 3: Cada Mudança Rebuilda Tudo

Você muda uma linha no `main.py`, roda `docker build` e... ele reinstala todas as dependências do zero. O `pip install` leva 2 minutos toda vez.

### Solução: Entender Cache de Camadas

Docker constrói imagens em **camadas**. Cada instrução do Dockerfile cria uma camada. Se uma camada muda, **todas as camadas depois dela são invalidadas**.

O problema do Dockerfile anterior: `COPY . .` antes do `pip install` copiava tudo — incluindo o código-fonte. Qualquer mudança no código invalidava o cache de `pip install`.

A solução é copiar primeiro **só o que define dependências**, instalar, e **depois** copiar o código:

```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

# Primeiro: só o que define dependências
COPY requirements.txt .
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /install /usr/local

# Depois: código e modelo (muda frequentemente)
COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

> **Regra de ouro**: ordene as instruções da **menos alterada** para a **mais alterada**.

Agora, mudar `main.py` → rebuild em segundos (cache das dependências é aproveitado).

Também crie um `.dockerignore` para não enviar lixo ao daemon:

```
.git
.venv
__pycache__
*.pyc
.pytest_cache
.env
.env.*
*.md
LICENSE
.vscode
.idea
notebooks/
data/raw/
```

Sem `.dockerignore`, o Docker envia **todo** o diretório como contexto de build — incluindo seus datasets de treino, checkpoints do modelo e o diretório `.git`.

---

## Problema 4: A API Precisa de um Banco de Dados

A API funciona, mas agora você precisa salvar as predições para auditoria e monitoramento. Você precisa de um PostgreSQL. Poderia instalar na máquina, mas... lembra do "na minha máquina funciona"?

### Solução: Docker Compose

Docker Compose permite definir e rodar **múltiplos containers** em um único arquivo YAML. Crie um `compose.yaml`:

```yaml
name: ml-api

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://app:secret@db:5432/predictions
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: predictions
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d predictions"]
      interval: 5s
      timeout: 3s
      retries: 5
```

```bash
docker compose up -d     # Sobe tudo em background
docker compose logs -f   # Segue os logs
docker compose ps        # Status dos serviços
docker compose down      # Para tudo
```

Preste atenção no `depends_on` com `condition: service_healthy`. Sem isso, a API pode tentar conectar antes do Postgres estar pronto — uma das causas mais comuns de erro em setups multi-container.

### O Que Mudou na API

Agora a API salva predições:

```python
# app/main.py (versão atualizada)
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "").replace(
    "postgresql://", "postgresql+asyncpg://"
)
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    X = np.array(request.features).reshape(1, -1)
    prediction = float(model.predict(X)[0])

    async with async_session() as session:
        session.add(PredictionLog(
            features=request.features,
            prediction=prediction,
        ))
        await session.commit()

    return PredictionResponse(prediction=prediction)
```

Mas tem um problema...

---

## Problema 5: Os Dados Somem ao Reiniciar

```bash
docker compose down
docker compose up -d
# Banco de dados vazio! Todas as predições sumiram.
```

Containers são **efêmeros**. Quando removidos, tudo dentro deles desaparece.

### Solução: Volumes

Volumes são a forma do Docker persistir dados além do ciclo de vida do container.

```yaml
services:
  db:
    image: postgres:16-alpine
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: predictions
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d predictions"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  db_data:
```

Agora `docker compose down` mantém os dados. Só `docker compose down -v` remove os volumes (cuidado!).

### Tipos de Montagem

| Tipo | Quando Usar | Exemplo |
|------|-------------|---------|
| **Volume** | Dados de produção (banco, uploads) | `db_data:/var/lib/postgresql/data` |
| **Bind mount** | Desenvolvimento (hot-reload do código) | `./app:/app` |
| **tmpfs** | Dados temporários/sensíveis (só RAM) | `tmpfs: [/tmp]` |

Para desenvolvimento, use bind mount do código-fonte:

```yaml
services:
  api:
    build: .
    volumes:
      - ./app:/app/app    # Código-fonte montado para hot-reload
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ports:
      - "8000:8000"
```

Agora, mudanças no código refletem instantaneamente sem rebuild.

---

## Problema 6: A API Não Encontra o Banco

Quando você escreveu `postgresql://app:secret@db:5432/predictions`, como a API sabe o que é `db`? Não é um hostname registrado em DNS nenhum.

### Solução: Networking do Docker

Docker Compose cria automaticamente uma **rede isolada** para os serviços definidos no arquivo. Dentro dessa rede, cada serviço é acessível **pelo seu nome** — resolução DNS automática.

```
compose.yaml:
  services:
    api:  →  acessível como "api" na rede interna
    db:   →  acessível como "db" na rede interna
```

Por isso `@db:5432` funciona. O Docker resolve `db` para o IP interno do container do PostgreSQL.

### Quando Você Precisa de Redes Customizadas

Ao adicionar mais serviços, a separação de rede vira uma questão de segurança:

```yaml
services:
  api:
    networks:
      - frontend
      - backend

  db:
    networks:
      - backend     # Só acessível pela API, não pelo mundo externo

  redis:
    networks:
      - backend

networks:
  frontend:
  backend:
```

O banco **não está** na rede `frontend` — impossível acessá-lo diretamente de fora. Só a API, que está em ambas as redes, faz a ponte.

### Publicação de Portas

Portas dentro da rede Docker são internas. Para acessar de fora (sua máquina, internet), use `ports`:

```yaml
services:
  api:
    ports:
      - "8000:8000"          # Exposta para o host
  db:
    expose:
      - "5432"               # Só dentro da rede Docker (melhor para segurança)
```

> **Dica de segurança**: Bind em localhost quando não deve ser público: `"127.0.0.1:5432:5432"`.

---

## Problema 7: Predições Repetidas São Lentas

Seu modelo leva 200ms por predição. Muitos clientes mandam as mesmas features. Não faz sentido reprocessar — você precisa de cache.

### Solução: Adicionar Redis ao Stack

```yaml
name: ml-api

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://app:secret@db:5432/predictions
      REDIS_URL: redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - frontend
      - backend

  db:
    image: postgres:16-alpine
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: predictions
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d predictions"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - backend

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    networks:
      - backend

volumes:
  db_data:

networks:
  frontend:
  backend:
```

E no código:

```python
import hashlib, json, redis.asyncio as redis

redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    cache_key = hashlib.md5(json.dumps(request.features).encode()).hexdigest()

    cached = await redis_client.get(cache_key)
    if cached:
        return PredictionResponse(prediction=float(cached))

    X = np.array(request.features).reshape(1, -1)
    prediction = float(model.predict(X)[0])

    await redis_client.setex(cache_key, 3600, str(prediction))

    async with async_session() as session:
        session.add(PredictionLog(features=request.features, prediction=prediction))
        await session.commit()

    return PredictionResponse(prediction=prediction)
```

Predições repetidas: de 200ms para <1ms. E tudo com `docker compose up -d`.

Note as condições de `depends_on`:
- `service_healthy` — espera o healthcheck passar (para o banco, que precisa inicializar)
- `service_started` — só espera o container iniciar (suficiente para o Redis)

---

## Problema 8: "Tá Rodando como Root?"

Você mostra o setup para o time de segurança. Primeira pergunta:

*"O container tá rodando como root?"*

```bash
docker exec ml-api whoami
# root
```

Sim. Por padrão, containers Docker rodam como **root**. Se alguém explorar uma vulnerabilidade na sua API, tem acesso root dentro do container — e potencialmente ao host.

### Solução: Hardening do Container

Atualize o Dockerfile:

```dockerfile
# Estágio 1: Build
FROM python:3.12-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt

# Estágio 2: Produção
FROM python:3.12-slim
WORKDIR /app

# Criar usuário não-root
RUN groupadd -r appuser && useradd --no-log-init -r -g appuser appuser

COPY --from=builder /install /usr/local
COPY --chown=appuser:appuser . .

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Rodar como não-root
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### E a Senha do Banco?

Olha o `compose.yaml`: `POSTGRES_PASSWORD: secret` — a senha está em texto plano no arquivo que vai para o Git.

Use **Docker Secrets** para dados sensíveis:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: predictions
      POSTGRES_USER: app
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt   # Este arquivo NÃO vai para o Git
```

Adicione `secrets/` ao `.gitignore` e `.dockerignore`.

### Checklist de Segurança

As práticas recomendadas pela OWASP e Docker:

1. **Rode como não-root** — nunca use `--privileged` em produção
2. **Fixe versões de imagem** — `python:3.12-slim`, não `python:latest`
3. **Use secrets** — nunca coloque senhas em `ENV` ou na imagem
4. **Limite recursos** — containers sem limites podem derrubar o host
5. **Escaneie imagens** — `docker scout cves ml-api:v2`
6. **Filesystem read-only** — `docker run --read-only --tmpfs /tmp`
7. **Drop capabilities** — `docker run --cap-drop ALL --cap-add NET_BIND_SERVICE`
8. **Separe redes** — banco nunca na mesma rede que o frontend
9. **Bind portas em localhost** — `"127.0.0.1:5432:5432"` quando não público
10. **Mantenha tudo atualizado** — Docker, imagens base, dependências

### Limite Recursos no Compose

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 1G      # ML models podem consumir bastante RAM
          cpus: "2.0"
        reservations:
          memory: 512M
          cpus: "1.0"
```

Sem limites, um modelo com vazamento de memória pode derrubar todos os outros containers (e o host).

---

## Problema 9: Preciso Colocar em Produção

O `compose.yaml` funciona para dev. Mas para produção, você precisa de uma imagem otimizada, CI/CD que builda automaticamente, e deploy sem downtime.

### Dockerfile de Produção Completo

Este é o Dockerfile final — aplicando tudo que aprendemos:

```dockerfile
# syntax=docker/dockerfile:1

# ─── Build ────────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install --no-cache-dir -r requirements.txt

# ─── Production ───────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

RUN groupadd -r appuser && useradd --no-log-init -r -g appuser appuser

COPY --from=builder /install /usr/local
COPY --chown=appuser:appuser . .

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

Destaques:
- **`--mount=type=cache`** — cache do pip persiste entre builds (BuildKit)
- **`PYTHONUNBUFFERED=1`** — logs aparecem imediatamente, sem buffer
- **`--workers 4`** — múltiplos workers para produção (Uvicorn com workers precisa de `uvicorn[standard]`)
- **Usuário não-root**, health check, imagem slim, multi-stage

### CI/CD com GitHub Actions

Automatize o build e push a cada commit na main:

```yaml
name: Build and Push
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

Cada push: build automático, cache inteligente, imagem versionada pelo commit SHA.

### compose.yaml de Produção

```yaml
name: ml-api-prod

services:
  api:
    image: ghcr.io/seu-usuario/ml-api:latest
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://app@db:5432/predictions
      REDIS_URL: redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "2.0"
    networks:
      - frontend
      - backend

  db:
    image: postgres:16-alpine
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: predictions
      POSTGRES_USER: app
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d predictions"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
    networks:
      - backend

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"
    networks:
      - backend

volumes:
  db_data:
  redis_data:

networks:
  frontend:
  backend:

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

---

## Problema 10: Algo Deu Errado em Produção

A API retorna 500. O container está rodando, mas as predições falham. Como investigar?

### Solução: Debugging e Troubleshooting

**Primeira parada — logs:**

```bash
docker compose logs api              # Logs da API
docker compose logs -f api           # Seguir em tempo real
docker compose logs --tail 50 api    # Últimas 50 linhas
```

**Precisa de um shell dentro do container:**

```bash
docker compose exec api bash
# ou, se a imagem não tem bash:
docker compose exec api sh
```

**Container não tem shell?** (imagens mínimas):

```bash
docker debug ml-api
# Abre um shell com ferramentas de debug, sem modificar o container
```

**Container crasha imediatamente:**

```bash
# Rode interativamente para ver o erro
docker run -it --rm ml-api:v2 bash

# Dentro do container, tente rodar manualmente:
python -c "from app.main import app; print('OK')"
```

**Verificar uso de recursos:**

```bash
docker stats                         # CPU, memória, rede em tempo real
docker system df                     # Uso de disco total
```

### Problemas Comuns e Soluções

**Porta já em uso:**
```bash
lsof -i :8000                       # Quem está usando?
docker ps                            # Outro container na mesma porta?
```

**Sem espaço em disco:**
```bash
docker system df                     # Diagnóstico
docker system prune -a               # Limpar tudo não utilizado
docker volume prune                  # Limpar volumes órfãos
docker builder prune                 # Limpar cache de build
```

**Permissão negada em arquivo:**
```bash
# Verificar ownership dentro do container
docker exec ml-api ls -la /app/models/

# Corrigir: garantir que o COPY usa --chown
# COPY --chown=appuser:appuser . .
```

**Build ignora mudanças (cache stale):**
```bash
docker build --no-cache .            # Forçar rebuild completo
docker compose build --no-cache      # Mesmo efeito no Compose
```

---

## Bônus: Workflow Diário com Docker

Depois de configurar tudo, o dia a dia é simples:

```bash
# Manhã: levantar o ambiente
docker compose up -d

# Desenvolver normalmente (bind mount faz hot-reload)
# Alterar código → API recarrega automaticamente

# Ver logs quando algo parece errado
docker compose logs -f api

# Rodar testes dentro do container (mesmo ambiente de produção)
docker compose exec api pytest

# Fim do dia: derrubar (dados persistem no volume)
docker compose down

# Atualizar dependências
docker compose build
docker compose up -d
```

### Comandos que Você Vai Memorizar

```bash
# Compose (90% do seu uso)
docker compose up -d               # Subir
docker compose down                # Derrubar
docker compose logs -f             # Logs
docker compose exec api bash       # Shell no serviço
docker compose build               # Rebuild
docker compose ps                  # Status

# Imagens
docker build -t nome:tag .         # Construir
docker image ls                    # Listar
docker image prune                 # Limpar não usadas

# Containers avulsos
docker run -d --name x -p 80:80 img   # Rodar
docker stop x && docker rm x          # Parar e remover
docker run -it --rm img bash           # Shell descartável

# Manutenção
docker system df                   # Uso de disco
docker system prune -a             # Limpeza geral
```

---

## Docker por Baixo dos Panos

Você já está usando Docker produtivamente. Agora vale entender o que acontece por baixo — isso ajuda a diagnosticar problemas e tomar decisões melhores.

### Arquitetura

Docker usa uma **arquitetura cliente-servidor**:

```
┌──────────────────────────────────────────┐
│         Docker Client (docker CLI)       │
│   Envia comandos via REST API            │
└─────────────────┬────────────────────────┘
                  │
┌─────────────────▼────────────────────────┐
│         Docker Daemon (dockerd)          │
│   Gerencia imagens, containers,          │
│   redes e volumes                        │
└─────────────────┬────────────────────────┘
                  │
┌─────────────────▼────────────────────────┐
│         containerd → runc                │
│   Runtime que cria/executa containers    │
│   usando namespaces e cgroups do Linux   │
└──────────────────────────────────────────┘
```

- **Docker Client**: o CLI que você usa (`docker build`, `docker run`)
- **Docker Daemon**: o servidor que faz o trabalho pesado
- **containerd**: gerencia o ciclo de vida dos containers (doado à CNCF)
- **runc**: cria e executa containers no nível mais baixo (doado à OCI)

### Tecnologias Linux Subjacentes

Docker não é mágica — é engenharia sobre funcionalidades do kernel Linux:

**Namespaces** isolam recursos: cada container tem sua própria visão de processos (`pid`), rede (`net`), filesystem (`mnt`), hostname (`uts`) e usuários (`user`).

**Control Groups (cgroups)** limitam recursos: CPU, memória, I/O de disco. É o que faz `deploy.resources.limits` funcionar no Compose.

**Union Filesystems** habilitam a arquitetura em camadas das imagens — copy-on-write para eficiência.

### Docker vs VMs

Uma dúvida comum:

| Aspecto | Containers | VMs |
|---------|-----------|-----|
| **Virtualiza** | Sistema operacional | Hardware |
| **Tamanho** | Dezenas de MB | Dezenas de GB |
| **Boot** | Segundos | Minutos |
| **Isolamento** | Processo (namespaces) | Hardware (hypervisor) |
| **Performance** | Quase nativa | Overhead do hypervisor |

Na prática, a maioria das empresas usa os dois: containers rodando dentro de VMs na cloud.

---

## Docker Desktop vs Alternativas

Docker Desktop é a GUI oficial, mas desde 2021 exige licença paga para empresas grandes (+250 funcionários ou +$10M receita). Alternativas gratuitas:

| Ferramenta | Destaques | Instalação |
|-----------|-----------|------------|
| **Podman** | Daemonless, rootless por padrão, CLI compatível | `brew install podman` |
| **Colima** | Mais simples para Mac, CLI only | `brew install colima && colima start` |
| **Rancher Desktop** | GUI, Kubernetes built-in | Download do site |

**Podman** se destaca para quem quer segurança: sem daemon rodando como root, e `alias docker=podman` funciona para quase tudo.

---

## Funcionalidades Novas do Docker

Três ferramentas recentes que valem conhecer:

**Docker Init** — gera Dockerfile, compose.yaml e .dockerignore com boas práticas para sua linguagem:

```bash
docker init
# Detecta Python, pergunta versão, porta, comando — gera tudo
```

**Docker Scout** — escaneia vulnerabilidades nas suas imagens:

```bash
docker scout cves ml-api:v2
docker scout recommendations ml-api:v2
```

**Docker Debug** — shell em qualquer container, mesmo os que não têm shell:

```bash
docker debug ml-api
# Toolbox completa: vim, curl, htop — sem modificar o container
```

---

## Recapitulando a Jornada

Começamos com uma API FastAPI que só funcionava localmente. Ao longo do guia, cada problema levou a um conceito Docker:

| Problema | Conceito Docker | Solução |
|----------|----------------|---------|
| "Na minha máquina funciona" | **Dockerfile** | Empacotar tudo em uma imagem |
| Imagem de 1.2GB | **Multi-stage build** | Separar build de produção |
| Rebuild lento a cada mudança | **Cache de camadas** | Ordenar instruções estrategicamente |
| Preciso de PostgreSQL | **Docker Compose** | Definir múltiplos serviços em YAML |
| Dados somem ao reiniciar | **Volumes** | Persistir dados fora do container |
| API não encontra o banco | **Networking** | DNS automático entre serviços |
| Predições lentas para dados repetidos | **Serviços adicionais** | Redis como cache no stack |
| Rodando como root | **Segurança** | USER, secrets, limites de recursos |
| Preciso deployar | **CI/CD + registry** | GitHub Actions + GHCR |
| Erro em produção | **Debugging** | Logs, exec, docker debug |

Cada conceito resolveu um problema concreto. Não existe razão para decorar comandos Docker sem contexto — agora você sabe **por que** cada um existe.

O ecossistema continua evoluindo: Docker Scout, Docker Debug, Docker Init e Hardened Images mostram que a plataforma está mais madura do que nunca. Mas os fundamentos — imagens, containers, volumes, redes, segurança — são os mesmos desde 2013. Domine esses, e você estará preparado para qualquer coisa que venha pela frente.
