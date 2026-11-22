"""Login / logout / current user."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from ..config import get_settings
from ..database import call_procedure, execute, fetch_one, fetch_value, get_engine
from ..schemas import LoginRequest
from ..security.auth import (COOKIE_NAME, RequestContext, client_ip, get_context, hash_token,
                             new_session_token, revoke_session)
from ..security.passwords import verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _record_attempt(conn, email: str, inv_id: int | None, ip: str | None, ok: bool, reason: str | None) -> None:
    execute(conn, """INSERT INTO login_attempts (email, investigator_id, ip_address, success, failure_reason)
                     VALUES (:e, :i, :ip, :ok, :r)""",
            {"e": email[:150], "i": inv_id, "ip": ip, "ok": 1 if ok else 0, "r": reason})


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response):
    s = get_settings()
    ip = client_ip(request)
    with get_engine().connect() as conn:
        recent_failures = fetch_value(conn, """
            SELECT COUNT(*) FROM login_attempts
             WHERE email = :e AND success = 0 AND attempted_at > NOW() - INTERVAL :m MINUTE
               AND attempted_at > COALESCE((SELECT MAX(attempted_at) FROM login_attempts
                                             WHERE email = :e AND success = 1), '1970-01-01')""",
                                      {"e": body.email, "m": s.login_lockout_minutes})
        user = fetch_one(conn, """SELECT investigator_id, investigator_name, email, role, password_hash, is_active
                                    FROM investigators WHERE email = :e""", {"e": body.email})
        if recent_failures >= s.login_max_failures:
            _record_attempt(conn, body.email, user["investigator_id"] if user else None, ip, False, "LOCKED")
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                                f"Too many failed attempts. Try again in {s.login_lockout_minutes} minutes.")
        ok = verify_password(body.password, user["password_hash"] if user else None)
        if not user or not ok or not user["is_active"]:
            reason = "UNKNOWN_EMAIL" if not user else ("BAD_PASSWORD" if not ok else "INACTIVE")
            _record_attempt(conn, body.email, user["investigator_id"] if user else None, ip, False, reason)
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid e-mail or password")

        _record_attempt(conn, body.email, user["investigator_id"], ip, True, None)
        token = new_session_token()
        expires = dt.datetime.now() + dt.timedelta(hours=s.session_hours)
        execute(conn, """INSERT INTO app_sessions (investigator_id, token_hash, ip_address, user_agent, expires_at)
                         VALUES (:i, :h, :ip, :ua, :exp)""",
                {"i": user["investigator_id"], "h": hash_token(token), "ip": ip,
                 "ua": (request.headers.get("user-agent") or "")[:255], "exp": expires})
        risk = "MEDIUM" if recent_failures >= 3 else "LOW"
        detail = "Successful login" + (f" after {recent_failures} failed attempts" if recent_failures else "")
        call_procedure(conn, "sp_log_app_event", {"i": user["investigator_id"], "a": "LOGIN", "t": None, "r": None,
                                                  "c": None, "d": detail, "ip": ip, "risk": risk})
    response.set_cookie(COOKIE_NAME, token, max_age=s.session_hours * 3600, httponly=True,
                        samesite="strict", secure=s.cookie_secure, path="/")
    return {"investigator_id": user["investigator_id"], "name": user["investigator_name"],
            "role": user["role"], "expires_at": expires.isoformat(timespec="seconds")}


@router.post("/logout")
def logout(response: Response, ctx: RequestContext = Depends(get_context)):
    revoke_session(ctx.conn, ctx.user.session_id)
    call_procedure(ctx.conn, "sp_log_app_event", {"i": ctx.user.investigator_id, "a": "LOGOUT", "t": None,
                                                  "r": None, "c": None, "d": "Logout", "ip": ctx.ip, "risk": "LOW"})
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
def me(ctx: RequestContext = Depends(get_context)):
    return ctx.user.public()
