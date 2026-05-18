from dataclasses import dataclass
from typing import Protocol


@dataclass
class Chunk:
    text: str
    source: str = ""


class Retriever(Protocol):
    async def retrieve(
        self, customer_id: str, query: str, top_k: int = 5
    ) -> list[Chunk]: ...
