"""Minimal client for a local Ollama server (open-weight models).

The LLM is OPTIONAL. If Ollama is not running, or the configured model is
not installed, ``status()`` reports it and every caller falls back to
deterministic, rule-based text. The LLM never receives database credentials
and never produces SQL - it only rewrites facts that the backend retrieved.
"""
from __future__ import annotations

import logging
import threading
import time

import httpx

from ..config import get_settings

log = logging.getLogger("ghosthunter.ollama")
_cache: dict = {"at": 0.0, "value": None}
_lock = threading.Lock()


class LLMUnavailable(RuntimeError):
    pass


def _model_matches(configured: str, installed: list[str]) -> bool:
    want = configured if ":" in configured else configured + ":latest"
    return any(m == configured or m == want for m in installed)


def status(force: bool = False) -> dict:
    s = get_settings()
    with _lock:
        if not force and _cache["value"] and time.time() - _cache["at"] < 20:
            return _cache["value"]
    value = {"enabled": s.ai_enabled, "url": s.ollama_url, "model": s.ollama_model,
             "server_reachable": False, "model_installed": False, "available": False,
             "installed_models": [], "mode": "OFFLINE (rule-based fallback)"}
    if s.ai_enabled:
        try:
            r = httpx.get(f"{s.ollama_url.rstrip('/')}/api/tags", timeout=0.6)
            r.raise_for_status()
            models = [m.get("name", "") for m in r.json().get("models", [])]
            value.update(server_reachable=True, installed_models=models,
                         model_installed=_model_matches(s.ollama_model, models))
            value["available"] = value["model_installed"]
            if value["available"]:
                value["mode"] = f"ONLINE (local LLM: {s.ollama_model})"
            else:
                value["mode"] = f"OFFLINE (model {s.ollama_model} not installed - run: ollama pull {s.ollama_model})"
        except Exception as exc:   # connection refused, timeout, bad JSON ...
            value["error"] = type(exc).__name__
    else:
        value["mode"] = "DISABLED in configuration (rule-based fallback)"
    with _lock:
        _cache.update(at=time.time(), value=value)
    return value


def chat(system: str, user: str, *, temperature: float = 0.1, json_mode: bool = False) -> str:
    st = status()
    if not st["available"]:
        raise LLMUnavailable(st["mode"])
    s = get_settings()
    payload = {
        "model": s.ollama_model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "stream": False,
        "options": {"temperature": temperature, "num_ctx": 8192},
    }
    if json_mode:
        payload["format"] = "json"
    try:
        r = httpx.post(f"{s.ollama_url.rstrip('/')}/api/chat", json=payload, timeout=s.ollama_timeout_seconds)
        r.raise_for_status()
        return (r.json().get("message") or {}).get("content", "").strip()
    except Exception as exc:
        log.warning("Ollama request failed: %s", exc)
        with _lock:
            _cache["at"] = 0.0            # re-check status next time
        raise LLMUnavailable(f"LLM request failed ({type(exc).__name__})") from exc
