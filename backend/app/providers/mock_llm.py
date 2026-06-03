import json
import re

from app.domain.models import Message


class MockLLM:
    """Single class implementing both CustomerLLM and CopilotLLM for mock mode."""

    async def customer_response(
        self,
        messages: list[Message],
        system_prompt: str,
        rag_context: str | None,
    ) -> str:
        last_user = next(
            (m.content for m in reversed(messages) if m.role == "user"), ""
        )
        lower = last_user.lower()
        if "payment" in lower or "pay" in lower:
            return "Look, I told you people before — I can't commit to anything until I see something in writing."
        if "verify" in lower or "birth" in lower:
            return "Why do you need that? You called me. I'm not giving personal info over the phone."
        if "plan" in lower or "arrangement" in lower:
            return "Maybe fifty a month, but only if you stop the late fees. That's all I can do right now."
        if "defensive" in system_prompt.lower() or "skeptical" in system_prompt.lower():
            return "Who is this again? I get these calls all the time. Prove you're legitimate."
        return "I hear what you're saying, but I need time to figure things out. Call me back next week."

    async def collector_suggestions(
        self,
        messages: list[Message],
        collector_utterance: str,
        customer_utterance: str,
        rag_context: str | None,
        company_name: str,
        corrections: list[dict] | None = None,
    ) -> dict:
        balance_hint = ""
        if rag_context and "balance" in rag_context.lower():
            m = re.search(r"balance[:\s]+\$?([\d,.]+)", rag_context, re.I)
            if m:
                balance_hint = f" referencing the ${m.group(1)} balance"

        return {
            "classification": "financial_hardship",
            "confidence": 0.75,
            "reasoning": "Customer indicates difficulty paying due to financial constraints.",
            "suggestions": [
                {"text": f"I understand this is stressful. Let's find a payment arrangement{balance_hint} that works for your budget.", "tone": "empathetic"},
                {"text": "I can email verification of the debt to you today — would that help us move forward?", "tone": "neutral"},
                {"text": "If we set up a plan now, I can request a pause on additional fees while you catch up.", "tone": "firm"},
            ],
            "current_phase": "probe",
            "phases_completed": ["intro"],
            "next_step": "Assess the customer's financial situation and ability to pay.",
            "alerts": [],
            "compliance_disclosed": True,
            "identity_verified": True,
        }
