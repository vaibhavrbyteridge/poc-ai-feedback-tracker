from pathlib import Path


def data_dir() -> Path:
    candidates = [
        Path(__file__).resolve().parent.parent.parent / "data",
        Path("/data"),
    ]
    for path in candidates:
        if (path / "seed_customers.json").exists():
            return path
    return candidates[0]
