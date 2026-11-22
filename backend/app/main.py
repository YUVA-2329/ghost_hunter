"""SQL Ghost Hunter - FastAPI application entry point.

Run (from the project root):
    python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
or simply:
    python run.py
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import mimetypes
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, OperationalError
from starlette.concurrency import run_in_threadpool

from .ai import detector, ollama_client
from .config import PROJECT_ROOT, get_settings
from .database import DatabaseRuleError, dispose_engine, get_engine, system_connection, translate_db_error
from .routes import auth, core, intelligence
from .services.health import check_system_health

# Some Windows registries map .js to text/plain, which browsers refuse for
# ES modules. Register the correct types explicitly.
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("ghosthunter")
FRONTEND_DIR = PROJECT_ROOT / "frontend"


def _run_analysis_once() -> None:
    try:
        with system_connection() as conn:
            r = detector.run_analysis(conn)
            log.info("anomaly analysis: %s findings, %s new alerts", r["findings"], r["new_alerts"])
    except Exception:
        log.exception("background anomaly analysis failed")


async def _analysis_loop(minutes: int) -> None:
    while True:
        await run_in_threadpool(_run_analysis_once)
        await asyncio.sleep(minutes * 60)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    (Path(s.storage_dir) / "evidence").mkdir(parents=True, exist_ok=True)
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        log.info("connected to MySQL %s:%s/%s as %s", s.db_host, s.db_port, s.db_name, s.db_app_user)
    except Exception as exc:
        log.error("DATABASE NOT REACHABLE: %s - check .env and that MySQL is running", exc)
    log.info("AI status: %s", ollama_client.status(force=True)["mode"])
    task = None
    if s.auto_analysis_minutes > 0:
        task = asyncio.create_task(_analysis_loop(s.auto_analysis_minutes))
    yield
    if task:
        task.cancel()
    dispose_engine()


app = FastAPI(title="SQL Ghost Hunter API", version="1.0.0",
              description="AI-powered database forensics & integrity monitoring. Every Database Change Leaves a Trace.",
              lifespan=lifespan, docs_url="/api-docs", redoc_url=None, openapi_url="/api/openapi.json")

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
       "font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; "
       "form-action 'self'")


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    # CSRF defence: state-changing API calls must carry a custom header that a
    # cross-site form cannot set (cookies are also SameSite=Strict).
    if request.method in UNSAFE_METHODS and request.url.path.startswith("/api/") \
            and request.headers.get("x-requested-with") != "GhostHunter":
        return JSONResponse({"detail": "Missing X-Requested-With header"}, status_code=403)
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("X-Frame-Options", "DENY")
    if not request.url.path.startswith("/api-docs"):
        response.headers.setdefault("Content-Security-Policy", CSP)
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.exception_handler(DatabaseRuleError)
async def rule_error(_: Request, exc: DatabaseRuleError):
    return JSONResponse({"detail": exc.message, "source": "database-rule", "mysql_errno": exc.mysql_errno},
                        status_code=exc.status_code)


@app.exception_handler(DBAPIError)
async def db_error(_: Request, exc: DBAPIError):
    translated = translate_db_error(exc)
    if isinstance(translated, DatabaseRuleError):
        return await rule_error(_, translated)
    log.error("database error: %s", exc)
    msg = "Database unavailable - is MySQL running?" if isinstance(exc, OperationalError) else "Database error"
    return JSONResponse({"detail": msg}, status_code=503 if isinstance(exc, OperationalError) else 500)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    errors = [{"field": ".".join(str(p) for p in e.get("loc", [])[1:]), "message": e.get("msg")} for e in exc.errors()]
    first = errors[0] if errors else {"field": "", "message": "invalid input"}
    return JSONResponse({"detail": f"Invalid input - {first['field']}: {first['message']}", "errors": errors},
                        status_code=422)


@app.get("/api/health")
def health():
    return check_system_health()


app.include_router(auth.router)
app.include_router(core.router)
app.include_router(intelligence.router)


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def api_not_found(path: str):
    raise HTTPException(404, "Unknown API endpoint")


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
