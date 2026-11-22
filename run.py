"""Start SQL Ghost Hunter:  python run.py   (then open http://127.0.0.1:8000)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

import uvicorn  # noqa: E402

from app.config import get_settings  # noqa: E402

if __name__ == "__main__":
    s = get_settings()
    print(f"SQL Ghost Hunter -> http://{s.app_host}:{s.app_port}")
    uvicorn.run("app.main:app", host=s.app_host, port=s.app_port, app_dir=str(Path(__file__).resolve().parent / "backend"))
