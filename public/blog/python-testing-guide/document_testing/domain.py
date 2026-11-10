"""Pure business rules: no HTTP, SQL, or external-provider imports."""

from pydantic import BaseModel, Field


class DocumentInput(BaseModel):
    document_id: str = Field(min_length=1)
    raw_name: str
    text: str


class DocumentOutput(BaseModel):
    document_id: str
    borrower_name: str
    payment_days: int | None
    review_route: str


def normalize_name(raw: str) -> str:
    cleaned = " ".join(raw.split())
    if not cleaned:
        raise ValueError("borrower_name cannot be blank")
    return cleaned


def route_for_review(payment_days: int | None) -> str:
    """Synthetic example policy, not real credit or contractual guidance."""
    if payment_days is None or not 1 <= payment_days <= 60:
        return "manual_review"
    return "auto_accept"
