---
title: 'Raspberry Pi 5 como Servidor Doméstico de um Engenheiro de IA'
description: 'Transforme um Raspberry Pi 5 em um servidor pessoal de desenvolvimento com IA — Docker, Tailscale, serviços persistentes e um app de demonstração rodando. Guia prático a partir da sua primeira sessão SSH.'
pubDate: 2026-05-12
tags: ['Raspberry Pi', 'DevOps', 'Docker', 'Ollama', 'Self-hosting']
lang: 'pt'
---

Você ligou o Raspberry Pi 5, o SSH está funcionando e um cursor piscando te encara. E agora?

Este guia transforma essa tela em branco em um servidor pessoal de desenvolvimento com IA — pronto para Docker, acessível remotamente de qualquer lugar, rodando suas automações como serviços persistentes. Vamos terminar com um app real implantado de ponta a ponta, para você sentir o fluxo completo antes de adicionar algo mais complexo.

**O que você vai ter no final:**
- Raspberry Pi 5 configurado como servidor headless
- Docker + Compose para serviços containerizados
- Tailscale para acesso remoto seguro (sem precisar de port forwarding)
- Um app FastAPI rodando como seu primeiro serviço implantado
- Ollama como bônus para inferência local de LLM

**O que este guia assume:** Seu Pi 5 já está rodando Raspberry Pi OS Lite (64-bit), você já se conectou via SSH pelo menos uma vez e tem acesso à internet. A configuração com o Raspberry Pi Imager está bem documentada na [documentação oficial](https://www.raspberrypi.com/documentation/computers/getting-started.html) — este guia começa logo após o primeiro login.

---

## 1. Configuração Pós-Boot

Primeiro, garanta que tudo está atualizado e que o básico está configurado.

```bash
sudo apt update && sudo apt full-upgrade -y
sudo reboot
```

Após o reboot, reconecte e execute o `raspi-config` para o essencial:

```bash
sudo raspi-config
```

Coisas que valem a pena configurar aqui:
- **System Options → Hostname** — dê um nome ao Pi, como `pidev`, em vez de `raspberrypi`
- **Localisation Options → Timezone** — defina seu fuso horário
- **Localisation Options → Locale** — defina seu locale (ex.: `en_US.UTF-8`)
- **Performance Options → GPU Memory** — reduza para `16` MB, já que estamos headless (libera mais RAM para os serviços)

Se preferir comandos não interativos:

```bash
sudo raspi-config nonint do_hostname "pidev"
sudo raspi-config nonint do_change_timezone "America/Sao_Paulo"
sudo raspi-config nonint do_memory_split 16
```

### Endurecimento do SSH

Se ainda não fez, mude para autenticação por chave e desabilite login por senha. Na sua workstation:

```bash
# Generate a key if you don't have one
ssh-keygen -t ed25519 -C "your-email"

# Copy to the Pi
ssh-copy-id pi@192.168.1.x
```

Depois, no Pi, edite `/etc/ssh/sshd_config`:

```
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
```

```bash
sudo systemctl restart ssh
```

> Mantenha sua sessão SSH atual aberta enquanto testa a nova conexão em um segundo terminal. Assim você não corre o risco de se trancar para fora.

### IP Estático (opcional, mas conveniente)

Raspberry Pi OS Bookworm e versões posteriores usam NetworkManager — a abordagem antiga com `dhcpcd.conf` não funciona mais. Se quiser um IP fixo:

```bash
# List connections to find the right name
nmcli connection show

# Set static IP (adjust interface name, IP, gateway, DNS)
sudo nmcli connection modify "Wired connection 1" \
  ipv4.method manual \
  ipv4.addresses "192.168.1.100/24" \
  ipv4.gateway "192.168.1.1" \
  ipv4.dns "1.1.1.1,8.8.8.8"

sudo nmcli connection down "Wired connection 1" && \
sudo nmcli connection up "Wired connection 1"
```

Alternativamente, `sudo nmtui` oferece uma TUI mais amigável. Ou simplesmente configure uma reserva DHCP no roteador — muitas vezes é o caminho mais simples.

---

## 2. Tailscale — Acesso de Qualquer Lugar

O Tailscale cria uma rede mesh criptografada entre seus dispositivos. Instale no Pi e no laptop, e você pode fazer SSH no Pi de qualquer lugar do mundo — sem port forwarding, sem configuração de VPN, sem DNS dinâmico.

```bash
curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.noarmor.gpg \
  | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null

curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.tailscale-keyring.list \
  | sudo tee /etc/apt/sources.list.d/tailscale.list

sudo apt update && sudo apt install -y tailscale

sudo tailscale up
```

Siga a URL de autenticação que aparecer. Depois de autenticar, obtenha o IP Tailscale do Pi:

```bash
tailscale ip -4
```

**Passo crítico:** Acesse o [console de administração do Tailscale](https://login.tailscale.com/admin/machines), encontre seu Pi e clique em **Disable key expiry**. Caso contrário, em 180 dias você ficará bloqueado remotamente sem forma de reautenticar.

Opcional: habilite o Tailscale SSH (gerencia acesso SSH via ACLs do Tailscale):

```bash
sudo tailscale up --ssh
```

A partir de agora, você pode fazer `ssh pi@100.x.x.x` de qualquer lugar.

---

## 3. Docker — A Base

Não instale o Docker com `sudo apt install docker.io` — o pacote Debian é antigo e não tem suporte. Use o repositório oficial do Docker:

```bash
sudo apt install -y ca-certificates curl

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update

sudo apt install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

# Run Docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

Verifique se funciona:

```bash
docker run hello-world
docker compose version
```

> O `$(dpkg --print-architecture)` retorna `arm64` no Pi 5 — isso está correto. Guias antigos do Pi 4 às vezes fixavam `armhf`, o que está errado para OS 64-bit.

### Uma nota sobre o Trixie

Se seu Pi estiver rodando Debian Trixie (como `wittmann@wittmann:~$` acima), o `VERSION_CODENAME` será `trixie`. O comando acima lida com isso automaticamente. Se encontrar erros 404 ao adicionar o repositório Docker, verifique `apt-cache policy docker-ce` — alguns repositórios de terceiros ainda não têm a suite `trixie`; nesse caso, substituir por `bookworm` na linha `Suites:` funciona (os pacotes são compatíveis).

---

## 4. Seu Primeiro App — De Ponta a Ponta

Vamos implantar um serviço real. Vamos construir um app FastAPI mínimo que retorna uma resposta JSON, containerizá-lo e rodá-lo com Docker Compose. Isso cobre o fluxo completo que você vai repetir para cada serviço futuro.

### O app

Crie um diretório de projeto:

```bash
mkdir ~/apps/hello-api && cd ~/apps/hello-api
```

Crie o arquivo do app:

```python
# main.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hello from the Pi!", "status": "running"}

@app.get("/health")
def health():
    return {"status": "ok"}
```

Crie o `Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN pip install fastapi uvicorn

COPY main.py .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Crie o `compose.yml`:

```yaml
services:
  hello-api:
    build: .
    ports:
      - "8000:8000"
    restart: always
```

### Implante

```bash
docker compose up -d
```

Na primeira execução, a imagem é construída. Depois disso:

```bash
# Check it's running
docker compose ps

# Test it
curl http://localhost:8000/

# Follow logs
docker compose logs -f
```

Você deve ver:

```json
{"message": "Hello from the Pi!", "status": "running"}
```

Agora teste do seu laptop (usando o IP Tailscale):

```bash
curl http://100.x.x.x:8000/
```

Pronto — um serviço real, rodando no Pi, acessível de qualquer lugar via Tailscale. A política `restart: always` faz com que ele sobreviva a reboots automaticamente.

### Comandos úteis do Compose

```bash
docker compose up -d          # start services in background
docker compose down           # stop and remove containers
docker compose restart        # restart services
docker compose logs -f        # follow logs
docker compose ps             # show running services
docker compose exec hello-api bash   # get a shell inside the container
```

---

## 5. Estruturando Múltiplos Serviços

Quando tiver mais de um serviço, uma estrutura de diretórios organizada compensa. Aqui está o que funciona bem:

```
~/apps/
├── hello-api/
│   ├── compose.yml
│   ├── Dockerfile
│   └── main.py
├── mcp-server/
│   ├── compose.yml
│   └── ...
└── monitoring/
    ├── compose.yml
    └── ...
```

Cada serviço fica em seu próprio diretório com seu `compose.yml`. Isso os mantém independentes — você pode atualizar, reiniciar ou derrubar um sem mexer nos outros.

Para serviços que compartilham uma rede (ex.: uma API que conversa com um banco de dados), você pode colocá-los no mesmo `compose.yml` ou usar redes externas do Docker:

```yaml
# In each compose.yml that needs to communicate
networks:
  shared:
    external: true
```

Crie a rede uma vez: `docker network create shared`.

### Variáveis de ambiente

Nunca hardcode segredos no `compose.yml`. Use um arquivo `.env`:

```bash
# .env
API_KEY=your-key-here
DATABASE_URL=postgresql://user:pass@db:5432/mydb
```

```yaml
# compose.yml
services:
  my-service:
    env_file: .env
```

Adicione `.env` ao `.gitignore` — ele nunca deve ser commitado.

---

## 6. Dicas de Sobrevivência do Cartão SD

Rodar um servidor 24/7 em cartão SD é arriscado — gravações pequenas constantes de logs, Docker e arquivos temporários degradam o cartão ao longo de meses. Três mitigações:

**`log2ram`** — move `/var/log` para RAM e sincroniza com o disco diariamente:

```bash
# Add the azlux repo
. /etc/os-release
sudo wget -O /usr/share/keyrings/azlux-archive-keyring.gpg \
  https://azlux.fr/repo.gpg

sudo tee /etc/apt/sources.list.d/azlux.list <<EOF
deb [signed-by=/usr/share/keyrings/azlux-archive-keyring.gpg] \
  http://packages.azlux.fr/debian/ $VERSION_CODENAME main
EOF

sudo apt update && sudo apt install -y log2ram rsync
```

Edite `/etc/log2ram.conf` e aumente `SIZE=128M` (o padrão de 40M é pequeno demais para Docker), depois reinicie.

**Limite de tamanho do Journald** — limita gravações do journal do systemd:

```bash
sudo mkdir -p /etc/systemd/journald.conf.d/
sudo tee /etc/systemd/journald.conf.d/size.conf <<'EOF'
[Journal]
SystemMaxUse=50M
RuntimeMaxUse=50M
EOF
sudo systemctl restart systemd-journald
```

**Mover dados do Docker para SSD USB** — camadas de imagem Docker são o maior vilão do cartão SD. Se tiver um SSD USB 3.0, mova o data root do Docker para lá:

```bash
sudo systemctl stop docker
sudo mv /var/lib/docker /mnt/ssd/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{"data-root": "/mnt/ssd/docker"}
EOF
sudo systemctl start docker
```

O Pi 5 também suporta NVMe via M.2 HAT+ — um upgrade mais permanente se você planeja rodar workloads mais pesados.

---

## 7. Ollama (Bônus) — Inferência Local de LLM

O Pi 5 não é um servidor GPU, mas com 8GB de RAM consegue rodar modelos pequenos a médios. Não espere respostas instantâneas — pense nele como um endpoint LLM lento, mas gratuito e sempre ligado, para automações pessoais.

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

O instalador detecta ARM64 e configura um serviço systemd automaticamente.

### Quais modelos são realistas

Com 8GB de RAM compartilhada e overhead do SO:

| Model | RAM usage | Speed on Pi 5 |
|---|---|---|
| `gemma3:1b` | ~1GB | 15–25 tok/s — fastest |
| `llama3.2:1b` | ~1.3GB | 10–20 tok/s |
| `llama3.2:3b` | ~2GB | 8–15 tok/s — good balance |
| `phi3:mini` (3.8B) | ~2.3GB | 5–10 tok/s |
| `llama3.1:8b` | ~4.7GB | 2–5 tok/s — slow but works |
| 13B+ | — | OOM or unusable |

Para uso interativo e automações, os modelos de 1B–3B acertam o ponto ideal. 7B/8B funciona para tarefas em batch onde a latência não importa.

```bash
# Pull and run a model
ollama pull llama3.2:3b
ollama run llama3.2:3b

# Check what's loaded and RAM usage
ollama ps

# The API is at localhost:11434 — OpenAI-compatible via /v1/
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:3b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

O endpoint compatível com OpenAI significa que você pode apontar a maioria das ferramentas LLM (LangChain, LlamaIndex, Claude Code com endpoint local via `--model`) para o Pi com mudanças mínimas de configuração.

**Resfriamento ativo não é opcional.** Rodar um modelo 7B empurra o Pi para 80°C em minutos sem ventoinha. O cooler ativo oficial ou um case bem ventilado com ventoinha é obrigatório para inferência sustentada.

---

## Próximos Passos

Agora você tem a base: Docker, Tailscale, um serviço rodando e, opcionalmente, um LLM local. Daqui, os próximos passos naturais são:

- **Portainer ou Dockge** — interface web para gerenciar seus serviços Docker
- **Uptime Kuma** — monitoramento leve que alerta quando um serviço cai
- **Caddy** — reverse proxy para servir múltiplos serviços com URLs limpas (com HTTPS automático via Tailscale Funnel)
- **Workloads reais de IA** — servidores MCP, agentes de IA, automações customizadas rodando 24/7

O padrão é sempre o mesmo: novo diretório em `~/apps/`, escreva um `compose.yml`, `docker compose up -d`. O Pi cuida do resto.
