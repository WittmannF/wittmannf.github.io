---
title: 'Guia Definitivo: Todos os Arquivos de Configuração do Claude Code'
description: 'CLAUDE.md, CLAUDE.local.md, rules, skills, agents, hooks, memória, settings — o Claude Code tem dezenas de arquivos de configuração. Este guia explica cada um, onde colocar, quando usar e como se relacionam entre si.'
pubDate: 2026-04-13
tags: ['Claude Code', 'AI', 'Developer Tools', 'Configuration', 'Workflow']
lang: 'pt'
---

Você começa a usar o Claude Code, cria um `CLAUDE.md`, e tudo funciona. Aí descobre que existe `CLAUDE.local.md`. Depois `.claude/rules/`. Depois `settings.json`. Depois memórias automáticas. Depois skills, agents, hooks...

De repente, tem uma dúzia de arquivos markdown e JSON que influenciam o comportamento do Claude — e nenhuma clareza sobre o que vai onde.

Este guia resolve isso. Vamos cobrir **todos** os arquivos de configuração que o Claude Code suporta, explicar o propósito de cada um, e dar regras claras de quando usar cada opção.

---

## A Visão Geral

Antes de mergulhar nos detalhes, aqui está o mapa completo de tudo que existe:

```
# Nível do sistema (gerenciado por IT/organização)
/Library/Application Support/ClaudeCode/    # macOS
/etc/claude-code/                           # Linux
  managed-settings.json
  CLAUDE.md

# Nível do usuário (pessoal, todos os projetos)
~/.claude/
  CLAUDE.md              # Instruções globais pessoais
  settings.json          # Configurações globais
  rules/*.md             # Regras pessoais
  skills/*/SKILL.md      # Skills pessoais
  agents/*.md            # Agents pessoais
  commands/*.md          # Comandos (legado)
  projects/*/memory/     # Memória automática por projeto
    MEMORY.md
    *.md

~/.claude.json           # Estado do app, MCP servers pessoais

# Nível do projeto (compartilhado com o time)
<projeto>/
  CLAUDE.md              # Instruções do projeto
  CLAUDE.local.md        # Instruções pessoais do projeto (gitignored)
  .mcp.json              # MCP servers do projeto
  .worktreeinclude       # Arquivos gitignored para worktrees
  .claude/
    CLAUDE.md            # Alternativa ao CLAUDE.md na raiz
    settings.json        # Configurações do projeto (compartilhado)
    settings.local.json  # Configurações locais (gitignored)
    rules/*.md           # Regras do projeto
    skills/*/SKILL.md    # Skills do projeto
    agents/*.md          # Agents do projeto
    commands/*.md        # Comandos (legado)
```

Parece muito? É porque existem duas dimensões ortogonais:

1. **Tipo de arquivo** — o que ele faz (instruções, configuração, automação, extensão)
2. **Escopo** — a quem se aplica (organização, usuário, projeto, local)

Vamos entender cada dimensão — mas antes, vale ver como tudo se encaixa no que o Claude realmente recebe.

---

## Como o Claude Code Monta o Contexto

Antes de detalhar cada arquivo, é útil entender **a estrutura completa do que chega ao modelo**. Essa visão vem da engenharia reversa do código-fonte do Claude Code: em março de 2026, descobriu-se que releases no npm incluíam source maps com o código TypeScript completo. Isso resultou em dois projetos de referência:

- **[OpenClaude](https://github.com/Gitlawb/openclaude)** — fork open-source do Claude Code construído a partir do código vazado, com suporte a múltiplos providers (OpenAI, Gemini, Ollama, etc.)
- **[Claude Code From Source](https://claude-code-from-source.com/)** — livro técnico em 18 capítulos analisando cada parte do código ([GitHub](https://github.com/alejandrobalderas/claude-code-from-source/tree/main/book))

### A Arquitetura do System Prompt

De acordo com o [Capítulo 4 (API Layer)](https://github.com/alejandrobalderas/claude-code-from-source/blob/main/book/ch04-api-layer.md), o system prompt é construído em **duas grandes seções**, separadas por um marcador interno. A razão é econômica: a API da Anthropic oferece cache de prompts — prefixos idênticos entre requisições são reutilizados no servidor, economizando latência e custo.

```
┌──────────────────────────────────────────────────────────────┐
│  SEÇÃO ESTÁTICA  (cache global — idêntica para todos os      │
│                   usuários do Claude Code no mundo)          │
│                                                              │
│  1. Identidade e introdução do Claude                        │
│  2. Regras de comportamento do sistema                       │
│  3. Instruções de execução de tarefas                        │
│  4. Orientações de ações e cautela                           │
│  5. Instruções de uso de ferramentas                         │
│  6. Tom e estilo                                             │
│  7. Eficiência de output                                     │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│        === DYNAMIC BOUNDARY ===                              │
├──────────────────────────────────────────────────────────────┤
│  SEÇÃO DINÂMICA  (cache por sessão — específica do usuário)  │
│                                                              │
│  8. Orientações de sessão                                    │
│  9. Instruções: arquivos CLAUDE.md (na ordem abaixo)        │
│ 10. Informações de ambiente (data, OS, modelo, session ID)   │
│ 11. Preferência de idioma                                    │
│ 12. Instruções MCP (quando há servidores configurados)       │
│ 13. Estilo de output                                         │
│                                                              │
│  + MEMORY.md (sempre presente, primeiras 200 linhas)         │
│  + Até 5 arquivos de memória (selecionados por sub-query)    │
└──────────────────────────────────────────────────────────────┘
```

Tudo **antes** do boundary é idêntico para todos os usuários — compartilha um cache global no servidor. Tudo **depois** é específico da sua sessão. Qualquer condição dinâmica colocada antes do boundary multiplica as variações no cache (problema 2^N), por isso o código-fonte usa um padrão de nomenclatura explícito: seções que quebram o cache são nomeadas `DANGEROUS_uncachedSystemPromptSection`.

### Onde Cada Arquivo Se Encaixa

**Arquivos CLAUDE.md** — todos vão para o item 9 da seção dinâmica, concatenados nesta ordem:

| Ordem | Arquivo | Quando |
|---|---|---|
| 1 | Managed `CLAUDE.md` | Sempre |
| 2 | `~/.claude/CLAUDE.md` | Sempre |
| 3 | `CLAUDE.md` de diretórios pai | Sempre |
| 4 | `./CLAUDE.md` / `.claude/CLAUDE.md` | Sempre |
| 5 | `./CLAUDE.local.md` | Sempre |

**Demais arquivos:**

| Arquivo | Onde aparece | Quando |
|---|---|---|
| `MEMORY.md` (índice) | Seção dinâmica | Sempre (máx. 200 linhas / 25KB) |
| Arquivos de memória (tópicos) | Seção dinâmica | Sob demanda (até 5 por turno) |
| Rules sem `paths:` | Seção dinâmica | Sempre |
| Rules com `paths:` | Injetadas na conversa | Quando o Claude acessa arquivos com match |
| Skills (frontmatter) | Seção dinâmica | Sempre (descrições no menu) |
| Skills (conteúdo completo) | Injetado na conversa | Quando invocado |
| Hooks | Não aparecem no prompt | Executam código externo nos eventos |
| Settings | Não aparecem no prompt | Controlam permissões e comportamento |
| MCP servers | Seção dinâmica, item 12 | Quando há servidores configurados |

### A Seleção de Memórias por LLM

De acordo com o [Capítulo 11 (Memory)](https://github.com/alejandrobalderas/claude-code-from-source/blob/main/book/ch11-memory.md), a seleção de quais arquivos de memória carregar **não é por keywords nem embeddings** — é feita por um modelo Sonnet em uma side-query paralela:

1. Usuário envia um prompt
2. Uma **side-query async** dispara em paralelo com o modelo principal
3. O sistema lê o frontmatter de todos os `.md` de memória (máx. 30 linhas cada)
4. Formata um manifesto com tipo, nome, data e descrição de cada arquivo
5. **Sonnet** recebe o manifesto + o prompt do usuário
6. Sonnet retorna até **5 nomes de arquivo** via JSON estruturado
7. Os arquivos selecionados são lidos por completo e injetados no contexto, com aviso de staleness se antigos

O `MEMORY.md` (índice) é sempre carregado. O conteúdo completo dos tópicos é selecionado por relevância. Arquivos com mais de 1 dia recebem um aviso automático — "essa memória tem X dias, verifique se ainda está válida" — porque modelos raciocinam melhor com "47 dias atrás" do que com um timestamp ISO.

### Implicações Práticas

Entendendo essa estrutura, algumas decisões de configuração ficam mais claras:

1. **CLAUDE.md longo = tokens desperdiçados em toda sessão.** O arquivo inteiro vai para o item 9 da seção dinâmica em cada conversa. Use rules com `paths:` para carregar instruções só quando relevantes.

2. **MCP quebra o cache global.** Quando você configura MCP servers, o item 12 injeta definições de ferramentas específicas — isso impede o caching global do system prompt.

3. **Rules sem `paths:` = sempre no prompt.** Elas ficam na seção dinâmica assim como os CLAUDE.md — só as rules com `paths:` são carregadas condicionalmente.

4. **Skills têm carregamento em duas fases.** O frontmatter (nome, descrição) entra no system prompt para o Claude saber que existem. O conteúdo completo só é injetado quando a skill é invocada.

5. **O `MEMORY.md` tem limite duro.** 200 linhas ou 25KB — o que vier primeiro. Acima disso, o sistema injeta um aviso pedindo para condensar.

Com esse mapa mental, as seções a seguir vão fazer mais sentido — cada arquivo tem um lugar preciso nessa estrutura.

---

## Parte 1: Os Arquivos de Instrução (Markdowns)

Estes são os arquivos que dizem ao Claude **como se comportar**. São todos markdown, carregados no contexto da conversa, e influenciam diretamente as respostas do Claude.

### CLAUDE.md — Instruções do Projeto

| Propriedade | Valor |
|---|---|
| **Caminho** | `./CLAUDE.md` ou `./.claude/CLAUDE.md` |
| **Escopo** | Projeto (todo o time) |
| **Git** | Sim, commitado |
| **Carregamento** | Início de toda sessão |
| **Contexto** | Sempre presente na janela de contexto |

Este é o arquivo mais importante. Ele define as regras do projeto — convenções de código, comandos de build, arquitetura, o que o Claude deve ou não fazer.

**Exemplo:**

```markdown
# Projeto Newsletter App

## Stack
- Backend: FastAPI + Python 3.12
- Frontend: Next.js 15
- DB: PostgreSQL via SQLAlchemy

## Comandos
- Testes: `uv run pytest`
- Lint: `uv run ruff check .`
- Dev server: `uv run uvicorn app.main:app --reload`

## Convenções
- Sempre use type hints em Python
- Endpoints devem retornar Pydantic models
- Testes ficam em tests/ espelhando a estrutura de src/
```

**Dicas:**
- Mantenha **abaixo de 200 linhas** — arquivos longos reduzem a aderência do Claude
- Use a sintaxe `@caminho/arquivo` para importar outros arquivos (resolve relativo ao CLAUDE.md)
- Imports são recursivos (máximo 5 níveis)
- Comentários HTML (`<!-- nota -->`) são removidos antes da injeção no contexto
- Pode colocar em `.claude/CLAUDE.md` para manter a raiz do projeto limpa

**Descoberta hierárquica:**
O Claude busca `CLAUDE.md` em todos os diretórios pai até a raiz. Em um monorepo, isso permite instruções em camadas:

```
monorepo/
  CLAUDE.md              # Regras gerais do monorepo
  packages/
    api/
      CLAUDE.md          # Regras específicas da API
    frontend/
      CLAUDE.md          # Regras específicas do frontend
```

Os CLAUDE.md de subdiretórios são carregados **sob demanda** — apenas quando o Claude lê arquivos naquele diretório.

---

### CLAUDE.local.md — Instruções Pessoais do Projeto

| Propriedade | Valor |
|---|---|
| **Caminho** | `./CLAUDE.local.md` |
| **Escopo** | Pessoal (apenas você, neste projeto) |
| **Git** | Não (automaticamente no .gitignore) |
| **Carregamento** | Início de toda sessão, após CLAUDE.md |
| **Precedência** | Maior que CLAUDE.md quando há conflito |

Use para preferências pessoais que só se aplicam a este projeto.

**Exemplo:**

```markdown
# Preferências Locais

- Meu ambiente de staging: https://staging-fernando.example.com
- Sempre rodar testes com -v (verbose)
- Eu prefiro usar docker compose ao invés de rodar localmente
```

**Quando usar:**
- URLs de sandbox pessoais
- Caminhos de máquina específicos
- Preferências de teste pessoais
- Qualquer instrução que não faz sentido para o time

---

### ~/.claude/CLAUDE.md — Instruções Globais Pessoais

| Propriedade | Valor |
|---|---|
| **Caminho** | `~/.claude/CLAUDE.md` |
| **Escopo** | Pessoal (todos os seus projetos) |
| **Git** | N/A (não está em nenhum repo) |
| **Carregamento** | Início de toda sessão, em todo projeto |
| **Precedência** | Menor que instruções do projeto |

Este é o seu perfil global. Regras que valem para **qualquer** projeto.

**Exemplo:**

```markdown
# Python Environment
- Always use `uv` for Python package management
- Always use `.venv` for virtual environments
- Install packages with `uv pip install`, never `pip install`

# Git
- Commit messages in English
- Use conventional commits (feat:, fix:, etc.)

# Style
- Respostas curtas e diretas
- Sem emojis
```

**Dica:** Mantenha curto. Este arquivo é carregado em **toda** sessão de **todo** projeto. Cada linha consome tokens.

---

### Resumo: Qual CLAUDE.md Usar?

| Pergunta | Arquivo |
|---|---|
| Regra vale para todo o time neste projeto? | `CLAUDE.md` (raiz) |
| Regra é só minha, mas específica deste projeto? | `CLAUDE.local.md` |
| Regra é minha e vale para qualquer projeto? | `~/.claude/CLAUDE.md` |
| Regra é da organização inteira? | Managed `CLAUDE.md` |

Ordem de carregamento (todos são concatenados, não substituídos):

1. Managed CLAUDE.md (organização)
2. `~/.claude/CLAUDE.md` (usuário global)
3. CLAUDE.md dos diretórios pai (monorepo)
4. `./CLAUDE.md` ou `./.claude/CLAUDE.md` (projeto)
5. `./CLAUDE.local.md` (pessoal do projeto)

---

## Parte 2: Rules — Instruções Condicionais

### .claude/rules/*.md

| Propriedade | Valor |
|---|---|
| **Caminho** | `.claude/rules/*.md` |
| **Escopo** | Projeto (time) ou pessoal (`~/.claude/rules/`) |
| **Git** | Sim (projeto) / N/A (pessoal) |
| **Carregamento** | Condicional (com `paths:`) ou sempre (sem `paths:`) |

Rules resolvem um problema específico: o CLAUDE.md fica grande demais. Em vez de um arquivo monolítico de 500 linhas, você divide em arquivos temáticos — que podem ser carregados **sempre** ou **apenas quando relevantes**, dependendo se possuem o campo `paths:` no frontmatter.

**Regra incondicional** (sempre carregada):

```markdown
# .claude/rules/code-quality.md

- Todo código novo precisa de testes
- Funções públicas precisam de docstrings
- Máximo 50 linhas por função
```

**Regra condicional** (carregada só quando o Claude trabalha com arquivos que batem no glob):

```markdown
---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
---

# Regras de Testes

- Use `describe` para agrupar por funcionalidade
- Nomes de teste: "should [esperado] when [condição]"
- Mock dependências externas, nunca módulos internos
- Prefira `toEqual` sobre `toBe` para objetos
```

```markdown
---
paths:
  - "src/api/**/*.py"
  - "src/routes/**/*.py"
---

# Regras de API

- Todo endpoint deve ter validação de input via Pydantic
- Retornar 422 para erros de validação, nunca 400
- Sempre incluir paginação em endpoints que retornam listas
```

**Quando usar rules vs CLAUDE.md:**

| Situação | Escolha |
|---|---|
| Regra se aplica a todos os arquivos, sempre | CLAUDE.md |
| Regra se aplica a um tipo de arquivo específico | `.claude/rules/` com `paths:` |
| CLAUDE.md passou de 200 linhas | Migrar tópicos para `.claude/rules/` |
| Regra pessoal específica a certos arquivos | `~/.claude/rules/` com `paths:` |

**Suporte a symlinks:** Você pode criar symlinks em `.claude/rules/` apontando para diretórios compartilhados, útil para regras comuns entre projetos.

---

## Parte 3: Settings — Configuração Técnica

Settings controlam **permissões, automações e comportamento técnico** do Claude Code. São JSON, não markdown.

### .claude/settings.json — Configuração do Projeto

| Propriedade | Valor |
|---|---|
| **Caminho** | `.claude/settings.json` |
| **Escopo** | Projeto (time) |
| **Git** | Sim |
| **Formato** | JSON |

```json
{
  "permissions": {
    "allow": [
      "Bash(npm test *)",
      "Bash(npm run *)",
      "Read",
      "Glob",
      "Grep"
    ],
    "deny": [
      "Bash(rm -rf *)"
    ]
  },
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "npx prettier --write $CLAUDE_FILE_PATH"
      }]
    }]
  },
  "model": "claude-opus-4-6"
}
```

### .claude/settings.local.json — Configuração Local

| Propriedade | Valor |
|---|---|
| **Caminho** | `.claude/settings.local.json` |
| **Escopo** | Pessoal (este projeto) |
| **Git** | Não (gitignored) |

Mesmo formato de `settings.json`, mas para overrides pessoais.

### ~/.claude/settings.json — Configuração Global

| Propriedade | Valor |
|---|---|
| **Caminho** | `~/.claude/settings.json` |
| **Escopo** | Pessoal (todos os projetos) |

Preferências que valem em qualquer projeto: permissões padrão, modelo preferido, hooks globais.

### Precedência de Settings

Do mais forte ao mais fraco:

1. **Managed settings** (organização — não pode ser sobrescrito)
2. **CLI arguments** (`--model`, `--permission-mode`)
3. **settings.local.json** (pessoal do projeto)
4. **settings.json** (projeto compartilhado)
5. **~/.claude/settings.json** (pessoal global)

**Regra de merge:** Arrays (como `permissions.allow`) são **combinados** entre escopos. Valores escalares usam o mais específico.

---

## Parte 4: Memória Automática

### ~/.claude/projects/*/memory/

| Propriedade | Valor |
|---|---|
| **Caminho** | `~/.claude/projects/<projeto>/memory/` |
| **Escopo** | Por projeto, pessoal |
| **Git** | N/A (fora do repo) |
| **Carregamento** | MEMORY.md no início (primeiras 200 linhas / 25KB), arquivos de tópico sob demanda |
| **Quem escreve** | Claude automaticamente + você pode editar |

A memória automática é onde o Claude **armazena o que aprendeu** ao longo das sessões. Diferente de CLAUDE.md (que você escreve), a memória é mantida pelo Claude com base nas interações.

**Estrutura:**

```
~/.claude/projects/<projeto>/memory/
  MEMORY.md              # Índice (carregado automaticamente)
  user_preferences.md    # Arquivo de tópico
  project_context.md     # Arquivo de tópico
  feedback_testing.md    # Arquivo de tópico
```

**MEMORY.md** é um índice conciso — cada entrada uma linha com link para o arquivo de detalhes:

```markdown
- [User role](user_preferences.md) — data scientist, prefers verbose output
- [Testing approach](feedback_testing.md) — always use real DB, never mocks
```

**Arquivos de tópico** têm frontmatter:

```markdown
---
name: testing approach
description: User preference for integration tests over mocks
type: feedback
---

Integration tests must hit a real database, not mocks.

**Why:** Prior incident where mock/prod divergence masked a broken migration.
**How to apply:** When writing or suggesting tests for DB operations, always use the real test database.
```

**Tipos de memória:**
- `user` — sobre a pessoa (papel, preferências, conhecimento)
- `feedback` — correções e confirmações de abordagem
- `project` — contexto de trabalho em andamento
- `reference` — ponteiros para recursos externos

**Memória vs CLAUDE.md:**

| | CLAUDE.md | Memória |
|---|---|---|
| Quem escreve | Você | Claude (automaticamente) |
| Carregamento | Sempre, totalmente | Índice no início, detalhes sob demanda |
| Escopo | Time ou pessoal | Pessoal |
| Conteúdo | Regras, instruções | Aprendizados, contexto, preferências |
| Versionamento | Git | Fora do repo |

**Gerenciar:** Use o comando `/memory` para ver, editar ou desabilitar. Ou configure `autoMemoryEnabled: false` em settings.

---

## Parte 5: Extensões — Skills, Agents, Commands

### .claude/skills/ — Workflows Reutilizáveis

| Propriedade | Valor |
|---|---|
| **Caminho** | `.claude/skills/<nome>/SKILL.md` |
| **Escopo** | Projeto ou pessoal (`~/.claude/skills/`) |
| **Git** | Sim (projeto) |
| **Carregamento** | Duas fases: frontmatter sempre no prompt, conteúdo completo quando invocado |

Skills são o mecanismo mais poderoso de extensão. Cada skill é um diretório com um `SKILL.md` e opcionalmente arquivos de apoio (checklists, scripts, templates).

**Exemplo:**

```
.claude/skills/
  deploy/
    SKILL.md
    checklist.md
    scripts/deploy.sh
  review-pr/
    SKILL.md
```

**SKILL.md:**

```markdown
---
name: deploy
description: Deploy the application to production
allowed-tools: Bash(npm run deploy) Bash(git push)
---

Deploy $ARGUMENTS to production:

1. Run the full test suite
2. Build the application
3. Check the deployment checklist in checklist.md
4. Execute the deploy script
5. Verify health checks pass
```

**Frontmatter principais:**

| Campo | Descrição |
|---|---|
| `name` | Nome da skill (vira o `/comando`) |
| `description` | Descrição (Claude usa para decidir quando auto-invocar) |
| `allowed-tools` | Ferramentas pré-aprovadas sem pedir permissão |
| `disable-model-invocation` | `true` = só o usuário pode invocar |
| `user-invocable` | `false` = escondida do menu, só o Claude invoca |
| `model` | Modelo override |
| `context` | `fork` = roda em subagent isolado |
| `paths` | Globs para auto-ativação |

**Variáveis disponíveis:** `$ARGUMENTS`, `$0`, `$1`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}`.

**Contexto dinâmico:** Use `` !`comando` `` para injetar output de shell antes do Claude processar.

---

### .claude/agents/ — Subagentes Customizados

| Propriedade | Valor |
|---|---|
| **Caminho** | `.claude/agents/<nome>.md` |
| **Escopo** | Projeto ou pessoal (`~/.claude/agents/`) |
| **Git** | Sim (projeto) |
| **Carregamento** | Quando invocado |

Agents são especialistas isolados. Cada um tem seu próprio contexto, ferramentas permitidas, e pode usar um modelo diferente.

**Exemplo:**

```markdown
---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools: Read, Grep, Glob
model: claude-opus-4-6
---

You are a senior security engineer. Review code for:

1. Injection vulnerabilities (SQL, command, XSS)
2. Authentication/authorization bypasses
3. Data exposure risks
4. Insecure dependencies

Report findings with severity (critical/high/medium/low) and fix recommendations.
```

**Frontmatter principais:**

| Campo | Descrição |
|---|---|
| `name` | Identificador único |
| `description` | Quando o Claude deve delegar para este agent |
| `tools` | Lista de ferramentas permitidas (restringe se especificado) |
| `model` | `sonnet`, `opus`, `haiku`, ou model ID completo |
| `memory` | `user`, `project`, ou `local` — memória persistente própria |
| `maxTurns` | Limite de turnos |
| `isolation` | `worktree` para isolar em git worktree |

---

### .claude/commands/ — Comandos (Legado)

| Propriedade | Valor |
|---|---|
| **Caminho** | `.claude/commands/<nome>.md` |
| **Status** | **Depreciado** — use skills no lugar |

Commands são a versão antiga de skills. Ainda funcionam, mas se uma skill e um command têm o mesmo nome, a skill tem prioridade. Para migrar, mova o arquivo para `.claude/skills/<nome>/SKILL.md`.

---

## Parte 6: Automação — Hooks

Hooks são definidos dentro de `settings.json` (qualquer escopo). Executam ações automáticas em resposta a eventos do ciclo de vida.

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "npx prettier --write $CLAUDE_FILE_PATH"
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "echo 'Claude finished' | say"
      }]
    }]
  }
}
```

**Eventos disponíveis:**

| Evento | Quando |
|---|---|
| `SessionStart` | Sessão inicia |
| `UserPromptSubmit` | Usuário envia prompt |
| `PreToolUse` | Antes de usar uma ferramenta (pode bloquear) |
| `PostToolUse` | Depois de usar uma ferramenta |
| `Stop` | Claude termina de responder |
| `SessionEnd` | Sessão encerra |
| `FileChanged` | Arquivo monitorado muda |
| `WorktreeCreate` | Worktree criada |

**Tipos de hook:**

| Tipo | Descrição |
|---|---|
| `command` | Executa shell script |
| `http` | POST para uma URL |
| `prompt` | Avaliação LLM single-turn |
| `agent` | Subagent com acesso a ferramentas |

**Exit codes (para `command`):** `0` = permitir, `2` = bloquear ação, outro = erro não-bloqueante.

---

## Parte 7: Outros Arquivos

### .mcp.json — Servidores MCP do Projeto

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

Compartilhado com o time (commitado). Servidores MCP pessoais ficam em `~/.claude.json`.

### .worktreeinclude — Arquivos para Worktrees

Lista arquivos gitignored que devem ser copiados para novas worktrees:

```
.env
.env.local
config/secrets.json
```

### ~/.claude/keybindings.json — Atalhos de Teclado

Personalização de keybindings. Gerencie com `/keybindings`.

---

## Parte 8: Árvore de Decisão

Não sabe onde colocar algo? Use este fluxo:

**É uma instrução sobre como o Claude deve se comportar?**
- Sim → É para todo o time? → `CLAUDE.md`
- Sim → É pessoal, neste projeto? → `CLAUDE.local.md`
- Sim → É pessoal, em todos os projetos? → `~/.claude/CLAUDE.md`
- Sim → Só se aplica a certos arquivos? → `.claude/rules/*.md` com `paths:`

**É configuração técnica (permissões, modelo, variáveis)?**
- Para o time → `.claude/settings.json`
- Pessoal neste projeto → `.claude/settings.local.json`
- Pessoal em todos os projetos → `~/.claude/settings.json`

**É um workflow reutilizável (deploy, review, etc.)?**
- → `.claude/skills/*/SKILL.md`

**É um especialista isolado (reviewer, researcher)?**
- → `.claude/agents/*.md`

**É automação que roda em resposta a eventos?**
- → `hooks` dentro de `settings.json`

**É algo que o Claude aprendeu sobre você ou o projeto?**
- → Memória automática (gerenciada pelo Claude, editável por você)

---

## Resumo Final

| Arquivo | Propósito | Escopo | Git | Carregamento |
|---|---|---|---|---|
| `CLAUDE.md` | Instruções do projeto | Time | Sim | Sempre |
| `CLAUDE.local.md` | Instruções pessoais do projeto | Pessoal | Não | Sempre |
| `~/.claude/CLAUDE.md` | Instruções pessoais globais | Pessoal | N/A | Sempre |
| `.claude/rules/*.md` | Instruções temáticas | Time/Pessoal | Sim/N/A | Sem `paths:` = sempre; com `paths:` = condicional |
| `.claude/settings.json` | Permissões, hooks, modelo | Time | Sim | Sempre |
| `.claude/settings.local.json` | Override pessoal de settings | Pessoal | Não | Sempre |
| `~/.claude/settings.json` | Settings globais pessoais | Pessoal | N/A | Sempre |
| `~/.claude/projects/*/memory/` | Memória aprendida | Pessoal | N/A | Sob demanda |
| `.claude/skills/*/SKILL.md` | Workflows reutilizáveis | Time/Pessoal | Sim/N/A | Frontmatter sempre; conteúdo sob demanda |
| `.claude/agents/*.md` | Subagentes especializados | Time/Pessoal | Sim/N/A | Sob demanda |
| `.claude/commands/*.md` | Comandos (legado) | Time/Pessoal | Sim/N/A | Sob demanda |
| `hooks` (em settings) | Automação por eventos | Time/Pessoal | Depende | Por evento |
| `.mcp.json` | Servidores MCP | Time | Sim | Sempre |
| `.worktreeinclude` | Arquivos para worktrees | Time | Sim | Na criação |

O sistema é extenso, mas a lógica é consistente: **escopo** (time vs pessoal vs global) cruzado com **tipo** (instrução vs configuração vs extensão vs automação). Entendendo essas duas dimensões, qualquer novo arquivo que a Anthropic adicione vai se encaixar naturalmente no modelo mental.

---

## Referências

- **Documentação oficial do Claude Code** — [code.claude.com/docs](https://code.claude.com/docs)
- **Claude Code From Source** — Livro técnico em 18 capítulos baseado na engenharia reversa do código-fonte. [Site](https://claude-code-from-source.com/) | [GitHub](https://github.com/alejandrobalderas/claude-code-from-source/tree/main/book). Capítulos mais relevantes para este guia:
  - [Cap. 4: API Layer](https://github.com/alejandrobalderas/claude-code-from-source/blob/main/book/ch04-api-layer.md) — construção do system prompt, cache, dynamic boundary
  - [Cap. 11: Memory](https://github.com/alejandrobalderas/claude-code-from-source/blob/main/book/ch11-memory.md) — sistema de memória, seleção por Sonnet, staleness
  - [Cap. 12: Extensibility](https://github.com/alejandrobalderas/claude-code-from-source/blob/main/book/ch12-extensibility.md) — skills, hooks, snapshot de segurança
- **OpenClaude** — Fork open-source do Claude Code com suporte a múltiplos providers. [GitHub](https://github.com/Gitlawb/openclaude)
