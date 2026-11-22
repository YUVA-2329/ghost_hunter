"""MySQL connectivity (SQLAlchemy Core + PyMySQL).

Design notes
* The engine connects with the least-privilege account ``ghost_app``.
* AUTOCOMMIT mode: multi-step operations live in stored procedures, which
  run their own START TRANSACTION / COMMIT / ROLLBACK. Python code that needs
  a transaction uses :func:`transaction`.
* Every query uses bound parameters (``:name``) - user input is never
  concatenated into SQL text.
* :func:`identity` sets ``@app_investigator_id`` / ``@app_client_ip`` on the
  connection so that audit triggers can attribute changes, and always clears
  them before the pooled connection is reused.
"""
from __future__ import annotations

import datetime as dt
import decimal
import json
import logging
from contextlib import contextmanager
from typing import Any, Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.exc import DBAPIError

from .config import get_settings

log = logging.getLogger("ghosthunter.db")
_engine: Engine | None = None

# MySQL error numbers that represent a business/constraint rule violation
RULE_ERRORS = {
    1644: 400,   # SIGNAL from a procedure or trigger
    3819: 400,   # CHECK constraint violated
    1048: 400,   # NOT NULL violated
    1406: 400,   # data too long
    1452: 400,   # FK: parent row missing
    1451: 409,   # FK: row still referenced
    1062: 409,   # duplicate (PRIMARY KEY / UNIQUE)
    1142: 403,   # privilege denied for the application account
    1143: 403,
}


class DatabaseRuleError(Exception):
    """A rule enforced by MySQL rejected the operation (safe to show the user)."""

    def __init__(self, message: str, status_code: int = 400, mysql_errno: int | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.mysql_errno = mysql_errno


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        s = get_settings()
        url = (f"mysql+pymysql://{s.db_app_user}:@{s.db_host}:{s.db_port}/{s.db_name}"
               "?charset=utf8mb4")
        _engine = create_engine(
            url,
            connect_args={"password": s.db_app_password},  # never part of a logged URL
            isolation_level="AUTOCOMMIT",
            pool_pre_ping=True,
            pool_recycle=1800,
            pool_size=10,
            max_overflow=10,
        )
    return _engine


def dispose_engine() -> None:
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None


def translate_db_error(exc: DBAPIError) -> Exception:
    orig = getattr(exc, "orig", None)
    args = getattr(orig, "args", ())
    if args and isinstance(args[0], int) and args[0] in RULE_ERRORS:
        errno, msg = args[0], str(args[1]) if len(args) > 1 else "Database rule violated"
        if errno == 1062:
            msg = "A record with the same unique value already exists"
        elif errno in (1142, 1143):
            msg = "The database refused this operation (insufficient privileges for the application account)"
        return DatabaseRuleError(msg, RULE_ERRORS[errno], errno)
    return exc


def _jsonable(value: Any) -> Any:
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat(sep=" ") if isinstance(value, dt.datetime) else value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8", "replace")
    return value


def row_to_dict(row, json_cols: tuple[str, ...] = ("old_values", "new_values", "supporting_facts", "params")) -> dict:
    d = {k: _jsonable(v) for k, v in row._mapping.items()}
    for c in json_cols:
        if c in d and isinstance(d[c], str):
            try:
                d[c] = json.loads(d[c])
            except ValueError:
                pass
    return d


def fetch_all(conn: Connection, sql: str, params: dict | None = None) -> list[dict]:
    try:
        return [row_to_dict(r) for r in conn.execute(text(sql), params or {})]
    except DBAPIError as exc:
        raise translate_db_error(exc) from exc


def fetch_one(conn: Connection, sql: str, params: dict | None = None) -> dict | None:
    rows = fetch_all(conn, sql, params)
    return rows[0] if rows else None


def fetch_value(conn: Connection, sql: str, params: dict | None = None) -> Any:
    try:
        return conn.execute(text(sql), params or {}).scalar()
    except DBAPIError as exc:
        raise translate_db_error(exc) from exc


def execute(conn: Connection, sql: str, params: dict | None = None) -> int:
    try:
        return conn.execute(text(sql), params or {}).rowcount
    except DBAPIError as exc:
        raise translate_db_error(exc) from exc


def call_procedure(conn: Connection, name: str, params: dict, out: list[str] | None = None) -> dict:
    """CALL a stored procedure with named IN parameters and optional OUT params.

    ``name`` and ``out`` come from code (never from users); values are bound.
    """
    if not name.replace("_", "").isalnum():
        raise ValueError("invalid procedure name")
    out = out or []
    placeholders = [f":{k}" for k in params] + [f"@gh_out_{o}" for o in out]
    try:
        for o in out:
            conn.execute(text(f"SET @gh_out_{o} = NULL"))
        conn.execute(text(f"CALL {name}({', '.join(placeholders)})"), params)
        if not out:
            return {}
        row = conn.execute(text("SELECT " + ", ".join(f"@gh_out_{o} AS {o}" for o in out))).one()
        return {k: _jsonable(v) for k, v in row._mapping.items()}
    except DBAPIError as exc:
        raise translate_db_error(exc) from exc


@contextmanager
def transaction(conn: Connection) -> Iterator[Connection]:
    conn.execute(text("START TRANSACTION"))
    try:
        yield conn
    except BaseException:
        conn.execute(text("ROLLBACK"))
        raise
    else:
        conn.execute(text("COMMIT"))


@contextmanager
def identity(conn: Connection, investigator_id: int | None, client_ip: str | None) -> Iterator[Connection]:
    """Attach the authenticated investigator to this connection for audit triggers."""
    conn.execute(text("SET @app_investigator_id = :i, @app_client_ip = :ip"),
                 {"i": investigator_id, "ip": client_ip})
    try:
        yield conn
    finally:
        try:
            conn.execute(text("SET @app_investigator_id = NULL, @app_client_ip = NULL"))
        except Exception:  # connection may be broken; the pool will discard it
            log.warning("could not reset audit identity on connection")


@contextmanager
def system_connection() -> Iterator[Connection]:
    """Connection without an investigator identity (background jobs)."""
    with get_engine().connect() as conn:
        with identity(conn, None, None):
            yield conn
