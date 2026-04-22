---
title: 'uv: O Gerenciador de Pacotes Python que Vai Mudar Seu Fluxo de Trabalho'
description: 'Guia prático e completo do uv — o substituto moderno para pip, venv, pyenv e pip-tools. Do zero à produção, com os atalhos que você vai usar todo dia.'
pubDate: 2026-04-22
tags: ['Python', 'uv', 'DevOps', 'Ferramentas']
lang: 'pt'
---

Você roda `pip install pandas` e espera 45 segundos. Cria um `venv` na mão com três comandos. Mantém um `requirements.txt` que não trava dependências transitivas. Usa `pyenv` para instalar o Python certo, `pip-tools` para gerar lockfiles, `virtualenv` para os ambientes.

Cinco ferramentas. Para fazer uma coisa.

**`uv` faz tudo isso — em um único binário, escrito em Rust, 10 a 100 vezes mais rápido que pip.**

Este guia vai do básico absoluto ("o que é isso?") até os atalhos que você vai usar todo dia — incluindo integração com Docker, gerenciamento de versões do Python, e scripts com dependências embutidas.

---

## O Que É uv (e Por Que Deveria Importar)

`uv` é um gerenciador de pacotes e projetos Python criado pela [Astral](https://astral.sh) — a mesma empresa do `ruff`, o linter Python mais rápido do mercado.

A proposta é simples: substituir `pip`, `pip-tools`, `pipx`, `venv`, `virtualenv` e `pyenv` com uma ferramenta única, consistente, e dramaticamente mais rápida.

**Na prática:**

```bash
# Antes (pip)
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn
# ~30-60 segundos dependendo da conexão

# Com uv
uv add fastapi uvicorn
# ~1-3 segundos, venv criado automaticamente
```

Não é exagero. O uv usa cache agressivo, resolução de dependências em paralelo, e evita re-downloads. Uma instalação que pip faz em 45 segundos, uv faz em 1.

---

## Instalação

```bash
# Mac / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Mac via Homebrew
brew install uv

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Confirme a instalação:

```bash
uv --version
# uv 0.7.x
```

---

## O Ponto de Partida: Dois Modos de Uso

O uv tem dois modos principais de operação, e é importante entender a diferença antes de começar:

| Modo | Quando usar | Comandos principais |
|------|-------------|---------------------|
| **Modo projeto** | Aplicações, pacotes, projetos com `pyproject.toml` | `uv init`, `uv add`, `uv sync`, `uv run` |
| **Modo pip** | Scripts avulsos, substituição direta do pip | `uv pip install`, `uv pip freeze` |

Se você está começando um projeto novo ou adotando uv em um projeto existente → **modo projeto**.

Se você quer só substituir `pip install` pontualmente → **modo pip**.

Vamos cobrir os dois.

---

## Problema 1: "Quero começar um projeto novo sem burocracia"

Com pip, você faz na mão: cria a pasta, o venv, ativa, instala, cria o `pyproject.toml` ou `setup.py`.

### Solução: `uv init`

```bash
uv init meu-projeto
cd meu-projeto
```

Isso cria a estrutura mínima:

```
meu-projeto/
├── .python-version   # versão do Python fixada para o projeto
├── pyproject.toml    # manifesto do projeto
├── README.md
└── hello.py          # arquivo de exemplo
```

O `pyproject.toml` gerado:

```toml
[project]
name = "meu-projeto"
version = "0.1.0"
description = "Add your description here"
requires-python = ">=3.13"
dependencies = []
```

O venv ainda não existe — o uv cria sob demanda quando você adiciona dependências ou roda algo.

**Variações úteis:**

```bash
# Projeto com app (adiciona [project.scripts])
uv init --app meu-app

# Pacote Python publicável (adiciona estrutura de src/)
uv init --lib minha-lib

# Script único (sem pyproject.toml, dependências inline)
uv init --script analise.py
```

---

## Problema 2: "Preciso de uma versão específica do Python que não tenho instalada"

Normalmente você instalaria pyenv, configuraria o shell, baixaria a versão. Com uv:

### Solução: `uv python`

```bash
# Lista as versões disponíveis para download
uv python list

# Instala o Python 3.12
uv python install 3.12

# Instala múltiplas versões de uma vez
uv python install 3.11 3.12 3.13

# Usa uma versão específica no projeto atual (cria .python-version)
uv python pin 3.12
```

O uv baixa binários pré-compilados do Python — sem compilação, sem dependências do sistema. Rápido e limpo.

Para criar um projeto com uma versão específica desde o início:

```bash
uv init --python 3.12 meu-projeto
```

---

## Problema 3: "Quero adicionar dependências sem ativar venv na mão"

Com pip, o fluxo é: `source .venv/bin/activate`, `pip install X`, atualizar `requirements.txt` na mão.

### Solução: `uv add`

```bash
# Adiciona uma dependência
uv add fastapi

# Adiciona com versão específica
uv add "httpx>=0.27"

# Adiciona múltiplas de uma vez
uv add fastapi uvicorn pydantic

# Adiciona dependência de desenvolvimento (não vai para produção)
uv add --dev pytest ruff

# Adiciona dependência opcional (grupo nomeado)
uv add --optional gpu torch torchvision
```

O `uv add` faz três coisas automaticamente:
1. Cria o `.venv` se não existir
2. Instala o pacote
3. Atualiza o `pyproject.toml` e o `uv.lock`

O `pyproject.toml` depois de `uv add fastapi uvicorn`:

```toml
[project]
name = "meu-projeto"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn>=0.34",
]
```

Para remover:

```bash
uv remove fastapi
```

---

## Problema 4: "Quero rodar código sem ativar o venv manualmente"

Com pip, você precisa sempre lembrar de ativar o venv antes de rodar qualquer coisa.

### Solução: `uv run`

```bash
# Roda um script no venv do projeto
uv run python script.py

# Roda qualquer comando disponível no venv
uv run fastapi dev app/main.py
uv run pytest
uv run ruff check .

# Roda com variável de ambiente
uv run --env DEBUG=true python script.py
```

O `uv run` detecta o projeto automaticamente (procura `pyproject.toml` no diretório atual e nos pais), ativa o venv internamente e roda o comando. Você nunca mais precisa de `source .venv/bin/activate`.

**Atalho direto para scripts:**

```bash
# Em vez de:
source .venv/bin/activate
python meu_script.py

# Apenas:
uv run meu_script.py
```

---

## Problema 5: "Um colega instalou versões diferentes das minhas e o código quebra"

`requirements.txt` declara `fastapi>=0.100` mas não trava dependências transitivas. Na máquina de um dev instala `starlette 0.41`, na outra `starlette 0.43`. Comportamento diferente. Difícil de debugar.

### Solução: `uv lock` + `uv sync --frozen`

O `uv lock` gera (ou atualiza) o `uv.lock` — um arquivo que trava as versões **exatas** de todas as dependências, incluindo transitivas:

```bash
uv lock
```

Resultado: um `uv.lock` com centenas de linhas como:

```
[[package]]
name = "fastapi"
version = "0.115.12"
source = { registry = "https://pypi.org/simple" }
dependencies = [
    { name = "pydantic", version = "2.11.3", ... },
    { name = "starlette", version = "0.46.1", ... },
]
```

Para instalar **exatamente** o que está no lockfile (o que outro dev, CI, ou container deve fazer):

```bash
uv sync --frozen
```

**Fluxo recomendado:**

```bash
# Dev A: adiciona dependência, atualiza lock, comita ambos
uv add requests
git add pyproject.toml uv.lock
git commit -m "add requests"

# Dev B: puxa as mudanças, sincroniza o ambiente
git pull
uv sync  # instala exatamente o que está no lock
```

**Variações do `uv sync`:**

```bash
uv sync                  # sincroniza tudo
uv sync --frozen         # usa o lock sem tentar atualizar
uv sync --no-dev         # ignora dependências de desenvolvimento
uv sync --group gpu      # inclui grupo opcional "gpu"
uv sync --all-extras     # inclui todos os extras/opcionais
```

---

## Problema 6: "Preciso substituir o pip em um projeto existente (sem pyproject.toml)"

Você tem um projeto legado com `requirements.txt` e não quer refatorar tudo agora.

### Solução: `uv pip` — drop-in replacement do pip

```bash
# Cria o venv
uv venv .venv

# Ativa (essa parte ainda é manual no modo pip)
source .venv/bin/activate

# Instala do requirements.txt
uv pip install -r requirements.txt

# Instala um pacote avulso
uv pip install numpy

# Lista instalados
uv pip list

# Gera requirements.txt a partir do ambiente atual
uv pip freeze > requirements.txt

# Mostra informações de um pacote
uv pip show pandas

# Desinstala
uv pip uninstall numpy
```

A interface é idêntica ao pip — só substitui `pip` por `uv pip`. A velocidade é a diferença.

**Gerar lockfile a partir de requirements.txt:**

```bash
# Compila um requirements.txt com versões travadas (equivalente ao pip-compile)
uv pip compile requirements.in -o requirements.txt
```

---

## Problema 7: "Quero rodar uma ferramenta CLI sem instalar globalmente"

Você precisa rodar `black`, `ruff`, `httpie`, `twine` — mas não quer instalar no Python global nem criar um venv só para isso.

### Solução: `uvx` (ferramenta avulsa)

```bash
# Roda diretamente sem instalar
uvx ruff check .
uvx black meu_script.py
uvx httpie GET https://api.exemplo.com

# Equivalente mais explícito
uv tool run ruff check .
```

O `uvx` baixa a ferramenta, roda, e não polui nenhum ambiente. Usa cache, então na segunda vez é instantâneo.

Para instalar permanentemente (disponível globalmente, como `pipx install`):

```bash
uv tool install ruff
uv tool install black

# Lista ferramentas instaladas
uv tool list

# Atualiza todas
uv tool upgrade --all
```

---

## Problema 8: "Tenho um script Python que precisa de dependências — mas não quero criar projeto"

Um script de análise, uma automação, um utilitário que você quer compartilhar como arquivo único.

### Solução: dependências inline no script

O uv suporta o padrão PEP 723 — dependências declaradas dentro do próprio script:

```python
# analise.py
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "pandas>=2.0",
#   "matplotlib>=3.8",
#   "requests",
# ]
# ///

import pandas as pd
import matplotlib.pyplot as plt
import requests

# seu código aqui...
```

Para rodar:

```bash
uv run analise.py
```

O uv instala as dependências em um ambiente isolado temporário, roda o script, e pronto. Nenhum `pyproject.toml`, nenhum venv manual. Compartilhe o `.py` e qualquer um roda com `uv run`.

Para adicionar dependências ao script pela CLI:

```bash
uv add --script analise.py pandas matplotlib
```

---

## Referência Rápida: Os Comandos Mais Usados

### Começando um projeto

```bash
uv init nome-do-projeto          # cria projeto novo
uv init --app nome-do-projeto    # projeto com entrypoint
uv init --lib nome-do-projeto    # biblioteca publicável
```

### Gerenciando dependências

```bash
uv add pacote                    # adiciona dependência
uv add "pacote>=1.0,<2.0"        # com restrição de versão
uv add --dev pytest              # dependência de dev
uv add --optional nome pacote    # grupo opcional
uv remove pacote                 # remove dependência
uv lock                          # atualiza uv.lock
uv sync                          # sincroniza venv com pyproject.toml
uv sync --frozen                 # usa lock sem atualizar
uv sync --no-dev                 # só dependências de produção
```

### Rodando código

```bash
uv run script.py                 # roda script no venv do projeto
uv run pytest                    # roda qualquer comando do venv
uv run -- python -c "print(1)"   # passa flags arbitrárias
```

### Python

```bash
uv python list                   # versões disponíveis
uv python install 3.12           # instala versão
uv python pin 3.12               # fixa versão no projeto (.python-version)
uv python find                   # mostra qual Python o projeto usa
```

### Ferramentas globais

```bash
uvx ferramenta                   # roda sem instalar
uv tool install ferramenta       # instala globalmente
uv tool list                     # lista instaladas
uv tool upgrade --all            # atualiza todas
```

### Modo pip (projetos legados)

```bash
uv venv .venv                    # cria venv
uv pip install -r requirements.txt
uv pip install pacote
uv pip list
uv pip freeze
uv pip compile requirements.in -o requirements.txt
```

---

## Integração com Docker

O padrão mais limpo para usar uv no Docker é o **multi-stage build**: copiar apenas o binário da imagem oficial do uv, sem instalar o uv em si como dependência do projeto.

```dockerfile
# Stage 1: baixa apenas o binário do uv
FROM ghcr.io/astral-sh/uv:latest AS uv-bin

# Stage 2: imagem de produção
FROM python:3.12-slim

# Copia só o binário
COPY --from=uv-bin /uv /usr/local/bin/uv

WORKDIR /app

# Copia manifesto e lockfile ANTES do código (cache de camadas)
COPY pyproject.toml uv.lock ./

# Instala dependências de produção, versões exatas do lockfile
RUN uv sync --frozen --no-dev

# Adiciona o venv ao PATH
ENV PATH="/app/.venv/bin:$PATH"

# Copia o código (muda com frequência — vem depois para não invalidar cache)
COPY src/ src/

CMD ["python", "-m", "meu_modulo"]
```

**Por que essa ordem importa:**

```
COPY pyproject.toml uv.lock ./   ← muda raramente (quando você adiciona pacotes)
RUN uv sync --frozen --no-dev    ← fica em cache enquanto os dois acima não mudarem

COPY src/ src/                   ← muda com frequência (código)
```

Se você copiar o código antes de instalar as dependências, qualquer mudança num `.py` invalida o cache do `uv sync` e reinstala tudo — potencialmente minutos extras em cada build.

---

## Migrando de pip + requirements.txt para uv

Se você tem um projeto existente com `requirements.txt`:

```bash
# 1. Inicializa o pyproject.toml no projeto existente
uv init --no-workspace

# 2. Importa as dependências do requirements.txt
uv add $(cat requirements.txt | grep -v '^#' | tr '\n' ' ')

# Ou se o requirements.txt já tem versões travadas, adiciona manualmente
# os pacotes sem versão ao pyproject.toml e deixa o uv resolver
```

Se você tem `requirements.txt` e `requirements-dev.txt`:

```bash
# Dependências de produção
uv add $(cat requirements.txt | grep -v '^#' | tr '\n' ' ')

# Dependências de dev
uv add --dev $(cat requirements-dev.txt | grep -v '^#' | tr '\n' ' ')
```

Depois, gere o lockfile e confirme que tudo funciona:

```bash
uv lock
uv sync
uv run pytest  # ou o que você usa para testar
```

---

## Resumo: O Que Substituir

| Antes | Com uv |
|-------|--------|
| `python -m venv .venv && source .venv/bin/activate` | `uv sync` (cria e sincroniza automaticamente) |
| `pip install pacote` | `uv add pacote` |
| `pip install -r requirements.txt` | `uv sync` |
| `pip freeze > requirements.txt` | `uv lock` (gera `uv.lock`) |
| `pip-compile requirements.in` | `uv pip compile requirements.in` |
| `pyenv install 3.12` | `uv python install 3.12` |
| `pipx run ferramenta` | `uvx ferramenta` |
| `pipx install ferramenta` | `uv tool install ferramenta` |
| `python script.py` (no venv ativo) | `uv run script.py` |

Uma ferramenta. Um lockfile. Sem ativação manual de venv. Muito mais rápido.
