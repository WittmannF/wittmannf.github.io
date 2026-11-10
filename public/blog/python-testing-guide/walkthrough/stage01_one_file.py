"""Stage 1 snapshot: before dependencies and layers were needed."""


def normalize_name(raw: str) -> str:
    cleaned = " ".join(raw.split())
    if not cleaned:
        raise ValueError("borrower_name cannot be blank")
    return cleaned


def route_for_review(days: int | None) -> str:
    if days is None or not 1 <= days <= 60:
        return "manual_review"
    return "auto_accept"


def process_document(document_id: str, name: str, days: int | None) -> dict:
    return {
        "document_id": document_id,
        "borrower_name": normalize_name(name),
        "payment_days": days,
        "review_route": route_for_review(days),
    }
