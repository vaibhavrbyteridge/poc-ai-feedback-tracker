from app.config import get_settings
from app.providers.mock_llm import MockLLM
from app.providers.mock_stt import MockUtteranceSTT
from app.providers.mock_tts import MockUtteranceTTS
from app.providers.protocols import CopilotLLM, CustomerLLM, UtteranceSTT, UtteranceTTS


def get_stt() -> UtteranceSTT:
    settings = get_settings()
    if settings.force_mock_stt or not settings.assemblyai_api_key:
        return MockUtteranceSTT()
    from app.providers.assemblyai_stt import AssemblyAIUtteranceSTT

    return AssemblyAIUtteranceSTT()


def get_llm() -> MockLLM:
    settings = get_settings()
    if settings.force_mock_llm or not settings.groq_api_key:
        return MockLLM()
    from app.providers.groq_llm import GroqLLM

    return GroqLLM()


def get_customer_llm() -> CustomerLLM:
    return get_llm()


def get_copilot_llm() -> CopilotLLM:
    return get_llm()


def get_tts() -> UtteranceTTS:
    settings = get_settings()
    if settings.force_mock_tts:
        return MockUtteranceTTS()
    from app.providers.edge_tts import EdgeUtteranceTTS

    return EdgeUtteranceTTS()
