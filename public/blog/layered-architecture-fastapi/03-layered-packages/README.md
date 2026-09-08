# 03 - Layered Packages

The layered files become packages:

- `api/routers/` contains FastAPI endpoints.
- `api/deps.py` wires dependencies with `Depends()`.
- `schemas/` contains API contracts.
- `services/` contains use cases.
- `repositories/` contains internal data access.
- `clients/` contains external service clients.
- `core/` contains shared configuration.
