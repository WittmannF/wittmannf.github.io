---
title: 'Terraform na AWS: O Guia Definitivo de Melhores Práticas'
description: 'De estrutura de projeto e gerenciamento de estado a módulos reutilizáveis, segurança, CI/CD e padrões comuns — tudo que você precisa saber para usar Terraform na AWS como um profissional, com exemplos de código reais.'
pubDate: 2026-04-17
tags: ['Terraform', 'AWS', 'IaC', 'DevOps', 'Cloud', 'Infraestrutura']
lang: 'pt'
---

Você cria uma instância EC2 pelo console da AWS. Funciona. Cria mais uma. Adiciona um security group. Configura um RDS. Três meses depois, ninguém sabe exatamente o que está rodando, quanto custa, ou quem criou aquele bucket S3 misterioso que ninguém ousa deletar.

Esse é o momento em que a maioria dos times descobre — da pior forma — que precisava de Infrastructure as Code desde o início.

O **Terraform** resolve isso. Ele permite que você descreva toda a sua infraestrutura AWS em arquivos declarativos, versionados no Git, revisáveis em pull requests, e aplicáveis de forma previsível. Mas saber que o Terraform existe é uma coisa. Usá-lo bem — com estrutura, segurança e práticas que escalam — é outra completamente diferente.

Este guia cobre tudo: da organização de projetos ao gerenciamento de estado, de módulos reutilizáveis a CI/CD, de segurança a padrões comuns de infraestrutura na AWS. Com exemplos de código reais em cada seção.

---

## 1. Estrutura de Projeto e Organização

A primeira decisão que você toma — e que impacta tudo depois — é como organizar seus arquivos Terraform.

### A Estrutura Recomendada

```
infrastructure/
├── modules/                    # Módulos reutilizáveis
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── ecs-service/
│   └── rds/
├── environments/
│   ├── dev/
│   │   ├── main.tf            # Chama os módulos
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── terraform.tfvars   # Valores específicos do ambiente
│   │   └── backend.tf         # Configuração do estado remoto
│   ├── staging/
│   └── prod/
└── global/                     # Recursos compartilhados (IAM, Route53)
    ├── main.tf
    └── backend.tf
```

### Por Que Separar por Ambiente?

A alternativa popular — usar **Terraform Workspaces** para separar ambientes — funciona para projetos simples, mas tem limitações sérias em escala:

| | Diretórios separados | Workspaces |
|---|---|---|
| Isolamento de estado | Total — arquivos de estado independentes | Parcial — mesmo backend, namespaces diferentes |
| Valores diferentes por ambiente | `terraform.tfvars` por diretório | Condicionais no código (`terraform.workspace == "prod"`) |
| Blast radius de um `terraform destroy` | Apenas um ambiente | Risco de destruir o workspace errado |
| Permissões IAM diferentes | Fácil — backend diferente, role diferente | Mais complexo |
| Visibilidade no PR | Claro qual ambiente é afetado | Ambíguo |

A recomendação da HashiCorp é clara: **use diretórios separados para ambientes com configurações significativamente diferentes.** Workspaces são mais adequados para variações menores, como múltiplas regiões com a mesma configuração.

### Mono-repo vs Multi-repo

Para a maioria dos times, um **mono-repo** com diretórios separados por ambiente funciona melhor:

- Um único `git log` mostra toda a história da infraestrutura
- PRs que tocam módulos e ambientes ficam atômicos
- CI/CD é mais simples de configurar
- Refatoração de módulos é mais fácil

Multi-repo faz sentido quando times completamente independentes gerenciam partes isoladas da infraestrutura e precisam de ciclos de deploy desacoplados.

---

## 2. Gerenciamento de Estado

O estado do Terraform é o mapeamento entre o que está definido nos seus arquivos `.tf` e o que realmente existe na AWS. É, sem exagero, o arquivo mais importante do seu projeto.

### Estado Remoto com S3

Nunca armazene o estado localmente. Configure um backend S3 desde o primeiro dia:

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket       = "minha-empresa-terraform-state"
    key          = "environments/dev/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true  # Locking nativo via S3 (recomendado)
  }
}
```

### Criando o Backend (o problema do ovo e da galinha)

O bucket S3 precisa existir antes de qualquer outro recurso. Crie-o com um projeto Terraform separado que usa estado local:

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
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

Depois de aplicar o bootstrap, migre o estado local para o S3:

```bash
cd bootstrap/
terraform init    # estado local
terraform apply   # cria bucket S3

# Agora adicione o backend S3 ao bootstrap/backend.tf e:
terraform init -migrate-state
```

### State Locking

Com `use_lockfile = true`, o Terraform cria um arquivo `.tflock` no S3 que garante que apenas uma pessoa (ou pipeline) pode modificar o estado ao mesmo tempo. Sem locking, dois `terraform apply` simultâneos podem corromper o estado.

> **Nota histórica**: versões anteriores do Terraform usavam DynamoDB para locking. A partir do Terraform 1.10+, o locking nativo via S3 é o método recomendado — mais simples, sem infraestrutura extra para gerenciar.

Se um lock travar (ex: um pipeline falhou no meio de um apply), use:

```bash
terraform force-unlock LOCK_ID
```

Use com cautela — confirme que nenhum apply está realmente rodando.

### Isolamento de Estado

Uma regra de ouro: **quanto menor o blast radius de cada arquivo de estado, melhor.** Se tudo está em um único estado e algo dá errado, tudo é afetado.

Separe pelo menos:

- **Rede** (VPC, subnets, NAT gateways) — muda raramente
- **Dados** (RDS, ElastiCache, S3) — crítico, `prevent_destroy`
- **Compute** (ECS, EKS, Lambda) — muda frequentemente
- **Global** (IAM, Route53) — compartilhado

Use `terraform_remote_state` data source ou outputs do SSM Parameter Store para compartilhar valores entre estados:

```hcl
# No projeto de rede
output "vpc_id" {
  value = module.vpc.vpc_id
}

output "private_subnet_ids" {
  value = module.vpc.private_subnet_ids
}

# No projeto de compute
data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = "minha-empresa-terraform-state"
    key    = "environments/dev/network/terraform.tfstate"
    region = "us-east-1"
  }
}

resource "aws_ecs_service" "app" {
  # ...
  network_configuration {
    subnets = data.terraform_remote_state.network.outputs.private_subnet_ids
  }
}
```

---

## 3. Módulos Reutilizáveis

Módulos são a forma do Terraform de criar abstrações reutilizáveis. Pense neles como funções: recebem inputs, criam recursos, e retornam outputs.

### Estrutura Padrão de um Módulo

```
modules/ecs-service/
├── main.tf          # Recursos
├── variables.tf     # Inputs
├── outputs.tf       # Outputs
├── versions.tf      # Versões requeridas do provider
└── README.md        # Documentação (gerada com terraform-docs)
```

### Exemplo: Módulo de ECS Service

```hcl
# modules/ecs-service/variables.tf
variable "name" {
  description = "Nome do serviço"
  type        = string
}

variable "container_image" {
  description = "Imagem Docker (ex: 123456789.dkr.ecr.us-east-1.amazonaws.com/app:latest)"
  type        = string
}

variable "container_port" {
  description = "Porta do container"
  type        = number
  default     = 8080
}

variable "cpu" {
  description = "CPU units (1 vCPU = 1024)"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memória em MB"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Número de tasks desejadas"
  type        = number
  default     = 2
}

variable "vpc_id" {
  description = "ID da VPC"
  type        = string
}

variable "subnet_ids" {
  description = "IDs das subnets privadas"
  type        = list(string)
}

variable "tags" {
  description = "Tags para todos os recursos"
  type        = map(string)
  default     = {}
}
```

```hcl
# modules/ecs-service/main.tf
resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = var.name
      image     = var.container_image
      essential = true
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.this.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = var.name
        }
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_service" "this" {
  name            = var.name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = false
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.name}"
  retention_in_days = 30
  tags              = var.tags
}

data "aws_region" "current" {}
```

```hcl
# modules/ecs-service/outputs.tf
output "service_name" {
  description = "Nome do ECS service"
  value       = aws_ecs_service.this.name
}

output "task_definition_arn" {
  description = "ARN da task definition"
  value       = aws_ecs_task_definition.this.arn
}

output "security_group_id" {
  description = "ID do security group do serviço"
  value       = aws_security_group.service.id
}
```

### Usando o Módulo

```hcl
# environments/dev/main.tf
module "api_service" {
  source = "../../modules/ecs-service"

  name            = "api"
  container_image = "123456789.dkr.ecr.us-east-1.amazonaws.com/api:v1.2.3"
  container_port  = 8080
  cpu             = 512
  memory          = 1024
  desired_count   = 2
  vpc_id          = data.terraform_remote_state.network.outputs.vpc_id
  subnet_ids      = data.terraform_remote_state.network.outputs.private_subnet_ids

  tags = local.common_tags
}
```

### Quando Criar um Módulo?

Nem tudo precisa ser um módulo. Crie quando:

- O mesmo padrão de recursos se repete **3+ vezes**
- Você quer **encapsular complexidade** (ex: um ECS service tem task definition, IAM roles, log group, security group — tudo junto)
- Times diferentes precisam do **mesmo padrão** com valores diferentes

Não crie módulos para um único recurso — `module "s3_bucket"` que só encapsula `aws_s3_bucket` adiciona indireção sem valor.

### Módulos da Comunidade

O Terraform Registry tem módulos mantidos pela comunidade que são excelentes pontos de partida:

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "minha-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true  # Um NAT para dev, um por AZ para prod

  tags = local.common_tags
}
```

Os módulos `terraform-aws-modules/*` são os mais populares e bem mantidos. Sempre fixe a versão.

---

## 4. Segurança

Terraform gerencia a infraestrutura inteira — um erro de segurança aqui tem blast radius máximo.

### Nunca Hardcode Credenciais

Isso parece óbvio, mas acontece com mais frequência do que qualquer um admite:

```hcl
# ❌ NUNCA faça isso
provider "aws" {
  access_key = "AKIAIOSFODNN7EXAMPLE"
  secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
  region     = "us-east-1"
}

# ✅ Use variáveis de ambiente ou perfis
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile  # Ou omita para usar a chain padrão
}
```

O Terraform segue a **AWS credential chain** automaticamente: variáveis de ambiente (`AWS_ACCESS_KEY_ID`), arquivo de configuração (`~/.aws/credentials`), IAM role do EC2/ECS, etc. Deixe-o usar.

### Gerenciamento de Secrets

Para valores sensíveis como senhas de banco de dados, nunca coloque em `terraform.tfvars`:

```hcl
# ✅ Use AWS Secrets Manager ou SSM Parameter Store
resource "aws_db_instance" "main" {
  # ...
  manage_master_user_password   = true  # AWS gerencia a senha automaticamente
  master_user_secret_kms_key_id = aws_kms_key.rds.arn
}

# Ou busque de um secret existente
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/db/password"
}

resource "aws_db_instance" "main" {
  # ...
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}
```

### Princípio do Menor Privilégio

A IAM role usada pelo Terraform deve ter apenas as permissões necessárias:

```hcl
# Política para o pipeline de CI/CD
data "aws_iam_policy_document" "terraform_ci" {
  statement {
    sid    = "TerraformStateAccess"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:ListBucket",
    ]
    resources = [
      "arn:aws:s3:::minha-empresa-terraform-state",
      "arn:aws:s3:::minha-empresa-terraform-state/*",
    ]
  }

  # Permissões específicas para os recursos que o Terraform gerencia
  statement {
    sid    = "ManageECSResources"
    effect = "Allow"
    actions = [
      "ecs:*",
      "ecr:*",
      "logs:*",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["us-east-1"]
    }
  }
}
```

### Marque Dados Sensíveis

```hcl
variable "db_password" {
  description = "Senha do banco de dados"
  type        = string
  sensitive   = true  # Não aparece em logs do plan/apply
}

output "db_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "db_password" {
  value     = aws_db_instance.main.password
  sensitive = true
}
```

### Encripte o Estado

O arquivo de estado contém **todos os valores em texto claro**, incluindo senhas e chaves. A encriptação do S3 é obrigatória, e o acesso ao bucket deve ser restrito:

```hcl
terraform {
  backend "s3" {
    bucket         = "minha-empresa-terraform-state"
    key            = "environments/prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true                    # Encriptação SSE-S3 ou KMS
    kms_key_id     = "alias/terraform-state" # Opcional: KMS para controle extra
    use_lockfile   = true
  }
}
```

---

## 5. Convenções de Nomenclatura e Tags

A consistência na nomenclatura previne confusão, facilita busca, e habilita automações de custo e compliance.

### Padrão de Nomenclatura

```hcl
locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Repository  = "github.com/minha-empresa/infrastructure"
  }
}

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"
  tags = local.common_tags
}

resource "aws_s3_bucket" "assets" {
  bucket = "${local.name_prefix}-assets-${data.aws_caller_identity.current.account_id}"
  tags   = local.common_tags
}
```

### Tags Obrigatórias

Use uma variável de validação para garantir que tags essenciais estão sempre presentes:

```hcl
variable "tags" {
  description = "Tags obrigatórias para todos os recursos"
  type        = map(string)

  validation {
    condition = alltrue([
      contains(keys(var.tags), "Project"),
      contains(keys(var.tags), "Environment"),
      contains(keys(var.tags), "Owner"),
    ])
    error_message = "Tags obrigatórias: Project, Environment, Owner."
  }
}
```

Melhor ainda, use **AWS Tag Policies** ou **AWS Config Rules** para enforcement em nível de organização.

### Default Tags no Provider

A partir do AWS provider 3.38+, você pode definir tags padrão que são aplicadas automaticamente a todos os recursos:

```hcl
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
```

---

## 6. Variáveis, Locals e Outputs

### Organize as Variáveis

Coloque todas as variáveis em `variables.tf` e agrupe por propósito:

```hcl
# --- Geral ---
variable "project" {
  description = "Nome do projeto"
  type        = string
}

variable "environment" {
  description = "Ambiente (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Ambiente deve ser dev, staging ou prod."
  }
}

variable "aws_region" {
  description = "Região AWS"
  type        = string
  default     = "us-east-1"
}

# --- Rede ---
variable "vpc_cidr" {
  description = "CIDR block da VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# --- Banco de Dados ---
variable "db_instance_class" {
  description = "Classe da instância RDS"
  type        = string
  default     = "db.t3.micro"
}
```

### Use Locals para Computações

Locals são para valores derivados — nunca duplique lógica:

```hcl
locals {
  name_prefix = "${var.project}-${var.environment}"
  is_prod     = var.environment == "prod"

  db_config = {
    dev = {
      instance_class    = "db.t3.micro"
      allocated_storage = 20
      multi_az          = false
    }
    staging = {
      instance_class    = "db.t3.small"
      allocated_storage = 50
      multi_az          = false
    }
    prod = {
      instance_class    = "db.r6g.large"
      allocated_storage = 100
      multi_az          = true
    }
  }

  db = local.db_config[var.environment]
}

resource "aws_db_instance" "main" {
  instance_class    = local.db.instance_class
  allocated_storage = local.db.allocated_storage
  multi_az          = local.db.multi_az
  # ...
}
```

### Arquivo tfvars por Ambiente

```hcl
# environments/dev/terraform.tfvars
project     = "minha-app"
environment = "dev"
aws_region  = "us-east-1"

# environments/prod/terraform.tfvars
project     = "minha-app"
environment = "prod"
aws_region  = "us-east-1"
```

### Outputs Úteis

Exporte apenas o que outros projetos ou scripts precisam:

```hcl
output "vpc_id" {
  description = "ID da VPC"
  value       = module.vpc.vpc_id
}

output "alb_dns_name" {
  description = "DNS do Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "URL do repositório ECR"
  value       = aws_ecr_repository.app.repository_url
}
```

---

## 7. Dependências e Lifecycle Rules

### Dependências Implícitas vs Explícitas

O Terraform automaticamente detecta dependências quando um recurso referencia outro:

```hcl
# Dependência implícita — Terraform sabe a ordem
resource "aws_security_group" "db" {
  vpc_id = aws_vpc.main.id  # Depende da VPC
}

resource "aws_db_instance" "main" {
  vpc_security_group_ids = [aws_security_group.db.id]  # Depende do SG
}
```

Use `depends_on` apenas quando a dependência não é visível nos atributos:

```hcl
resource "aws_ecs_service" "app" {
  # ...

  depends_on = [aws_lb_listener.https]
}
```

### Lifecycle Rules

```hcl
resource "aws_db_instance" "main" {
  # ...

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_ecs_task_definition" "app" {
  # ...

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_launch_template" "app" {
  # ...

  lifecycle {
    ignore_changes = [image_id]
  }
}
```

Quando usar cada regra:

| Regra | Quando usar |
|---|---|
| `prevent_destroy` | Bancos de dados, buckets S3 com dados, recursos que nunca devem ser deletados acidentalmente |
| `create_before_destroy` | Recursos que precisam de zero-downtime na atualização (task definitions, launch templates) |
| `ignore_changes` | Atributos gerenciados fora do Terraform (ex: AMI atualizada por outro pipeline, tags adicionadas manualmente) |

### Moved Blocks (Terraform 1.1+)

Quando você refatora código e renomeia um recurso, use `moved` para evitar destroy + recreate:

```hcl
moved {
  from = aws_s3_bucket.old_name
  to   = aws_s3_bucket.new_name
}

moved {
  from = aws_instance.web
  to   = module.compute.aws_instance.web
}
```

---

## 8. Versionamento e Pinning

### Fixe Versões — Sempre

Sem pinning, um `terraform init` pode baixar uma versão nova do provider que quebra tudo:

```hcl
# versions.tf
terraform {
  required_version = ">= 1.5.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"    # Permite 5.x, bloqueia 6.0
    }
  }
}
```

### Lock File

O arquivo `.terraform.lock.hcl` é gerado automaticamente e deve ser commitado no Git. Ele garante que todos no time usem exatamente as mesmas versões do provider:

```bash
# Atualize o lock file quando mudar versões
terraform init -upgrade
```

### Versões de Módulos

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.8.1"  # Fixe a versão exata para módulos externos
  # ...
}

module "internal_service" {
  source = "git::https://github.com/minha-empresa/terraform-modules.git//ecs-service?ref=v2.1.0"
  # ...
}
```

Para módulos locais (`source = "../../modules/vpc"`), o versionamento é pelo Git — o módulo é sempre a versão do commit atual.

---

## 9. Importação de Recursos Existentes

Uma das barreiras mais comuns para adotar Terraform é a infraestrutura que já existe. Desde o Terraform 1.5, o processo ficou muito mais simples com **import blocks**.

### Import Blocks (Terraform 1.5+)

Antes, importar era um processo manual com `terraform import`. Agora é declarativo:

```hcl
# Importar um bucket S3 existente
import {
  to = aws_s3_bucket.existing_assets
  id = "meu-bucket-existente"
}

resource "aws_s3_bucket" "existing_assets" {
  bucket = "meu-bucket-existente"
  # ... configure para match com o estado real
}

# Importar uma instância EC2
import {
  to = aws_instance.legacy_server
  id = "i-0abc123def456789"
}

# Importar um security group
import {
  to = aws_security_group.legacy_sg
  id = "sg-0abc123def456789"
}
```

### Geração Automática de Configuração

A melhor parte: o Terraform pode gerar a configuração automaticamente:

```bash
# Escreva apenas os import blocks, sem os resource blocks
# Então rode:
terraform plan -generate-config-out=generated.tf
```

O Terraform cria `generated.tf` com todos os atributos do recurso existente. Revise, limpe, e mova para os arquivos corretos.

### Workflow de Migração

1. **Identifique** os recursos existentes (use `aws cli` ou o console)
2. **Escreva** os import blocks em um arquivo `imports.tf`
3. **Gere** a configuração com `terraform plan -generate-config-out=generated.tf`
4. **Revise** e limpe o código gerado
5. **Aplique** com `terraform apply` — os recursos são importados sem modificação
6. **Remova** os import blocks (eles só precisam rodar uma vez)
7. **Valide** com `terraform plan` — o resultado deve ser "No changes"

---

## 10. CI/CD com Terraform

Aplicar Terraform manualmente é aceitável no início, mas em times, você precisa de um pipeline.

### Workflow Recomendado

```
PR criado → terraform plan → comentário no PR com o plano
PR aprovado + merged → terraform apply (automático ou manual)
```

### GitHub Actions

```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  pull_request:
    paths:
      - 'infrastructure/**'
  push:
    branches: [main]
    paths:
      - 'infrastructure/**'

permissions:
  id-token: write   # Para OIDC com AWS
  contents: read
  pull-requests: write

jobs:
  plan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [dev, staging, prod]
    defaults:
      run:
        working-directory: infrastructure/environments/${{ matrix.environment }}

    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-ci
          aws-region: us-east-1

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.9.0"

      - name: Terraform Init
        run: terraform init

      - name: Terraform Format Check
        run: terraform fmt -check -recursive

      - name: Terraform Validate
        run: terraform validate

      - name: Terraform Plan
        id: plan
        run: terraform plan -no-color -out=tfplan
        continue-on-error: true

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const output = `### Terraform Plan — \`${{ matrix.environment }}\`

            \`\`\`
            ${{ steps.plan.outputs.stdout }}
            \`\`\`

            *Pushed by: @${{ github.actor }}*`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: output
            });

  apply:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production  # Requer aprovação manual
    defaults:
      run:
        working-directory: infrastructure/environments/prod

    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-ci
          aws-region: us-east-1

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.9.0"

      - name: Terraform Init
        run: terraform init

      - name: Terraform Apply
        run: terraform apply -auto-approve
```

### OIDC em Vez de Chaves Estáticas

Note o uso de `role-to-assume` no workflow acima. Com OIDC, o GitHub Actions assume uma IAM role diretamente — sem `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` guardadas nos secrets do repositório:

```hcl
# IAM role para GitHub Actions via OIDC
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["ffffffffffffffffffffffffffffffffffffffff"]
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:minha-empresa/infrastructure:*"]
    }
  }
}

resource "aws_iam_role" "terraform_ci" {
  name               = "terraform-ci"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json
}
```

---

## 11. Testes e Validação

### terraform validate

O básico — verifica se a sintaxe está correta:

```bash
terraform validate
```

### terraform fmt

Formatação consistente. Rode no CI e bloqueie PRs que não formataram:

```bash
terraform fmt -check -recursive -diff
```

### TFLint

Linter específico para Terraform que detecta erros que `validate` não pega:

```bash
# Instalar
brew install tflint

# Configurar (.tflint.hcl)
plugin "aws" {
  enabled = true
  version = "0.32.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

rule "terraform_naming_convention" {
  enabled = true
}

rule "terraform_documented_variables" {
  enabled = true
}

# Rodar
tflint --init
tflint
```

O TFLint pega coisas como tipos de instância EC2 inválidos, AMIs que não existem na região, e violações de naming conventions.

### Checkov / tfsec

Análise estática de segurança — detecta configurações inseguras:

```bash
# Instalar
pip install checkov

# Rodar
checkov -d . --framework terraform

# Exemplos do que detecta:
# ✗ S3 bucket sem encriptação
# ✗ Security group com 0.0.0.0/0 na porta 22
# ✗ RDS sem backup habilitado
# ✗ CloudTrail sem encriptação KMS
```

### Terratest (Testes de Integração)

Para validar que a infraestrutura realmente funciona como esperado:

```go
// test/vpc_test.go
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/stretchr/testify/assert"
)

func TestVpcModule(t *testing.T) {
    t.Parallel()

    terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
        TerraformDir: "../modules/vpc",
        Vars: map[string]interface{}{
            "project":     "test",
            "environment": "test",
            "cidr":        "10.99.0.0/16",
        },
    })

    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)

    vpcId := terraform.Output(t, terraformOptions, "vpc_id")
    assert.NotEmpty(t, vpcId)

    privateSubnets := terraform.OutputList(t, terraformOptions, "private_subnet_ids")
    assert.Equal(t, 3, len(privateSubnets))
}
```

---

## 12. Estimativa e Gerenciamento de Custos

### Infracost

O Infracost estima custos antes de aplicar mudanças — diretamente no pull request:

```bash
# Instalar
brew install infracost
infracost auth login

# Estimar custos de um plano
infracost breakdown --path .

# Comparar com a infraestrutura atual
infracost diff --path .
```

Exemplo de output:

```
Name                                     Monthly Qty  Unit         Monthly Cost

aws_db_instance.main
├─ Database instance (db.r6g.large)              730  hours             $260.00
├─ Storage (gp3)                                 100  GB                 $11.50
└─ Additional backup storage                      50  GB                  $4.75

aws_ecs_service.app
└─ 2 × Fargate (0.5 vCPU, 1GB)                  730  hours              $48.58

OVERALL TOTAL                                                          $324.83
```

### No CI/CD

```yaml
- name: Infracost
  run: |
    infracost diff --path . --format json --out-file /tmp/infracost.json
    infracost comment github --path /tmp/infracost.json \
      --repo ${{ github.repository }} \
      --pull-request ${{ github.event.pull_request.number }} \
      --github-token ${{ github.token }}
```

---

## 13. Princípio DRY com Terragrunt

Se você tem múltiplos ambientes com configuração quase idêntica, **Terragrunt** elimina a repetição:

```
infrastructure/
├── modules/
│   └── ecs-service/
├── terragrunt.hcl              # Config raiz
└── environments/
    ├── dev/
    │   └── terragrunt.hcl      # Inclui a config raiz + overrides
    ├── staging/
    │   └── terragrunt.hcl
    └── prod/
        └── terragrunt.hcl
```

```hcl
# terragrunt.hcl (raiz)
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket       = "minha-empresa-terraform-state"
    key          = "${path_relative_to_include()}/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      ManagedBy = "terraform"
    }
  }
}
EOF
}
```

```hcl
# environments/dev/terragrunt.hcl
include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../modules/ecs-service"
}

inputs = {
  environment   = "dev"
  desired_count = 1
  cpu           = 256
  memory        = 512
}
```

```hcl
# environments/prod/terragrunt.hcl
include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../modules/ecs-service"
}

inputs = {
  environment   = "prod"
  desired_count = 4
  cpu           = 1024
  memory        = 2048
}
```

Agora, `terragrunt run-all apply` aplica todos os ambientes de uma vez, na ordem correta.

---

## 14. Padrões Comuns na AWS

### VPC Completa

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${local.name_prefix}-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = local.is_prod ? false : true
  one_nat_gateway_per_az = local.is_prod

  enable_dns_hostnames = true
  enable_dns_support   = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
  }

  tags = local.common_tags
}
```

### RDS com Boas Práticas

```hcl
resource "aws_db_instance" "main" {
  identifier     = "${local.name_prefix}-db"
  engine         = "postgres"
  engine_version = "16.3"

  instance_class    = local.db.instance_class
  allocated_storage = local.db.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn

  db_name  = "app"
  username = "admin"
  manage_master_user_password = true

  multi_az               = local.db.multi_az
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  backup_retention_period = local.is_prod ? 30 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  deletion_protection = local.is_prod
  skip_final_snapshot = !local.is_prod
  final_snapshot_identifier = local.is_prod ? "${local.name_prefix}-db-final" : null

  performance_insights_enabled = true

  tags = local.common_tags

  lifecycle {
    prevent_destroy = true
  }
}
```

### S3 + CloudFront para Static Sites

```hcl
resource "aws_s3_bucket" "website" {
  bucket = "${local.name_prefix}-website"
  tags   = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_distribution" "website" {
  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "s3-website"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  enabled             = true
  default_root_object = "index.html"
  aliases             = [var.domain_name]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-website"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.website.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = local.common_tags
}

resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${local.name_prefix}-website-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
```

### Lambda Function

```hcl
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "processor" {
  filename         = data.archive_file.lambda.output_path
  function_name    = "${local.name_prefix}-processor"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.main.name
      LOG_LEVEL  = var.environment == "prod" ? "warn" : "debug"
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = local.common_tags
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.processor.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
```

---

## 15. Anti-Padrões para Evitar

Depois de ver tudo que funciona bem, aqui está o que evitar:

### ❌ `terraform apply` sem `plan` antes

Sempre rode `plan` primeiro. No CI/CD, salve o plano e aplique o plano salvo:

```bash
terraform plan -out=tfplan
terraform apply tfplan
```

### ❌ Recursos compartilhados em um único estado

Se rede, banco de dados e compute estão no mesmo estado, um `terraform destroy` acidental destrói tudo. Isole.

### ❌ Usar `count` quando `for_each` é mais apropriado

```hcl
# ❌ count — recursos referenciados por índice (frágil)
resource "aws_subnet" "private" {
  count      = 3
  cidr_block = "10.0.${count.index}.0/24"
}
# Se remover o item 0, os itens 1 e 2 são destruídos e recriados

# ✅ for_each — recursos referenciados por chave (estável)
resource "aws_subnet" "private" {
  for_each   = toset(["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"])
  cidr_block = each.value
}
# Remover um item destrói apenas aquele item
```

### ❌ Hardcoded AZs e Account IDs

```hcl
# ❌
availability_zone = "us-east-1a"

# ✅
data "aws_availability_zones" "available" {
  state = "available"
}

availability_zone = data.aws_availability_zones.available.names[0]
```

### ❌ Ignorar o output do `plan`

O `plan` é sua última linha de defesa. Se ele mostra `destroy` em um recurso que você não esperava, **pare e investigue**. Nunca dê `apply` em um plano sem ler.

### ❌ Não usar `terraform.lock.hcl`

Commite o lock file. Sempre. Sem ele, cada desenvolvedor pode estar usando versões diferentes do provider.

---

## Checklist de Melhores Práticas

Para referência rápida, aqui está tudo consolidado:

| Categoria | Prática |
|---|---|
| **Estado** | Backend remoto S3 com `use_lockfile = true` desde o dia 1 |
| **Estado** | Encriptação KMS habilitada |
| **Estado** | State isolation por domínio (rede, dados, compute) |
| **Estrutura** | Diretórios separados por ambiente |
| **Estrutura** | Módulos para padrões que se repetem 3+ vezes |
| **Segurança** | Zero credenciais hardcoded |
| **Segurança** | `sensitive = true` em variáveis e outputs sensíveis |
| **Segurança** | OIDC para CI/CD, não chaves estáticas |
| **Segurança** | Secrets no AWS Secrets Manager, não no tfvars |
| **Versões** | Pin de versão do Terraform, providers e módulos |
| **Versões** | `.terraform.lock.hcl` commitado |
| **Tags** | Default tags no provider |
| **Tags** | Tags obrigatórias validadas |
| **CI/CD** | `plan` no PR, `apply` no merge |
| **CI/CD** | Infracost para estimativa de custos |
| **Qualidade** | `fmt`, `validate`, TFLint e Checkov no pipeline |
| **Lifecycle** | `prevent_destroy` em recursos críticos |
| **Lifecycle** | `for_each` em vez de `count` quando possível |
| **Migração** | Import blocks para infraestrutura existente |

---

## Conclusão

Terraform na AWS não é difícil de começar — mas é fácil criar uma bola de neve de tech debt se você não estruturar bem desde o início. As práticas neste guia não são teoria acadêmica: são o resultado de dor real em projetos reais.

Comece simples: um backend S3, um módulo por padrão que se repete, um pipeline que mostra o `plan` no PR. Não tente aplicar tudo de uma vez. Cada prática desse guia é uma melhoria incremental que você pode adotar quando o problema correspondente aparecer.

O investimento em infraestrutura como código compensa exponencialmente. No dia em que você precisar recriar um ambiente inteiro do zero — e esse dia vai chegar — você vai agradecer a si mesmo por ter tomado o tempo de fazer direito.
