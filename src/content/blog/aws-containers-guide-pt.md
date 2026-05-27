---
title: 'Deploy na AWS com Containers: Lambda e Fargate na Prática'
description: 'Guia prático de deploy na AWS usando containers Docker. Começamos com Lambda (o mais simples), evoluímos para Fargate para jobs longos, e montamos um pipeline completo com enrichment e busca vetorial. Exemplo real: um scraper de notícias para newsletter.'
pubDate: 2026-04-18
tags: ['AWS', 'Docker', 'DevOps', 'Lambda', 'Fargate', 'Python']
lang: 'pt'
---

Você dockerizou sua aplicação. Funciona na sua máquina, a imagem está pronta. Agora precisa que isso rode na cloud — de preferência sem gerenciar servidores, sem pagar quando não está usando, e sem passar uma semana configurando infraestrutura.

A AWS tem **dezenas** de formas de rodar um container. Isso é o problema: são tantas opções que a decisão paralisa. Este guia corta o ruído. Vamos cobrir as **duas opções que importam** para tarefas agendadas, em ordem de complexidade, e depois montar o pipeline completo:

1. **Lambda** — roda um container sob demanda, paga por execução. Ideal para tarefas curtas e agendadas.
2. **ECS Fargate** — roda containers sem gerenciar servidores, com mais controle. Para tarefas longas ou complexas.
3. **Pipeline completo** — conectar scraper → enrichment → busca vetorial com eventos S3 e Step Functions.

Como exemplo prático, vamos usar um **scraper de notícias para uma newsletter** — uma aplicação que precisa rodar a cada poucas horas, coletar artigos, enriquecer com embeddings, e indexar numa busca vetorial. Um cenário real que cobre agendamento, containers, pipelines orientados a eventos e custo.

> **Pré-requisito**: você já sabe o básico de Docker (Dockerfile, build, push). Se não, leia primeiro o [Guia Prático de Docker](/pt/blog/docker-ultimate-guide-pt).

---

## O Exemplo: Um Scraper de Notícias

Nosso scraper é simples: coleta manchetes de AI de fontes como Google News, processa com um LLM para classificar por tópico, e salva os resultados no S3.

```python
# scraper.py
import json
import boto3
from datetime import datetime

def run_scraper():
    articles = scrape_sources()       # Coleta de Google News, Rundown, etc.
    classified = classify(articles)    # LLM classifica por tópico
    save_to_s3(classified)             # Salva no S3 como JSON
    print(f"Scraped {len(classified)} articles at {datetime.now()}")

def handler(event, context):
    """Entry point para Lambda."""
    run_scraper()
    return {"statusCode": 200, "body": f"Scraped at {datetime.now()}"}

if __name__ == "__main__":
    run_scraper()
```

O scraper roda a cada 4 horas, leva ~5 minutos, e usa ~512MB de RAM. Mas o scraper é só a primeira etapa — depois dele, precisamos enriquecer os artigos com embeddings e indexar para busca. Vamos começar pelo compute e depois montar o pipeline completo.

---

## Nível 1: AWS Lambda — O Caminho Mais Simples

Lambda é serverless no sentido mais puro: você entrega o código (ou um container), a AWS roda, e você paga apenas pelo tempo de execução. Sem servidor, sem cluster, sem nada para gerenciar.

### Por Que Lambda para um Scraper?

- **Zero infraestrutura**: não precisa de VPC, subnet, security group
- **Paga por uso**: ~$0.45/mês para nosso scraper (sim, centavos)
- **Agendamento nativo**: EventBridge Scheduler dispara a Lambda no horário que você quiser

### Limitações

Antes de começar, as restrições que importam:

| Limite | Valor |
|--------|-------|
| Timeout máximo | **15 minutos** |
| Memória | 128 MB a 10 GB |
| Imagem Docker | até 10 GB |
| Storage temporário (`/tmp`) | até 10 GB |
| Sem porta de rede | Lambda não "escuta" — é invocação pura |

Se seu scraper termina em menos de 15 minutos, Lambda é a escolha certa. Se não, pule para o Nível 2 (Fargate).

### Preciso de Docker?

Não necessariamente. Lambda aceita dois formatos de deploy:

| Formato | Limite de tamanho | Quando usar |
|---------|------------------|-------------|
| **ZIP** | 50 MB (zip) / 250 MB (descompactado) | Aplicações leves, poucas dependências |
| **Container** | 10 GB | Dependências pesadas (ML, numpy, scipy), ambiente complexo |

Para um scraper Python com poucas dependências, ZIP é mais simples. Se seu projeto já é um pacote instalável com `pip install -e .` ou `uv pip install -e .`, melhor ainda.

### Caminho A: Deploy com ZIP (Sem Docker)

O jeito mais rápido de subir uma Lambda — sem Docker, sem ECR, sem nada.

**Passo 1: Empacotar as dependências**

```bash
# Criar diretório de empacotamento
mkdir -p package

# Instalar dependências no diretório (usando uv — rápido e determinístico)
uv pip install -r requirements.txt --target package/

# Copiar seu código
cp scraper.py package/

# Zipar tudo
cd package && zip -r ../lambda.zip . && cd ..
```

Se seu projeto é um CLI instalável (com `pyproject.toml`):

```bash
mkdir -p package
uv pip install . --target package/
cd package && zip -r ../lambda.zip . && cd ..
```

**Passo 2: Criar a função**

```bash
AWS_ACCOUNT=123456789012
AWS_REGION=us-east-1

aws lambda create-function \
  --function-name news-scraper \
  --runtime python3.12 \
  --handler scraper.handler \
  --zip-file fileb://lambda.zip \
  --role arn:aws:iam::$AWS_ACCOUNT:role/lambda-execution-role \
  --memory-size 512 \
  --timeout 900 \
  --region $AWS_REGION
```

**Para atualizar:**

```bash
# Reempacotar
cd package && zip -r ../lambda.zip . && cd ..

# Atualizar a função
aws lambda update-function-code \
  --function-name news-scraper \
  --zip-file fileb://lambda.zip
```

Simples. Sem Docker, sem registry, sem build de imagem. Se o zip ficar maior que 50 MB, suba para S3 e referencie de lá:

```bash
aws s3 cp lambda.zip s3://meu-bucket/lambda/news-scraper.zip

aws lambda update-function-code \
  --function-name news-scraper \
  --s3-bucket meu-bucket \
  --s3-key lambda/news-scraper.zip
```

> **Quando ZIP não basta**: se suas dependências descompactadas passam de 250 MB (comum com numpy, pandas, scikit-learn), você precisa do caminho B (container). Libs de ML tipicamente estouram esse limite.

### Caminho B: Deploy com Container

Para projetos com dependências pesadas ou quando você quer o mesmo ambiente local e na cloud.

**Passo 1: Dockerfile para Lambda**

```dockerfile
FROM public.ecr.aws/lambda/python:3.12

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scraper.py .

CMD ["scraper.handler"]
```

Se você usa `uv` no projeto:

```dockerfile
FROM public.ecr.aws/lambda/python:3.12

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache .

COPY scraper.py .

CMD ["scraper.handler"]
```

A imagem base `public.ecr.aws/lambda/python:3.12` já inclui o runtime da Lambda. O `CMD` aponta para a função handler (`arquivo.função`).

> **Cold start**: Lambda com container image pode levar 5-15 segundos no primeiro invoke (a AWS precisa baixar e descompactar a imagem). Para um scraper agendado isso é irrelevante — mas não use este padrão para APIs em Lambda + API Gateway sem considerar provisioned concurrency.

**Passo 2: Subir para o ECR**

```bash
# Criar repositório no ECR (o registry privado da AWS)
aws ecr create-repository \
  --repository-name news-scraper \
  --image-scanning-configuration scanOnPush=true \
  --region $AWS_REGION

# Login no ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com

# Build, tag e push (use o git SHA como tag para rastreabilidade)
GIT_SHA=$(git rev-parse --short HEAD)
docker build -t news-scraper .
docker tag news-scraper:latest $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-scraper:$GIT_SHA
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-scraper:$GIT_SHA
```

**Passo 3: Criar a função**

```bash
aws lambda create-function \
  --function-name news-scraper \
  --package-type Image \
  --code ImageUri=$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-scraper:$GIT_SHA \
  --role arn:aws:iam::$AWS_ACCOUNT:role/lambda-execution-role \
  --memory-size 512 \
  --timeout 900 \
  --region $AWS_REGION
```

> **Evite a tag `latest` em produção**: ela é mutável — duas pessoas podem pushar imagens diferentes com a mesma tag. Use o git SHA ou semver para garantir reprodutibilidade e facilitar rollback.

> **Dica de custo**: ECR cobra $0.10/GB/mês. Adicione uma lifecycle policy para manter só as últimas 5 imagens:
> ```bash
> aws ecr put-lifecycle-policy \
>   --repository-name news-scraper \
>   --lifecycle-policy-text '{
>     "rules": [{
>       "rulePriority": 1,
>       "selection": {"tagStatus": "any", "countType": "imageCountMoreThan", "countNumber": 5},
>       "action": {"type": "expire"}
>     }]
>   }'
> ```

### Criar a IAM Role

Independente do caminho (ZIP ou container), a Lambda precisa de uma role:

```bash
# Criar a role
aws iam create-role \
  --role-name lambda-execution-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Permissão básica (logs)
aws iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Adicione o que seu scraper precisar (S3, Bedrock, OpenSearch, etc.)
aws iam put-role-policy \
  --role-name lambda-execution-role \
  --policy-name s3-write \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::meu-bucket-artigos/*"
    }]
  }'
```

### Passo 4: Agendar com EventBridge Scheduler

Aqui entra o **EventBridge Scheduler** — o serviço de agendamento da AWS. É o equivalente ao `cron`, mas gerenciado.

```bash
# Criar a role para o Scheduler invocar a Lambda
aws iam create-role \
  --role-name scheduler-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "scheduler.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam put-role-policy \
  --role-name scheduler-lambda-role \
  --policy-name invoke-lambda \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:'$AWS_REGION':'$AWS_ACCOUNT':function:news-scraper"
    }]
  }'

# Criar o schedule — a cada 4 horas
aws scheduler create-schedule \
  --name news-scraper-schedule \
  --schedule-expression "rate(4 hours)" \
  --schedule-expression-timezone "America/Sao_Paulo" \
  --flexible-time-window '{"Mode": "OFF"}' \
  --target '{
    "Arn": "arn:aws:lambda:'$AWS_REGION':'$AWS_ACCOUNT':function:news-scraper",
    "RoleArn": "arn:aws:iam::'$AWS_ACCOUNT':role/scheduler-lambda-role"
  }' \
  --region $AWS_REGION
```

Pronto. A cada 4 horas, o EventBridge dispara a Lambda, que roda o scraper, salva no S3, e desliga. Você não paga nada entre as execuções.

### Outras Expressões de Agendamento

```bash
rate(4 hours)                    # A cada 4 horas
rate(1 day)                      # Diariamente
cron(0 8 * * ? *)                # Todo dia às 8h UTC
cron(30 9 ? * MON-FRI *)         # Dias úteis às 9:30 UTC
cron(0 */6 * * ? *)              # A cada 6 horas
```

> **EventBridge Scheduler vs EventBridge Rules**: ambos agendam, mas o Scheduler é mais novo e melhor — suporta fuso horário, retry automático, dead-letter queue, e aceita até 1 milhão de schedules por conta. Use o Scheduler para projetos novos.

### Testar e Monitorar

```bash
# Testar manualmente
aws lambda invoke \
  --function-name news-scraper \
  --payload '{}' \
  response.json

# Ver logs
aws logs tail /aws/lambda/news-scraper --follow

# Atualizar a imagem após mudanças
GIT_SHA=$(git rev-parse --short HEAD)
docker build -t news-scraper .
docker tag news-scraper:latest $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-scraper:$GIT_SHA
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-scraper:$GIT_SHA
aws lambda update-function-code \
  --function-name news-scraper \
  --image-uri $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-scraper:$GIT_SHA
```

### Quanto Custa?

Para nosso scraper (512 MB, 5 min, 6x/dia):

| Item | Cálculo | Custo |
|------|---------|-------|
| Requests | 180/mês | $0.00 |
| Compute | 27.000 GB-segundos | $0.45 |
| **Total** | | **~$0.45/mês** |

Na prática, o free tier da Lambda (400.000 GB-segundos/mês) cobre isso inteiramente nos primeiros 12 meses.

> **Por que Lambda pode custar mais que Fargate?** Lambda cobra por GB-segundo — 512 MB × 5 min × 6 execuções = 27.000 GB-segundos. Fargate cobra por vCPU-hora com granularidade de segundo, e 0.25 vCPU é mais barato que o equivalente em Lambda. Para jobs curtos e frequentes com memória moderada, Fargate pode surpreender no custo. Na prática, a simplicidade de Lambda (zero infra para gerenciar) justifica os centavos a mais.

---

## Nível 2: ECS Fargate — Para Quando Lambda Não Basta

Lambda resolve a maioria dos scrapers, mas tem limites. Se o seu job:

- Leva mais de 15 minutos
- Precisa de mais de 10 GB de memória
- Precisa de networking específico (VPC, acesso a banco privado)
- Roda múltiplos containers juntos

...então você precisa do **ECS Fargate**.

### O Que É ECS Fargate?

**ECS** (Elastic Container Service) é o orquestrador de containers da AWS. **Fargate** é o modo "serverless" do ECS — você define o container e os recursos, a AWS gerencia o servidor por baixo.

Os conceitos:

| Conceito | O Que É | Analogia |
|----------|---------|----------|
| **Cluster** | Agrupamento lógico de tasks | Uma pasta |
| **Task Definition** | Blueprint do container (imagem, CPU, memória, variáveis) | Um `docker-compose.yaml` |
| **Task** | Uma execução do blueprint | Um `docker run` |
| **Service** | Mantém N tasks rodando 24/7 | `docker compose up` com restart |
| **Scheduled Task** | Task disparada por agendamento | `cron` + `docker run` |

Para o scraper, vamos usar **Scheduled Task** — roda, faz o trabalho, e desliga. Sem Service, sem custo ocioso.

### Passo 1: Criar o Cluster

```bash
aws ecs create-cluster --cluster-name scraper-cluster --region $AWS_REGION
```

### Passo 2: Criar as Roles IAM

Fargate precisa de duas roles:

```bash
# Execution Role — usada pelo ECS para puxar imagem do ECR e escrever logs
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Task Role — usada pelo SEU container para acessar S3, OpenSearch, etc.
aws iam create-role \
  --role-name scraperTaskRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Adicione as permissões que seu scraper precisa (ex: S3)
aws iam put-role-policy \
  --role-name scraperTaskRole \
  --policy-name s3-write \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::meu-bucket-artigos/*"
    }]
  }'
```

**Execution Role vs Task Role** — essa distinção confunde muita gente:
- **Execution Role**: o ECS usa para operações de infra (puxar imagem, enviar logs). Você quase nunca muda.
- **Task Role**: seu container assume em runtime. É onde você coloca permissões para S3, DynamoDB, OpenSearch, Bedrock, etc.

### Passo 3: Criar a Task Definition

Crie um arquivo `task-def.json`:

```json
{
  "family": "news-scraper",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/scraperTaskRole",
  "containerDefinitions": [
    {
      "name": "scraper",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/news-scraper:latest",
      "essential": true,
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/news-scraper",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "environment": [
        {"name": "S3_BUCKET", "value": "meu-bucket-artigos"},
        {"name": "SCRAPER_SOURCES", "value": "google_news,rundown"}
      ]
    }
  ]
}
```

```bash
# Criar o log group
aws logs create-log-group --log-group-name /ecs/news-scraper --region $AWS_REGION

# Registrar a task definition
aws ecs register-task-definition --cli-input-json file://task-def.json --region $AWS_REGION
```

> **CPU e memória**: Fargate tem combinações válidas predefinidas. As mais comuns:
> | CPU | Memória |
> |-----|---------|
> | 256 (.25 vCPU) | 512 MB, 1 GB, 2 GB |
> | 512 (.5 vCPU) | 1 GB a 4 GB |
> | 1024 (1 vCPU) | 2 GB a 8 GB |
> | 2048 (2 vCPU) | 4 GB a 16 GB |
> | 4096 (4 vCPU) | 8 GB a 30 GB |

### Passo 4: Agendar com EventBridge Scheduler

```bash
# Role para o Scheduler disparar tasks no ECS
aws iam create-role \
  --role-name scheduler-ecs-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "scheduler.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam put-role-policy \
  --role-name scheduler-ecs-role \
  --policy-name ecs-run-task \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "ecs:RunTask",
        "Resource": "arn:aws:ecs:'$AWS_REGION':'$AWS_ACCOUNT':task-definition/news-scraper:*"
      },
      {
        "Effect": "Allow",
        "Action": "iam:PassRole",
        "Resource": [
          "arn:aws:iam::'$AWS_ACCOUNT':role/ecsTaskExecutionRole",
          "arn:aws:iam::'$AWS_ACCOUNT':role/scraperTaskRole"
        ]
      }
    ]
  }'

# Criar o schedule
aws scheduler create-schedule \
  --name news-scraper-fargate \
  --schedule-expression "rate(4 hours)" \
  --schedule-expression-timezone "America/Sao_Paulo" \
  --flexible-time-window '{"Mode": "OFF"}' \
  --target '{
    "Arn": "arn:aws:ecs:'$AWS_REGION':'$AWS_ACCOUNT':cluster/scraper-cluster",
    "RoleArn": "arn:aws:iam::'$AWS_ACCOUNT':role/scheduler-ecs-role",
    "EcsParameters": {
      "TaskDefinitionArn": "arn:aws:ecs:'$AWS_REGION':'$AWS_ACCOUNT':task-definition/news-scraper",
      "TaskCount": 1,
      "LaunchType": "FARGATE",
      "NetworkConfiguration": {
        "AwsvpcConfiguration": {
          "Subnets": ["subnet-abc123"],
          "SecurityGroups": ["sg-abc123"],
          "AssignPublicIp": "ENABLED"
        }
      }
    },
    "RetryPolicy": {
      "MaximumRetryAttempts": 2,
      "MaximumEventAgeInSeconds": 3600
    }
  }' \
  --region $AWS_REGION
```

> **Subnets e Security Groups**: Fargate roda dentro de uma VPC, então você precisa especificar subnet e security group. Se estiver usando a VPC default, pegue os IDs com:
> ```bash
> aws ec2 describe-subnets --filters "Name=default-for-az,Values=true" --query "Subnets[].SubnetId" --output text
> aws ec2 describe-security-groups --filters "Name=group-name,Values=default" --query "SecurityGroups[].GroupId" --output text
> ```
> O `AssignPublicIp: ENABLED` é necessário se a subnet é pública (o container precisa de internet para acessar sites e o ECR).

> **Cuidado com NAT Gateway**: se você usar private subnets (sem IP público), o Fargate precisa de um NAT Gateway para acessar a internet. O NAT custa ~$32/mês fixo — muito mais que o próprio compute do scraper. Para projetos pessoais ou MVPs, use public subnets com `AssignPublicIp: ENABLED` e evite esse custo.

### Testar e Monitorar

```bash
# Rodar manualmente (sem esperar o schedule)
aws ecs run-task \
  --cluster scraper-cluster \
  --task-definition news-scraper \
  --launch-type FARGATE \
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": ["subnet-abc123"],
      "securityGroups": ["sg-abc123"],
      "assignPublicIp": "ENABLED"
    }
  }' \
  --region $AWS_REGION

# Ver logs
aws logs tail /ecs/news-scraper --follow

# Listar tasks (rodando ou recentes)
aws ecs list-tasks --cluster scraper-cluster --region $AWS_REGION
```

### Quanto Custa?

Para nosso scraper (0.25 vCPU, 512 MB, 5 min, 6x/dia):

| Item | Cálculo | Custo |
|------|---------|-------|
| vCPU | 0.25 × 15h × $0.04048/h | $0.15 |
| Memória | 0.5 GB × 15h × $0.004445/h | $0.03 |
| **Total** | | **~$0.19/mês** |

> **Fargate Spot**: para tarefas tolerantes a interrupção (como scrapers), Fargate Spot reduz o custo em até 70%. Basta trocar `"LaunchType": "FARGATE"` por `"CapacityProviderStrategy": [{"capacityProvider": "FARGATE_SPOT", "weight": 1}]`. Se a AWS precisar da capacidade de volta, a task é interrompida — mas para um scraper que roda a cada 4 horas, isso raramente importa.

---

## Nível 3: O Pipeline Completo — Scrape → Enrich → Index

O scraper sozinho é só a primeira peça. Na prática, você precisa de um **pipeline**:

1. **Scraper** coleta artigos brutos e salva no S3
2. **Enrichment** gera embeddings vetoriais (Amazon Bedrock Titan)
3. **Ingestion** indexa no OpenSearch Serverless para busca semântica

Cada etapa pode ser uma Lambda separada — e o S3 pode ser o "barramento" que conecta tudo via eventos.

### Opção A: S3 Event → Lambda (Simples)

Quando o scraper salva um arquivo no S3, uma segunda Lambda é disparada automaticamente para processar:

```bash
# Criar a Lambda de enrichment
aws lambda create-function \
  --function-name news-enrichment \
  --package-type Image \
  --code ImageUri=$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-enrichment:latest \
  --role arn:aws:iam::$AWS_ACCOUNT:role/enrichment-role \
  --memory-size 1024 \
  --timeout 900 \
  --region $AWS_REGION

# Permitir que o S3 invoque a Lambda
aws lambda add-permission \
  --function-name news-enrichment \
  --statement-id s3-trigger \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::meu-bucket-artigos

# Configurar a notificação no bucket
aws s3api put-bucket-notification-configuration \
  --bucket meu-bucket-artigos \
  --notification-configuration '{
    "LambdaFunctionConfigurations": [{
      "LambdaFunctionArn": "arn:aws:lambda:'$AWS_REGION':'$AWS_ACCOUNT':function:news-enrichment",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "raw/"},
            {"Name": "suffix", "Value": ".jsonl"}
          ]
        }
      }
    }]
  }'
```

O fluxo:
1. Scraper salva `raw/google_news/2026-04-20/batch_001.jsonl`
2. S3 emite evento → dispara `news-enrichment`
3. Lambda lê o JSONL, chama Bedrock para gerar embeddings, e indexa no OpenSearch

**Quando usar**: pipeline com 2 etapas, sem necessidade de retry sofisticado.

### Opção B: Step Functions (Orquestração Robusta)

Se o pipeline tem múltiplas etapas que podem falhar independentemente, **Step Functions** oferece retry por etapa, rollback, e visibilidade:

```json
{
  "Comment": "News pipeline: scrape → enrich → ingest",
  "StartAt": "Scrape",
  "States": {
    "Scrape": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:news-scraper",
      "ResultPath": "$.scrapeResult",
      "Retry": [{"ErrorEquals": ["States.ALL"], "MaxAttempts": 2, "BackoffRate": 2}],
      "Next": "Enrich"
    },
    "Enrich": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:news-enrichment",
      "ResultPath": "$.enrichResult",
      "Retry": [{"ErrorEquals": ["States.ALL"], "MaxAttempts": 3, "BackoffRate": 2}],
      "Next": "Ingest"
    },
    "Ingest": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:news-ingest",
      "Retry": [{"ErrorEquals": ["States.ALL"], "MaxAttempts": 2, "BackoffRate": 2}],
      "End": true
    }
  }
}
```

```bash
# Criar a state machine
aws stepfunctions create-state-machine \
  --name news-pipeline \
  --definition file://pipeline.json \
  --role-arn arn:aws:iam::$AWS_ACCOUNT:role/step-functions-role \
  --region $AWS_REGION

# Agendar via EventBridge Scheduler
aws scheduler create-schedule \
  --name news-pipeline-schedule \
  --schedule-expression "rate(4 hours)" \
  --schedule-expression-timezone "America/Sao_Paulo" \
  --flexible-time-window '{"Mode": "OFF"}' \
  --target '{
    "Arn": "arn:aws:states:'$AWS_REGION':'$AWS_ACCOUNT':stateMachine:news-pipeline",
    "RoleArn": "arn:aws:iam::'$AWS_ACCOUNT':role/scheduler-stepfunctions-role",
    "Input": "{\"source\": \"all\"}"
  }' \
  --region $AWS_REGION
```

**Quando usar**: 3+ etapas, etapas com taxas de erro diferentes (ex: Bedrock pode ter throttling), necessidade de visibilidade no console (Step Functions mostra o grafo de execução em tempo real).

### IAM para Bedrock e OpenSearch Serverless

O enrichment precisa de permissões específicas:

```bash
# Permissão para invocar modelos no Bedrock
aws iam put-role-policy \
  --role-name enrichment-role \
  --policy-name bedrock-invoke \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:'$AWS_REGION'::foundation-model/amazon.titan-embed-text-v2:0"
    }]
  }'
```

Para **OpenSearch Serverless**, a IAM policy sozinha não basta — você precisa de uma **data access policy** no próprio OpenSearch que referencia a role:

```bash
# IAM policy na role (necessária mas não suficiente)
aws iam put-role-policy \
  --role-name enrichment-role \
  --policy-name opensearch-write \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "aoss:APIAccessAll",
      "Resource": "arn:aws:aoss:'$AWS_REGION':'$AWS_ACCOUNT':collection/<collection-id>"
    }]
  }'

# Data access policy no OpenSearch Serverless (sem isso, a role não acessa os índices)
aws opensearchserverless create-access-policy \
  --name enrichment-access \
  --type data \
  --policy '[{
    "Rules": [
      {"Resource": ["index/newsletter-articles/*"], "Permission": ["aoss:WriteDocument", "aoss:ReadDocument", "aoss:CreateIndex", "aoss:DescribeIndex"], "ResourceType": "index"}
    ],
    "Principal": ["arn:aws:iam::'$AWS_ACCOUNT':role/enrichment-role"]
  }]'
```

> **Atenção**: OpenSearch Serverless usa autenticação SigV4 (não usuário/senha). Seu código precisa assinar as requests com as credenciais da role — bibliotecas como `opensearch-py` com `AWSV4SignerAuth` fazem isso automaticamente.

### Quanto Custa o Pipeline Completo?

| Componente | Custo/mês | Notas |
|-----------|-----------|-------|
| Lambda scraper (512 MB, 5 min, 6x/dia) | $0.45 | Free tier cobre nos primeiros 12 meses |
| Lambda enrichment (1 GB, 2 min, 6x/dia) | $0.30 | Bedrock embeddings são rápidos |
| Bedrock Titan Embed (~100 artigos × 6x/dia) | $0.01 | $0.0001 por 1K tokens |
| OpenSearch Serverless (2 OCU mínimo) | ~$50 | O item mais caro — mínimo de 2 OCU |
| S3 (artigos JSONL) | $0.02 | Negligível |
| Step Functions (se usado) | $0.05 | 180 execuções/mês |
| **Total** | **~$51** | OpenSearch domina o custo |

> **O elefante na sala**: OpenSearch Serverless tem mínimo de 2 OCU ($0.24/h × 2 × 730h = ~$350 na tabela oficial). Na prática, para uso dev/teste, a AWS oferece preço reduzido em collections novas. Se custo for crítico, considere alternativas: OpenSearch em EC2, Pinecone free tier, ou PostgreSQL com `pgvector`.

### S3 Event vs Step Functions: Quando Usar Cada Um

| | S3 Event → Lambda | Step Functions |
|---|---|---|
| **Complexidade** | Mínima | Moderada |
| **Etapas** | 1-2 | 3+ |
| **Retry** | Básico (Lambda retry) | Configurável por etapa |
| **Visibilidade** | CloudWatch Logs | Console visual com grafo |
| **Debugging** | Difícil (eventos dispersos) | Fácil (histórico de execuções) |
| **Custo adicional** | $0 | ~$0.025 por 1K transições |
| **Melhor para** | "Quando X aparece, faça Y" | "Execute A, depois B, depois C com retry" |

---

## Comparação Final: Qual Serviço Usar?

### Compute: Lambda vs Fargate

| | Lambda | Fargate (Scheduled Task) |
|---|---|---|
| **Complexidade** | Muito baixa | Média |
| **Max runtime** | 15 min | Sem limite |
| **Max memória** | 10 GB | 120 GB |
| **Networking** | Opcional (VPC) | Obrigatório (VPC) |
| **Custo (nosso scraper)** | ~$0.45/mês | ~$0.19/mês |
| **Cold start** | 1-15s (container: ~10s) | 30-60s (provisionamento) |
| **Agendamento** | EventBridge Scheduler | EventBridge Scheduler |
| **Melhor para** | Jobs curtos e simples | Jobs longos ou complexos |

### Orquestração: S3 Events vs Step Functions

| | S3 Event → Lambda | Step Functions |
|---|---|---|
| **Complexidade** | Mínima | Moderada |
| **Modelo** | Reativo ("quando X, faça Y") | Orquestração ("A → B → C") |
| **Retry** | Básico | Configurável por etapa |
| **Visibilidade** | CloudWatch Logs | Console visual com grafo |
| **Custo adicional** | $0 | ~$0.025/1K transições |
| **Melhor para** | Pipeline linear simples | Pipeline com branches/retry/parallelism |

### Árvore de Decisão

```
É uma tarefa agendada/batch?
├── Termina em < 15 min?
│   ├── SIM → Lambda + EventBridge Scheduler
│   └── NÃO → Fargate Scheduled Task
├── Precisa de GPU? → ECS Fargate (com instância GPU)
└── Tem múltiplas etapas (scrape → enrich → index)?
    ├── 2 etapas simples → S3 Event → Lambda
    └── 3+ etapas ou retry complexo → Step Functions
```

### Custo Mensal Estimado (Nosso Scraper)

| Serviço | Custo/mês | Notas |
|---------|-----------|-------|
| **Lambda** | $0.45 | Free tier cobre nos primeiros 12 meses |
| **Fargate** | $0.19 | Fargate Spot: ~$0.06 |
| **Fargate Spot** | $0.06 | Pode ser interrompido (ok para scrapers) |
| **EC2 t3.micro 24/7** | ~$7.60 | Para comparação |

> **Custo ≠ complexidade**: Lambda custa mais que Fargate neste cenário, mas é drasticamente mais simples de operar. Pagar centavos a mais para não gerenciar VPC/subnets/security groups é quase sempre o tradeoff certo — especialmente para um time pequeno.

---

## Receita Completa: A Arquitetura do Scraper de Notícias

Na prática, a arquitetura completa combina múltiplos serviços — cada um fazendo o que faz melhor:

```
EventBridge Scheduler (cron: a cada 4h)
        │
        ▼
   AWS Lambda (scraper)           ← Coleta artigos de múltiplas fontes
        │
        ▼
   S3 (raw/ — JSONL bruto)        ← Trigger via S3 Event
        │
        ▼
   AWS Lambda (enrichment)        ← Gera embeddings via Bedrock Titan
        │
        ▼
   OpenSearch Serverless          ← Busca semântica (k-NN)
        │
        ▼
   Web App (consulta via API)     ← Chatbot de newsletter
```

- **Lambda** (scraper) coleta artigos periodicamente — custo: centavos
- **S3** funciona como barramento: armazena os dados brutos e dispara o próximo estágio
- **Lambda** (enrichment) gera embeddings de 1024 dimensões e indexa — custo: centavos
- **OpenSearch Serverless** serve busca vetorial e keyword — custo: ~$50/mês (domina o orçamento)

Cada peça é independente e testável isoladamente. Se o enrichment falhar, os artigos brutos estão no S3 — basta reprocessar.

---

## Infraestrutura como Código com Terraform

Subir tudo pela CLI funciona para experimentar, mas para produção use **Terraform** (ou CDK). Aqui vai um exemplo mínimo para o setup Lambda + EventBridge:

```hcl
# main.tf
provider "aws" {
  region = "us-east-1"
}

resource "aws_ecr_repository" "scraper" {
  name                 = "news-scraper"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_lambda_function" "scraper" {
  function_name = "news-scraper"
  role          = aws_iam_role.lambda_role.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.scraper.repository_url}:latest"
  memory_size   = 512
  timeout       = 900
}

resource "aws_scheduler_schedule" "scraper" {
  name                = "news-scraper-schedule"
  schedule_expression = "rate(4 hours)"

  schedule_expression_timezone = "America/Sao_Paulo"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.scraper.arn
    role_arn = aws_iam_role.scheduler_role.arn
  }
}

resource "aws_iam_role" "lambda_role" {
  name = "news-scraper-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role" "scheduler_role" {
  name = "news-scraper-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  role = aws_iam_role.scheduler_role.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = "lambda:InvokeFunction"
      Effect   = "Allow"
      Resource = aws_lambda_function.scraper.arn
    }]
  })
}
```

```bash
terraform init
terraform plan    # Revise o que será criado
terraform apply   # Crie a infraestrutura
```

> **Dica**: sempre revise o `terraform plan` antes de aplicar, especialmente quando o código foi gerado por LLM. Verifique o que está sendo criado e as permissões atribuídas.

---

## Resumo

| Você quer... | Use | Conexão |
|-------------|-----|---------|
| Rodar um scraper a cada N horas | **Lambda** | EventBridge Scheduler |
| Rodar um job pesado/longo periodicamente | **Fargate Scheduled Task** | EventBridge Scheduler |
| Disparar processamento quando um arquivo chega | **Lambda** | S3 Event Notification |
| Orquestrar múltiplas etapas com retry | **Step Functions** | EventBridge Scheduler |
| Pipeline completo (scrape → enrich → index) | **Lambda + S3 Events** ou **Step Functions** | EventBridge Scheduler → S3 → Lambda chain |

A AWS parece complexa porque oferece 10 formas de fazer a mesma coisa. Mas para pipelines de dados com containers, a decisão é simples: Lambda para jobs curtos, Fargate para jobs longos, S3 como barramento entre etapas, e EventBridge Scheduler para iniciar tudo. ECR para guardar as imagens. É isso.
