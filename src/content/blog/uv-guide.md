---
title: 'uv: The Python Package Manager That Will Change Your Workflow'
description: 'A practical, complete guide to uv — the modern replacement for pip, venv, pyenv, and pip-tools. From zero to production, with the shortcuts you will use every day.'
pubDate: 2026-04-22
tags: ['Python', 'uv', 'DevOps', 'Tools']
lang: 'en'
---

You run `pip install pandas` and wait 45 seconds. You create a `venv` by hand with three commands. You maintain a `requirements.txt` that does not pin transitive dependencies. You use `pyenv` to install the right Python, `pip-tools` to generate lockfiles, `virtualenv` for environments.

Five tools. To do one thing.

**`uv` does all of this — in a single binary, written in Rust, 10 to 100 times faster than pip.**

This guide goes from the absolute basics ("what is this?") to the shortcuts you will use every day — including Docker integration, Python version management, and scripts with inline dependencies.

---

## What Is uv (and Why You Should Care)

`uv` is a Python package and project manager created by [Astral](https://astral.sh) — the same company behind `ruff`, the fastest Python linter on the market.

The pitch is simple: replace `pip`, `pip-tools`, `pipx`, `venv`, `virtualenv`, and `pyenv` with a single, consistent tool that is dramatically faster.

**In practice:**

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

That is not an exaggeration. uv uses aggressive caching, parallel dependency resolution, and avoids re-downloads. An install that takes pip 45 seconds, uv does in 1.

---

## Installation

```bash
# Mac / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Mac via Homebrew
brew install uv

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Confirm the installation:

```bash
uv --version
# uv 0.7.x
```

---

## The Starting Point: Two Usage Modes

uv has two main modes of operation, and it is important to understand the difference before you start:

| Mode | When to use | Main commands |
|------|-------------|---------------|
| **Project mode** | Applications, packages, projects with `pyproject.toml` | `uv init`, `uv add`, `uv sync`, `uv run` |
| **pip mode** | Standalone scripts, direct pip replacement | `uv pip install`, `uv pip freeze` |

If you are starting a new project or adopting uv in an existing one → **project mode**.

If you just want to replace `pip install` on the fly → **pip mode**.

We will cover both.

---

## Problem 1: "I Want to Start a New Project Without the Busywork"

With pip, you do it by hand: create the folder, the venv, activate it, install packages, create `pyproject.toml` or `setup.py`.

### Solution: `uv init`

```bash
uv init meu-projeto
cd meu-projeto
```

This creates the minimal structure:

```
meu-projeto/
├── .python-version   # versão do Python fixada para o projeto
├── pyproject.toml    # manifesto do projeto
├── README.md
└── hello.py          # arquivo de exemplo
```

The generated `pyproject.toml`:

```toml
[project]
name = "meu-projeto"
version = "0.1.0"
description = "Add your description here"
requires-python = ">=3.13"
dependencies = []
```

The venv does not exist yet — uv creates it on demand when you add dependencies or run something.

**Useful variations:**

```bash
# Projeto com app (adiciona [project.scripts])
uv init --app meu-app

# Pacote Python publicável (adiciona estrutura de src/)
uv init --lib minha-lib

# Script único (sem pyproject.toml, dependências inline)
uv init --script analise.py
```

---

## Problem 2: "I Need a Specific Python Version That I Do Not Have Installed"

Normally you would install pyenv, configure your shell, download the version. With uv:

### Solution: `uv python`

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

uv downloads precompiled Python binaries — no compilation, no system dependencies. Fast and clean.

To create a project with a specific version from the start:

```bash
uv init --python 3.12 meu-projeto
```

---

## Problem 3: "I Want to Add Dependencies Without Manually Activating a venv"

With pip, the flow is: `source .venv/bin/activate`, `pip install X`, update `requirements.txt` by hand.

### Solution: `uv add`

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

`uv add` does three things automatically:
1. Creates the `.venv` if it does not exist
2. Installs the package
3. Updates `pyproject.toml` and `uv.lock`

The `pyproject.toml` after `uv add fastapi uvicorn`:

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

To remove:

```bash
uv remove fastapi
```

---

## Problem 4: "I Want to Run Code Without Manually Activating the venv"

With pip, you always have to remember to activate the venv before running anything.

### Solution: `uv run`

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

`uv run` detects the project automatically (looks for `pyproject.toml` in the current directory and parent directories), activates the venv internally, and runs the command. You never need `source .venv/bin/activate` again.

**Direct shortcut for scripts:**

```bash
# Em vez de:
source .venv/bin/activate
python meu_script.py

# Apenas:
uv run meu_script.py
```

---

## Problem 5: "A Colleague Installed Different Versions Than Mine and the Code Breaks"

`requirements.txt` declares `fastapi>=0.100` but does not pin transitive dependencies. On one dev's machine it installs `starlette 0.41`, on another `starlette 0.43`. Different behavior. Hard to debug.

### Solution: `uv lock` + `uv sync --frozen`

`uv lock` generates (or updates) `uv.lock` — a file that pins the **exact** versions of all dependencies, including transitive ones:

```bash
uv lock
```

Result: a `uv.lock` with hundreds of lines like:

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

To install **exactly** what is in the lockfile (what another dev, CI, or container should do):

```bash
uv sync --frozen
```

**Recommended workflow:**

```bash
# Dev A: adiciona dependência, atualiza lock, comita ambos
uv add requests
git add pyproject.toml uv.lock
git commit -m "add requests"

# Dev B: puxa as mudanças, sincroniza o ambiente
git pull
uv sync  # instala exatamente o que está no lock
```

**`uv sync` variations:**

```bash
uv sync                  # sincroniza tudo
uv sync --frozen         # usa o lock sem tentar atualizar
uv sync --no-dev         # ignora dependências de desenvolvimento
uv sync --group gpu      # inclui grupo opcional "gpu"
uv sync --all-extras     # inclui todos os extras/opcionais
```

---

## Problem 6: "I Need to Replace pip in an Existing Project (Without pyproject.toml)"

You have a legacy project with `requirements.txt` and do not want to refactor everything right now.

### Solution: `uv pip` — drop-in replacement for pip

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

The interface is identical to pip — just replace `pip` with `uv pip`. Speed is the difference.

**Generate a lockfile from requirements.txt:**

```bash
# Compila um requirements.txt com versões travadas (equivalente ao pip-compile)
uv pip compile requirements.in -o requirements.txt
```

---

## Problem 7: "I Want to Run a CLI Tool Without Installing It Globally"

You need to run `black`, `ruff`, `httpie`, `twine` — but you do not want to install them in your global Python or create a venv just for that.

### Solution: `uvx` (standalone tool)

```bash
# Roda diretamente sem instalar
uvx ruff check .
uvx black meu_script.py
uvx httpie GET https://api.exemplo.com

# Equivalente mais explícito
uv tool run ruff check .
```

`uvx` downloads the tool, runs it, and does not pollute any environment. It uses cache, so the second time is instant.

To install permanently (available globally, like `pipx install`):

```bash
uv tool install ruff
uv tool install black

# Lista ferramentas instaladas
uv tool list

# Atualiza todas
uv tool upgrade --all
```

---

## Problem 8: "I Have a Python Script That Needs Dependencies — But I Do Not Want to Create a Project"

An analysis script, an automation, a utility you want to share as a single file.

### Solution: inline dependencies in the script

uv supports the PEP 723 standard — dependencies declared inside the script itself:

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

To run:

```bash
uv run analise.py
```

uv installs the dependencies in a temporary isolated environment, runs the script, and you are done. No `pyproject.toml`, no manual venv. Share the `.py` and anyone can run it with `uv run`.

To add dependencies to the script from the CLI:

```bash
uv add --script analise.py pandas matplotlib
```

---

## Quick Reference: The Most Used Commands

### Starting a project

```bash
uv init nome-do-projeto          # cria projeto novo
uv init --app nome-do-projeto    # projeto com entrypoint
uv init --lib nome-do-projeto    # biblioteca publicável
```

### Managing dependencies

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

### Running code

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

### Global tools

```bash
uvx ferramenta                   # roda sem instalar
uv tool install ferramenta       # instala globalmente
uv tool list                     # lista instaladas
uv tool upgrade --all            # atualiza todas
```

### pip mode (legacy projects)

```bash
uv venv .venv                    # cria venv
uv pip install -r requirements.txt
uv pip install pacote
uv pip list
uv pip freeze
uv pip compile requirements.in -o requirements.txt
```

---

## Docker Integration

The cleanest pattern for using uv in Docker is the **multi-stage build**: copy only the binary from the official uv image, without installing uv itself as a project dependency.

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

**Why this order matters:**

```
COPY pyproject.toml uv.lock ./   ← muda raramente (quando você adiciona pacotes)
RUN uv sync --frozen --no-dev    ← fica em cache enquanto os dois acima não mudarem

COPY src/ src/                   ← muda com frequência (código)
```

If you copy the code before installing dependencies, any change to a `.py` file invalidates the `uv sync` cache and reinstalls everything — potentially minutes of extra time on every build.

---

## Migrating from pip + requirements.txt to uv

If you have an existing project with `requirements.txt`:

```bash
# 1. Inicializa o pyproject.toml no projeto existente
uv init --no-workspace

# 2. Importa as dependências do requirements.txt
uv add $(cat requirements.txt | grep -v '^#' | tr '\n' ' ')

# Ou se o requirements.txt já tem versões travadas, adiciona manualmente
# os pacotes sem versão ao pyproject.toml e deixa o uv resolver
```

If you have `requirements.txt` and `requirements-dev.txt`:

```bash
# Dependências de produção
uv add $(cat requirements.txt | grep -v '^#' | tr '\n' ' ')

# Dependências de dev
uv add --dev $(cat requirements-dev.txt | grep -v '^#' | tr '\n' ' ')
```

Then generate the lockfile and confirm everything works:

```bash
uv lock
uv sync
uv run pytest  # ou o que você usa para testar
```

---

## Summary: What to Replace

| Before | With uv |
|--------|---------|
| `python -m venv .venv && source .venv/bin/activate` | `uv sync` (creates and syncs automatically) |
| `pip install pacote` | `uv add pacote` |
| `pip install -r requirements.txt` | `uv sync` |
| `pip freeze > requirements.txt` | `uv lock` (generates `uv.lock`) |
| `pip-compile requirements.in` | `uv pip compile requirements.in` |
| `pyenv install 3.12` | `uv python install 3.12` |
| `pipx run ferramenta` | `uvx ferramenta` |
| `pipx install ferramenta` | `uv tool install ferramenta` |
| `python script.py` (with active venv) | `uv run script.py` |

One tool. One lockfile. No manual venv activation. Much faster.
