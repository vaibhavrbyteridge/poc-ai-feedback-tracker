from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    assemblyai_api_key: str = ""
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    # Reasoning effort for gpt-oss models: none | default | low | medium | high.
    # Low keeps latency down for real-time turns; scoring overrides to a higher value.
    groq_reasoning_effort: str = "low"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/debt_sim"
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = "test"
    mysql_database: str = "performance_coaching"
    cors_origins: str = "http://localhost:5173"
    force_mock_stt: bool = False
    force_mock_llm: bool = False
    force_mock_tts: bool = False
    use_dummy_data: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
