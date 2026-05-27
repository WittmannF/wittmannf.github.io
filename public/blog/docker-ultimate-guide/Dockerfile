# syntax=docker/dockerfile:1

# ─── Build ────────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install --no-cache-dir -r requirements.txt

# ─── Production ───────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

RUN groupadd -r appuser && useradd --no-log-init -r -g appuser appuser

COPY --from=builder /install /usr/local
COPY --chown=appuser:appuser . .

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
