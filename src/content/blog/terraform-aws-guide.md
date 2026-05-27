---
title: 'Terraform on AWS: Practical Guide From Zero to Production'
description: 'Learn Terraform by building: a news scraper that starts with manually created resources and ends with versioned, modular, automated infrastructure. Each problem leads to the next concept.'
pubDate: 2026-04-17
tags: ['Terraform', 'AWS', 'IaC', 'DevOps', 'Cloud', 'Infrastructure']
lang: 'en'
---

You create a Lambda through the AWS console. It works. You add an S3 bucket. An EventBridge Schedule. An IAM role. Three weeks later, a colleague asks: *"What exactly is running in our account?"* — and nobody can answer with certainty.

Worse: someone deletes a resource through the console thinking it wasn't in use. The application breaks. Nobody knows how to recreate exactly what was there.

This guide will take you from that situation — infrastructure created manually through the console — to everything versioned in code, modular, with CI/CD, and ready for production. Each section solves a real problem.

We'll use a **scheduled news scraper on AWS** as our example — Lambda + S3 + EventBridge Scheduler. If you read the [AWS deployment guide](/blog/aws-containers-guide), we'll now put that same infrastructure into code.

---

## The Starting Point: Hand-Created Infrastructure

You followed a tutorial and created these resources through the console (or CLI):

- A **Lambda function** that runs your scraper
- An **S3 bucket** where articles are saved
- An **EventBridge Schedule** that triggers the Lambda every 4 hours
- **IAM roles** for the Lambda and the Scheduler

It works. But the problems start to show up...

---

## Problem 1: "Who Created This? What Is This Resource?"

You open the AWS console and find:
- 3 S3 buckets with mysterious names
- 5 IAM roles that nobody knows are in use
- A Lambda that *maybe* someone created to test something

Nobody can rebuild the environment. There's no documentation. The console is the only source of truth — and it's a terrible one.

### Solution: Terraform — Infrastructure as Code

Terraform lets you describe your infrastructure in declarative files. You write *what you want to exist*, and Terraform figures out how to create it.

Install Terraform:

```bash
# Mac
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Verificar
terraform version
```

Create a directory for the project:

```bash
mkdir infra && cd infra
```

Create the `main.tf` file — we'll start with just the S3 bucket:

```hcl
provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "articles" {
  bucket = "news-scraper-articles-123456"
}
```

Now run:

```bash
terraform init     # Baixa o provider da AWS
terraform plan     # Mostra o que será criado (sem criar nada)
terraform apply    # Cria de fato (pede confirmação)
```

The `plan` is your safety net — it shows **exactly** what will happen before it happens. Always read the plan.

Done: your bucket is created, and the code that describes it is in a file you can version in Git. Anyone who reads `main.tf` knows exactly what exists in AWS.

### The Three Commands You'll Use All the Time

```bash
terraform init      # Inicializa o projeto (baixa providers, módulos)
terraform plan      # Preview das mudanças
terraform apply     # Aplica as mudanças
terraform destroy   # Remove tudo (cuidado!)
```

---

## Problem 2: I Need to Create the Rest of the Infrastructure

One bucket isn't enough. You need the Lambda, IAM roles, and scheduling. Let's add everything.

### Solution: Define All Resources

Add to `main.tf`:

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

Notice how Terraform figures out the **order** automatically: it knows the Lambda depends on the IAM role (because it references `aws_iam_role.lambda.arn`), so it creates the role first. You don't need to specify the order — it understands from the dependency graph.

> **`source_code_hash`** makes Terraform detect when the Lambda code has changed. Without it, updating `lambda.zip` won't trigger a redeploy.

---

## Problem 3: I Changed a Resource and Everything Got Out of Sync

You edited the Lambda through the console — changed the timeout to 600s to test. It works. But the next time you run `terraform apply`, Terraform reverts the timeout to 900s (the value in code).

Or worse: you manually deleted a resource through the console. Terraform thinks it still exists, tries to modify it, and errors out.

### Solution: Understand the State

Terraform keeps a **state** file (`terraform.tfstate`) that maps what's in code to what exists in AWS. That's how it knows the difference between "create" and "update".

```bash
# Ver o que o Terraform gerencia
terraform state list

# Detalhes de um recurso específico
terraform state show aws_lambda_function.scraper
```

The state is Terraform's **source of truth**. If you change something through the console, Terraform doesn't know — until the next `plan`, when it detects drift:

```bash
terraform plan
# ~ aws_lambda_function.scraper
#     ~ timeout: 600 -> 900   (vai reverter para o código)
```

**Golden rules**:
1. Never edit Terraform-managed resources manually in the console
2. If you did edit, run `terraform plan` to see the drift and decide: update the code or let Terraform fix it
3. If you created something through the console and want Terraform to manage it, import it (we'll cover this in Problem 7)

---

## Problem 4: Two Developers Ran Apply at the Same Time

The `terraform.tfstate` file is on your machine. Your colleague has a different copy. You both run `apply` at the same time — and the infrastructure ends up in an inconsistent state.

Or worse: someone loses the laptop with the only existing `tfstate`. Without the state, Terraform loses the connection to the real resources.

### Solution: Remote State with S3

Move the state to the cloud — accessible to everyone, with locking to prevent conflicts.

First, create the bucket (a one-time bootstrap):

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

Now configure your project to use the remote backend. Create `backend.tf`:

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

`use_lockfile = true` creates a lock file in S3 — if someone is running `apply`, nobody else can run at the same time. Conflicts are gone.

> **Versioning on S3** is essential: if the state gets corrupted, you can recover a previous version from the versioned bucket.

---

## Problem 5: Everything Is in One Giant File

`main.tf` grew to 300 lines. Lambda, S3, IAM, EventBridge — all together. Hard to read, hard to maintain.

### Solution: Split Into Files

Terraform reads **all** `.tf` files in the directory as a single block. The split is purely organizational — but it makes a huge difference in readability:

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

Move variables to `variables.tf`:

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

Pin versions in `versions.tf`:

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

And use `locals` for derived values — avoids repetition:

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

`default_tags` on the provider applies tags automatically to **all** resources — without repeating `tags = ...` in every block. Useful for tracking cost and ownership.

---

## Problem 6: I Need Staging and Production

The scraper is in dev. Now you need a copy in staging and another in prod — with different configurations (more memory, less frequency, separate bucket).

### Solution: Environments with `tfvars`

Create a variables file per environment:

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

Update resources to use the variables:

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

Apply per environment:

```bash
# Dev
terraform plan -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars

# Prod
terraform plan -var-file=envs/prod.tfvars
terraform apply -var-file=envs/prod.tfvars
```

> **Important**: each environment needs a **separate state**. Change the `key` in `backend.tf` or use the `-backend-config` flag:
> ```bash
> terraform init -backend-config="key=scraper/prod/terraform.tfstate"
> ```

---

## Problem 7: I Already Have Hand-Created Resources

Half the infrastructure was created through the console. You want to start using Terraform without destroying and recreating everything.

### Solution: Import Blocks

Since Terraform 1.5, importing is declarative:

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

Best of all: Terraform can **generate the configuration** automatically:

```bash
# Escreva só os import blocks, sem os resource blocks
terraform plan -generate-config-out=generated.tf
```

Terraform creates `generated.tf` with all attributes. Review, clean up, move to the correct files, and:

```bash
terraform apply     # Importa sem modificar nada
terraform plan      # Deve mostrar "No changes" — tudo sincronizado
```

Remove the `import` blocks afterward — they only need to run once.

---

## Problem 8: I Accidentally Deleted the Database

Someone ran `terraform destroy` and took the S3 bucket with 3 months of articles with it. Or worse: an `apply` that was supposed to update the bucket ended up recreating it (and losing the data).

### Solution: Lifecycle Rules

Protect critical resources:

```hcl
resource "aws_s3_bucket" "articles" {
  bucket = "${local.name_prefix}-articles"

  lifecycle {
    prevent_destroy = true
  }
}
```

With `prevent_destroy`, Terraform **refuses** to destroy the resource — even with `terraform destroy`. You need to remove the rule first.

Other useful rules:

```hcl
resource "aws_lambda_function" "scraper" {
  # ...

  lifecycle {
    create_before_destroy = true
  }
}
```

| Rule | When to use |
|-------|------------|
| `prevent_destroy` | Data that cannot be lost (S3 with data, RDS, DynamoDB) |
| `create_before_destroy` | Resources that need zero-downtime (creates the new one before deleting the old) |
| `ignore_changes` | Attributes managed outside Terraform (e.g., a tag added manually) |

---

## Problem 9: The Same Pattern Repeats 5 Times

You have 5 different scrapers (Google News, Rundown, AI Research, etc.). Each one needs Lambda + IAM Role + EventBridge Schedule + Log Group. You copy and paste the entire block, changing names and variables. 300 lines become 1500.

### Solution: Modules

Modules are like functions: they take inputs, create resources, return outputs.

Create the structure:

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

The module:

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

Now in `main.tf`, 5 scrapers in ~50 lines:

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

Each new scraper is ~15 lines. All the complexity of IAM, logs, and scheduling is encapsulated in the module.

> **When to create modules?** When the same resource pattern repeats 3+ times. Don't create a module for a single resource — `module "s3"` that only wraps `aws_s3_bucket` is indirection without value.

---

## Problem 10: I'm Afraid to Run Apply in Production

You made a change in Terraform. The `plan` shows 12 resources that will be modified. You think it's correct... but what if it isn't? In dev, no big deal. In prod, a wrong change brings everything down.

### Solution: CI/CD with Plan on PR

The idea: every infrastructure change goes through a Pull Request. CI runs `terraform plan` automatically and comments the result on the PR. You (and your colleague) review the plan before applying.

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

The flow:
1. Dev creates a PR with a Terraform change
2. CI runs `plan` and comments on the PR
3. Colleagues review the plan
4. PR is approved and merged
5. CI runs `apply` in production

The `environment: production` on the apply job can require manual approval in GitHub — an extra layer of security.

> **OIDC instead of keys**: notice the `role-to-assume`. With OIDC, GitHub Actions assumes an IAM role directly — without storing `AWS_ACCESS_KEY_ID` in repository secrets. More secure.

---

## Problem 11: Passwords Are in the Code

`terraform.tfvars` has the database password. `main.tf` has the API token. Someone committed `.tfstate` to Git — and it has **all values in plain text**, including passwords.

### Solution: Secrets in the Right Place

**Rule 1**: never commit `terraform.tfstate` or `terraform.tfvars` with passwords.

```
# .gitignore
*.tfstate
*.tfstate.*
*.tfvars        # Se contiver segredos — use variáveis de ambiente
.terraform/
```

**Rule 2**: use AWS Secrets Manager or SSM Parameter Store:

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

**Rule 3**: mark sensitive variables:

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

**Rule 4**: state in S3 should have KMS encryption and restricted access. The state contains **all values** — including those marked as `sensitive`.

---

## Recapping the Journey

We started with resources created manually through the console. Throughout the guide, each problem led to a Terraform concept:

| Problem | Concept | Solution |
|----------|---------|---------|
| Nobody knows what exists in AWS | **Basic IaC** | Describe infrastructure in `.tf` |
| Need Lambda + S3 + IAM + Scheduler | **Resources and dependencies** | Terraform resolves order automatically |
| Manual change causes drift | **State** | State file tracks real resources |
| Conflict between devs | **Remote state + locking** | S3 backend with `use_lockfile` |
| Giant file | **Organization** | Split into files + variables + locals |
| Need dev and prod | **Environments** | `tfvars` per environment, separate state |
| Resources already exist in console | **Import** | Import blocks + automatic generation |
| Accidentally deleted data | **Lifecycle rules** | `prevent_destroy`, `create_before_destroy` |
| Same pattern 5 times | **Modules** | Encapsulate reusable patterns |
| Afraid of apply in production | **CI/CD** | Plan on PR, apply on merge |
| Passwords in code | **Security** | Secrets Manager, `sensitive`, encryption |

Each concept solved a concrete problem. Start simple — a `main.tf` with `terraform apply` is infinitely better than manual infrastructure. Add the other concepts when the corresponding problem shows up.

---

## Quick Reference

### Commands

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

### Project Structure

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

- [ ] Remote state in S3 with locking and encryption
- [ ] Pinned Terraform and provider versions
- [ ] `.terraform.lock.hcl` committed to Git
- [ ] `terraform.tfstate` and secrets in `.gitignore`
- [ ] `prevent_destroy` on resources with data
- [ ] `default_tags` on the provider
- [ ] `terraform plan` in CI for every PR
- [ ] Secrets in AWS Secrets Manager, not in code
