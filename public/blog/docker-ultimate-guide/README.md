# Docker Ultimate Guide — Example Project

Example FastAPI + ML API used in the blog post [Docker: O Guia Definitivo — Do Zero à Produção](https://fernandowittmann.com/pt/blog/docker-ultimate-guide-pt).

## Quick Start

```bash
uv venv .venv && source .venv/bin/activate
uv pip install -r requirements.txt
python train_model.py
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Test

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"features": [1.5, 2.3, 0.8, 4.1]}'
```

## Project Structure

```
├── app/
│   └── main.py           # FastAPI application
├── models/               # Generated model goes here
├── train_model.py        # Trains and saves model.pkl
├── requirements.txt      # Python dependencies
└── Dockerfile            # Production Dockerfile from the tutorial
```
