# Debt Collection Conversation Simulator

Training simulator: human collector (push-to-talk) - AI customer (personality + RAG) with co-pilot suggestions.

## Stack

- **Backend:** FastAPI, utterance-batch STT/TTS, WebSocket turns
- **Frontend:** Vite + React + TypeScript
- **Database:** SQLite (standard-library sqlite3, no external server)
- **STT:** AssemblyAI async (live when ASSEMBLYAI_API_KEY set)
- **LLM:** Groq chat completions (live when GROQ_API_KEY set)
- **TTS:** Edge TTS (no API key)
- Mocks when keys missing or FORCE_MOCK_* is true

## Quick start

Backend:

    cd backend
    python -m venv .venv
    pip install -r requirements.txt
    cp .env.example .env   # add keys
    uvicorn app.main:app --reload --port 8000

Frontend:

    cd frontend
    npm install
    npm run dev

Open http://localhost:5173

## Database

The app uses SQLite. The database file and schema are created automatically on
first use at data/app.db (override with SQLITE_PATH in .env). The schema lives
in backend/app/schema.sql and seeds the single demo collector (id = 5). No
manual setup or database server is required.

The legacy MySQL scripts under data/*.sql are retained for reference only and
are no longer used by the application.
