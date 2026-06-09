# Debt Collection Conversation Simulator

Training simulator: human collector (push-to-talk) ↔ AI customer (personality + RAG) with co-pilot suggestions.

## Stack

- **Backend:** FastAPI, utterance-batch STT/TTS, WebSocket turns 
- **Frontend:** Vite + React + TypeScript
- **STT:** AssemblyAI async (live when `ASSEMBLYAI_API_KEY` set)
- **LLM:** Groq chat completions (live when `GROQ_API_KEY` set)
- **TTS:** Edge TTS (no API key; AssemblyAI has no standalone utterance TTS—only inside [Voice Agent API](https://www.assemblyai.com/docs/voice-agents))
- Mocks when keys missing or `FORCE_MOCK_*` is true

## Quick start

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add keys
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Postgres (future RAG)

```bash
docker compose up -d postgres
```

Schema: `data/schema.sql`
