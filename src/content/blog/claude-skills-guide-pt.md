---
title: 'Skills do Claude Code: O Guia Completo do Básico ao Avançado'
description: 'Skills são o mecanismo de extensão mais poderoso do Claude Code. Este guia cobre tudo — estrutura de pastas, frontmatter, argumentos, injeção dinâmica de contexto, modos de invocação, agentes e boas práticas — com exemplos reais para copiar e adaptar.'
pubDate: 2026-06-16
tags: ['Claude Code', 'IA', 'Ferramentas de Desenvolvimento', 'Workflow', 'Automação']
lang: 'pt'
---

> **Prefere um formato visual e interativo?** Este artigo tem uma [versão interativa](/guides/claude-skills) com explorador de frontmatter clicável, demos ao vivo de argumentos, tutoriais passo a passo e um checklist de produção.

O Claude Code começa cada sessão do zero. Sem skills, você repete as mesmas instruções indefinidamente — re-explicando seu pipeline de deploy, seus padrões de code review, suas convenções de SQL, seu estilo de commit. As skills resolvem isso: você escreve essas instruções uma vez, em um arquivo, e as invoca de forma confiável.

Este guia cobre tudo, da sua primeira skill de três linhas a padrões avançados: layouts multi-arquivo, auto-invocação, injeção de shell, subagentes isolados e agentes customizados.

---

## O que são Skills?

Skills são workflows reutilizáveis — arquivos markdown que o Claude carrega quando você invoca um slash command ou quando o contexto da conversa corresponde a uma frase de gatilho. Elas podem conter instruções, procedimentos passo a passo, comandos shell para executar, templates e referências a outros arquivos.

Uma skill mínima tem esta aparência:

```markdown
---
name: saudar
description: Cumprimentar o usuário de forma calorosa
---

Cumprimente o usuário. Se $ARGUMENTS contiver um nome, use-o.
Caso contrário, use "amigo" como fallback. Mantenha em uma frase.
```

Coloque isso em `.claude/skills/saudar/SKILL.md` e você tem o comando `/saudar`. Esse é o mecanismo completo — tudo o mais é detalhe.

---

## Onde as Skills Vivem

Skills podem existir em três lugares. A localização determina quem pode usá-las:

| Local | Escopo | Git | Comando |
|---|---|---|---|
| `~/.claude/skills/<nome>/SKILL.md` | Você, todos os projetos | N/A | `/nome` |
| `.claude/skills/<nome>/SKILL.md` | Seu time, este projeto | Sim | `/nome` |
| `<plugin>/plugin/skills/<nome>/SKILL.md` | Quem instalar o plugin | Via plugin | `/plugin:nome` |

**O nome do diretório vira o nome do comando.** Uma skill em `.claude/skills/deploy-prod/SKILL.md` vira `/deploy-prod`. O campo `name:` no frontmatter é apenas um rótulo de exibição — não afeta o slash command.

Por compatibilidade, `.claude/commands/foo.md` ainda funciona e cria `/foo`. Skills têm prioridade em conflitos de nomes e desbloqueiam mais recursos.

### Arquivos de suporte

Skills podem ter arquivos de suporte junto com o SKILL.md:

```
.claude/skills/deploy/
├── SKILL.md          ← instruções (obrigatório)
├── checklist.md      ← carregado pelo Claude quando necessário
├── references/
│   └── infra.md      ← notas detalhadas de infraestrutura
└── scripts/
    └── health-check.sh
```

O Claude carrega o SKILL.md quando a skill é invocada. Ele lê os arquivos de suporte apenas quando julga necessário — isso mantém o contexto enxuto. Referencie os arquivos pelo nome no SKILL.md e o Claude os buscará conforme necessário.

---

## Referência de Frontmatter

O bloco YAML no topo do SKILL.md controla o comportamento da skill. Estes são os campos mais importantes:

### `description` ★ (o mais importante)

```yaml
---
description: |
  Fazer deploy da aplicação para staging ou produção.
  Use quando o usuário disser "deploy", "subir", "lançar",
  "publicar" ou pedir para enviar uma nova versão.
---
```

O Claude lê todas as descrições de skills no início da sessão. Quando a conversa corresponde, ele auto-invoca a skill. Escreva em terceira pessoa com frases de gatilho específicas. O limite máximo é **1.536 caracteres** combinados com `when_to_use`.

### `allowed-tools`

```yaml
---
allowed-tools: Bash(git *) Bash(npm test) Read Glob Grep
---
```

Pré-aprova ferramentas para que o Claude não peça permissão durante a skill. Use padrões específicos — `Bash(npm *)` e não `Bash(*)`. Ativo apenas enquanto a skill está em execução.

### `argument-hint`

```yaml
---
argument-hint: "[staging|production] [--dry-run]"
---
```

Exibido no autocomplete quando o usuário digita `/nome-da-skill`. Colchetes indicam opcional por convenção.

### `disable-model-invocation: true`

Impede o Claude de auto-invocar a skill — apenas o usuário pode dispará-la com `/nome-da-skill`. Use para operações destrutivas. Quando ativo, a description **não** é carregada no contexto.

### `user-invocable: false`

Esconde a skill do menu `/` mas mantém a description no contexto para que o Claude ainda possa auto-invocá-la. Use para comportamentos de fundo que você quer ativos, mas não visíveis.

### `model`

```yaml
---
model: claude-opus-4-8
---
```

Sobrescreve o modelo da sessão para esta skill. Use `claude-opus-4-8` para análises complexas, `claude-haiku-4-5-20251001` para tarefas simples de formatação.

### `context: fork`

Executa a skill em um subagente isolado sem histórico de conversa. Os resultados retornam para a conversa principal como uma mensagem. Combine com `agent: Explore` ou `agent: general-purpose` para especificar o tipo de subagente.

### `paths`

```yaml
---
paths: "**/*.test.ts,**/*.spec.ts"
---
```

Limita a auto-ativação a quando o Claude toca arquivos que correspondem aos padrões glob. Economiza tokens — a description só é injetada quando relevante.

---

## Argumentos e Variáveis

Quando o usuário executa `/deploy staging --dry-run`, estas variáveis ficam disponíveis:

| Variável | Valor |
|---|---|
| `$ARGUMENTS` | `staging --dry-run` |
| `$0` | `staging` |
| `$1` | `--dry-run` |
| `${CLAUDE_SKILL_DIR}` | Caminho absoluto para o diretório da skill |
| `${CLAUDE_SESSION_ID}` | ID da sessão atual |

**Argumentos nomeados** — declare no frontmatter para referências legíveis:

```yaml
---
arguments: [componente, de, para]
argument-hint: "<componente> <framework-origem> <framework-destino>"
---

Migre o componente $componente de $de para $para.
```

Executar `/migrar-componente SearchBar React Vue` resulta em `$componente=SearchBar`, `$de=React`, `$para=Vue`.

Se `$ARGUMENTS` não for referenciado no corpo da skill, os argumentos são automaticamente adicionados no final como `ARGUMENTS: <valor>`.

---

## Injeção Dinâmica de Contexto

Use `` !`comando` `` para executar comandos shell antes que o Claude veja a skill. A saída é injetada como texto simples:

```markdown
---
name: revisar-pr
allowed-tools: Bash(git *) Bash(gh *) Read
---

Revise o PR atual.

## Arquivos alterados
!`git diff --name-only HEAD~1`

## Descrição do PR
!`gh pr view --json title,body --jq '.title'`

Verifique cada arquivo alterado quanto à correção, testes e convenções.
```

O Claude recebe a saída real do diff, não instruções para ir buscá-la. Esta é uma das funcionalidades mais poderosas — sua skill sempre tem dados frescos e atuais.

Blocos multi-linha cercados também funcionam:

````markdown
## Ambiente
```!
node --version
npm --version
git log --oneline -5
```
````

**Importante:** A injeção de shell executa uma vez ao carregar a skill, não a cada mensagem. Para dados verdadeiramente ao vivo dentro de uma conversa, use `allowed-tools: Bash(...)` e deixe o Claude executar os comandos explicitamente.

Organizações podem desativar a injeção de shell globalmente com `disableSkillShellExecution: true` nas configurações gerenciadas.

---

## Quatro Modos de Invocação

### 1. Comando explícito (padrão)

A skill aparece no menu `/` e só executa quando o usuário a invoca explicitamente. Ideal para workflows que nunca devem rodar automaticamente — deploys, lançamentos, operações destrutivas.

### 2. Auto-disparada

O Claude lê a description e auto-invoca a skill quando a conversa corresponde. Nenhum `/nome-da-skill` necessário. Ideal para conhecimento de fundo e padrões de código.

```yaml
---
description: |
  Ao trabalhar com queries SQL, sempre aplique padrões de
  query parametrizada para prevenir SQL injection. Auto-invocar
  quando o usuário escrever queries de banco de dados.
---
```

### 3. Condicional por arquivo

Similar à auto-disparada, mas só ativa quando o Claude toca arquivos que correspondem aos globs em `paths:`. A description é invisível ao Claude quando trabalhando em arquivos não correspondentes — ótimo para regras específicas de linguagem com custo zero quando irrelevante.

```yaml
---
description: Aplicar nossas convenções de componentes React
paths: "src/components/**/*.tsx,src/components/**/*.jsx"
---
```

### 4. Isolada (subagente em fork)

A skill executa em um subagente completamente novo sem histórico de conversa. Os resultados voltam como uma mensagem para a conversa principal. Use para buscas abrangentes, auditorias imparciais ou análises longas que sobrecarregariam o contexto principal.

```yaml
---
context: fork
agent: Explore
description: Busca profunda no código — executa isolado
---
```

---

## Exemplos Reais

### /deploy — Deploy seguro com checklist

```markdown
---
name: deploy
description: Fazer deploy da aplicação para staging ou produção.
  Use quando o usuário disser "deploy", "subir", "lançar" ou "publicar".
argument-hint: "[staging|production] [--dry-run]"
allowed-tools: Bash(npm *) Bash(git *) Bash(gh *)
---

Deploy de $0 para branch !`git branch --show-current`.
Último commit: !`git log -1 --oneline`

Passos:
1. Execute `npm test` — aborte se algum teste falhar
2. Execute `npm run build`
3. Se $0 for "production", peça confirmação final
4. Execute `npm run deploy:$0`
5. Verifique o health check na URL de destino

Flag $1: se "--dry-run", simule apenas — não faça o deploy.
```

Combine com um `checklist.md` no mesmo diretório para verificação pré-deploy.

### /auditoria-seguranca — Auditoria OWASP isolada

```markdown
---
name: auditoria-seguranca
description: Auditoria de segurança no código. Use quando o usuário
  pedir revisão de segurança, verificação de vulnerabilidades ou auditoria OWASP.
context: fork
model: claude-opus-4-8
argument-hint: "[caminho ou 'tudo']"
allowed-tools: Read Glob Grep
---

Realize uma auditoria de segurança em: $ARGUMENTS

Verifique o OWASP Top 10:
- Injeção (SQL, command, XSS)
- Controle de acesso quebrado
- Falhas criptográficas (segredos hardcoded, hashing fraco)
- Dependências inseguras

Para cada achado:
- **Severidade**: Crítica / Alta / Média / Baixa
- **Localização**: arquivo:linha
- **Problema**: o que está errado
- **Correção**: remediação concreta

Ordene por severidade. Se nada encontrado, diga claramente.
```

### /debug — Depuração estruturada

```markdown
---
name: debug
description: Depurar um bug ou comportamento inesperado. Use quando o usuário
  disser "está quebrado", "não funciona" ou colar um stack trace.
---

Depure: $ARGUMENTS

Protocolo:
1. **Reproduza** — você consegue reproduzir de forma confiável?
2. **Forme 3 hipóteses** — liste da mais para menos provável
3. **Teste a primeira** — confirme ou descarte antes de avançar
4. **Reporte** — causa raiz (confirmada), correção e por que está certa

Nunca "tente" uma correção sem antes confirmar a causa raiz.
```

---

## Agentes Customizados

Agentes são diferentes de skills — são especialistas isolados com seu próprio contexto, lista de ferramentas e modelo. O Claude delega para eles com base na description.

```markdown
---
name: revisor-seguranca
description: |
  Agente especialista em segurança. Delegue para este agente
  ao revisar código que lida com autenticação, autorização,
  entrada do usuário, queries de banco, operações de arquivo
  ou criptografia.
tools: Read Glob Grep
model: claude-opus-4-8
---

Você é um engenheiro sênior de segurança de aplicações.

Revise o código fornecido exclusivamente por problemas de segurança.
Reporte achados com severidade, localização, cenário de exploit e correção.
```

Coloque em `.claude/agents/revisor-seguranca.md`. O Claude o instancia conforme necessário.

**Skills vs agentes:**

| | Skill | Agente |
|---|---|---|
| Contexto | Compartilhado com o principal | Próprio contexto isolado |
| Ferramentas | As do Claude principal | Lista própria |
| Ideal para | Workflows reutilizáveis | Análise especializada |

---

## Boas Práticas

**Escreva descriptions como um briefing.** A description é como o Claude decide quando disparar. Inclua frases de gatilho específicas que os usuários realmente usariam. Seja concreto: "deploy", "subir para prod", "publicar" — não "operações de implantação".

**Mantenha o SKILL.md enxuto.** Skills têm um orçamento de compactação de 5.000 tokens por sessão. Arquivos monolíticos grandes são truncados. Mantenha o arquivo principal com menos de ~400 linhas e mova detalhes para diretórios `references/` ou `examples/`.

**Declare `allowed-tools`.** Cada chamada de ferramenta sem pré-aprovação dispara um diálogo de permissão. Especificar `Bash(npm run *) Read Glob` para uma skill de teste a torna fluida. Use padrões específicos — `Bash(npm run *)` e não `Bash(*)`.

**Use injeção de shell para dados ao vivo.** Skills são compartilhadas entre máquinas e membros da equipe. Não assuma a versão do Node, o gerenciador de pacotes ou a branch atual. Use `` !`...` `` para injetar o estado real.

**Proteja operações destrutivas.** Para ações irreversíveis, use `disable-model-invocation: true` e exija confirmação explícita no corpo da skill. Nunca deixe uma skill destrutiva ser auto-disparada por um gatilho vago.

**Use forma imperativa.** "Execute o conjunto de testes" é mais claro que "Você deveria executar o conjunto de testes". Economiza tokens e reduz ambiguidade.

---

## Checklist: Antes de Publicar uma Skill

**Estrutura**
- [ ] Skill está em seu próprio diretório (`.claude/skills/<nome>/SKILL.md`)
- [ ] Escopo correto escolhido: pessoal, projeto ou plugin
- [ ] Conjuntos grandes de instruções divididos em arquivos de suporte

**Frontmatter**
- [ ] `description` presente com frases de gatilho específicas
- [ ] `allowed-tools` declarado para todas as ferramentas necessárias
- [ ] `argument-hint` definido se a skill aceita argumentos
- [ ] `disable-model-invocation: true` para operações destrutivas

**Conteúdo**
- [ ] Instruções em forma imperativa
- [ ] Corpo do SKILL.md com menos de ~400 linhas
- [ ] Injeção de shell usada em vez de suposições estáticas
- [ ] `$ARGUMENTS` ou `$0/$1` usados onde necessário

**Segurança**
- [ ] Skills destrutivas exigem confirmação explícita do usuário
- [ ] `allowed-tools` usa padrões específicos, não `Bash(*)`
- [ ] Nenhum segredo hardcoded no SKILL.md

---

## Leitura Adicional

- **[Referência oficial de skills](https://code.claude.com/docs/en/skills)** — campos do frontmatter, variáveis, modos de invocação
- **[Customização do Claude Code](https://docs.anthropic.com/en/docs/claude-code/customization)** — regras, hooks, agentes, configurações
- **[Claude Code from Source](https://claude-code-from-source.com/)** — internos técnicos, capítulo 12 cobre extensibilidade
- **[Versão interativa deste guia](/guides/claude-skills)** — exemplos clicáveis e checklist ao vivo
