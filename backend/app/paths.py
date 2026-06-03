from pathlib import Path


def data_dir() -> Path:
    candidates = [
        Path(__file__).resolve().parent.parent.parent / "data",
        Path("/data"),
    ]
    for path in candidates:
        if (path / "debt_data_sample.json").exists():
            return path
    return candidates[0]
