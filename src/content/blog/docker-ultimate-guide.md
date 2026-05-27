---
title: 'Docker for ML Engineers: A Practical Guide from Zero to Production'
description: 'Learn Docker by building: a FastAPI API with an ML model that starts running locally and ends production-ready. Each problem leads to the next concept — Dockerfile, Compose, volumes, networking, security, and deployment.'
pubDate: 2026-04-17
tags: ['Docker', 'DevOps', 'Containers', 'FastAPI', 'Python']
lang: 'en'
---

You trained an ML model. It works in your notebook. Now you need to serve it as an API for the rest of the team to consume. You build a FastAPI API, run it locally, everything looks great. Then you send the repo to a colleague and...

*"What Python version are you on? numpy throws an error here. And the .pkl model — where is it?"*

This guide takes you from that situation — an API that only works on your machine — to a containerized application ready for production. There are **12 real problems** you'll face when putting a model into production, each one leading to the next Docker concept: Dockerfile, `.dockerignore`, layer caching, Compose, volumes, networking, Redis, security, container registry, CI/CD, debugging, and cloud deployment.

We'll use a **FastAPI API that serves predictions from an ML model** as our running example. If you work on backend for AI applications, you'll feel right at home.

> **Want to follow along hands-on?** All example files are [available on GitHub](https://github.com/WittmannF/wittmannf.github.io/tree/main/public/blog/docker-ultimate-guide). Clone the repo, install dependencies with `pip install -r requirements.txt`, run `python train_model.py` to generate the model, and follow along.

---

## The Starting Point: An API That Works (on Your Machine)

We have a simple API: it receives data, runs a trained model, and returns a prediction.

```python
# app/main.py
from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np

app = FastAPI(title="ML Prediction API")
model = joblib.load("models/model.pkl")

class PredictionRequest(BaseModel):
    features: list[float]

class PredictionResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    prediction: float
    model_version: str = "1.0.0"

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    X = np.array(request.features).reshape(1, -1)
    prediction = model.predict(X)[0]
    return PredictionResponse(prediction=float(prediction))
```

To run locally:

```bash
pip install fastapi uvicorn joblib scikit-learn numpy
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

It works. But try replicating this on another machine. Python 3.11 vs 3.12, a different scikit-learn version, incompatible numpy, a model trained with another library version. Chaos.

**First problem: how do you guarantee this API runs the same everywhere?**

---

## What Docker Is (and Why It Solves This Problem)

Docker is a platform that packages your application together with **everything** it needs — code, runtime, libraries, model, configuration — into a **container**. A container is an isolated, portable environment: it works on your machine, your colleague's machine, the staging server, and in production on AWS.

The most useful analogy: before shipping containers, every type of cargo required a different transport method. Containers standardized everything — any cargo, any ship, any port. Docker did the same for software.

### Essential Concepts (only what you need for now)

- **Image**: a read-only template with everything your app needs. Think of it as a snapshot of the environment
- **Container**: a running instance of an image. Think of it as an isolated process
- **Dockerfile**: the recipe for building an image
- **Registry**: where images are stored (Docker Hub is the default public one)

More concepts will appear as needed. Let's get to what matters.

---

## Problem 1: "It Works on My Machine"

### Solution: Your First Dockerfile

Create a file called `Dockerfile` (no extension) at the project root:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Line by line:

| Instruction | What it does |
|-------------|--------------|
| `FROM python:3.12-slim` | Starts from an official Python image (slim version, ~150MB) |
| `WORKDIR /app` | Creates and enters the `/app` directory inside the container |
| `COPY requirements.txt .` | Copies the dependencies file into the image |
| `RUN pip install ...` | Installs dependencies (during build, not at runtime) |
| `COPY . .` | Copies all application code |
| `EXPOSE 8000` | Documents that the app listens on port 8000 |
| `CMD [...]` | Command executed when the container starts |

Now build and run:

```bash
# Build the image (the trailing dot is the build context — current directory)
docker build -t ml-api:v1 .

# Run the container
docker run -d --name ml-api -p 8000:8000 ml-api:v1

# Test
curl http://localhost:8000/health
# {"status": "healthy"}

curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"features": [1.5, 2.3, 0.8, 4.1]}'
# {"prediction": 42.7, "model_version": "1.0.0"}
```

Done. Anyone with Docker installed runs `docker run` and has the API working. Same Python version, same libraries, same model.

### Basic Commands You'll Use All the Time

```bash
docker ps                    # Running containers
docker ps -a                 # All (including stopped)
docker logs ml-api           # View logs
docker logs -f ml-api        # Follow logs in real time
docker exec -it ml-api bash  # Open a shell inside the container
docker stop ml-api           # Stop
docker rm ml-api             # Remove
```

But there's a problem...

---

## Problem 2: Docker Is Copying Junk into the Image

Run the build and notice the first line:

```bash
docker build -t ml-api:v1 .
# [+] Building ... transferring context: 500MB
```

The `COPY . .` copies **everything** from the directory into the image: `.git`, `.venv`, `__pycache__`, training datasets, model checkpoints, `.env` with credentials. Everything.

This causes three problems: slow builds (sending hundreds of MB to the daemon takes time), an image larger than necessary, and — worst of all — **secrets leaking into the image** you publish.

### Solution: `.dockerignore`

It works exactly like `.gitignore`. Create it at the project root:

```
.git
.venv
__pycache__
*.pyc
.pytest_cache
.env
.env.*
*.md
LICENSE
.vscode
.idea
notebooks/
data/raw/
```

Now `docker build` sends only what matters: code, requirements, and the model. Faster builds, a cleaner image, no leaking secrets.

> **Tip**: Always create `.dockerignore` alongside your `Dockerfile`. It's as important as `.gitignore` — and frequently forgotten.

---

## Problem 3: Every Change Rebuilds Everything

You change one line in `main.py`, run `docker build`, and... it reinstalls all dependencies from scratch. The `pip install` takes 2 minutes every time.

### Solution: Understanding Layer Caching

Docker builds images in **layers**. Each Dockerfile instruction creates a layer. If a layer changes, **all layers after it are invalidated**.

Look at our Dockerfile:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Notice the order: first `COPY requirements.txt` and `pip install`, **then** `COPY . .` with the code. This is intentional.

If we did `COPY . .` before `pip install`, any change in `main.py` would invalidate the cache and force reinstallation of all dependencies. With the correct order, changing the code doesn't affect the `pip install` layer — rebuild in seconds.

> **Golden rule**: order instructions from **least changed** to **most changed**.

Test it: change something in `main.py` and run `docker build` again. Notice that the `pip install` layers come from cache (`CACHED`), and only the last layers are rebuilt.

---

## Problem 4: The API Needs a Database

The API works, but now you need to save predictions for auditing and monitoring. You need PostgreSQL. You could install it on your machine, but... remember "it works on my machine"?

### Solution: Docker Compose

Docker Compose lets you define and run **multiple containers** in a single YAML file. Create a `compose.yaml`:

```yaml
name: ml-api

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://app:secret@db:5432/predictions
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: predictions
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d predictions"]
      interval: 5s
      timeout: 3s
      retries: 5
```

```bash
docker compose up -d     # Start everything in the background
docker compose logs -f   # Follow logs
docker compose ps        # Service status
docker compose down      # Stop everything
```

Pay attention to `depends_on` with `condition: service_healthy`. Without it, the API may try to connect before Postgres is ready — one of the most common causes of errors in multi-container setups.

### What Changed in the API

Now the API saves predictions:

```python
# app/main.py (updated version)
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "").replace(
    "postgresql://", "postgresql+asyncpg://"
)
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    X = np.array(request.features).reshape(1, -1)
    prediction = float(model.predict(X)[0])

    async with async_session() as session:
        session.add(PredictionLog(
            features=request.features,
            prediction=prediction,
        ))
        await session.commit()

    return PredictionResponse(prediction=prediction)
```

But there's a problem...

---

## Problem 5: Data Disappears on Restart

```bash
docker compose down
docker compose up -d
# Empty database! All predictions gone.
```

Containers are **ephemeral**. When removed, everything inside them disappears.

### Solution: Volumes

Volumes are Docker's way of persisting data beyond the container lifecycle.

```yaml
services:
  db:
    image: postgres:16-alpine
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: predictions
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d predictions"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  db_data:
```

Now `docker compose down` keeps the data. Only `docker compose down -v` removes volumes (careful!).

### Mount Types

| Type | When to Use | Example |
|------|-------------|---------|
| **Volume** | Production data (database, uploads) | `db_data:/var/lib/postgresql/data` |
| **Bind mount** | Development (hot-reload for code) | `./app:/app` |
| **tmpfs** | Temporary/sensitive data (RAM only) | `tmpfs: [/tmp]` |

For development, use a bind mount for the source code:

```yaml
services:
  api:
    build: .
    volumes:
      - ./app:/app/app    # Source code mounted for hot-reload
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ports:
      - "8000:8000"
```

Now code changes reflect instantly without a rebuild.

---

## Problem 6: The API Can't Find the Database

When you wrote `postgresql://app:secret@db:5432/predictions`, how does the API know what `db` is? It's not a hostname registered in any DNS.

### Solution: Docker Networking

Docker Compose automatically creates an **isolated network** for the services defined in the file. Within that network, each service is reachable **by its name** — automatic DNS resolution.

```
compose.yaml:
  services:
    api:  →  reachable as "api" on the internal network
    db:   →  reachable as "db" on the internal network
```

That's why `@db:5432` works. Docker resolves `db` to the internal IP of the PostgreSQL container.

### When You Need Custom Networks

As you add more services, network separation becomes a security concern:

```yaml
services:
  api:
    networks:
      - frontend
      - backend

  db:
    networks:
      - backend     # Only reachable by the API, not from outside

  redis:
    networks:
      - backend

networks:
  frontend:
  backend:
```

The database is **not** on the `frontend` network — impossible to reach it directly from outside. Only the API, which is on both networks, bridges the gap.

### Port Publishing

Ports inside the Docker network are internal. To access from outside (your machine, the internet), use `ports`:

```yaml
services:
  api:
    ports:
      - "8000:8000"          # Exposed to the host
  db:
    expose:
      - "5432"               # Only inside the Docker network (better for security)
```

> **Security tip**: Bind to localhost when it shouldn't be public: `"127.0.0.1:5432:5432"`.

---

## Problem 7: Repeated Predictions Are Slow

Your model takes 200ms per prediction. Many clients send the same features. It doesn't make sense to reprocess — you need caching.

### Solution: Add Redis to the Stack

```yaml
name: ml-api

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://app:secret@db:5432/predictions
      REDIS_URL: redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - frontend
      - backend

  db:
    image: postgres:16-alpine
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: predictions
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d predictions"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - backend

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    networks:
      - backend

volumes:
  db_data:

networks:
  frontend:
  backend:
```

And in the code:

```python
import hashlib, json, redis.asyncio as redis

redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    cache_key = hashlib.md5(json.dumps(request.features).encode()).hexdigest()

    cached = await redis_client.get(cache_key)
    if cached:
        return PredictionResponse(prediction=float(cached))

    X = np.array(request.features).reshape(1, -1)
    prediction = float(model.predict(X)[0])

    await redis_client.setex(cache_key, 3600, str(prediction))

    async with async_session() as session:
        session.add(PredictionLog(features=request.features, prediction=prediction))
        await session.commit()

    return PredictionResponse(prediction=prediction)
```

Repeated predictions: from 200ms to <1ms. And all with `docker compose up -d`.

Note the `depends_on` conditions:
- `service_healthy` — waits for the healthcheck to pass (for the database, which needs to initialize)
- `service_started` — only waits for the container to start (sufficient for Redis)

---

## Problem 8: "Is It Running as Root?"

You show the setup to the security team. First question:

*"Is the container running as root?"*

```bash
docker exec ml-api whoami
# root
```

Yes. By default, Docker containers run as **root**. If someone exploits a vulnerability in your API, they have root access inside the container — and potentially on the host.

### Solution: Container Hardening

Update the Dockerfile:

```dockerfile
FROM python:3.12-slim
WORKDIR /app

# Create non-root user
RUN groupadd -r appuser && useradd --no-log-init -r -g appuser appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appuser . .

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run as non-root
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### What About the Database Password?

Look at `compose.yaml`: `POSTGRES_PASSWORD: secret` — the password is in plain text in a file that goes to Git.

Use **Docker Secrets** for sensitive data:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: predictions
      POSTGRES_USER: app
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt   # This file does NOT go to Git
```

Add `secrets/` to `.gitignore` and `.dockerignore`.

### Security Checklist

Best practices recommended by OWASP and Docker:

1. **Run as non-root** — never use `--privileged` in production
2. **Pin image versions** — `python:3.12-slim`, not `python:latest`
3. **Use secrets** — never put passwords in `ENV` or in the image
4. **Limit resources** — containers without limits can take down the host
5. **Scan images** — `docker scout cves ml-api:v2`
6. **Read-only filesystem** — `docker run --read-only --tmpfs /tmp`
7. **Drop capabilities** — `docker run --cap-drop ALL --cap-add NET_BIND_SERVICE`
8. **Separate networks** — database never on the same network as the frontend
9. **Bind ports to localhost** — `"127.0.0.1:5432:5432"` when not public
10. **Keep everything updated** — Docker, base images, dependencies

### Resource Limits in Compose

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 1G      # ML models can consume a lot of RAM
          cpus: "2.0"
        reservations:
          memory: 512M
          cpus: "1.0"
```

Without limits, a model with a memory leak can take down all other containers (and the host).

---

## Problem 9: I Need to Share This Image

You built the image, tested it locally, everything works. Now a colleague wants to run the same API — or you need to deploy on a server. How do you share it?

Sending the code and asking someone to run `docker build` works, but they'll need the `model.pkl`, the dependencies, and hope everything goes right. The whole point of Docker is to avoid that.

### Solution: Container Registry

A container registry is like GitHub, but for Docker images. You `push` the image; anyone who wants to run it does `pull`. The model, dependencies, code — **everything goes together inside the image**.

We'll use the **GitHub Container Registry (GHCR)**, which is free for public repositories:

```bash
# 1. Login to GHCR (use a Personal Access Token with write:packages permission)
docker login ghcr.io -u YOUR_USERNAME

# 2. Tag the image with the registry address
docker tag ml-api:v1 ghcr.io/YOUR_USERNAME/ml-api:v1

# 3. Push
docker push ghcr.io/YOUR_USERNAME/ml-api:v1
```

Done. Now anyone (or any server) can run:

```bash
docker pull ghcr.io/YOUR_USERNAME/ml-api:v1
docker run -d -p 8000:8000 ghcr.io/YOUR_USERNAME/ml-api:v1
```

No installing Python, no installing dependencies, no separate `model.pkl` needed. Everything is inside the image.

> **Docker Hub vs GHCR**: Docker Hub is the most popular registry (where `python:3.12-slim`, `postgres:16-alpine` live). GHCR is convenient if your code is already on GitHub — permissions follow the repository. Both are free for public images.

### What About Corporate Environments?

GHCR and Docker Hub are great for open-source projects, but if your model is proprietary, you need a private registry. Major clouds offer integrated registries:

| Cloud | Registry | Login |
|-------|----------|-------|
| **AWS** | Amazon ECR | `aws ecr get-login-password \| docker login` |
| **GCP** | Artifact Registry | `gcloud auth configure-docker` |

Private by default, with access control via IAM — the same permissions your team already uses in the cloud.

In practice, nobody does `git clone` + `docker build` on the production server. The real flow is: dev pushes code → CI/CD builds the image and pushes to the registry → production server does `docker pull` and runs. The registry is the middle ground between code and deployment.

### Versioning with Tags

Tags are like versions of your image:

```bash
docker tag ml-api:v1 ghcr.io/YOUR_USERNAME/ml-api:v1
docker tag ml-api:v1 ghcr.io/YOUR_USERNAME/ml-api:latest
docker push ghcr.io/YOUR_USERNAME/ml-api:v1
docker push ghcr.io/YOUR_USERNAME/ml-api:latest
```

This is especially useful for ML models: retrained the model? Build a new image with `v2`, push it. The old model stays available at `v1` if you need to roll back.

---

## Problem 10: I Need to Automate Deployment

Doing `docker build` and `docker push` manually works, but it's error-prone. Forgot to build? Published the wrong image? In production, you want this to be automatic.

### Production Dockerfile

Before automating, let's put together the final Dockerfile — applying everything we've learned:

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app

RUN groupadd -r appuser && useradd --no-log-init -r -g appuser appuser

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appuser . .

# Training the model inside the container ensures version compatibility
RUN python train_model.py

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

Highlights:
- **`RUN python train_model.py`** — training inside the container eliminates version incompatibilities (e.g., trained with scikit-learn 1.8 on Mac, container has 1.5 → error)
- **`--mount=type=cache`** — pip cache persists across builds (BuildKit)
- **`PYTHONUNBUFFERED=1`** — logs appear immediately, no buffering
- **`--workers 4`** — multiple workers for production (Uvicorn with workers requires `uvicorn[standard]`)
- **Non-root user**, health check, slim image

> **What about models that take hours to train?** The `RUN python train_model.py` works for small models like ours. For large models, the MLOps pattern is to use a **model registry** (MLflow, Weights & Biases, or simply S3/GCS). CI/CD downloads the trained model during the build: `RUN aws s3 cp s3://my-bucket/models/model-v2.pkl models/model.pkl`. Training happens in another pipeline (with GPU), and the Dockerfile only packages the result.

### CI/CD with GitHub Actions

Automate build and push on every commit to main:

```yaml
name: Build and Push
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

Every push to main: automatic build, smart caching, image versioned by commit SHA.

### Production compose.yaml

In production, instead of `build: .`, use the image from the registry:

```yaml
name: ml-api-prod

services:
  api:
    image: ghcr.io/your-username/ml-api:latest
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://app@db:5432/predictions
      REDIS_URL: redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "2.0"
    networks:
      - frontend
      - backend

  db:
    image: postgres:16-alpine
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: predictions
      POSTGRES_USER: app
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d predictions"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
    networks:
      - backend

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"
    networks:
      - backend

volumes:
  db_data:
  redis_data:

networks:
  frontend:
  backend:

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

---

## Problem 11: Something Went Wrong in Production

The API returns 500. The container is running, but predictions fail. How do you investigate?

### Solution: Debugging and Troubleshooting

**First stop — logs:**

```bash
docker compose logs api              # API logs
docker compose logs -f api           # Follow in real time
docker compose logs --tail 50 api    # Last 50 lines
```

**Need a shell inside the container:**

```bash
docker compose exec api bash
# or, if the image doesn't have bash:
docker compose exec api sh
```

**Container has no shell?** (minimal images):

```bash
docker debug ml-api
# Opens a shell with debug tools, without modifying the container
```

**Container crashes immediately:**

```bash
# Run interactively to see the error
docker run -it --rm ml-api:v2 bash

# Inside the container, try running manually:
python -c "from app.main import app; print('OK')"
```

**Check resource usage:**

```bash
docker stats                         # CPU, memory, network in real time
docker system df                     # Total disk usage
```

### Common Problems and Solutions

**Port already in use:**
```bash
lsof -i :8000                       # Who's using it?
docker ps                            # Another container on the same port?
```

**Out of disk space:**
```bash
docker system df                     # Diagnosis
docker system prune -a               # Clean everything unused
docker volume prune                  # Clean orphaned volumes
docker builder prune                 # Clean build cache
```

**Permission denied on file:**
```bash
# Check ownership inside the container
docker exec ml-api ls -la /app/models/

# Fix: ensure COPY uses --chown
# COPY --chown=appuser:appuser . .
```

**Build ignores changes (stale cache):**
```bash
docker build --no-cache .            # Force full rebuild
docker compose build --no-cache      # Same effect with Compose
```

---

## Problem 12: I Need This Running in the Cloud

The image is in the registry, CI/CD works, but the API still runs on your machine. To serve real users, it needs to be in the cloud.

Let's look at the two simplest options — no Kubernetes, no unnecessary complexity.

### Option 1: Google Cloud Run

Cloud Run is the simplest way to deploy a container. Serverless: scales automatically (including to zero — you don't pay when nobody is using it).

```bash
# 1. Authenticate and configure
gcloud auth login
gcloud config set project YOUR_PROJECT

# 2. Build and push to Artifact Registry (or use the GHCR image)
gcloud builds submit --tag gcr.io/YOUR_PROJECT/ml-api:v1

# 3. Deploy
gcloud run deploy ml-api \
  --image gcr.io/YOUR_PROJECT/ml-api:v1 \
  --port 8000 \
  --region us-central1 \
  --allow-unauthenticated
```

Done. In ~2 minutes you get a public URL. Test:

```bash
curl https://ml-api-xxxxx-uc.a.run.app/health
# {"status": "healthy"}
```

For environment variables and secrets:

```bash
gcloud run deploy ml-api \
  --image gcr.io/YOUR_PROJECT/ml-api:v1 \
  --port 8000 \
  --region us-central1 \
  --set-env-vars="PYTHONUNBUFFERED=1" \
  --set-secrets="DATABASE_URL=db-url:latest"
```

### Option 2: AWS App Runner

App Runner is the AWS equivalent — as simple as Cloud Run.

```bash
# 1. Push the image to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker tag ml-api:v1 123456789.dkr.ecr.us-east-1.amazonaws.com/ml-api:v1
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/ml-api:v1

# 2. Create the service via CLI
aws apprunner create-service \
  --service-name ml-api \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "123456789.dkr.ecr.us-east-1.amazonaws.com/ml-api:v1",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {"Port": "8000"}
    },
    "AutoDeploymentsEnabled": true
  }'
```

App Runner also scales automatically and supports auto-deploy when the image is updated in ECR.

> **How much does it cost?** Both charge by usage (CPU + memory while the API is processing requests). For ML APIs with irregular traffic, Cloud Run's "scale to zero" is unbeatable — you literally pay nothing when there's no traffic. App Runner keeps at least one instance active by default, but can be configured to scale to zero as well.

> **What about Kubernetes?** EKS (AWS) and GKE (GCP) are options when you need complex orchestration — multiple services, sophisticated auto-scaling, GPU scheduling. But for an ML API serving predictions, Cloud Run or App Runner solve it with a fraction of the complexity and operational cost.

---

## Bonus: Daily Workflow with Docker

### Do I Need to Develop Inside Docker?

Not necessarily. In practice, most teams use a mix:

- **Code runs locally** — faster, native hot-reload, IDE debugger works directly. For fast iteration, nothing beats running in your terminal.
- **Dependencies run in Docker** — Postgres, Redis, queues. The `compose.yaml` starts these services while your API runs locally pointing to `localhost:5432`.
- **Docker for final validation** — before committing, `docker compose up` to test everything together in the same environment as production.

Developing 100% inside Docker works, but it's slower and the developer experience is worse. Developing 100% locally is fast, but it's the path to "it works on my machine." The middle ground is the industry standard.

### Day to Day

After setting everything up, day-to-day is simple:

```bash
# Morning: start the environment
docker compose up -d

# Develop normally (bind mount enables hot-reload)
# Change code → API reloads automatically

# Check logs when something looks wrong
docker compose logs -f api

# Run tests inside the container (same environment as production)
docker compose exec api pytest

# End of day: shut down (data persists in the volume)
docker compose down

# Update dependencies
docker compose build
docker compose up -d
```

### Commands You'll Memorize

```bash
# Compose (90% of your usage)
docker compose up -d               # Start
docker compose down                # Stop
docker compose logs -f             # Logs
docker compose exec api bash       # Shell in service
docker compose build               # Rebuild
docker compose ps                  # Status

# Images
docker build -t name:tag .         # Build
docker image ls                    # List
docker image prune                 # Clean unused

# Standalone containers
docker run -d --name x -p 80:80 img   # Run
docker stop x && docker rm x          # Stop and remove
docker run -it --rm img bash           # Disposable shell

# Maintenance
docker system df                   # Disk usage
docker system prune -a             # General cleanup
```

---

## Docker Under the Hood

You're already using Docker productively. Now it's worth understanding what happens underneath — this helps diagnose problems and make better decisions.

### Architecture

Docker uses a **client-server architecture**:

```
┌──────────────────────────────────────────┐
│         Docker Client (docker CLI)       │
│   Sends commands via REST API            │
└─────────────────┬────────────────────────┘
                  │
┌─────────────────▼────────────────────────┐
│         Docker Daemon (dockerd)          │
│   Manages images, containers,            │
│   networks and volumes                   │
└─────────────────┬────────────────────────┘
                  │
┌─────────────────▼────────────────────────┐
│         containerd → runc                │
│   Runtime that creates/runs containers   │
│   using Linux namespaces and cgroups     │
└──────────────────────────────────────────┘
```

- **Docker Client**: the CLI you use (`docker build`, `docker run`)
- **Docker Daemon**: the server that does the heavy lifting
- **containerd**: manages container lifecycle (donated to CNCF)
- **runc**: creates and runs containers at the lowest level (donated to OCI)

### Underlying Linux Technologies

Docker isn't magic — it's engineering on top of Linux kernel features:

**Namespaces** isolate resources: each container has its own view of processes (`pid`), network (`net`), filesystem (`mnt`), hostname (`uts`), and users (`user`).

**Control Groups (cgroups)** limit resources: CPU, memory, disk I/O. This is what makes `deploy.resources.limits` work in Compose.

**Union Filesystems** enable the layered image architecture — copy-on-write for efficiency.

### Docker vs VMs

A common question:

| Aspect | Containers | VMs |
|--------|-----------|-----|
| **Virtualizes** | Operating system | Hardware |
| **Size** | Tens of MB | Tens of GB |
| **Boot** | Seconds | Minutes |
| **Isolation** | Process (namespaces) | Hardware (hypervisor) |
| **Performance** | Near-native | Hypervisor overhead |

In practice, most companies use both: containers running inside VMs in the cloud.

---

## Docker Desktop vs Alternatives

Docker Desktop is the official GUI, but since 2021 it requires a paid license for large companies (+250 employees or +$10M revenue). Free alternatives:

| Tool | Highlights | Installation |
|------|------------|--------------|
| **Podman** | Daemonless, rootless by default, compatible CLI | `brew install podman` |
| **Colima** | Simpler for Mac, CLI only | `brew install colima && colima start` |
| **Rancher Desktop** | GUI, Kubernetes built-in | Download from site |

**Podman** stands out for those who want security: no daemon running as root, and `alias docker=podman` works for almost everything.

---

## New Docker Features

Three recent tools worth knowing:

**Docker Init** — generates Dockerfile, compose.yaml, and .dockerignore with best practices for your language:

```bash
docker init
# Detects Python, asks version, port, command — generates everything
```

**Docker Scout** — scans vulnerabilities in your images:

```bash
docker scout cves ml-api:v2
docker scout recommendations ml-api:v2
```

**Docker Debug** — shell in any container, even those without a shell:

```bash
docker debug ml-api
# Full toolbox: vim, curl, htop — without modifying the container
```

---

## Recapping the Journey

We started with a FastAPI API that only worked locally. Throughout the guide, each problem led to a Docker concept:

| Problem | Docker Concept | Solution |
|---------|----------------|----------|
| "It works on my machine" | **Dockerfile** | Package everything in an image |
| Docker copying junk and secrets | **`.dockerignore`** | Filter what goes into the image |
| Slow rebuild on every change | **Layer caching** | Order instructions strategically |
| I need PostgreSQL | **Docker Compose** | Define multiple services in YAML |
| Data disappears on restart | **Volumes** | Persist data outside the container |
| API can't find the database | **Networking** | Automatic DNS between services |
| Slow predictions for repeated data | **Additional services** | Redis as cache in the stack |
| Running as root | **Security** | USER, secrets, resource limits |
| I need to share the image | **Container registry** | docker push/pull via GHCR |
| I need to automate deployment | **CI/CD** | GitHub Actions + production compose |
| Error in production | **Debugging** | Logs, exec, docker debug |
| I need to run in the cloud | **Cloud deploy** | Cloud Run, App Runner |

Each concept solved a concrete problem. There's no reason to memorize Docker commands without context — now you know **why** each one exists.

The ecosystem keeps evolving: Docker Scout, Docker Debug, Docker Init, and Hardened Images show that the platform is more mature than ever. But the fundamentals — images, containers, volumes, networks, security — have been the same since 2013. Master those, and you'll be ready for whatever comes next.
