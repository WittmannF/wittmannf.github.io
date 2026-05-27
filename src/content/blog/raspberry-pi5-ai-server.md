---
title: 'Raspberry Pi 5 as an AI Engineer''s Home Server'
description: 'Turn a Raspberry Pi 5 into a personal AI dev server — Docker, Tailscale, persistent services, and a running demo app. Practical guide starting from your first SSH session.'
pubDate: 2026-05-12
tags: ['Raspberry Pi', 'DevOps', 'Docker', 'Ollama', 'Self-hosting']
lang: 'en'
---

You've got a Raspberry Pi 5 powered on, SSH working, and a blinking cursor staring back at you. Now what?

This guide turns that blank slate into a personal AI development server — Docker-ready, remotely accessible from anywhere, running your automations as persistent services. We'll finish with a real first app deployed end-to-end, so you can feel the whole workflow before adding anything more complex.

**What you'll end up with:**
- Raspberry Pi 5 configured as a headless server
- Docker + Compose for containerized services
- Tailscale for secure remote access (no port forwarding needed)
- A running FastAPI app as your first deployed service
- Ollama as a bonus for local LLM inference

**What this guide assumes:** Your Pi 5 is already running Raspberry Pi OS Lite (64-bit), you've connected via SSH at least once, and you have internet access. The Raspberry Pi Imager setup is well-documented in the [official docs](https://www.raspberrypi.com/documentation/computers/getting-started.html) — this guide picks up right after first login.

---

## 1. Post-Boot Configuration

First, make sure everything is up to date and the basics are configured.

```bash
sudo apt update && sudo apt full-upgrade -y
sudo reboot
```

After reboot, reconnect and run `raspi-config` for the essentials:

```bash
sudo raspi-config
```

Things worth setting here:
- **System Options → Hostname** — give your Pi a name like `pidev` instead of `raspberrypi`
- **Localisation Options → Timezone** — set to your timezone
- **Localisation Options → Locale** — set to your locale (e.g. `en_US.UTF-8`)
- **Performance Options → GPU Memory** — drop to `16` MB since we're headless (frees more RAM for services)

If you prefer non-interactive commands:

```bash
sudo raspi-config nonint do_hostname "pidev"
sudo raspi-config nonint do_change_timezone "America/Sao_Paulo"
sudo raspi-config nonint do_memory_split 16
```

### SSH Hardening

If you haven't already, switch to key-based auth and disable password login. On your workstation:

```bash
# Generate a key if you don't have one
ssh-keygen -t ed25519 -C "your-email"

# Copy to the Pi
ssh-copy-id pi@192.168.1.x
```

Then on the Pi, edit `/etc/ssh/sshd_config`:

```
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
```

```bash
sudo systemctl restart ssh
```

> Keep your current SSH session open while you test the new connection from a second terminal. This way you can't lock yourself out.

### Static IP (optional but convenient)

Raspberry Pi OS Bookworm and later use NetworkManager — the old `dhcpcd.conf` approach no longer works. If you want a fixed IP:

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

Alternatively, `sudo nmtui` gives you a friendlier TUI. Or just set a DHCP reservation on your router — often the simpler path.

---

## 2. Tailscale — Access From Anywhere

Tailscale creates an encrypted mesh network between your devices. Install it on the Pi and on your laptop, and you can SSH into the Pi from anywhere in the world — no port forwarding, no VPN configuration, no dynamic DNS.

```bash
curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.noarmor.gpg \
  | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null

curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.tailscale-keyring.list \
  | sudo tee /etc/apt/sources.list.d/tailscale.list

sudo apt update && sudo apt install -y tailscale

sudo tailscale up
```

Follow the authentication URL it prints. After authenticating, get your Pi's Tailscale IP:

```bash
tailscale ip -4
```

**Critical step:** Go to the [Tailscale admin console](https://login.tailscale.com/admin/machines), find your Pi, and click **Disable key expiry**. Otherwise you'll be locked out remotely in 180 days with no way to re-authenticate.

Optional: enable Tailscale SSH (manages SSH access through Tailscale ACLs):

```bash
sudo tailscale up --ssh
```

From now on, you can `ssh pi@100.x.x.x` from anywhere.

---

## 3. Docker — The Foundation

Do not install Docker via `sudo apt install docker.io` — the Debian package is old and unsupported. Use the official Docker repository:

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

Verify it works:

```bash
docker run hello-world
docker compose version
```

> The `$(dpkg --print-architecture)` returns `arm64` on the Pi 5 — this is correct. Old Pi 4 guides sometimes hardcoded `armhf`, which is wrong for 64-bit OS.

### A note on Trixie

If your Pi is running Debian Trixie (like `wittmann@wittmann:~$` above), the `VERSION_CODENAME` will be `trixie`. The command above handles this automatically. If you run into 404 errors when adding the Docker repo, check `apt-cache policy docker-ce` — some third-party repos don't have a `trixie` suite yet, in which case substituting `bookworm` in the `Suites:` line will work (the packages are compatible).

---

## 4. Your First App — End to End

Let's deploy a real service. We'll build a tiny FastAPI app that returns a JSON response, containerize it, and run it with Docker Compose. This covers the full workflow you'll repeat for every future service.

### The app

Create a project directory:

```bash
mkdir ~/apps/hello-api && cd ~/apps/hello-api
```

Create the app file:

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

Create the `Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN pip install fastapi uvicorn

COPY main.py .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Create `compose.yml`:

```yaml
services:
  hello-api:
    build: .
    ports:
      - "8000:8000"
    restart: always
```

### Deploy it

```bash
docker compose up -d
```

The first run builds the image. After that:

```bash
# Check it's running
docker compose ps

# Test it
curl http://localhost:8000/

# Follow logs
docker compose logs -f
```

You should see:

```json
{"message": "Hello from the Pi!", "status": "running"}
```

Now test it from your laptop (using the Tailscale IP):

```bash
curl http://100.x.x.x:8000/
```

That's it — a real service, running on your Pi, accessible from anywhere via Tailscale. The `restart: always` policy means it survives reboots automatically.

### Useful Compose commands

```bash
docker compose up -d          # start services in background
docker compose down           # stop and remove containers
docker compose restart        # restart services
docker compose logs -f        # follow logs
docker compose ps             # show running services
docker compose exec hello-api bash   # get a shell inside the container
```

---

## 5. Structuring Multiple Services

Once you have more than one service, a clean directory structure pays off. Here's what works well:

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

Each service lives in its own directory with its own `compose.yml`. This keeps them independent — you can update, restart, or tear down one without touching the others.

For services that share a network (e.g., an API that talks to a database), you can either put them in the same `compose.yml` or use Docker's external networks:

```yaml
# In each compose.yml that needs to communicate
networks:
  shared:
    external: true
```

Create the network once: `docker network create shared`.

### Environment variables

Never hardcode secrets in `compose.yml`. Use a `.env` file:

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

Add `.env` to `.gitignore` — it should never be committed.

---

## 6. SD Card Survival Tips

Running a 24/7 server on an SD card is risky — constant small writes from logs, Docker, and temp files will degrade it over months. Three mitigations:

**`log2ram`** — moves `/var/log` to RAM and syncs to disk daily:

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

Edit `/etc/log2ram.conf` and increase `SIZE=128M` (the default 40M is too small for Docker), then reboot.

**Journald size limit** — caps systemd journal writes:

```bash
sudo mkdir -p /etc/systemd/journald.conf.d/
sudo tee /etc/systemd/journald.conf.d/size.conf <<'EOF'
[Journal]
SystemMaxUse=50M
RuntimeMaxUse=50M
EOF
sudo systemctl restart systemd-journald
```

**Move Docker data to USB SSD** — Docker image layers are the biggest SD card killer. If you have a USB 3.0 SSD, move Docker's data root there:

```bash
sudo systemctl stop docker
sudo mv /var/lib/docker /mnt/ssd/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{"data-root": "/mnt/ssd/docker"}
EOF
sudo systemctl start docker
```

The Pi 5 also supports NVMe via the M.2 HAT+ — a more permanent upgrade if you're planning to run heavier workloads.

---

## 7. Ollama (Bonus) — Local LLM Inference

The Pi 5 is not a GPU server, but with 8GB RAM it can run small-to-medium models. Don't expect instant responses — think of it as a slow-but-free, always-on LLM endpoint for personal automations.

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

The installer detects ARM64 and sets up a systemd service automatically.

### Which models are realistic

With 8GB shared RAM and the OS overhead:

| Model | RAM usage | Speed on Pi 5 |
|---|---|---|
| `gemma3:1b` | ~1GB | 15–25 tok/s — fastest |
| `llama3.2:1b` | ~1.3GB | 10–20 tok/s |
| `llama3.2:3b` | ~2GB | 8–15 tok/s — good balance |
| `phi3:mini` (3.8B) | ~2.3GB | 5–10 tok/s |
| `llama3.1:8b` | ~4.7GB | 2–5 tok/s — slow but works |
| 13B+ | — | OOM or unusable |

For interactive use and automations, the 1B–3B models hit the sweet spot. 7B/8B works for batch tasks where latency doesn't matter.

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

The OpenAI-compatible endpoint means you can point most LLM tooling (LangChain, LlamaIndex, Claude Code with `--model` local endpoint) at your Pi with minimal config changes.

**Active cooling is not optional.** Running a 7B model will push your Pi to 80°C within minutes without a fan. The official active cooler or a well-ventilated case with a fan is mandatory for sustained inference.

---

## What's Next

You now have the foundation: Docker, Tailscale, a running service, and optionally a local LLM. From here, natural next steps are:

- **Portainer or Dockge** — web UI for managing your Docker services
- **Uptime Kuma** — lightweight monitoring that alerts you when a service goes down
- **Caddy** — reverse proxy to serve multiple services under clean URLs (with automatic HTTPS via Tailscale Funnel)
- **Actual AI workloads** — MCP servers, AI agents, custom automations running 24/7

The pattern is always the same: new directory under `~/apps/`, write a `compose.yml`, `docker compose up -d`. The Pi handles the rest.
