from app.rag.mock_retriever import MockRetriever
from app.rag.protocols import Retriever


def get_retriever() -> Retriever:
    return MockRetriever()
