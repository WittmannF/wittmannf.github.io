"""Stage 7: opt-in black-box HTTP E2E. Set TEST_BASE_URL to run it."""

import json
import os
from urllib.request import Request, urlopen
from uuid import uuid4
import pytest

pytestmark = pytest.mark.e2e

def test_live_create_and_read():
    base_url = os.getenv("TEST_BASE_URL")
    if not base_url:
        pytest.skip("Set TEST_BASE_URL for a deployed/running API")

    doc_id = f"e2e-{uuid4().hex}"
    payload = json.dumps({
        "document_id": doc_id, "raw_name": "  Ana   Silva  ",
        "text": "Payment Terms: 30 days",
    }).encode("utf-8")
    request = Request(
        f"{base_url.rstrip('/')}/documents/process",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=5) as response:
        assert response.status == 201
        created = json.load(response)

    with urlopen(f"{base_url.rstrip('/')}/documents/{doc_id}", timeout=5) as response:
        retrieved = json.load(response)
    assert created == retrieved
    assert retrieved["borrower_name"] == "Ana Silva"
    assert retrieved["payment_days"] == 30
