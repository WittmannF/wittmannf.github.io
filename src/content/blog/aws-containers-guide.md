---
title: 'Deploy on AWS with Containers: Lambda and Fargate in Practice'
description: 'Practical guide to deploying on AWS with Docker containers. We start with Lambda (the simplest option), move to Fargate for long-running jobs, and build a complete pipeline with enrichment and vector search. Real-world example: a news scraper for a newsletter.'
pubDate: 2026-04-18
tags: ['AWS', 'Docker', 'DevOps', 'Lambda', 'Fargate', 'Python']
lang: 'en'
---

You dockerized your application. It works on your machine, the image is ready. Now you need it running in the cloud — preferably without managing servers, without paying when idle, and without spending a week configuring infrastructure.

AWS has **dozens** of ways to run a container. That's the problem: so many options that the decision paralyzes you. This guide cuts through the noise. We'll cover the **two options that matter** for scheduled tasks, in order of complexity, and then build the complete pipeline:

1. **Lambda** — runs a container on demand, pay per execution. Ideal for short, scheduled tasks.
2. **ECS Fargate** — runs containers without managing servers, with more control. For long or complex tasks.
3. **Complete pipeline** — connect scraper → enrichment → vector search with S3 events and Step Functions.

As a practical example, we'll use a **news scraper for a newsletter** — an application that needs to run every few hours, collect articles, enrich them with embeddings, and index them in a vector search engine. A real scenario that covers scheduling, containers, event-driven pipelines, and cost.

> **Prerequisite**: you already know Docker basics (Dockerfile, build, push). If not, read the [Practical Docker Guide](/blog/docker-ultimate-guide) first.

---

## The Example: A News Scraper

Our scraper is simple: it collects AI headlines from sources like Google News, processes them with an LLM to classify by topic, and saves the results to S3.

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

The scraper runs every 4 hours, takes ~5 minutes, and uses ~512MB of RAM. But the scraper is only the first step — after it, we need to enrich the articles with embeddings and index them for search. We'll start with compute and then build the complete pipeline.

---

## Level 1: AWS Lambda — The Simplest Path

Lambda is serverless in the purest sense: you deliver the code (or a container), AWS runs it, and you pay only for execution time. No server, no cluster, nothing to manage.

### Why Lambda for a Scraper?

- **Zero infrastructure**: no VPC, subnet, or security group required
- **Pay per use**: ~$0.45/month for our scraper (yes, cents)
- **Native scheduling**: EventBridge Scheduler triggers Lambda whenever you want

### Limitations

Before you start, the constraints that matter:

| Limit | Value |
|-------|-------|
| Maximum timeout | **15 minutes** |
| Memory | 128 MB to 10 GB |
| Docker image | up to 10 GB |
| Temporary storage (`/tmp`) | up to 10 GB |
| No network port | Lambda doesn't "listen" — pure invocation |

If your scraper finishes in under 15 minutes, Lambda is the right choice. If not, skip to Level 2 (Fargate).

### Do I Need Docker?

Not necessarily. Lambda accepts two deployment formats:

| Format | Size limit | When to use |
|--------|-----------|-------------|
| **ZIP** | 50 MB (zip) / 250 MB (unzipped) | Lightweight apps, few dependencies |
| **Container** | 10 GB | Heavy dependencies (ML, numpy, scipy), complex environment |

For a Python scraper with few dependencies, ZIP is simpler. If your project is already an installable package with `pip install -e .` or `uv pip install -e .`, even better.

### Path A: Deploy with ZIP (No Docker)

The fastest way to deploy a Lambda — no Docker, no ECR, nothing else.

**Step 1: Package dependencies**

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

If your project is an installable CLI (with `pyproject.toml`):

```bash
mkdir -p package
uv pip install . --target package/
cd package && zip -r ../lambda.zip . && cd ..
```

**Step 2: Create the function**

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

**To update:**

```bash
# Reempacotar
cd package && zip -r ../lambda.zip . && cd ..

# Atualizar a função
aws lambda update-function-code \
  --function-name news-scraper \
  --zip-file fileb://lambda.zip
```

Simple. No Docker, no registry, no image build. If the zip exceeds 50 MB, upload to S3 and reference it from there:

```bash
aws s3 cp lambda.zip s3://meu-bucket/lambda/news-scraper.zip

aws lambda update-function-code \
  --function-name news-scraper \
  --s3-bucket meu-bucket \
  --s3-key lambda/news-scraper.zip
```

> **When ZIP isn't enough**: if your unzipped dependencies exceed 250 MB (common with numpy, pandas, scikit-learn), you need Path B (container). ML libraries typically blow past this limit.

### Path B: Deploy with Container

For projects with heavy dependencies or when you want the same environment locally and in the cloud.

**Step 1: Dockerfile for Lambda**

```dockerfile
FROM public.ecr.aws/lambda/python:3.12

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scraper.py .

CMD ["scraper.handler"]
```

If you use `uv` in the project:

```dockerfile
FROM public.ecr.aws/lambda/python:3.12

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache .

COPY scraper.py .

CMD ["scraper.handler"]
```

The base image `public.ecr.aws/lambda/python:3.12` already includes the Lambda runtime. The `CMD` points to the handler function (`file.function`).

> **Cold start**: Lambda with a container image can take 5–15 seconds on the first invoke (AWS needs to pull and unpack the image). For a scheduled scraper this is irrelevant — but don't use this pattern for APIs on Lambda + API Gateway without considering provisioned concurrency.

**Step 2: Push to ECR**

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

**Step 3: Create the function**

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

> **Avoid the `latest` tag in production**: it's mutable — two people can push different images with the same tag. Use git SHA or semver to ensure reproducibility and make rollback easier.

> **Cost tip**: ECR charges $0.10/GB/month. Add a lifecycle policy to keep only the last 5 images:
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

### Create the IAM Role

Regardless of path (ZIP or container), Lambda needs a role:

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

### Step 4: Schedule with EventBridge Scheduler

This is where **EventBridge Scheduler** comes in — AWS's scheduling service. It's the equivalent of `cron`, but managed.

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

Done. Every 4 hours, EventBridge triggers Lambda, which runs the scraper, saves to S3, and shuts down. You pay nothing between executions.

### Other Schedule Expressions

```bash
rate(4 hours)                    # A cada 4 horas
rate(1 day)                      # Diariamente
cron(0 8 * * ? *)                # Todo dia às 8h UTC
cron(30 9 ? * MON-FRI *)         # Dias úteis às 9:30 UTC
cron(0 */6 * * ? *)              # A cada 6 horas
```

> **EventBridge Scheduler vs EventBridge Rules**: both schedule tasks, but Scheduler is newer and better — it supports time zones, automatic retry, dead-letter queues, and accepts up to 1 million schedules per account. Use Scheduler for new projects.

### Test and Monitor

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

### How Much Does It Cost?

For our scraper (512 MB, 5 min, 6x/day):

| Item | Calculation | Cost |
|------|-------------|------|
| Requests | 180/month | $0.00 |
| Compute | 27,000 GB-seconds | $0.45 |
| **Total** | | **~$0.45/month** |

In practice, Lambda's free tier (400,000 GB-seconds/month) covers this entirely for the first 12 months.

> **Why can Lambda cost more than Fargate?** Lambda charges per GB-second — 512 MB × 5 min × 6 runs = 27,000 GB-seconds. Fargate charges per vCPU-hour with second-level granularity, and 0.25 vCPU is cheaper than the Lambda equivalent. For short, frequent jobs with moderate memory, Fargate can surprise you on cost. In practice, Lambda's simplicity (zero infrastructure to manage) justifies the few extra cents.

---

## Level 2: ECS Fargate — When Lambda Isn't Enough

Lambda handles most scrapers, but it has limits. If your job:

- Takes more than 15 minutes
- Needs more than 10 GB of memory
- Requires specific networking (VPC, access to a private database)
- Runs multiple containers together

...then you need **ECS Fargate**.

### What Is ECS Fargate?

**ECS** (Elastic Container Service) is AWS's container orchestrator. **Fargate** is ECS's "serverless" mode — you define the container and resources, AWS manages the server underneath.

The concepts:

| Concept | What It Is | Analogy |
|---------|------------|---------|
| **Cluster** | Logical grouping of tasks | A folder |
| **Task Definition** | Container blueprint (image, CPU, memory, variables) | A `docker-compose.yaml` |
| **Task** | One execution of the blueprint | A `docker run` |
| **Service** | Keeps N tasks running 24/7 | `docker compose up` with restart |
| **Scheduled Task** | Task triggered on a schedule | `cron` + `docker run` |

For the scraper, we'll use **Scheduled Task** — it runs, does the work, and shuts down. No Service, no idle cost.

### Step 1: Create the Cluster

```bash
aws ecs create-cluster --cluster-name scraper-cluster --region $AWS_REGION
```

### Step 2: Create IAM Roles

Fargate needs two roles:

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

**Execution Role vs Task Role** — this distinction confuses a lot of people:
- **Execution Role**: ECS uses it for infrastructure operations (pull image, send logs). You almost never change it.
- **Task Role**: your container assumes it at runtime. This is where you put permissions for S3, DynamoDB, OpenSearch, Bedrock, etc.

### Step 3: Create the Task Definition

Create a `task-def.json` file:

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

> **CPU and memory**: Fargate has predefined valid combinations. The most common:
> | CPU | Memory |
> |-----|--------|
> | 256 (.25 vCPU) | 512 MB, 1 GB, 2 GB |
> | 512 (.5 vCPU) | 1 GB to 4 GB |
> | 1024 (1 vCPU) | 2 GB to 8 GB |
> | 2048 (2 vCPU) | 4 GB to 16 GB |
> | 4096 (4 vCPU) | 8 GB to 30 GB |

### Step 4: Schedule with EventBridge Scheduler

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

> **Subnets and Security Groups**: Fargate runs inside a VPC, so you need to specify subnet and security group. If you're using the default VPC, get the IDs with:
> ```bash
> aws ec2 describe-subnets --filters "Name=default-for-az,Values=true" --query "Subnets[].SubnetId" --output text
> aws ec2 describe-security-groups --filters "Name=group-name,Values=default" --query "SecurityGroups[].GroupId" --output text
> ```
> `AssignPublicIp: ENABLED` is required if the subnet is public (the container needs internet access to reach websites and ECR).

> **Watch out for NAT Gateway**: if you use private subnets (no public IP), Fargate needs a NAT Gateway to access the internet. NAT costs ~$32/month fixed — much more than the scraper's compute itself. For personal projects or MVPs, use public subnets with `AssignPublicIp: ENABLED` and avoid that cost.

### Test and Monitor

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

### How Much Does It Cost?

For our scraper (0.25 vCPU, 512 MB, 5 min, 6x/day):

| Item | Calculation | Cost |
|------|-------------|------|
| vCPU | 0.25 × 15h × $0.04048/h | $0.15 |
| Memory | 0.5 GB × 15h × $0.004445/h | $0.03 |
| **Total** | | **~$0.19/month** |

> **Fargate Spot**: for interruption-tolerant tasks (like scrapers), Fargate Spot reduces cost by up to 70%. Just replace `"LaunchType": "FARGATE"` with `"CapacityProviderStrategy": [{"capacityProvider": "FARGATE_SPOT", "weight": 1}]`. If AWS needs the capacity back, the task is interrupted — but for a scraper that runs every 4 hours, that rarely matters.

---

## Level 3: The Complete Pipeline — Scrape → Enrich → Index

The scraper alone is just the first piece. In practice, you need a **pipeline**:

1. **Scraper** collects raw articles and saves to S3
2. **Enrichment** generates vector embeddings (Amazon Bedrock Titan)
3. **Ingestion** indexes in OpenSearch Serverless for semantic search

Each stage can be a separate Lambda — and S3 can be the "bus" that connects everything via events.

### Option A: S3 Event → Lambda (Simple)

When the scraper saves a file to S3, a second Lambda is automatically triggered to process it:

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

The flow:
1. Scraper saves `raw/google_news/2026-04-20/batch_001.jsonl`
2. S3 emits event → triggers `news-enrichment`
3. Lambda reads the JSONL, calls Bedrock to generate embeddings, and indexes in OpenSearch

**When to use**: pipeline with 2 stages, no need for sophisticated retry.

### Option B: Step Functions (Robust Orchestration)

If the pipeline has multiple stages that can fail independently, **Step Functions** offers per-stage retry, rollback, and visibility:

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

**When to use**: 3+ stages, stages with different error rates (e.g., Bedrock may throttle), need for console visibility (Step Functions shows the execution graph in real time).

### IAM for Bedrock and OpenSearch Serverless

Enrichment needs specific permissions:

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

For **OpenSearch Serverless**, the IAM policy alone isn't enough — you need a **data access policy** on OpenSearch itself that references the role:

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

> **Note**: OpenSearch Serverless uses SigV4 authentication (not username/password). Your code needs to sign requests with the role's credentials — libraries like `opensearch-py` with `AWSV4SignerAuth` do this automatically.

### How Much Does the Complete Pipeline Cost?

| Component | Cost/month | Notes |
|-----------|------------|-------|
| Lambda scraper (512 MB, 5 min, 6x/day) | $0.45 | Free tier covers first 12 months |
| Lambda enrichment (1 GB, 2 min, 6x/day) | $0.30 | Bedrock embeddings are fast |
| Bedrock Titan Embed (~100 articles × 6x/day) | $0.01 | $0.0001 per 1K tokens |
| OpenSearch Serverless (2 OCU minimum) | ~$50 | Most expensive item — 2 OCU minimum |
| S3 (JSONL articles) | $0.02 | Negligible |
| Step Functions (if used) | $0.05 | 180 executions/month |
| **Total** | **~$51** | OpenSearch dominates cost |

> **The elephant in the room**: OpenSearch Serverless has a 2 OCU minimum ($0.24/h × 2 × 730h = ~$350 on the official pricing table). In practice, for dev/test use, AWS offers reduced pricing on new collections. If cost is critical, consider alternatives: OpenSearch on EC2, Pinecone free tier, or PostgreSQL with `pgvector`.

### S3 Event vs Step Functions: When to Use Each

| | S3 Event → Lambda | Step Functions |
|---|---|---|
| **Complexity** | Minimal | Moderate |
| **Stages** | 1–2 | 3+ |
| **Retry** | Basic (Lambda retry) | Configurable per stage |
| **Visibility** | CloudWatch Logs | Visual console with graph |
| **Debugging** | Hard (scattered events) | Easy (execution history) |
| **Additional cost** | $0 | ~$0.025 per 1K transitions |
| **Best for** | "When X appears, do Y" | "Run A, then B, then C with retry" |

---

## Final Comparison: Which Service to Use?

### Compute: Lambda vs Fargate

| | Lambda | Fargate (Scheduled Task) |
|---|---|---|
| **Complexity** | Very low | Medium |
| **Max runtime** | 15 min | No limit |
| **Max memory** | 10 GB | 120 GB |
| **Networking** | Optional (VPC) | Required (VPC) |
| **Cost (our scraper)** | ~$0.45/month | ~$0.19/month |
| **Cold start** | 1–15s (container: ~10s) | 30–60s (provisioning) |
| **Scheduling** | EventBridge Scheduler | EventBridge Scheduler |
| **Best for** | Short, simple jobs | Long or complex jobs |

### Orchestration: S3 Events vs Step Functions

| | S3 Event → Lambda | Step Functions |
|---|---|---|
| **Complexity** | Minimal | Moderate |
| **Model** | Reactive ("when X, do Y") | Orchestration ("A → B → C") |
| **Retry** | Basic | Configurable per stage |
| **Visibility** | CloudWatch Logs | Visual console with graph |
| **Additional cost** | $0 | ~$0.025/1K transitions |
| **Best for** | Simple linear pipeline | Pipeline with branches/retry/parallelism |

### Decision Tree

```
Is it a scheduled/batch task?
├── Finishes in < 15 min?
│   ├── YES → Lambda + EventBridge Scheduler
│   └── NO → Fargate Scheduled Task
├── Needs GPU? → ECS Fargate (with GPU instance)
└── Has multiple stages (scrape → enrich → index)?
    ├── 2 simple stages → S3 Event → Lambda
    └── 3+ stages or complex retry → Step Functions
```

### Estimated Monthly Cost (Our Scraper)

| Service | Cost/month | Notes |
|---------|------------|-------|
| **Lambda** | $0.45 | Free tier covers first 12 months |
| **Fargate** | $0.19 | Fargate Spot: ~$0.06 |
| **Fargate Spot** | $0.06 | Can be interrupted (fine for scrapers) |
| **EC2 t3.micro 24/7** | ~$7.60 | For comparison |

> **Cost ≠ complexity**: Lambda costs more than Fargate in this scenario, but is drastically simpler to operate. Paying a few extra cents to avoid managing VPC/subnets/security groups is almost always the right tradeoff — especially for a small team.

---

## Full Recipe: The News Scraper Architecture

In practice, the complete architecture combines multiple services — each doing what it does best:

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

- **Lambda** (scraper) collects articles periodically — cost: cents
- **S3** acts as the bus: stores raw data and triggers the next stage
- **Lambda** (enrichment) generates 1024-dimensional embeddings and indexes — cost: cents
- **OpenSearch Serverless** serves vector and keyword search — cost: ~$50/month (dominates the budget)

Each piece is independent and testable in isolation. If enrichment fails, the raw articles are in S3 — just reprocess them.

---

## Infrastructure as Code with Terraform

Setting everything up via CLI works for experimenting, but for production use **Terraform** (or CDK). Here's a minimal example for the Lambda + EventBridge setup:

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

> **Tip**: always review `terraform plan` before applying, especially when the code was generated by an LLM. Verify what's being created and the permissions being assigned.

---

## Summary

| You want to... | Use | Connection |
|----------------|-----|------------|
| Run a scraper every N hours | **Lambda** | EventBridge Scheduler |
| Run a heavy/long job periodically | **Fargate Scheduled Task** | EventBridge Scheduler |
| Trigger processing when a file arrives | **Lambda** | S3 Event Notification |
| Orchestrate multiple stages with retry | **Step Functions** | EventBridge Scheduler |
| Complete pipeline (scrape → enrich → index) | **Lambda + S3 Events** or **Step Functions** | EventBridge Scheduler → S3 → Lambda chain |

AWS seems complex because it offers 10 ways to do the same thing. But for data pipelines with containers, the decision is simple: Lambda for short jobs, Fargate for long jobs, S3 as the bus between stages, and EventBridge Scheduler to kick everything off. ECR to store the images. That's it.
