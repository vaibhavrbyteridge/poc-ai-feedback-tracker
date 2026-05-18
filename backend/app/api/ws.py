import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.domain.session_store import session_store
from app.services.orchestrator import orchestrator

router = APIRouter()


@router.websocket("/ws/{session_id}")
async def websocket_session(websocket: WebSocket, session_id: str):
    await websocket.accept()

    if not session_store.get(session_id):
        await websocket.send_json(
            {"type": "error", "message": f"Session not found: {session_id}"}
        )
        await websocket.close()
        return

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "message": "Invalid JSON message"}
                )
                continue

            msg_type = msg.get("type")

            if msg_type == "collector_utterance":
                audio_b64 = msg.get("audio_base64", "")
                mime = msg.get("mime", "audio/webm")

                if not audio_b64:
                    await websocket.send_json(
                        {"type": "error", "message": "Missing audio_base64"}
                    )
                    continue

                import base64

                audio_bytes = base64.b64decode(audio_b64)

                await websocket.send_json({"type": "turn_processing"})

                try:
                    result = await orchestrator.process_turn(
                        session_id, audio_bytes, mime
                    )
                    await websocket.send_json(
                        {"type": "turn_complete", **result}
                    )
                except Exception as e:
                    await websocket.send_json(
                        {"type": "error", "message": str(e)}
                    )
            else:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": f"Unknown message type: {msg_type}",
                    }
                )

    except WebSocketDisconnect:
        pass
