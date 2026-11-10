"""Stage 8: Hypothesis is a technique for unit-level property tests."""

import pytest
from hypothesis import given, strategies as st
from document_testing.domain import normalize_name

@given(st.text())
def test_normalization_is_idempotent(raw):
    if not raw.split():
        with pytest.raises(ValueError):
            normalize_name(raw)
    else:
        normalized = normalize_name(raw)
        assert normalize_name(normalized) == normalized
