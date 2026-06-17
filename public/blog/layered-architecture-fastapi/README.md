# Layered Architecture FastAPI Examples

These examples mirror the progression from the article:

1. `01-single-file` - everything in one FastAPI file.
2. `02-layered-files` - the same app split into `router.py`, `schemas.py`, `services.py`, and `repositories.py`.
3. `03-layered-packages` - files become top-level packages such as `api/`, `schemas/`, `services/`, `repositories/`, and `clients/`.
4. `04-feature-modules` - the app is grouped by feature while keeping the same layers inside each feature.
5. `05-feature-packages` - one feature grows into internal packages for routers, schemas, services, repositories, and clients.

The code is intentionally small. It is meant to show structure and dependency direction, not production-ready integrations.
