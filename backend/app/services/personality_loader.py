from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader

from app.providers.protocols import VoiceConfig

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
PERSONALITIES_DIR = PROMPTS_DIR / "personalities"


class PersonalityLoader:
    def __init__(self) -> None:
        self._jinja = Environment(
            loader=FileSystemLoader(str(PROMPTS_DIR)),
            autoescape=False,
        )

    def list_personalities(self) -> list[str]:
        return sorted(p.stem for p in PERSONALITIES_DIR.glob("*.yaml"))

    def render(self, personality_id: str) -> tuple[str, VoiceConfig]:
        path = PERSONALITIES_DIR / f"{personality_id}.yaml"
        if not path.exists():
            raise ValueError(f"Unknown personality: {personality_id}")

        with open(path, encoding="utf-8") as f:
            p = yaml.safe_load(f)

        system_prompt = self._jinja.get_template("customer_system.j2").render(p=p)
        voice = VoiceConfig(tts_voice_name=p.get("tts_voice_name", "Charon"))
        return system_prompt, voice


personality_loader = PersonalityLoader()
