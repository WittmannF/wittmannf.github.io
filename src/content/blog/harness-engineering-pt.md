---
title: 'Engenharia de Harness: a camada de sistemas que transforma LLMs em agentes confiáveis'
description: 'Um guia prático sobre o runtime ao redor de agentes de IA: loops, ferramentas, contexto, sandboxes, estado, recuperação, verificação e avaliação.'
pubDate: 2026-10-05T12:00:00-03:00
tags: ['IA', 'LLMs', 'Agentes', 'Engenharia de Harness', 'MCP', 'Sistemas de IA']
lang: 'pt'
---

> **Prefere aprender visualmente?** Explore o [guia interativo de Engenharia de Harness](https://wittmannf.github.io/harness-engineering/) com vários capítulos, diagramas, perguntas de revisão e um checklist de produção.

> **Read in English:** [Harness Engineering: The Systems Layer That Turns LLMs Into Reliable Agents](/blog/harness-engineering).

Um modelo de linguagem capaz não é, sozinho, um agente funcional.

O modelo pode analisar uma tarefa e gerar uma próxima ação plausível. Mas alguma outra coisa precisa decidir quais informações ele recebe, quais ferramentas pode chamar, se uma ação é permitida, onde ela executa, como o resultado volta, o que sobrevive a um reinício e o que realmente significa concluir a tarefa.

Essa camada de sistemas ao redor do modelo é o **agent harness**.

E **engenharia de harness** é a disciplina de projetá-la bem.

Essa distinção explica um padrão que surpreende muitas equipes: dois produtos podem usar o mesmo modelo e ainda assim se comportar de formas muito diferentes. Um conclui trabalho em várias etapas de maneira confiável; o outro esquece restrições, escolhe a ferramenta errada, repete efeitos colaterais ou declara sucesso sem verificar nada. A diferença frequentemente está fora dos pesos do modelo — está no harness.

Este artigo constrói um modelo mental prático para essa camada e mostra como suas partes se conectam.

---

## 1. Uma chamada ao modelo não é um agente

Uma invocação de um modelo de linguagem pode ser representada, de forma abstrata, assim:

```text
y ~ pθ(· | c)
```

O modelo gera uma saída `y` condicionada ao contexto `c`.

Nada nessa expressão significa automaticamente que:

- um comando executa;
- um navegador abre;
- um arquivo muda;
- uma chamada de API é autorizada;
- uma ação com falha é repetida com segurança;
- estado útil sobrevive ao próximo processo;
- o trabalho continua depois da primeira resposta; ou
- o resultado final é verificado.

Um sistema agêntico adiciona um processo de controle ao redor da inferência:

```text
sistema de agente ≈ modelo + harness + ambiente
```

Isso não é uma identidade formal. É uma decomposição útil:

| Camada | Responsabilidade |
|---|---|
| **Modelo** | Capacidade aprendida: compreensão, planejamento, geração e seleção de ações |
| **Harness** | Controle: montagem de contexto, loop, roteamento, política, estado, recuperação e verificação |
| **Ambiente** | Realidade externa: arquivos, APIs, bancos, browsers, shells e serviços |

O limite importante não é se o produto recebe o rótulo comercial de “chatbot” ou “agente”. A pergunta relevante é se a saída do modelo participa de um loop controlado capaz de inspecionar e alterar estado externo.

---

## 2. O loop mínimo de um agente

Um harness mínimo executa repetidamente seis tarefas:

1. montar o contexto ativo;
2. invocar o modelo;
3. identificar se a resposta é final ou solicita uma ação;
4. aplicar política, permissões e regras de aprovação;
5. executar a ação em um ambiente;
6. retornar a observação e atualizar o estado.

Conceitualmente:

```text
Tarefa
  ↓
Montar contexto ativo
  ↓
Invocar o modelo
  ↓
Resposta final ou solicitação de ação?
  ├── final → retornar resultado
  └── ação
        ↓
     política / aprovação / roteamento
        ↓
     executar no ambiente
        ↓
     observação + atualização de estado
        └──────────────→ próxima chamada ao modelo
```

Uma forma de representar os objetos que evoluem é:

```text
sₜ       = estado durável ou de trabalho antes do passo t
cₜ=G(sₜ) = contexto selecionado para a próxima chamada
aₜ=M(cₜ) = saída do modelo ou solicitação de ação
oₜ=E(aₜ) = observação produzida pelo ambiente

sₜ₊₁ = U(sₜ, aₜ, oₜ)
```

A ideia central é simples: **agir, observar, atualizar, continuar**.

O modelo fornece decisões. O harness dá continuidade operacional a essas decisões.

### Um esboço de implementação

```python
estado = inicializar(tarefa)

while not estado.terminal:
    contexto = selecionar_contexto(estado)
    resposta = modelo.gerar(contexto, tools=ferramentas_visiveis(estado))

    if resposta.final:
        estado = verificar_e_finalizar(estado, resposta)
        continue

    requisicao = validar_chamada(resposta.tool_call)
    autorizar(requisicao, estado.politica)
    observacao = executar(requisicao, sandbox=estado.sandbox)
    estado = atualizar(estado, requisicao, observacao)
```

Sistemas reais são mais complexos, mas todo recurso adicional — memória, aprovações, subagentes, checkpoints — ainda precisa ocupar algum lugar ao redor desse loop.

---

## 3. Componentes que costumam ser confundidos

Vários termos são usados como se fossem sinônimos. Eles não são.

| Componente | Significado útil | Falha típica |
|---|---|---|
| **Modelo** | Sistema aprendido de inferência | Interpreta ou escolhe mal |
| **Agente** | Modelo operando dentro de um loop orientado a uma tarefa | Não progride em direção ao objetivo |
| **Harness** | Maquinaria de runtime e controle que dirige o loop | Fornece contexto, roteamento, política ou recovery inadequados |
| **Sessão** | Contêiner lógico de histórico e estado | Perde progresso entre turnos ou reinícios |
| **Contexto** | Informação entregue a uma invocação do modelo | Omite, enterra ou sobrecarrega evidência relevante |
| **Ferramenta** | Capacidade chamável exposta ao modelo | Tem contrato ambíguo ou resultado ruidoso |
| **Sandbox** | Ambiente controlado de execução | Expõe demais ou não oferece uma capacidade necessária |
| **Workflow** | Caminho de execução definido principalmente por código | É rígido demais para a tarefa |
| **Evaluation harness** | Infraestrutura que executa e avalia trials | Mede o resultado errado ou um ambiente instável |

Esses componentes podem compartilhar um processo em um protótipo. A separação conceitual continua útil porque eles carregam pressupostos de confiança e modos de falha diferentes.

---

## 4. Ferramentas fazem parte da entrada do modelo

Uma ferramenta não é apenas código de backend. Seu **nome, descrição, parâmetros, schema e formato de resultado** geralmente entram no contexto do modelo.

Isso significa que o design da ferramenta altera o comportamento do modelo antes mesmo da primeira chamada.

Considere duas interfaces capazes de modificar o mesmo repositório:

```text
shell(command)
```

e:

```text
read_file(path, start_line, end_line)
search_code(query)
apply_patch(path, patch)
run_tests(target)
```

O shell oferece enorme flexibilidade, mas obriga o modelo a escolher comandos, escapar caminhos, interpretar saídas arbitrárias e se recuperar de erros de sintaxe. Ferramentas estruturadas restringem a superfície de ação e podem tornar intenção e resultado mais fáceis de expressar.

Nenhuma opção é universalmente superior. O ponto é que a interface altera a dificuldade efetiva da tarefa.

### Avalie toda ferramenta em quatro dimensões

1. **Affordance** — qual operação ela pode realizar?
2. **Contrato** — como o modelo solicita a operação?
3. **Observação** — quais informações retornam?
4. **Feedback** — o resultado facilita a próxima ação correta?

Um modelo de custo útil é:

```text
Cferramenta = Cseleção + Cobservação
```

- `Cseleção`: dificuldade de escolher a ferramenta e os argumentos corretos;
- `Cobservação`: carga de contexto e raciocínio imposta pelo resultado.

Isso explica por que adicionar ferramentas pode reduzir confiabilidade. Seis operações sobrepostas chamadas `search`, `find`, `lookup`, `query`, `grep` e `retrieve` aumentam a capacidade no papel enquanto tornam a seleção ambígua.

### Um erro de ferramenta com alto sinal

Compare:

```text
Erro.
```

com:

```json
{
  "status": "failed",
  "reason": "branch_not_found",
  "requested_branch": "release/2.4",
  "available_branches": ["main", "release/2.3"],
  "side_effects": "none",
  "retryable": true
}
```

O segundo resultado transforma a falha em uma observação útil. O modelo pode se recuperar sem adivinhar — e sem fingir que a ação funcionou.

---

## 5. MCP é uma camada de interface, não o agente inteiro

O [Model Context Protocol](https://modelcontextprotocol.io/) padroniza como aplicações de IA se conectam a capacidades externas como ferramentas, recursos e prompts.

Isso resolve um problema importante de interoperabilidade. Não define a arquitetura completa do agente.

O MCP, sozinho, não decide:

- como o loop do modelo é agendado;
- qual histórico entra no próximo contexto;
- quais chamadas exigem aprovação;
- onde as ferramentas executam;
- como efeitos colaterais são repetidos;
- como subagentes se coordenam;
- o que prova conclusão; ou
- como o sistema inteiro é avaliado.

O modelo mental seguro é:

```text
Harness do agente
    ↓
Cliente MCP
    ↓
Servidores MCP → tools · resources · prompts · extensões opcionais
```

O MCP oferece superfícies interoperáveis de capacidade. O harness define a política operacional ao redor delas.

---

## 6. Contexto ativo não é memória durável

Cada chamada ao modelo vê um contexto finito. O harness decide o que entra.

Possíveis ingredientes incluem:

- instruções de sistema e developer;
- a tarefa atual;
- histórico recente da conversa;
- schemas e resultados de ferramentas;
- documentação recuperada;
- plano e estado de tarefas;
- resumos de trabalho anterior;
- estado do repositório ou da aplicação;
- registros de memória; e
- relatórios de subagentes.

A política ingênua — incluir tudo que pode importar — falha por dois motivos:

1. a capacidade de contexto é finita;
2. material irrelevante compete com evidência útil mesmo quando ainda há espaço.

Um harness de produção deve separar duas superfícies:

| Superfície | Objetivo |
|---|---|
| **Estado durável da sessão** | Preservar eventos, decisões, artefatos, IDs e histórico entre turnos ou reinícios |
| **Contexto ativo do modelo** | Apresentar a menor visão útil para a inferência atual |

Persistência não implica inclusão automática em toda chamada. Inclusão em uma chamada não implica armazenamento durável.

### Divulgação progressiva

Um padrão forte é:

1. fornecer informação suficiente para orientar o agente;
2. tornar informação mais profunda descobrível;
3. recuperar orientação detalhada somente quando necessário.

Esse padrão se aplica à documentação de repositório, resultados de ferramentas, RAG, memória e skills.

### Compactação tem perdas

Quando o histórico cresce, sistemas frequentemente substituem detalhes antigos por um resumo:

```text
C(H) ≠ H
```

Um histórico compactado não é o histórico original. Ele pode omitir exatamente o detalhe exigido por uma etapa futura.

Bons desenhos mantêm o histórico durável recuperável e tratam o contexto compactado como uma visão temporária.

---

## 7. Segurança exige mais do que prompts de aprovação

Quando um agente pode criar efeitos colaterais, segurança passa a ser arquitetura.

Três mecanismos costumam ser confundidos:

### Permissões

Definem quais operações são autorizadas para o agente ou usuário.

### Aprovação humana

Mantém decisões de alto impacto — publicar, apagar, enviar, gastar, elevar privilégio — sob controle humano explícito.

### Contenção

Limita o que o ambiente de execução consegue alcançar mesmo se instruções, verificações de política ou aprovações falharem.

Exemplos:

- limites de filesystem;
- regras de egress de rede;
- containers e VMs;
- limites de processo e recursos;
- isolamento de credenciais; e
- proxies escopados para serviços externos.

Aprovação responde: **“Esta ação deve acontecer?”**

Contenção responde: **“O que pode acontecer?”**

As duas importam.

### Mantenha credenciais fora da execução não confiável

Se código gerado pelo modelo roda numa sandbox com credenciais de longa duração, prompt injection, dependência maliciosa ou comando incorreto podem lê-las.

Um desenho mais forte mantém credenciais no plano de controle confiável e expõe operações restritas por um proxy:

```text
Sandbox sem o segredo bruto
        ↓
Proxy controlado: escopo + política + auditoria
        ↓
Serviço externo
```

Um segredo que nunca entra na sandbox não pode ser lido diretamente por ela.

### Observações têm proveniência

O contexto do agente pode incluir páginas web, e-mails, arquivos, issues, resultados de ferramentas, memória, skills e saída de subagentes. Qualquer uma dessas fontes pode conter instruções hostis ou enganosas.

Um modelo mental útil é:

```text
observação = (conteúdo, fonte, confiança, tempo, permissões)
```

Todo texto vira token, mas nem todo token tem a mesma autoridade.

---

## 8. Agentes de longa duração herdam problemas de sistemas distribuídos

Uma chamada de cinco segundos frequentemente pode falhar e ser repetida com pouca coordenação. Uma tarefa que dura horas ou dias é diferente.

Durante trabalho prolongado:

- o harness pode cair;
- um worker pode desaparecer;
- a sandbox pode ser reclamada;
- a rede pode desconectar;
- a aprovação pode chegar muito depois; e
- outro processo pode precisar retomar a tarefa.

O sistema precisa de eventos duráveis, checkpoints, artefatos recuperáveis e uma forma de reconciliar o que o harness lembra com o que aconteceu no mundo externo.

### A lacuna perigosa

Suponha que o harness solicite:

```text
create_ticket(...)
```

O sistema remoto cria o ticket, mas a conexão cai antes da resposta chegar.

Agora quatro transições podem discordar:

```text
ação solicitada
ação executada
resultado observado
estado da tarefa persistido
```

Repetir cegamente pode criar um ticket duplicado.

### Idempotência deve ser específica por ferramenta

Uma operação idempotente tem o mesmo efeito desejado quando repetida:

```text
f(f(s)) = f(s)
```

`set_ticket_status(id, "closed")` geralmente pode ser desenhada como idempotente. `charge_card`, `send_email` e `create_order` não são naturalmente seguras para repetição.

Proteções comuns incluem:

- chaves de idempotência;
- IDs únicos de operação;
- registros de deduplicação;
- escritas transacionais;
- consulta antes de repetir; e
- políticas de retry específicas por ferramenta.

“Se falhar, tente de novo” não é uma estratégia universal.

---

## 9. Subagentes adicionam custos de coordenação

Subagentes podem aumentar throughput quando uma tarefa se decompõe em partes independentes. Também podem introduzir:

- trabalho duplicado;
- pressupostos inconsistentes;
- overhead de comunicação;
- custo maior de tokens;
- propagação de erros; e
- conflitos em estado compartilhado.

Delegue quando:

- subtarefas têm limites claros;
- fontes ou módulos são independentes;
- resultados podem ser verificados objetivamente; e
- o responsável pela integração é explícito.

Evite delegação quando:

- cada etapa depende da anterior;
- todos precisam do mesmo contexto extenso;
- vários workers escrevem no mesmo estado; ou
- coordenar custa mais do que executar.

Design multiagente não é apenas um problema de prompting. É um problema de consistência e ownership.

---

## 10. Verificação é diferente de conclusão autodeclarada

Um agente pode dizer:

> O bug foi corrigido.

Isso é uma afirmação — não uma evidência.

Evidências mais fortes podem incluir:

- a reprodução original não falha mais;
- testes de regressão passam;
- a aplicação funciona de ponta a ponta;
- o banco contém o estado desejado;
- o navegador mostra o resultado esperado; ou
- a API externa confirma o outcome.

Uma escada útil de evidência é:

```text
afirmação do modelo
    ↓
artefato existe
    ↓
verificações determinísticas passam
    ↓
estado externo satisfaz o objetivo
```

Sempre que possível, conclusão deve estar vinculada a estado observável fora da própria afirmação do modelo.

### Mecanismo versus julgamento

Use enforcement determinístico para propriedades decidíveis mecanicamente:

- JSON válido;
- conformidade com schemas;
- limites de caminhos;
- dependências proibidas;
- budgets de recursos; e
- testes e invariantes.

Use julgamento do modelo ou humano quando interpretação é realmente necessária:

- relevância;
- qualidade de texto;
- qualidade de design;
- planejamento ambíguo; e
- interpretação de políticas.

O modelo não deveria precisar lembrar uma regra que o sistema consegue impor de forma barata.

---

## 11. O agent harness opera; o evaluation harness mede

Um **agent harness** permite que o modelo aja.

Um **evaluation harness** provisiona tarefas e ambientes, executa trials, registra trajetórias, chama graders e agrega outcomes.

Performance de agente é, portanto, função de mais do que os pesos do modelo:

```text
performance medida = F(modelo, harness, ambiente, tarefa, grader)
```

Mude política de contexto, schemas, recursos de computação, timeouts ou grader, e o score pode mudar sem alterar o modelo.

Uma boa avaliação mede:

- correção do estado final, não apenas transcripts plausíveis;
- consistência entre tentativas repetidas;
- falhas de seleção e contrato de ferramentas;
- falhas de contexto e recuperação;
- custo, latência, tokens e tool calls; e
- efeitos adversos e violações de política.

### Componentes do harness são hipóteses

Planner, evaluator, mecanismo de reset de contexto ou camada multiagente existem porque alguém acredita que compensam uma limitação atual.

Quando os modelos melhoram, essa hipótese pode expirar.

Faça ablações:

- remova o planner — a qualidade muda?
- remova o evaluator — ele encontra defeitos reais?
- reduza as ferramentas — a seleção melhora?
- mude a compactação — a continuidade melhora o suficiente para justificar o custo?

Harnesses devem evoluir junto com os modelos e tarefas que atendem.

---

## 12. Checklist de produção

Antes de colocar um agente em produção, responda explicitamente:

1. **O que o modelo recebe?** Instruções, histórico, ferramentas, dados recuperados, resumos e artefatos.
2. **Quem controla o loop?** Código da aplicação, harness gerenciado, workflow engine ou outro agente.
3. **Quais ações estão disponíveis?** Funções, ferramentas MCP, shell, navegador, arquivos, APIs e subagentes.
4. **Onde as ações executam?** Processo confiável, máquina local, container, VM ou serviço remoto.
5. **O que sobrevive a uma falha?** Eventos, arquivos, checkpoints, snapshots e efeitos externos.
6. **Quais regras são mecânicas?** Schemas, mounts, rede, aprovações, testes e budgets.
7. **Como erros são representados?** Exceção fatal, retry automático, observação para o modelo ou escalonamento humano.
8. **Quais ações podem ser repetidas?** Idempotentes, deduplicadas ou nenhuma das duas.
9. **Como o agente obtém ground truth?** Testes, logs, estado do browser, banco e respostas externas.
10. **O que prova conclusão?** Afirmação, validador, estado externo, evaluator ou pessoa.
11. **Como o run para se nunca tiver sucesso?** Limites de turno, tempo, tokens, custo, tools e política.
12. **O que acontece após interrupção?** Resume, retry, reprovisionamento, rollback ou restart.
13. **Observações não confiáveis carregam instruções?** Dados da web, tools, arquivos, memória, skills e subagentes.
14. **Como subagentes se coordenam?** Limites de tarefa, ownership, estado compartilhado, merge e concorrência.
15. **Como o harness é avaliado?** Tarefas representativas, ambientes estáveis, métricas de outcome e ablações.

Se um sistema não consegue responder a essas perguntas, ele ainda pode funcionar numa demo. É muito mais difícil raciocinar sobre ele em produção.

---

## Modelo mental final

O núcleo da engenharia de harness cabe em nove afirmações:

1. O modelo fornece capacidade aprendida.
2. O harness conecta essa capacidade ao trabalho.
3. O estado durável determina o que sobrevive.
4. A política de contexto determina o que o modelo vê agora.
5. O ambiente de execução determina o que realmente pode acontecer.
6. Permissões e contenção determinam o alcance da falha.
7. Feedback revela se uma ação funcionou.
8. Verificação transforma “pronto” em evidência.
9. Avaliação determina se o harness ajuda ou apenas adiciona maquinaria.

Essa é a camada de sistemas entre uma chamada de modelo impressionante e um agente em que você pode confiar para trabalho real.

Para ver este material com diagramas e navegação por capítulos, continue no [guia interativo de Engenharia de Harness](https://wittmannf.github.io/harness-engineering/).

---

## Leituras adicionais

- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)
- [SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering](https://arxiv.org/abs/2405.15793)
- [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Anthropic — Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic — Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [OpenAI — Harness engineering](https://openai.com/index/harness-engineering/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [IETF RFC 9110 — Métodos idempotentes](https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods)
