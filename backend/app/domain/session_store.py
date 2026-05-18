import uuid
from typing import Optional

from app.domain.models import Session


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def create(self, session: Session) -> Session:
        self._sessions[session.session_id] = session
        return session

    def get(self, session_id: str) -> Optional[Session]:
        return self._sessions.get(session_id)

    def update(self, session: Session) -> Session:
        self._sessions[session.session_id] = session
        return session

    @staticmethod
    def new_id() -> str:
        return str(uuid.uuid4())


session_store = SessionStore()
