---
title: 'Git Worktree: Trabalhe em Múltiplos Branches ao Mesmo Tempo'
description: 'Chega de stash, troca de branch e perda de contexto. O git worktree permite fazer checkout de múltiplos branches simultaneamente, cada um no seu próprio diretório, todos compartilhando um único repositório. Este é o guia completo, passo a passo.'
pubDate: 2026-03-28
tags: ['Git', 'Ferramentas de Desenvolvimento', 'Workflow', 'Produtividade']
lang: 'pt'
---

Você está no meio de uma feature — arquivos reestruturados, refatoração pela metade, três abas do navegador abertas, modelo mental finalmente carregado — e então o Slack pinga: *produção caiu, você pode dar uma olhada?*

Você sabe o que vem a seguir. `git stash`, torça para nada se perder, troque para `main`, crie uma branch de hotfix, corrija o problema, faça merge, push, volte para a branch anterior, `git stash pop`, e então passe dez minutos lembrando onde estava.

Existe uma forma melhor. Ela está embutida no Git desde 2015. Se chama **git worktree**, e a maioria dos desenvolvedores nunca ouviu falar.

---

## O Que É Git Worktree?

Um worktree é um diretório de trabalho vinculado ao seu repositório. Você já tem um — ele foi criado quando você rodou `git init` ou `git clone`. O Git o chama de **worktree principal**.

O `git worktree` permite criar diretórios de trabalho adicionais — **worktrees vinculados** — cada um com um branch diferente em checkout, todos compartilhando o mesmo banco de dados `.git`.

```
my-project/           ← worktree principal (feature branch)
my-project-hotfix/    ← worktree vinculado (branch de hotfix)
my-project-review/    ← worktree vinculado (branch de revisão de PR)
```

Todos os três diretórios compartilham um único banco de objetos. Sem duplicação. Sem sincronização. Commits feitos em qualquer worktree ficam imediatamente visíveis nos outros.

---

## Por Que Não Usar Git Stash?

O `git stash` funciona bem para trocas de contexto rápidas, de cinco minutos. Ele falha quando:

- Você tem **arquivos não rastreados** (`git stash` os ignora por padrão)
- Você precisa **rodar um servidor ou testes** nos dois branches simultaneamente
- Você quer **manter o histórico do terminal, estado da IDE e o foco** intactos
- A interrupção se transforma em uma hora de trabalho

E `git clone` é ainda pior — duplica todo o diretório `.git`, desperdiça espaço em disco e deixa seus branches fora de sincronia.

| | `git stash` | `git clone` | `git worktree` |
|---|---|---|---|
| Uso de disco | Mínimo | Duplica o `.git` | Mínimo (BD compartilhado) |
| Arquivos não rastreados preservados | Não (por padrão) | N/A | Sim |
| Trabalhar em dois branches ao mesmo tempo | Não | Sim | Sim |
| Refs / commits compartilhados | N/A | Não (sync manual) | Sim, automático |
| Risco de perder trabalho | Médio | Baixo | Baixo |

---

## Pré-requisitos

Verifique sua versão do Git. O worktree foi adicionado no Git 2.5 (2015) e estabilizado a partir do 2.7+.

```bash
git --version
# git version 2.39.0 ✓
```

Se estiver abaixo de 2.5, atualize o Git. No macOS: `brew upgrade git`. No Ubuntu: `sudo apt update && sudo apt upgrade git`.

---

## Passo 1 — Adicione Seu Primeiro Worktree Vinculado

O comando central é `git worktree add`. Sua forma mais simples recebe um caminho e um nome de branch:

```bash
git worktree add <caminho> [<branch>]
```

Digamos que você está na branch `feature/dashboard` e precisa corrigir um bug em `main`:

```bash
git worktree add ../my-project-hotfix main
```

Isso cria um novo diretório `../my-project-hotfix` com `main` em checkout. Seu diretório atual — e sua feature branch — permanecem intocados.

Agora abra uma segunda aba do terminal, navegue até o novo diretório e trabalhe por lá:

```bash
cd ../my-project-hotfix
# corrija o bug
git commit -am "Corrige null pointer no redirecionamento de login"
git push origin main
```

Sua feature branch continua exatamente onde você a deixou no diretório original.

---

## Passo 2 — Crie um Novo Branch em um Novo Worktree

Na maioria das vezes você não vai fazer checkout de uma branch existente — vai criar uma nova. Use a flag `-b`:

```bash
git worktree add -b hotfix/login-redirect ../hotfix main
```

Desmembrando:
- `-b hotfix/login-redirect` — cria uma nova branch chamada `hotfix/login-redirect`
- `../hotfix` — o diretório a ser criado
- `main` — o commit de origem (cria a branch a partir de `main`)

Se a branch já existe e você quer forçar o reset, use `-B` (maiúsculo):

```bash
git worktree add -B hotfix/login-redirect ../hotfix main
```

---

## Passo 3 — Liste Todos os Worktrees

Veja todos os seus worktrees ativos a qualquer momento:

```bash
git worktree list
```

Exemplo de saída:

```
/Users/fernando/my-project          abc1234 [feature/dashboard]
/Users/fernando/hotfix              def5678 [hotfix/login-redirect]
/Users/fernando/review-pr-42        9abcdef [teammate/auth-refactor]
```

Para mais detalhes, use `--verbose`:

```bash
git worktree list --verbose
```

Isso mostra os worktrees bloqueados e os que podem ser removidos com prune.

---

## Passo 4 — Remova um Worktree Quando Terminar

Depois de commitar e fazer push do seu hotfix, limpe:

```bash
git worktree remove ../hotfix
```

Isso remove o diretório e limpa os arquivos administrativos em `.git/worktrees/`. O Git se recusa a remover um worktree com mudanças não commitadas — use `--force` para forçar:

```bash
git worktree remove --force ../hotfix
```

---

## Passo 5 — Remova Worktrees Obsoletos com Prune

Se você deletou manualmente um diretório de worktree com `rm -rf` em vez de usar `git worktree remove`, os arquivos administrativos em `.git/worktrees/` permanecem como entradas obsoletas. Limpe-os com:

```bash
git worktree prune
```

Para pré-visualizar o que seria removido sem remover nada:

```bash
git worktree prune --dry-run
```

O Git também faz prune automático de entradas obsoletas durante o `git gc`, controlado pela configuração `gc.worktreePruneExpire` (padrão: 3 meses).

---

## Workflows do Mundo Real

### Workflow 1: Hotfix de Emergência

O caso de uso clássico.

```bash
# Você está em feature/dashboard, no meio do trabalho
git worktree add -b hotfix/crash ../hotfix main

cd ../hotfix
# investigue, corrija o bug
git commit -am "Corrige crash no checkout com carrinho vazio"
git push origin hotfix/crash
# abra PR, aguarde merge

cd ../my-project           # de volta à sua feature, intocada
git worktree remove ../hotfix
```

Interrupção total no trabalho da sua feature: zero.

### Workflow 2: Revisando um Pull Request de um Colega

Em vez de stash, troca de branch e restauração:

```bash
git worktree add ../review-pr-42 origin/teammate/auth-refactor

cd ../review-pr-42
npm install && npm test    # rode os testes dele
# leia o código, deixe comentários

cd ../my-project
git worktree remove ../review-pr-42
```

### Workflow 3: Rodando Testes em Dois Branches Simultaneamente

Seu pipeline de CI está lento e você quer rodar os testes em `main` enquanto continua desenvolvendo:

```bash
git worktree add ../main-test main

# Terminal 1 (main-test)
cd ../main-test && npm test

# Terminal 2 (my-project)
cd ../my-project && continue coding
```

Os dois processos rodam em paralelo, de forma independente.

### Workflow 4: Respondendo Comentários de Revisão de PR

Você abriu um PR e começou uma nova tarefa. Os comentários de revisão chegam.

```bash
# Você está agora em feature/new-task
git worktree add ../pr-fixes feature/dashboard

cd ../pr-fixes
# responda os comentários de revisão
git push origin feature/dashboard

cd ../my-project
git worktree remove ../pr-fixes
```

---

## Avançado: Padrão de Repositório Bare

Para times ou power users que querem manter todos os worktrees em um único diretório organizado, um clone bare é elegante:

```bash
# Clone como repositório bare (sem diretório de trabalho, apenas os dados do .git)
git clone --bare https://github.com/you/my-project.git .bare

# Crie um arquivo .git apontando para o repositório bare (faz ferramentas como git log funcionarem)
echo "gitdir: ./.bare" > .git

# Corrija o rastreamento remoto (clones bare não configuram isso por padrão)
git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git fetch

# Adicione seus worktrees
git worktree add main main
git worktree add feature/dashboard -b feature/dashboard origin/main
```

Seu diretório agora fica assim:

```
my-project/
├── .bare/            ← o banco de dados git real
├── .git              ← arquivo: gitdir: ./.bare
├── main/             ← worktree para a branch main
└── feature/
    └── dashboard/    ← worktree para sua feature
```

Tudo em um lugar, organizado de forma limpa.

---

## Bloqueando um Worktree

Se um worktree está em um drive removível, compartilhamento de rede, ou temporariamente indisponível, você pode bloqueá-lo para evitar remoção acidental via prune:

```bash
git worktree lock --reason "no pendrive" ../hotfix
```

Para desbloquear depois:

```bash
git worktree unlock ../hotfix
```

Worktrees bloqueados aparecem em `git worktree list --verbose` com o status `locked`.

---

## Movendo um Worktree

Você pode mover um worktree vinculado para um novo local sem quebrar nada:

```bash
git worktree move ../hotfix ../new-location/hotfix
```

Se você moveu um diretório manualmente (com `mv`), os links internos do Git ficarão quebrados. Corrija-os com:

```bash
git worktree repair
```

---

## Armadilhas Comuns

**Você não pode fazer checkout do mesmo branch em dois worktrees.**

```bash
git worktree add ../duplicate main
# fatal: 'main' is already checked out at '/path/to/my-project'
```

Cada branch pode existir em exatamente um worktree por vez. Isso é intencional — dois diretórios compartilhando o mesmo índice de branch gerariam conflitos de índice.

**Suporte a submódulos é limitado.**

A documentação do Git avisa explicitamente que múltiplos worktrees para repositórios com submódulos "não é recomendado." O suporte a submódulos em worktrees ainda é experimental. Se seu projeto depende fortemente de submódulos, teste com cuidado antes de adotar este workflow.

**IDEs ainda reindexam por diretório.**

VS Code e JetBrains tratam cada diretório de worktree como um novo projeto e o indexarão separadamente. Você ainda se beneficia de não trocar branches, mas espere algum custo de inicialização da IDE ao abrir um novo worktree.

---

## Referência Rápida

```bash
# Adicionar um worktree (branch existente)
git worktree add <caminho> <branch>

# Adicionar um worktree (nova branch, baseada em outra)
git worktree add -b <nova-branch> <caminho> <branch-base>

# Listar todos os worktrees
git worktree list
git worktree list --verbose

# Remover um worktree
git worktree remove <caminho>
git worktree remove --force <caminho>   # mesmo com mudanças não commitadas

# Limpar entradas obsoletas
git worktree prune
git worktree prune --dry-run

# Bloquear / desbloquear
git worktree lock --reason "<motivo>" <caminho>
git worktree unlock <caminho>

# Mover um worktree
git worktree move <caminho-antigo> <caminho-novo>

# Corrigir links quebrados após mover manualmente
git worktree repair
```

---

## Quando Usar Worktrees?

Use `git stash` quando a interrupção é genuinamente curta (menos de 5 minutos) e sua árvore de trabalho está limpa.

Use `git worktree` quando:

- Você precisa **rodar os dois branches** (servidores, testes, builds) ao mesmo tempo
- A interrupção é substancial — uma correção de bug completa, uma revisão de PR, responder comentários de revisão
- Você tem **arquivos não rastreados** que não quer gerenciar com flags do stash
- Você quer **manter o foco** no diretório original sem nenhum ruído de troca de branch

Depois que você começa a usar worktrees, a dança do stash começa a parecer a ferramenta errada para a maioria das interrupções. O overhead mental de "criar, trabalhar, remover" é menor do que você esperaria — e o ganho em foco ininterrupto é real.
