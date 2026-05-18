import hashlib

COLLECTOR_PHRASES = [
    "Hello, I'm calling regarding your outstanding balance on account ending in 4421.",
    "We haven't received payment since your promise on April tenth. Can we set up a plan today?",
    "I understand times are tough — what amount can you commit to this week?",
    "This account is ninety days past due. We need to resolve this before further action.",
    "Can you verify your date of birth so I can pull up the account details?",
]


class MockUtteranceSTT:
    async def transcribe_utterance(self, audio: bytes, mime_type: str) -> str:
        idx = int(hashlib.md5(audio).hexdigest(), 16) % len(COLLECTOR_PHRASES)
        return COLLECTOR_PHRASES[idx]
