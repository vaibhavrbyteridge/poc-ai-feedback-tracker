from pydantic import BaseModel, Field
from typing import Literal


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class Turn(BaseModel):
    collector_transcript: str
    customer_text: str
    suggestions: list[dict] = Field(default_factory=list)
    classification: str = ""
    confidence: float = 0.0
    reasoning: str = ""


class SessionCreate(BaseModel):
    customer_id: str
    personality_id: str
    company_name: str = "Acme Collections"


class SessionResponse(BaseModel):
    session_id: str
    customer_id: str
    customer_name: str
    personality_id: str
    company_name: str


class Session(BaseModel):
    session_id: str
    customer_id: str
    customer_name: str
    personality_id: str
    company_name: str
    messages: list[Message] = Field(default_factory=list)
    turns: list[Turn] = Field(default_factory=list)
