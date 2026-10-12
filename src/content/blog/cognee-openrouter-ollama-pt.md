---
title: 'Rodando Cognee Localmente com Embeddings via Ollama e LLM pelo OpenRouter'
description: 'Guia prático para rodar Cognee no Mac com embeddings locais via Ollama e enviar somente as chamadas do LLM generativo para o OpenRouter.'
pubDate: 2026-09-18
tags: ['AI', 'LLMs', 'Cognee', 'OpenRouter', 'Ollama', 'RAG', 'Knowledge Graphs', 'Python']
lang: 'pt'
---

Eu queria experimentar o [Cognee](https://github.com/topoteretes/cognee), uma camada open source de memória para agentes de IA, mas sem deixar que a qualidade de um LLM local pequeno interferisse na avaliação.

Ao mesmo tempo, usar uma API externa para gerar embeddings parecia desnecessário. Embeddings são relativamente leves, o Ollama lida bem com isso localmente e eu já tinha o Ollama instalado no Mac.

A solução foi um setup híbrido:

```text
                           MacBook
                              |
                         Cognee
                              |
              +---------------+---------------+
              |               |               |
       Storage local      Grafo local     Vetores locais
                                              |
                                              v
                                            Ollama
                                              |
                                      nomic-embed-text

                     Chamadas de LLM do Cognee
                              |
                              v
                          OpenRouter
                              |
                         LLM remoto
```

O resultado é um meio-termo bastante útil:

- Cognee roda localmente.
- O storage padrão do Cognee roda localmente, sem exigir um servidor de banco separado para esse experimento.
- Os embeddings são gerados localmente pelo Ollama com `nomic-embed-text`.
- Somente as chamadas do LLM generativo vão para o OpenRouter.
- É possível trocar o LLM sem alterar o restante da arquitetura.

Neste guia, vou montar essa configuração do zero e explicar por que cada componente existe.

> Este artigo foi escrito com base no `main` atual do Cognee em setembro de 2026. O projeto evolui rapidamente, então vale conferir o repositório oficial caso alguma variável de configuração mude em versões futuras.

---

## Por que o Cognee precisa de um modelo de embeddings e de um LLM

O primeiro conceito importante é que embeddings e LLMs generativos têm funções diferentes.

Um modelo de embeddings transforma texto em uma representação numérica:

```text
"Alice trabalha na Acme como engenheira de machine learning."

                    ↓

[0.021, -0.184, 0.092, ..., 0.337]
```

Esse vetor é útil para busca por similaridade. Se uma pergunta futura gerar um vetor próximo, o banco vetorial pode recuperar o trecho relevante.

Um LLM generativo faz outra coisa. O Cognee usa um LLM durante a construção e consulta da memória, incluindo tarefas como extração de entidades, extração de relacionamentos, sumarização, structured output e algumas formas de raciocínio durante a consulta.

Por exemplo, a partir desta frase:

```text
Durante a reunião de arquitetura, Alice propôs substituir Redis por PostgreSQL
porque o time queria reduzir o número de componentes de infraestrutura.
```

um LLM pode ajudar a derivar uma estrutura parecida com:

```text
Alice
  |
  +-- propôs --> Substituir Redis por PostgreSQL
                         |
                         +-- motivo --> Reduzir componentes de infraestrutura
                         |
                         +-- contexto --> Reunião de arquitetura
```

Essa diferença importa. Um modelo de embeddings ruim pode prejudicar retrieval, mas um LLM generativo ruim também pode prejudicar a estrutura da memória antes mesmo da primeira pergunta.

Por isso, para avaliar o Cognee, prefiro começar com um LLM remoto de boa qualidade e manter os embeddings locais.

---

## A arquitetura que vamos montar

O setup deste tutorial fica assim:

```text
                     DOCUMENTOS DE ENTRADA
                              |
                              v
                            Cognee
                              |
                +-------------+-------------+
                |                           |
                v                           v
         Embeddings locais              LLM generativo
                |                           |
              Ollama                    OpenRouter
                |                           |
       nomic-embed-text              modelo escolhido
                |                           |
                v                           v
          Vetores locais          entidades, relações,
                                  resumos, raciocínio
                \                           /
                 \                         /
                  +---- memória Cognee ---+
```

Uma forma simples de pensar na arquitetura é:

| Componente | Onde roda | Função |
|---|---|---|
| Cognee | Local | Pipeline de memória e retrieval |
| Metadata/storage | Local | Estado e dados do Cognee |
| Vector storage | Local | Busca semântica |
| Graph storage | Local | Relações e memória estruturada |
| Ollama | Local | Inferência de embeddings |
| `nomic-embed-text` | Local | Geração de embeddings |
| OpenRouter | Remoto | API unificada para o LLM generativo |
| LLM generativo | Remoto | Extração, sumarização e raciocínio |

Para um primeiro experimento, isso evita Docker, Neo4j, PostgreSQL, Redis, CUDA e um modelo generativo grande rodando localmente.

---

## O que fica local e o que sai da sua máquina

Antes de começar, vale deixar uma distinção de privacidade muito clara.

Esse setup mantém storage e geração de embeddings localmente, mas **não é um pipeline de IA totalmente local**.

Quando o Cognee precisa do LLM para extração, sumarização ou completion, o texto relevante é enviado ao OpenRouter e, depois, ao provider do modelo selecionado.

Portanto, esta afirmação é verdadeira:

```text
Os embeddings são gerados localmente.
```

Mas esta não é necessariamente verdadeira:

```text
Nenhum conteúdo dos documentos sai da minha máquina.
```

Se o requisito for que o conteúdo nunca deixe o computador, o LLM generativo também precisa rodar localmente, por exemplo via Ollama ou outro servidor de inferência local.

Para dados sensíveis, revise os controles de privacidade do OpenRouter e as políticas do provider escolhido antes de enviar dados de produção.

---

## Requisitos

Para seguir este guia, você precisa de:

- macOS ou Linux
- Python 3.10 a 3.14
- [`uv`](https://docs.astral.sh/uv/)
- [Ollama](https://ollama.com/)
- uma conta e uma API key do [OpenRouter](https://openrouter.ai/)
- alguns gigabytes livres em disco

Vou usar Python 3.12 nos exemplos.

Você não precisa de uma GPU NVIDIA. Em Apple Silicon, o Ollama consegue aproveitar a aceleração local disponível para workloads suportados.

Também não precisa baixar um modelo generativo local como Llama, Qwen ou Gemma para esta configuração específica. O Ollama será usado apenas para embeddings.

---

## Passo 1: verificar o Ollama

Primeiro confirme que o Ollama está instalado:

```bash
ollama --version
```

Depois liste os modelos disponíveis:

```bash
ollama list
```

Se `nomic-embed-text` não estiver instalado, baixe o modelo:

```bash
ollama pull nomic-embed-text
```

Confira novamente:

```bash
ollama list
```

Você deve ver uma entrada para `nomic-embed-text`.

Por padrão, o Ollama expõe sua API local na porta `11434`. Teste se o servidor está acessível:

```bash
curl http://localhost:11434/api/tags
```

Se falhar, abra o aplicativo do Ollama ou inicie o servidor manualmente:

```bash
ollama serve
```

---

## Passo 2: testar o endpoint de embeddings diretamente

Antes de colocar o Cognee no meio, gosto de testar cada dependência separadamente.

Envie uma requisição de embedding diretamente ao Ollama:

```bash
curl http://localhost:11434/api/embed \
  -d '{
    "model": "nomic-embed-text",
    "input": "Cognee cria memória persistente para aplicações de IA."
  }'
```

A resposta deve conter JSON com um array `embeddings` e uma lista grande de valores de ponto flutuante.

Conceitualmente:

```json
{
  "embeddings": [
    [0.0123, -0.0841, 0.1932, 0.0417]
  ]
}
```

O vetor real será muito maior. O `nomic-embed-text` usa embeddings de 768 dimensões nesta configuração.

Neste ponto já sabemos que o serviço local de embeddings funciona independentemente do Cognee.

---

## Passo 3: criar o projeto Python

Crie um projeto com `uv`:

```bash
uv init --python 3.12 cognee-openrouter
cd cognee-openrouter
```

Instale o Cognee com o extra do Ollama:

```bash
uv add "cognee[ollama]"
```

Verifique o import:

```bash
uv run python -c "import cognee; print('Cognee imported successfully')"
```

A estrutura mínima fica aproximadamente assim:

```text
cognee-openrouter/
├── .python-version
├── README.md
├── main.py
├── pyproject.toml
└── uv.lock
```

---

## Passo 4: criar uma API key no OpenRouter

O OpenRouter disponibiliza uma API compatível com o formato da OpenAI na frente de vários providers de modelos.

Em vez de mudar de SDK toda vez que quiser comparar modelos, você mantém o mesmo endpoint e troca apenas o slug do modelo.

Crie uma API key no dashboard do OpenRouter e mantenha essa chave fora do código-fonte.

As chaves normalmente têm este formato:

```text
sk-or-v1-...
```

Crie um `.env` e garanta que ele não será commitado:

```bash
touch .env
echo ".env" >> .gitignore
```

No macOS ou Linux, também é possível restringir as permissões locais:

```bash
chmod 600 .env
```

---

## Passo 5: escolher um modelo

O Cognee se beneficia de um modelo que seja bom em:

- seguir instruções
- extrair entidades e relacionamentos
- produzir JSON e structured output confiável
- resumir conteúdo
- respeitar schemas de forma consistente

Para o primeiro teste, eu não começaria com o modelo mais caro disponível. O objetivo inicial é validar a arquitetura.

Em setembro de 2026, um exemplo atual e de baixo custo no OpenRouter é:

```text
openai/gpt-5.6-luna
```

Ele suporta structured outputs e tem custo baixo o suficiente para experimentação. Se a qualidade da memória não for suficiente, você pode depois testar modelos mais fortes como GPT-5.6 Terra, GPT-5.6 Sol, Claude, Gemini ou qualquer outro disponível no OpenRouter.

Existe um detalhe de nomenclatura que é fácil de errar.

O slug do modelo no OpenRouter é:

```text
openai/gpt-5.6-luna
```

Mas o Cognee usa LiteLLM internamente nessa integração. Portanto, na configuração do Cognee o valor recebe o prefixo `openrouter/`:

```text
openrouter/openai/gpt-5.6-luna
```

Essa diferença aparece nos próximos passos.

---

## Passo 6: configurar o Cognee

Crie o `.env` com:

```dotenv
# LLM generativo via OpenRouter
LLM_PROVIDER="custom"
LLM_MODEL="openrouter/openai/gpt-5.6-luna"
LLM_ENDPOINT="https://openrouter.ai/api/v1"
LLM_API_KEY="sk-or-v1-SUA-CHAVE-AQUI"

# Embeddings locais via Ollama
EMBEDDING_PROVIDER="ollama"
EMBEDDING_MODEL="nomic-embed-text:latest"
EMBEDDING_ENDPOINT="http://localhost:11434/api/embed"
EMBEDDING_API_KEY="ollama"
EMBEDDING_DIMENSIONS=768

# Tokenizer usado pelo Cognee para dimensionar chunks
HUGGINGFACE_TOKENIZER="nomic-ai/nomic-embed-text-v1.5"
```

Esse é o núcleo da configuração híbrida.

### Por que `LLM_PROVIDER="custom"`?

O OpenRouter expõe um endpoint compatível com OpenAI, e a configuração atual do Cognee usa o provider `custom` para essa integração.

```dotenv
LLM_PROVIDER="custom"
LLM_ENDPOINT="https://openrouter.ai/api/v1"
```

### Por que o modelo começa com `openrouter/`?

O LiteLLM usa esse prefixo para selecionar a rota do OpenRouter:

```dotenv
LLM_MODEL="openrouter/openai/gpt-5.6-luna"
```

### Por que configurar embeddings separadamente?

Este é um dos detalhes mais importantes do setup.

O Cognee trata LLM e embeddings como providers independentes.

Configurar apenas:

```dotenv
LLM_PROVIDER="custom"
```

não move automaticamente os embeddings para o Ollama.

Se você esquecer as variáveis `EMBEDDING_*`, o Cognee pode continuar usando a configuração padrão de embeddings. Nesse caso, é possível receber um erro de autenticação da OpenAI durante a ingestão mesmo que o LLM pelo OpenRouter esteja configurado corretamente.

### Por que `EMBEDDING_DIMENSIONS=768`?

O vector store precisa trabalhar com dimensionalidade consistente. O `nomic-embed-text` usado neste setup produz vetores com 768 dimensões.

### Por que definir `HUGGINGFACE_TOKENIZER`?

O Cognee precisa de um tokenizer compatível com o modelo de embeddings para calcular o tamanho dos chunks corretamente.

A inferência de embeddings continua acontecendo localmente pelo Ollama. Porém, os arquivos do tokenizer podem ser baixados do Hugging Face na primeira vez em que forem necessários e depois ficam em cache local.

Portanto, a inferência é local, mas a primeira execução ainda pode fazer uma pequena requisição de rede para obter os assets do tokenizer.

---

## Passo 7: testar o OpenRouter diretamente

Agora valide a parte remota sem envolver o Cognee.

Exporte temporariamente a chave no shell:

```bash
export OPENROUTER_API_KEY="sk-or-v1-SUA-CHAVE-AQUI"
```

Faça uma chamada direta:

```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-5.6-luna",
    "messages": [
      {
        "role": "user",
        "content": "Responda exatamente: OpenRouter funciona"
      }
    ]
  }'
```

Observe que a chamada direta ao OpenRouter usa:

```text
openai/gpt-5.6-luna
```

e não:

```text
openrouter/openai/gpt-5.6-luna
```

O prefixo `openrouter/` é necessário para o LiteLLM dentro do Cognee, não para a API HTTP do próprio OpenRouter.

Se essa chamada funcionar, já validamos as duas dependências separadamente:

```text
Embeddings Ollama    OK
LLM OpenRouter       OK
```

Isso reduz muito a dificuldade de depuração.

---

## Passo 8: criar a primeira memória

Substitua o conteúdo de `main.py` por:

```python
import asyncio

import cognee


DATASET = "architecture_demo"

TEXT = """
A Acme está construindo uma plataforma interna de inteligência de documentos.

Alice lidera o time de machine learning.

Durante uma reunião de arquitetura, Alice sugeriu substituir Redis por PostgreSQL
para reduzir o número de componentes de infraestrutura.

Bob é responsável por fazer o deploy da nova arquitetura.

A migração está prevista para outubro de 2026.
"""


async def main():
    await cognee.remember(TEXT, dataset_name=DATASET)

    questions = [
        "Quem lidera o time de machine learning?",
        "Qual mudança de infraestrutura Alice propôs?",
        "Por que PostgreSQL foi proposto?",
        "Quem é responsável pelo deploy?",
        "Quando a migração deve acontecer?",
    ]

    for question in questions:
        print(f"\nPergunta: {question}")
        results = await cognee.recall(question)

        for result in results:
            print(result)


if __name__ == "__main__":
    asyncio.run(main())
```

Execute:

```bash
uv run python main.py
```

A primeira ingestão pode demorar consideravelmente mais do que inserir texto em um vector database simples. Isso é esperado, porque o Cognee está fazendo mais do que apenas gerar embeddings.

---

## O que acontece dentro de `remember()`?

Em alto nível, a API de memória do Cognee segue um pipeline semelhante a:

```text
remember()
    |
    v
ingestão
    |
    v
chunking
    |
    +--------------------------+
    |                          |
    v                          v
embeddings                extração por LLM
    |                          |
    v                          v
vetores locais       entidades + relacionamentos
                               |
                               v
                       memória estruturada
                               |
                               v
                          enriquecimento
```

Esse é o principal motivo pelo qual a qualidade do LLM importa.

Em um RAG básico, o LLM generativo muitas vezes aparece principalmente depois do retrieval:

```text
documentos -> embeddings -> retrieval -> resposta do LLM
```

No Cognee, o LLM também pode participar enquanto a memória está sendo construída:

```text
documentos -> extração por LLM -> memória estruturada -> retrieval -> resposta
```

Um modelo ruim pode degradar a representação da memória, não apenas a redação da resposta final.

---

## Como repetir experimentos de forma limpa

Ao comparar modelos, use um dataset controlado e limpe a memória entre execuções em vez de adicionar os mesmos fatos repetidamente.

O Cognee disponibiliza `forget()` para remoção. Em experimentos locais descartáveis, você pode limpar explicitamente toda a memória antes de reconstruir:

```python
await cognee.forget(everything=True)
```

Não coloque essa linha casualmente em código de produção. Ela é útil em scripts de benchmark nos quais apagar a memória local de teste é intencional.

Um loop experimental simples é:

```text
limpar memória de teste
        |
        v
ingerir os mesmos documentos
        |
        v
rodar as mesmas perguntas
        |
        v
registrar qualidade, tempo e custo
        |
        v
trocar somente o LLM
```

Assim a comparação entre modelos fica muito mais significativa.

---

## Como escolher um modelo melhor no OpenRouter

Depois que o pipeline estiver funcionando, a seleção do modelo passa a ser uma questão empírica.

Eu avaliaria pelo menos estas dimensões:

| Dimensão | Por que importa |
|---|---|
| Confiabilidade de structured output | Cognee depende de saídas consistentes com schema |
| Extração de entidades | Define quais conceitos entram na memória |
| Extração de relações | Afeta diretamente a qualidade do grafo |
| Instruction following | Reduz saídas inválidas ou irrelevantes |
| Latência | Afeta ingestão e consultas interativas |
| Custo | Extração pode ser executada muitas vezes entre chunks |

Uma progressão útil seria:

```text
Etapa 1
um modelo capaz e barato para tudo

Etapa 2
comparar com um modelo mais forte

Etapa 3
medir se a diferença de qualidade justifica o custo
```

Não assuma que o modelo mais caro é automaticamente a melhor decisão de arquitetura. A pergunta correta é se um modelo mais forte melhora suficientemente as tarefas reais de memória e retrieval para justificar o custo adicional.

---

## Avançado: usar modelos diferentes por estágio

O Cognee também suporta roteamento de modelos por estágio.

Isso é útil porque extração, sumarização e raciocínio em query têm perfis diferentes de volume, custo e qualidade.

Conceitualmente:

```text
                    Cognee
                       |
          +------------+------------+
          |            |            |
          v            v            v
       Extração    Sumarização     Query
          |            |            |
     barato/bom       médio       mais forte
```

Por exemplo:

```dotenv
# Modelo base, usado como fallback
LLM_PROVIDER="custom"
LLM_MODEL="openrouter/openai/gpt-5.6-luna"
LLM_ENDPOINT="https://openrouter.ai/api/v1"
LLM_API_KEY="sk-or-v1-SUA-CHAVE-AQUI"

# Extração
LLM_EXTRACTION_PROVIDER="custom"
LLM_EXTRACTION_MODEL="openrouter/openai/gpt-5.6-luna"
LLM_EXTRACTION_ENDPOINT="https://openrouter.ai/api/v1"
LLM_EXTRACTION_API_KEY="sk-or-v1-SUA-CHAVE-AQUI"

# Sumarização
LLM_SUMMARIZATION_PROVIDER="custom"
LLM_SUMMARIZATION_MODEL="openrouter/openai/gpt-5.6-luna"
LLM_SUMMARIZATION_ENDPOINT="https://openrouter.ai/api/v1"
LLM_SUMMARIZATION_API_KEY="sk-or-v1-SUA-CHAVE-AQUI"

# Raciocínio durante a consulta
LLM_QUERY_PROVIDER="custom"
LLM_QUERY_MODEL="openrouter/openai/gpt-5.6-terra"
LLM_QUERY_ENDPOINT="https://openrouter.ai/api/v1"
LLM_QUERY_API_KEY="sk-or-v1-SUA-CHAVE-AQUI"
```

Uma otimização comum é manter um modelo de melhor custo-benefício para extração, que pode ocorrer uma vez por chunk, e reservar um modelo mais forte para raciocínio durante a consulta, que tende a ter volume menor.

Eu não começaria com essa configuração. Primeiro faça a versão de modelo único funcionar, crie um conjunto de avaliação repetível e só depois otimize por estágio.

---

## Troubleshooting

### Cognee pede uma API key da OpenAI durante a ingestão

Isso normalmente significa que o LLM foi configurado, mas o provider de embeddings não.

Confira:

```dotenv
EMBEDDING_PROVIDER="ollama"
EMBEDDING_MODEL="nomic-embed-text:latest"
EMBEDDING_ENDPOINT="http://localhost:11434/api/embed"
EMBEDDING_API_KEY="ollama"
EMBEDDING_DIMENSIONS=768
```

As configurações de LLM e embeddings são independentes.

### Conexão recusada pelo Ollama

Teste o servidor diretamente:

```bash
curl http://localhost:11434/api/tags
```

Se falhar:

```bash
ollama serve
```

Depois tente novamente.

### `nomic-embed-text` não está instalado

```bash
ollama pull nomic-embed-text
ollama list
```

### Erro de dimensão dos vetores

Confirme que a configuração usa consistentemente:

```dotenv
EMBEDDING_DIMENSIONS=768
```

Se você criou dados de teste anteriormente com outro modelo de embeddings e outra dimensionalidade, normalmente é mais simples apagar a memória descartável de teste e reconstruí-la.

### OpenRouter retorna `401 Unauthorized`

Verifique a API key e teste o OpenRouter diretamente com `curl` antes de depurar o Cognee.

### OpenRouter informa que o modelo não existe

Slugs de modelos mudam com o tempo. Liste o catálogo atual:

```bash
curl -s https://openrouter.ai/api/v1/models | jq -r '.data[].id'
```

Lembre da diferença:

```text
API HTTP do OpenRouter:
openai/gpt-5.6-luna

Cognee via LiteLLM:
openrouter/openai/gpt-5.6-luna
```

### Erros de structured output ou extração

Nem todos os modelos obedecem schemas rígidos com a mesma confiabilidade.

Se a chamada HTTP funciona, mas o Cognee falha repetidamente durante extração estruturada, teste um modelo com suporte melhor a structured output antes de concluir que o problema está no pipeline do Cognee.

---

## Uma forma melhor de avaliar o Cognee

Depois que tudo estiver rodando, eu criaria uma avaliação pequena e fixa em vez de começar ingerindo milhares de documentos.

Por exemplo:

```text
20 a 50 documentos representativos
20 perguntas factuais diretas
10 perguntas sobre relacionamentos
10 perguntas multi-hop
```

Registre:

```text
qualidade da extração de entidades
qualidade dos relacionamentos
qualidade do retrieval
correção das respostas
tempo de ingestão
latência das consultas
custo do LLM
```

Depois compare configurações mantendo o restante fixo:

```text
Configuração A
nomic-embed-text + GPT-5.6 Luna

Configuração B
nomic-embed-text + GPT-5.6 Terra

Configuração C
nomic-embed-text + outro modelo do OpenRouter

Configuração D
nomic-embed-text + LLM local pelo Ollama
```

Assim você isola o efeito do modelo generativo.

Isso é muito mais útil do que perguntar se um modelo é "melhor" de forma abstrata.

---

## Estrutura final do projeto

O projeto pode continuar muito pequeno:

```text
cognee-openrouter/
├── .env
├── .gitignore
├── .python-version
├── main.py
├── pyproject.toml
└── uv.lock
```

Seu `.gitignore` deve conter pelo menos:

```gitignore
.env
.venv/
__pycache__/
```

Nunca commite sua chave do OpenRouter.

---

## Setup completo, de forma condensada

Instale o Cognee:

```bash
uv init --python 3.12 cognee-openrouter
cd cognee-openrouter
uv add "cognee[ollama]"
```

Instale o modelo local de embeddings:

```bash
ollama pull nomic-embed-text
```

Configure o `.env`:

```dotenv
LLM_PROVIDER="custom"
LLM_MODEL="openrouter/openai/gpt-5.6-luna"
LLM_ENDPOINT="https://openrouter.ai/api/v1"
LLM_API_KEY="sk-or-v1-SUA-CHAVE-AQUI"

EMBEDDING_PROVIDER="ollama"
EMBEDDING_MODEL="nomic-embed-text:latest"
EMBEDDING_ENDPOINT="http://localhost:11434/api/embed"
EMBEDDING_API_KEY="ollama"
EMBEDDING_DIMENSIONS=768
HUGGINGFACE_TOKENIZER="nomic-ai/nomic-embed-text-v1.5"
```

Execute a aplicação:

```bash
uv run python main.py
```

A arquitetura final fica:

```text
Cognee               local
Storage               local
Memória em grafo      local
Vector storage        local
Embedding inference   local via Ollama
LLM generativo        remoto via OpenRouter
```

---

## Considerações finais

Esse setup híbrido é uma boa forma de avaliar o Cognee sem transformar a performance de um modelo local em uma variável adicional do experimento.

Embeddings são baratos e simples de rodar localmente. O trabalho semanticamente mais difícil, como extrair entidades, relacionamentos, resumos e saídas estruturadas, pode usar um modelo remoto de maior qualidade.

O OpenRouter também deixa o experimento mais fácil de iterar, porque o restante da arquitetura permanece fixo enquanto o modelo muda.

Isso permite uma progressão limpa:

```text
1. Validar Cognee com um LLM remoto capaz
2. Comparar diferentes modelos do OpenRouter
3. Separar modelos por extração, sumarização e query se fizer sentido
4. Comparar o melhor setup remoto com um LLM totalmente local via Ollama
```

A pergunta interessante deixa de ser apenas "o Cognee roda localmente?".

Ela passa a ser: **quanto a qualidade do LLM afeta a memória que o Cognee constrói, e qual é o modelo mais barato que preserva a qualidade de que realmente precisamos?**

## Referências

- [Repositório do Cognee](https://github.com/topoteretes/cognee)
- [Documentação do Cognee](https://docs.cognee.ai/)
- [Guia do Cognee com Ollama local](https://docs.cognee.ai/guides/local-ollama)
- [Documentação do OpenRouter](https://openrouter.ai/docs)
- [Catálogo de modelos do OpenRouter](https://openrouter.ai/models)
- [Ollama](https://ollama.com/)
- [`nomic-embed-text` no Ollama](https://ollama.com/library/nomic-embed-text)
