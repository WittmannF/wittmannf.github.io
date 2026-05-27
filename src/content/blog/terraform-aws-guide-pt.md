---
title: 'Terraform na AWS: Guia Prático Do Zero à Produção'
description: 'Aprenda Terraform construindo: um scraper de notícias que começa com recursos criados manualmente e termina com infraestrutura versionada, modular e automatizada. Cada problema leva ao próximo conceito.'
pubDate: 2026-04-17
tags: ['Terraform', 'AWS', 'IaC', 'DevOps', 'Cloud', 'Infraestrutura']
lang: 'pt'
---

Você cria uma Lambda pelo console da AWS. Funciona. Adiciona um bucket S3. Um EventBridge Schedule. Uma role IAM. Três semanas depois, um colega pergunta: *"O que exatamente está rodando na nossa conta?"* — e ninguém sabe responder com certeza.

Pior: alguém deleta um recurso pelo console achando que não era usado. A aplicação quebra. Ninguém sabe recriar exatamente o que existia.

Este guia vai te levar dessa situação — infraestrutura criada manualmente pelo console — até tudo versionado em código, modular, com CI/CD e pronto para produção. Cada seção resolve um problema real.

Vamos usar como exemplo um **scraper de notícias agendado na AWS** — Lambda + S3 + EventBridge Scheduler. Se você leu o [guia de deploy na AWS](/pt/blog/aws-containers-guide-pt), vamos agora colocar essa mesma infraestrutura em código.

---

## O Ponto de Partida: Infraestrutura Criada na Mão

Você seguiu um tutorial e criou pelo console (ou CLI) estes recursos:

- Uma **Lambda function** que roda seu scraper
- Um **bucket S3** onde os artigos são salvos
- Um **EventBridge Schedule** que dispara a Lambda a cada 4 horas
- **IAM roles** para a Lambda e o Scheduler

Funciona. Mas os problemas começam a aparecer...

---

## Problema 1: "Quem Criou Isso? O Que É Esse Recurso?"

Você abre o console da AWS e encontra:
- 3 buckets S3 com nomes misteriosos
- 5 IAM roles que ninguém sabe se estão em uso
- Uma Lambda que *talvez* alguém tenha criado para testar algo

Ninguém consegue reconstruir o ambiente. Não existe documentação. O console é a única fonte de verdade — e é uma fonte terrível.

### Solução: Terraform — Infraestrutura como Código

Terraform permite descrever sua infraestrutura em arquivos declarativos. Você escreve *o que quer que exista*, e o Terraform descobre como criar.

Instale o Terraform:

```bash
# Mac
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Verificar
terraform version
```

Crie um diretório para o projeto:

```bash
mkdir infra && cd infra
```

Crie o arquivo `main.tf` — vamos começar com apenas o bucket S3:

```hcl
provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "articles" {
  bucket = "news-scraper-articles-123456"
}
```

Agora rode:

```bash
terraform init     # Baixa o provider da AWS
terraform plan     # Mostra o que será criado (sem criar nada)
terraform apply    # Cria de fato (pede confirmação)
```

O `plan` é sua rede de segurança — ele mostra **exatamente** o que vai acontecer antes de acontecer. Sempre leia o plan.

Pronto: seu bucket está criado, e o código que o descreve está num arquivo que você pode versionar no Git. Qualquer pessoa que ler `main.tf` sabe exatamente o que existe na AWS.

### Os Três Comandos que Você Vai Usar o Tempo Todo

```bash
terraform init      # Inicializa o projeto (baixa providers, módulos)
terraform plan      # Preview das mudanças
terraform apply     # Aplica as mudanças
terraform destroy   # Remove tudo (cuidado!)
```

---

## Problema 2: Preciso Criar o Resto da Infraestrutura

Um bucket não basta. Você precisa da Lambda, das roles IAM, e do agendamento. Vamos adicionar tudo.

### Solução: Definir Todos os Recursos

Adicione ao `main.tf`:

```hcl
provider "aws" {
  region = "us-east-1"
}

# ─── S3 ──────────────────────────────────────────
resource "aws_s3_bucket" "articles" {
  bucket = "news-scraper-articles-123456"
}

# ─── IAM Role para a Lambda ─────────────────────
resource "aws_iam_role" "lambda" {
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
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_s3" {
  role = aws_iam_role.lambda.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = ["s3:PutObject"]
      Effect   = "Allow"
      Resource = "${aws_s3_bucket.articles.arn}/*"
    }]
  })
}

# ─── Lambda Function ────────────────────────────
resource "aws_lambda_function" "scraper" {
  function_name = "news-scraper"
  role          = aws_iam_role.lambda.arn
  runtime       = "python3.12"
  handler       = "scraper.handler"
  filename      = "lambda.zip"
  memory_size   = 512
  timeout       = 900

  source_code_hash = filebase64sha256("lambda.zip")

  environment {
    variables = {
      S3_BUCKET = aws_s3_bucket.articles.bucket
    }
  }
}

# ─── CloudWatch Log Group ───────────────────────
resource "aws_cloudwatch_log_group" "scraper" {
  name              = "/aws/lambda/news-scraper"
  retention_in_days = 14
}

# ─── EventBridge Scheduler ──────────────────────
resource "aws_iam_role" "scheduler" {
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
  role = aws_iam_role.scheduler.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = "lambda:InvokeFunction"
      Effect   = "Allow"
      Resource = aws_lambda_function.scraper.arn
    }]
  })
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
    role_arn = aws_iam_role.scheduler.arn
  }
}
```

```bash
terraform plan    # Mostra: 8 recursos a criar
terraform apply   # Cria tudo
```

Repare como o Terraform descobre a **ordem** automaticamente: ele sabe que a Lambda depende da IAM role (porque referencia `aws_iam_role.lambda.arn`), então cria a role primeiro. Você não precisa especificar a ordem — ele entende pelo grafo de dependências.

> **O `source_code_hash`** faz o Terraform detectar quando o código da Lambda mudou. Sem ele, atualizar o `lambda.zip` não dispara um redeploy.

---

## Problema 3: Mudei um Recurso e Tudo se Perdeu

Você editou a Lambda pelo console — mudou o timeout para 600s para testar. Funciona. Mas na próxima vez que rodar `terraform apply`, o Terraform volta o timeout para 900s (o valor no código).

Ou pior: você deletou manualmente um recurso pelo console. O Terraform acha que ele ainda existe, tenta modificá-lo, e dá erro.

### Solução: Entender o State

Terraform mantém um arquivo de **estado** (`terraform.tfstate`) que mapeia o que está no código para o que existe na AWS. É assim que ele sabe a diferença entre "criar" e "atualizar".

```bash
# Ver o que o Terraform gerencia
terraform state list

# Detalhes de um recurso específico
terraform state show aws_lambda_function.scraper
```

O estado é a **fonte de verdade** do Terraform. Se você muda algo pelo console, o Terraform não sabe — até o próximo `plan`, quando detecta o drift:

```bash
terraform plan
# ~ aws_lambda_function.scraper
#     ~ timeout: 600 -> 900   (vai reverter para o código)
```

**Regras de ouro**:
1. Nunca edite recursos gerenciados pelo Terraform manualmente no console
2. Se editou, rode `terraform plan` para ver o drift e decida: atualizar o código ou deixar o Terraform corrigir
3. Se criou algo pelo console e quer que o Terraform gerencie, importe (veremos no Problema 7)

---

## Problema 4: Dois Desenvolvedores Rodaram Apply ao Mesmo Tempo

O arquivo `terraform.tfstate` está na sua máquina. Seu colega tem uma cópia diferente. Vocês rodam `apply` ao mesmo tempo — e a infraestrutura fica num estado inconsistente.

Ou pior: alguém perde o laptop com o único `tfstate` existente. Sem o state, o Terraform perde a relação com os recursos reais.

### Solução: Estado Remoto com S3

Mova o estado para a cloud — acessível por todos, com lock para evitar conflitos.

Primeiro, crie o bucket (um bootstrap que roda uma vez):

```hcl
# bootstrap/main.tf
provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "minha-empresa-terraform-state"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

```bash
cd bootstrap
terraform init && terraform apply
```

Agora configure seu projeto para usar o backend remoto. Crie `backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket       = "minha-empresa-terraform-state"
    key          = "scraper/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

```bash
terraform init -migrate-state    # Migra o state local para o S3
```

O `use_lockfile = true` cria um arquivo de lock no S3 — se alguém está rodando `apply`, ninguém mais consegue rodar ao mesmo tempo. Acabam os conflitos.

> **Versioning no S3** é fundamental: se o state corromper, você pode recuperar uma versão anterior do bucket versionado.

---

## Problema 5: Tudo Está num Arquivo Gigante

O `main.tf` cresceu para 300 linhas. Lambda, S3, IAM, EventBridge — tudo junto. Difícil de ler, difícil de manter.

### Solução: Separar em Arquivos

O Terraform lê **todos** os arquivos `.tf` do diretório como um único bloco. A separação é puramente organizacional — mas faz diferença enorme na legibilidade:

```
infra/
├── main.tf          # Lambda, recursos principais
├── iam.tf           # Todas as roles e policies
├── storage.tf       # S3 buckets
├── scheduling.tf    # EventBridge schedules
├── variables.tf     # Variáveis de input
├── outputs.tf       # Valores de saída
├── versions.tf      # Versões do Terraform e providers
└── backend.tf       # Configuração do estado remoto
```

Mova as variáveis para `variables.tf`:

```hcl
# variables.tf
variable "project" {
  description = "Nome do projeto"
  type        = string
  default     = "news-scraper"
}

variable "aws_region" {
  description = "Região AWS"
  type        = string
  default     = "us-east-1"
}

variable "schedule_expression" {
  description = "Frequência do scraper"
  type        = string
  default     = "rate(4 hours)"
}
```

Fixe versões em `versions.tf`:

```hcl
# versions.tf
terraform {
  required_version = ">= 1.5.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

E use `locals` para valores derivados — evita repetição:

```hcl
# main.tf
locals {
  name_prefix = var.project
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}
```

O `default_tags` no provider aplica tags automaticamente a **todos** os recursos — sem precisar repetir `tags = ...` em cada bloco. Útil para rastrear custo e ownership.

---

## Problema 6: Preciso de Staging e Produção

O scraper está em dev. Agora você precisa de uma cópia em staging e outra em prod — com configurações diferentes (mais memória, menos frequência, bucket separado).

### Solução: Ambientes com `tfvars`

Crie um arquivo de variáveis por ambiente:

```
infra/
├── main.tf
├── variables.tf
├── ...
├── envs/
│   ├── dev.tfvars
│   ├── staging.tfvars
│   └── prod.tfvars
└── backend.tf
```

```hcl
# envs/dev.tfvars
project             = "news-scraper"
environment         = "dev"
lambda_memory       = 512
lambda_timeout      = 900
schedule_expression = "rate(4 hours)"
```

```hcl
# envs/prod.tfvars
project             = "news-scraper"
environment         = "prod"
lambda_memory       = 1024
lambda_timeout      = 900
schedule_expression = "rate(2 hours)"
```

Atualize os recursos para usar as variáveis:

```hcl
# variables.tf
variable "environment" {
  description = "Ambiente (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Ambiente deve ser dev, staging ou prod."
  }
}

variable "lambda_memory" {
  description = "Memória da Lambda em MB"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Timeout da Lambda em segundos"
  type        = number
  default     = 900
}
```

```hcl
# main.tf
locals {
  name_prefix = "${var.project}-${var.environment}"
}

resource "aws_s3_bucket" "articles" {
  bucket = "${local.name_prefix}-articles"
}

resource "aws_lambda_function" "scraper" {
  function_name = "${local.name_prefix}"
  memory_size   = var.lambda_memory
  timeout       = var.lambda_timeout
  # ...
}
```

Aplique por ambiente:

```bash
# Dev
terraform plan -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars

# Prod
terraform plan -var-file=envs/prod.tfvars
terraform apply -var-file=envs/prod.tfvars
```

> **Importante**: cada ambiente precisa de um **state separado**. Mude a `key` no `backend.tf` ou use a flag `-backend-config`:
> ```bash
> terraform init -backend-config="key=scraper/prod/terraform.tfstate"
> ```

---

## Problema 7: Já Tenho Recursos Criados na Mão

Metade da infraestrutura foi criada pelo console. Você quer começar a usar Terraform sem destruir e recriar tudo.

### Solução: Import Blocks

Desde o Terraform 1.5, importar é declarativo:

```hcl
# Importar um bucket S3 existente
import {
  to = aws_s3_bucket.articles
  id = "meu-bucket-existente"
}

resource "aws_s3_bucket" "articles" {
  bucket = "meu-bucket-existente"
}

# Importar uma Lambda existente
import {
  to = aws_lambda_function.scraper
  id = "news-scraper"
}

# Importar uma IAM role
import {
  to = aws_iam_role.lambda
  id = "news-scraper-lambda-role"
}
```

O melhor: o Terraform pode **gerar a configuração** automaticamente:

```bash
# Escreva só os import blocks, sem os resource blocks
terraform plan -generate-config-out=generated.tf
```

O Terraform cria `generated.tf` com todos os atributos. Revise, limpe, mova para os arquivos corretos, e:

```bash
terraform apply     # Importa sem modificar nada
terraform plan      # Deve mostrar "No changes" — tudo sincronizado
```

Remova os `import` blocks depois — eles só precisam rodar uma vez.

---

## Problema 8: Deletei o Banco por Acidente

Alguém rodou `terraform destroy` e levou o bucket S3 com 3 meses de artigos junto. Ou pior: um `apply` que deveria atualizar o bucket acabou recriando ele (e perdendo os dados).

### Solução: Lifecycle Rules

Proteja recursos críticos:

```hcl
resource "aws_s3_bucket" "articles" {
  bucket = "${local.name_prefix}-articles"

  lifecycle {
    prevent_destroy = true
  }
}
```

Com `prevent_destroy`, o Terraform **se recusa** a destruir o recurso — mesmo com `terraform destroy`. Você precisa remover a regra antes.

Outras regras úteis:

```hcl
resource "aws_lambda_function" "scraper" {
  # ...

  lifecycle {
    create_before_destroy = true
  }
}
```

| Regra | Quando usar |
|-------|------------|
| `prevent_destroy` | Dados que não podem ser perdidos (S3 com dados, RDS, DynamoDB) |
| `create_before_destroy` | Recursos que precisam de zero-downtime (cria o novo antes de deletar o antigo) |
| `ignore_changes` | Atributos gerenciados fora do Terraform (ex: tag adicionada manualmente) |

---

## Problema 9: O Mesmo Padrão se Repete 5 Vezes

Você tem 5 scrapers diferentes (Google News, Rundown, AI Research, etc.). Cada um precisa de Lambda + IAM Role + EventBridge Schedule + Log Group. Você copia e cola o bloco inteiro, mudando nomes e variáveis. 300 linhas viram 1500.

### Solução: Módulos

Módulos são como funções: recebem inputs, criam recursos, retornam outputs.

Crie a estrutura:

```
infra/
├── modules/
│   └── scheduled-lambda/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── main.tf
├── variables.tf
└── ...
```

O módulo:

```hcl
# modules/scheduled-lambda/variables.tf
variable "name" {
  description = "Nome da função"
  type        = string
}

variable "handler" {
  description = "Handler da Lambda (arquivo.função)"
  type        = string
}

variable "filename" {
  description = "Caminho do zip"
  type        = string
}

variable "memory_size" {
  type    = number
  default = 512
}

variable "timeout" {
  type    = number
  default = 900
}

variable "schedule_expression" {
  description = "Cron ou rate expression"
  type        = string
}

variable "environment_variables" {
  type    = map(string)
  default = {}
}

variable "policy_statements" {
  description = "Statements IAM adicionais para a Lambda"
  type = list(object({
    actions   = list(string)
    resources = list(string)
  }))
  default = []
}
```

```hcl
# modules/scheduled-lambda/main.tf
resource "aws_iam_role" "lambda" {
  name = "${var.name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_custom" {
  count = length(var.policy_statements) > 0 ? 1 : 0
  role  = aws_iam_role.lambda.name

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [for s in var.policy_statements : {
      Action   = s.actions
      Effect   = "Allow"
      Resource = s.resources
    }]
  })
}

resource "aws_lambda_function" "this" {
  function_name    = var.name
  role             = aws_iam_role.lambda.arn
  runtime          = "python3.12"
  handler          = var.handler
  filename         = var.filename
  source_code_hash = filebase64sha256(var.filename)
  memory_size      = var.memory_size
  timeout          = var.timeout

  environment {
    variables = var.environment_variables
  }
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.name}"
  retention_in_days = 14
}

resource "aws_iam_role" "scheduler" {
  name = "${var.name}-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  role = aws_iam_role.scheduler.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = "lambda:InvokeFunction"
      Effect   = "Allow"
      Resource = aws_lambda_function.this.arn
    }]
  })
}

resource "aws_scheduler_schedule" "this" {
  name                = "${var.name}-schedule"
  schedule_expression = var.schedule_expression

  schedule_expression_timezone = "America/Sao_Paulo"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.this.arn
    role_arn = aws_iam_role.scheduler.arn
  }
}
```

```hcl
# modules/scheduled-lambda/outputs.tf
output "function_name" {
  value = aws_lambda_function.this.function_name
}

output "function_arn" {
  value = aws_lambda_function.this.arn
}

output "role_arn" {
  value = aws_iam_role.lambda.arn
}
```

Agora no `main.tf`, 5 scrapers em ~50 linhas:

```hcl
module "google_news_scraper" {
  source = "./modules/scheduled-lambda"

  name                = "${local.name_prefix}-google-news"
  handler             = "scraper.handler"
  filename            = "lambdas/google-news.zip"
  schedule_expression = "rate(4 hours)"

  environment_variables = {
    S3_BUCKET = aws_s3_bucket.articles.bucket
    SOURCE    = "google_news"
  }

  policy_statements = [{
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.articles.arn}/*"]
  }]
}

module "rundown_scraper" {
  source = "./modules/scheduled-lambda"

  name                = "${local.name_prefix}-rundown"
  handler             = "scraper.handler"
  filename            = "lambdas/rundown.zip"
  schedule_expression = "rate(6 hours)"

  environment_variables = {
    S3_BUCKET = aws_s3_bucket.articles.bucket
    SOURCE    = "rundown"
  }

  policy_statements = [{
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.articles.arn}/*"]
  }]
}

module "ai_research_agent" {
  source = "./modules/scheduled-lambda"

  name                = "${local.name_prefix}-ai-research"
  handler             = "agent.handler"
  filename            = "lambdas/ai-research.zip"
  memory_size         = 1024
  schedule_expression = "rate(12 hours)"

  environment_variables = {
    S3_BUCKET   = aws_s3_bucket.articles.bucket
    SEARCH_API  = "tavily"
  }

  policy_statements = [
    {
      actions   = ["s3:PutObject"]
      resources = ["${aws_s3_bucket.articles.arn}/*"]
    },
    {
      actions   = ["bedrock:InvokeModel"]
      resources = ["*"]
    }
  ]
}
```

Cada scraper novo são ~15 linhas. Toda a complexidade de IAM, logs, e scheduling está encapsulada no módulo.

> **Quando criar módulos?** Quando o mesmo padrão de recursos se repete 3+ vezes. Não crie módulo para um único recurso — `module "s3"` que só encapsula `aws_s3_bucket` é indireção sem valor.

---

## Problema 10: Tenho Medo de Rodar Apply em Produção

Você fez uma mudança no Terraform. O `plan` mostra 12 recursos que vão ser modificados. Você acha que está certo... mas e se não estiver? Em dev, tanto faz. Em prod, uma mudança errada derruba tudo.

### Solução: CI/CD com Plan no PR

A ideia: toda mudança de infraestrutura passa por um Pull Request. O CI roda `terraform plan` automaticamente e comenta o resultado no PR. Você (e seu colega) revisam o plano antes de aplicar.

```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  pull_request:
    paths: ['infra/**']
  push:
    branches: [main]
    paths: ['infra/**']

permissions:
  id-token: write
  contents: read
  pull-requests: write

jobs:
  plan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infra

    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-ci
          aws-region: us-east-1

      - uses: hashicorp/setup-terraform@v3

      - run: terraform init
      - run: terraform fmt -check
      - run: terraform validate

      - name: Plan
        id: plan
        run: terraform plan -no-color -var-file=envs/prod.tfvars
        continue-on-error: true

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `### Terraform Plan\n\`\`\`\n${{ steps.plan.outputs.stdout }}\n\`\`\``
            });

  apply:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production
    defaults:
      run:
        working-directory: infra

    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-ci
          aws-region: us-east-1

      - uses: hashicorp/setup-terraform@v3

      - run: terraform init
      - run: terraform apply -auto-approve -var-file=envs/prod.tfvars
```

O fluxo:
1. Dev cria PR com mudança no Terraform
2. CI roda `plan` e comenta no PR
3. Colegas revisam o plan
4. PR é aprovado e merged
5. CI roda `apply` em produção

O `environment: production` no job de apply pode exigir aprovação manual no GitHub — uma camada extra de segurança.

> **OIDC em vez de chaves**: repare no `role-to-assume`. Com OIDC, o GitHub Actions assume uma IAM role diretamente — sem guardar `AWS_ACCESS_KEY_ID` nos secrets do repositório. Mais seguro.

---

## Problema 11: As Senhas Estão no Código

O `terraform.tfvars` tem a senha do banco. O `main.tf` tem o token da API. Alguém commitou o `.tfstate` no Git — e ele tem **todos os valores em texto claro**, incluindo senhas.

### Solução: Secrets no Lugar Certo

**Regra 1**: nunca commite `terraform.tfstate` nem `terraform.tfvars` com senhas.

```
# .gitignore
*.tfstate
*.tfstate.*
*.tfvars        # Se contiver segredos — use variáveis de ambiente
.terraform/
```

**Regra 2**: use AWS Secrets Manager ou SSM Parameter Store:

```hcl
# Buscar um secret existente
data "aws_secretsmanager_secret_version" "api_key" {
  secret_id = "news-scraper/tavily-api-key"
}

resource "aws_lambda_function" "scraper" {
  # ...
  environment {
    variables = {
      TAVILY_API_KEY = data.aws_secretsmanager_secret_version.api_key.secret_string
    }
  }
}
```

**Regra 3**: marque variáveis sensíveis:

```hcl
variable "db_password" {
  type      = string
  sensitive = true    # Não aparece no plan/apply
}

output "db_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = true
}
```

**Regra 4**: o state no S3 deve ter encriptação KMS e acesso restrito. O state contém **todos os valores** — incluindo os marcados como `sensitive`.

---

## Recapitulando a Jornada

Começamos com recursos criados manualmente pelo console. Ao longo do guia, cada problema levou a um conceito do Terraform:

| Problema | Conceito | Solução |
|----------|---------|---------|
| Ninguém sabe o que existe na AWS | **IaC básico** | Descrever infraestrutura em `.tf` |
| Preciso de Lambda + S3 + IAM + Scheduler | **Recursos e dependências** | Terraform resolve a ordem automaticamente |
| Mudança manual desincroniza | **State** | Arquivo de estado rastreia recursos reais |
| Conflito entre devs | **Remote state + locking** | S3 backend com `use_lockfile` |
| Arquivo gigante | **Organização** | Separar em arquivos + variables + locals |
| Preciso de dev e prod | **Ambientes** | `tfvars` por ambiente, state separado |
| Recursos já existem no console | **Import** | Import blocks + geração automática |
| Deletei dados por acidente | **Lifecycle rules** | `prevent_destroy`, `create_before_destroy` |
| Mesmo padrão 5 vezes | **Módulos** | Encapsular padrões reutilizáveis |
| Medo de apply em produção | **CI/CD** | Plan no PR, apply no merge |
| Senhas no código | **Segurança** | Secrets Manager, `sensitive`, encriptação |

Cada conceito resolveu um problema concreto. Comece simples — um `main.tf` com `terraform apply` já é infinitamente melhor que infraestrutura manual. Os outros conceitos, adicione quando o problema correspondente aparecer.

---

## Referência Rápida

### Comandos

```bash
terraform init              # Inicializar projeto
terraform plan              # Preview de mudanças
terraform apply             # Aplicar mudanças
terraform destroy           # Remover tudo
terraform fmt               # Formatar código
terraform validate          # Validar sintaxe
terraform state list        # Listar recursos gerenciados
terraform state show ADDR   # Detalhes de um recurso
terraform import ADDR ID    # Importar recurso existente
terraform output            # Ver outputs
```

### Estrutura de Projeto

```
infra/
├── main.tf              # Recursos principais
├── iam.tf               # Roles e policies
├── storage.tf           # S3, DynamoDB
├── scheduling.tf        # EventBridge
├── variables.tf         # Inputs
├── outputs.tf           # Outputs
├── versions.tf          # Versões fixadas
├── backend.tf           # State remoto
├── envs/
│   ├── dev.tfvars
│   ├── staging.tfvars
│   └── prod.tfvars
└── modules/
    └── scheduled-lambda/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

### Checklist

- [ ] State remoto no S3 com locking e encriptação
- [ ] Versões fixadas do Terraform e providers
- [ ] `.terraform.lock.hcl` commitado no Git
- [ ] `terraform.tfstate` e secrets no `.gitignore`
- [ ] `prevent_destroy` em recursos com dados
- [ ] `default_tags` no provider
- [ ] `terraform plan` no CI para todo PR
- [ ] Secrets no AWS Secrets Manager, não no código
