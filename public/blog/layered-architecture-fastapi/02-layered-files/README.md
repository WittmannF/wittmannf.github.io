# 02 - Layered Files

The same app is split by responsibility:

- `schemas.py` defines request and response shapes.
- `repositories.py` hides data retrieval and storage.
- `services.py` coordinates the use cases.
- `router.py` translates HTTP into service calls.
- `main.py` wires everything together.
