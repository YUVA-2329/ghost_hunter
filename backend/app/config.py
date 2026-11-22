"""Application configuration loaded from environment variables / .env.

No secret is hard-coded: database passwords come from the .env file in the
project root (copy .env.example to .env and edit it).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(PROJECT_ROOT / ".env"), env_file_encoding="utf-8",
                                      extra="ignore")

    app_name: str = "SQL Ghost Hunter"
    app_host: str = "127.0.0.1"
    app_port: int = 8000

    # Database - the application connects with the least-privilege account
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_name: str = "ghost_hunter"
    db_app_user: str = "ghost_app"
    db_app_password: str = Field(default="", repr=False)
    # Administrative account - used ONLY by setup/maintenance scripts
    db_admin_user: str = "root"
    db_admin_password: str = Field(default="", repr=False)

    # Sessions
    session_hours: int = 8
    cookie_secure: bool = False          # set true when served over HTTPS
    login_max_failures: int = 5
    login_lockout_minutes: int = 15

    # Evidence storage
    storage_dir: Path = PROJECT_ROOT / "storage"
    sample_evidence_dir: Path = PROJECT_ROOT / "sample_evidence"
    max_upload_mb: int = 20

    # AI (local Ollama - optional)
    ai_enabled: bool = True
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_timeout_seconds: float = 60.0

    # Anomaly detection
    analysis_lookback_days: int = 30
    auto_analysis_minutes: int = 10      # 0 disables the background run

    @property
    def evidence_dir(self) -> Path:
        return Path(self.storage_dir) / "evidence"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
