from app.domain.models import Message
from app.providers.factory import get_customer_llm


async def customer_response(
    messages: list[Message],
    system_prompt: str,
    rag_context: str | None,
) -> str:
    llm = get_customer_llm()
    return await llm.customer_response(messages, system_prompt, rag_context)
