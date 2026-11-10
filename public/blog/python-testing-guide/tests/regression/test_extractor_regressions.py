"""Stage 8: a regression objective, checked against the real regex adapter."""

import json
from pathlib import Path
import pytest
from document_testing.infrastructure import RegexExtractor

CASES = json.loads(
    (Path(__file__).resolve().parents[1] / "fixtures" / "golden_cases.json")
    .read_text(encoding="utf-8")
)

@pytest.mark.parametrize("case", CASES, ids=lambda case: case["id"])
def test_extraction_regression(case):
    assert RegexExtractor().payment_days(case["text"]) == case["expected_payment_days"]
