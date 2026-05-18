# Debt Collection Conversation Simulator

Training simulator: human collector (push-to-talk) ↔ AI customer (personality + RAG) with co-pilot suggestions.

## Stack

- **Backend:** FastAPI, utterance-batch STT/TTS, WebSocket turns
- **Frontend:** Vite + React + TypeScript
- **STT:** AssemblyAI async (live when `ASSEMBLYAI_API_KEY` set)
- **LLM/TTS:** Gemini (live when `GEMINI_API_KEY` set); mocks otherwise

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
