"""Adapters for external concerns. SQLite is real; extraction is intentionally simple."""

from contextlib import closing
from pathlib import Path
import re
import sqlite3

from .domain import DocumentOutput


class RegexExtractor:
    def payment_days(self, text: str) -> int | None:
        match = re.search(r"\bpayment terms\s*:\s*(\d+)\s+days?\b", text, flags=re.I)
        return int(match.group(1)) if match else None


class SQLiteDocumentRepository:
    def __init__(self, db_path: str | Path):
        self.db_path = str(db_path)
        with closing(sqlite3.connect(self.db_path)) as conn:
            with conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS documents (
                        document_id TEXT PRIMARY KEY,
                        borrower_name TEXT NOT NULL,
                        payment_days INTEGER,
                        review_route TEXT NOT NULL
                    )
                    """
                )

    def save(self, document: DocumentOutput) -> None:
        with closing(sqlite3.connect(self.db_path)) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO documents (document_id, borrower_name, payment_days, review_route)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(document_id) DO UPDATE SET
                        borrower_name=excluded.borrower_name,
                        payment_days=excluded.payment_days,
                        review_route=excluded.review_route
                    """,
                    (document.document_id, document.borrower_name, document.payment_days, document.review_route),
                )

    def get(self, document_id: str) -> DocumentOutput | None:
        with closing(sqlite3.connect(self.db_path)) as conn:
            row = conn.execute(
                "SELECT document_id, borrower_name, payment_days, review_route "
                "FROM documents WHERE document_id = ?",
                (document_id,),
            ).fetchone()
        return DocumentOutput(
            document_id=row[0], borrower_name=row[1], payment_days=row[2], review_route=row[3]
        ) if row else None
