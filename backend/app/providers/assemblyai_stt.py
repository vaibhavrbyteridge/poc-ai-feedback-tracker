import asyncio

import httpx

from app.config import get_settings

ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2"
# Required by POST /v2/transcript (see TranscriptParams in AssemblyAI OpenAPI).
_DEFAULT_SPEECH_MODELS = ["universal-3-pro", "universal-2"]


def _http_error_detail(resp: httpx.Response) -> str:
    try:
        data = resp.json()
        if isinstance(data, dict):
            err = data.get("error")
            if isinstance(err, str):
                return err
            if isinstance(err, dict) and "error" in err:
                return str(err["error"])
    except Exception:
        pass
    body = (resp.text or "").strip()
    return body[:500] if body else resp.reason_phrase


class AssemblyAIUtteranceSTT:
    def __init__(self) -> None:
        self._api_key = get_settings().assemblyai_api_key.strip()
        self._headers = {"authorization": self._api_key}

    async def transcribe_utterance(self, audio: bytes, mime_type: str) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            upload_resp = await client.post(
                f"{ASSEMBLYAI_BASE}/upload",
                headers=self._headers,
                content=audio,
            )
            if upload_resp.is_error:
                raise RuntimeError(
                    f"AssemblyAI upload failed ({upload_resp.status_code}): "
                    f"{_http_error_detail(upload_resp)}"
                )
            upload_url = upload_resp.json()["upload_url"]

            transcript_resp = await client.post(
                f"{ASSEMBLYAI_BASE}/transcript",
                headers={**self._headers, "content-type": "application/json"},
                json={
                    "audio_url": upload_url,
                    "speech_models": _DEFAULT_SPEECH_MODELS,
                },
            )
            if transcript_resp.is_error:
                raise RuntimeError(
                    f"AssemblyAI transcript submit failed ({transcript_resp.status_code}): "
                    f"{_http_error_detail(transcript_resp)}"
                )
            transcript_id = transcript_resp.json()["id"]

            for _ in range(120):
                poll = await client.get(
                    f"{ASSEMBLYAI_BASE}/transcript/{transcript_id}",
                    headers=self._headers,
                )
                poll.raise_for_status()
                data = poll.json()
                status = data["status"]
                if status == "completed":
                    return data.get("text") or ""
                if status == "error":
                    raise RuntimeError(data.get("error", "Transcription failed"))
                await asyncio.sleep(0.5)

            raise TimeoutError("AssemblyAI transcription timed out")
