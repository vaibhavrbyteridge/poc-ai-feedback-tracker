import struct

from app.providers.protocols import VoiceConfig


class MockUtteranceTTS:
    async def synthesize(self, text: str, voice_config: VoiceConfig) -> bytes:
        _ = (text, voice_config)
        # Minimal valid WAV: 0.3s silence at 16kHz mono 16-bit
        sample_rate = 16000
        duration_sec = 0.3
        num_samples = int(sample_rate * duration_sec)
        data_size = num_samples * 2
        header = struct.pack(
            "<4sI4s4sIHHIIHH4sI",
            b"RIFF",
            36 + data_size,
            b"WAVE",
            b"fmt ",
            16,
            1,
            1,
            sample_rate,
            sample_rate * 2,
            2,
            16,
            b"data",
            data_size,
        )
        return header + (b"\x00\x00" * num_samples)
