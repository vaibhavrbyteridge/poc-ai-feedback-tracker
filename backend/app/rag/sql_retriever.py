from app.rag.protocols import Chunk


class SQLRetriever:
    """Stub for future Postgres-backed RAG. Not wired in v1."""

    async def retrieve(
        self, customer_id: str, query: str, top_k: int = 5
    ) -> list[Chunk]:
        raise NotImplementedError(
            "SQLRetriever is not implemented yet. Use MockRetriever."
        )
