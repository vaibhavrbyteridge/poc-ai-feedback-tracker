from app.domain.models import Message
from app.providers.factory import get_copilot_llm


async def collector_suggestions(
    messages: list[Message],
    collector_utterance: str,
    customer_utterance: str,
    rag_context: str | None,
    company_name: str,
) -> list[str]:
    llm = get_copilot_llm()
    return await llm.collector_suggestions(
        messages,
        collector_utterance,
        customer_utterance,
        rag_context,
        company_name,
    )
