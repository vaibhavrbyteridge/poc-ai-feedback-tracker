import json

from app.paths import data_dir
from app.rag.protocols import Chunk

DATA_PATH = data_dir() / "seed_customers.json"


class MockRetriever:
    def __init__(self) -> None:
        with open(DATA_PATH, encoding="utf-8") as f:
            self._customers = json.load(f)

    async def retrieve(
        self, customer_id: str, query: str, top_k: int = 5
    ) -> list[Chunk]:
        customer = self._customers.get(customer_id)
        if not customer:
            return [Chunk(text=f"No records found for customer {customer_id}.")]

        text = (
            f"Customer: {customer['name']}\n"
            f"Balance: ${customer['balance']:,.2f}\n"
            f"Due date: {customer['due_date']}\n"
            f"Status: {customer['status']}\n"
            f"Last contact: {customer['last_contact']}\n"
            f"Notes: {customer['hardship_notes']}"
        )
        return [Chunk(text=text, source="seed_customers.json")]
