---
title: 'Deploy na AWS com Containers: Lambda, Fargate e App Runner na Prática'
description: 'Guia prático de deploy na AWS usando containers Docker. Começamos com Lambda (o mais simples), evoluímos para Fargate com agendamento, e cobrimos App Runner para APIs. Exemplo real: um scraper de notícias para newsletter.'
pubDate: 2026-04-18
tags: ['AWS', 'Docker', 'DevOps', 'Lambda', 'Fargate', 'Python']
lang: 'pt'
---

Você dockerizou sua aplicação. Funciona na sua máquina, a imagem está pronta. Agora precisa que isso rode na cloud — de preferência sem gerenciar servidores, sem pagar quando não está usando, e sem passar uma semana configurando infraestrutura.

A AWS tem **dezenas** de formas de rodar um container. Isso é o problema: são tantas opções que a decisão paralisa. Este guia corta o ruído. Vamos cobrir as **três opções que importam** para a maioria dos casos, em ordem de complexidade:

1. **Lambda** — roda um container sob demanda, paga por execução. Ideal para tarefas curtas e agendadas.
2. **ECS Fargate** — roda containers sem gerenciar servidores, com mais controle. Para tarefas longas ou complexas.
3. **App Runner** — o mais simples para APIs web. O "Cloud Run da AWS".

Como exemplo prático, vamos usar um **scraper de notícias para uma newsletter** — uma aplicação que precisa rodar a cada poucas horas, coletar artigos e salvar no S3. Um cenário real que cobre agendamento, containers e custo.

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

O scraper roda a cada 4 horas, leva ~5 minutos, e usa ~512MB de RAM. Com esse perfil, temos três caminhos possíveis.

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

# Instalar dependências no diretório
pip install -r requirements.txt -t package/

# Copiar seu código
cp scraper.py package/

# Zipar tudo
cd package && zip -r ../lambda.zip . && cd ..
```

Se você usa `uv` e seu projeto é um CLI instalável:

```bash
mkdir -p package
uv pip install . -t package/
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

A imagem base `public.ecr.aws/lambda/python:3.12` já inclui o runtime da Lambda. O `CMD` aponta para a função handler (`arquivo.função`).

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

# Build, tag e push
docker build -t news-scraper .
docker tag news-scraper:latest $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-scraper:latest
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-scraper:latest
```

**Passo 3: Criar a função**

```bash
aws lambda create-function \
  --function-name news-scraper \
  --package-type Image \
  --code ImageUri=$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-scraper:latest \
  --role arn:aws:iam::$AWS_ACCOUNT:role/lambda-execution-role \
  --memory-size 512 \
  --timeout 900 \
  --region $AWS_REGION
```

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
docker build -t news-scraper .
docker tag news-scraper:latest $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-scraper:latest
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-scraper:latest
aws lambda update-function-code \
  --function-name news-scraper \
  --image-uri $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/news-scraper:latest
```

### Quanto Custa?

Para nosso scraper (512 MB, 5 min, 6x/dia):

| Item | Cálculo | Custo |
|------|---------|-------|
| Requests | 180/mês | $0.00 |
| Compute | 27.000 GB-segundos | $0.45 |
| **Total** | | **~$0.45/mês** |

Na prática, o free tier da Lambda (400.000 GB-segundos/mês) cobre isso inteiramente nos primeiros 12 meses.

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

## Nível 3: App Runner — Para APIs Web

App Runner não serve para scrapers agendados — ele é feito para **APIs e aplicações web** que precisam estar disponíveis para receber requests HTTP.

Se além do scraper você também precisa servir os dados via API (ex: um endpoint que retorna as notícias coletadas), App Runner é o caminho mais simples.

### O Que É

App Runner é para APIs o que Lambda é para batch jobs: você entrega o container, ele faz o resto (load balancer, TLS, auto-scaling, domínio).

```bash
aws apprunner create-service \
  --service-name news-api \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "'$AWS_ACCOUNT'.dkr.ecr.'$AWS_REGION'.amazonaws.com/news-api:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "8000",
        "RuntimeEnvironmentVariables": {
          "S3_BUCKET": "meu-bucket-artigos",
          "DATABASE_URL": "postgresql://..."
        }
      }
    },
    "AutoDeploymentsEnabled": true,
    "AuthenticationConfiguration": {
      "AccessRoleArn": "arn:aws:iam::'$AWS_ACCOUNT':role/apprunner-ecr-access-role"
    }
  }' \
  --instance-configuration '{
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB"
  }' \
  --region $AWS_REGION
```

Em ~5 minutos você recebe uma URL pública com HTTPS.

O `AutoDeploymentsEnabled: true` faz com que, toda vez que você pushear uma nova imagem para o ECR, o App Runner faça redeploy automaticamente.

### App Runner vs ECS Fargate para APIs

| Aspecto | App Runner | ECS Fargate (Service) |
|---------|-----------|----------------------|
| Setup | ~1 comando | Cluster + Task Def + Service + ALB |
| TLS/HTTPS | Automático | Configurar ALB + ACM |
| Custom domain | Sim, integrado | Via Route 53 + ALB |
| Auto-scaling | Automático | Configurar manualmente |
| Scale to zero | Sim | Não (mínimo 1 task) |
| VPC access | Via VPC Connector | Nativo |
| Sidecars | Não | Sim |
| Max recursos | 4 vCPU, 12 GB | 16 vCPU, 120 GB |
| Preço | Levemente mais caro | Mais controle sobre custo |

**Regra simples**: se `aws apprunner create-service` resolve, use App Runner. Se precisar de mais controle, use ECS Fargate com um Service.

### Quando NÃO Usar App Runner

- Tarefas agendadas/batch (use Lambda ou Fargate Scheduled Task)
- Timeout maior que 120 segundos por request
- Containers que precisam de GPU
- Workloads que precisam de sidecar containers
- Mais de 4 vCPU ou 12 GB de memória

---

## Comparação Final: Qual Serviço Usar?

### Para Tarefas Agendadas (Scrapers, Batch Jobs, ETL)

| | Lambda | Fargate (Scheduled) |
|---|---|---|
| **Complexidade** | Muito baixa | Média |
| **Max runtime** | 15 min | Sem limite |
| **Max memória** | 10 GB | 120 GB |
| **Networking** | Opcional (VPC) | Obrigatório (VPC) |
| **Custo (nosso scraper)** | ~$0.45/mês | ~$0.19/mês |
| **Agendamento** | EventBridge Scheduler | EventBridge Scheduler |
| **Melhor para** | Jobs curtos e simples | Jobs longos ou complexos |

### Para APIs Web

| | App Runner | Fargate (Service) |
|---|---|---|
| **Complexidade** | Muito baixa | Alta |
| **Scale to zero** | Sim | Não |
| **TLS/HTTPS** | Automático | Manual (ALB + ACM) |
| **Custom domain** | Integrado | Route 53 + ALB |
| **Max recursos** | 4 vCPU, 12 GB | 16 vCPU, 120 GB |
| **Melhor para** | APIs simples | APIs com requisitos complexos |

### Árvore de Decisão

```
Sua aplicação é uma API web (escuta HTTP)?
├── SIM → Precisa de mais de 4 vCPU ou 12 GB?
│   ├── SIM → ECS Fargate Service
│   └── NÃO → App Runner (mais simples)
└── NÃO → É uma tarefa agendada/batch
    ├── Termina em < 15 min?
    │   ├── SIM → Lambda + EventBridge Scheduler
    │   └── NÃO → Fargate Scheduled Task
    └── Precisa de GPU? → ECS Fargate (com instância GPU)
```

### Custo Mensal Estimado (Nosso Scraper)

| Serviço | Custo/mês | Notas |
|---------|-----------|-------|
| **Lambda** | $0.45 | Free tier cobre nos primeiros 12 meses |
| **Fargate** | $0.19 | Fargate Spot: ~$0.06 |
| **Fargate Spot** | $0.06 | Pode ser interrompido (ok para scrapers) |
| **App Runner** | ~$1.57 | Não recomendado para este caso |
| **EC2 t3.micro 24/7** | ~$7.60 | Para comparação |

---

## Receita Completa: Scraper com Lambda + Newsletter com App Runner

Na prática, a arquitetura ideal para nosso caso combina dois serviços:

```
EventBridge Scheduler (cron: a cada 4h)
        │
        ▼
   AWS Lambda (scraper)
        │
        ▼
   S3 (artigos em JSON)
        │
        ▼
   App Runner (API + dashboard)
        │
        ▼
   Usuário acessa a newsletter
```

- **Lambda** coleta os artigos periodicamente (custo: centavos)
- **S3** armazena os dados (custo: centavos)
- **App Runner** serve a API/dashboard (custo: ~$5-15/mês dependendo do tráfego, zero se escalar a zero)

Cada peça faz o que faz melhor. Lambda não fica ociosa esperando; App Runner não precisa ter lógica de agendamento.

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

| Você quer... | Use | Agendamento |
|-------------|-----|-------------|
| Rodar um scraper a cada N horas | **Lambda** | EventBridge Scheduler |
| Rodar um job pesado/longo periodicamente | **Fargate Scheduled Task** | EventBridge Scheduler |
| Servir uma API web | **App Runner** | N/A (sempre disponível) |
| Tudo acima com mais controle | **ECS Fargate Service** | N/A (sempre rodando) |

A AWS parece complexa porque oferece 10 formas de fazer a mesma coisa. Mas para containers, a decisão é simples: Lambda para jobs curtos, Fargate para jobs longos, App Runner para APIs. EventBridge Scheduler para agendar qualquer coisa. ECR para guardar as imagens. É isso.
