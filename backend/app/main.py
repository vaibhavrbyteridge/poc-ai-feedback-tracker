from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import sessions, ws, auth
from app.config import get_settings

app = FastAPI(title="Debt Collection Conversation Simulator")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(ws.router)
app.include_router(auth.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
