"""Authentication, server-side sessions and role-based access control.

The browser only holds a random session token in an HttpOnly cookie. The
backend stores SHA-256(token) in ``app_sessions`` and resolves the
investigator from the database on every request. Investigator IDs sent by
the browser are never trusted for identity.
"""
from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from typing import Iterator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.engine import Connection

from ..config import get_settings
from ..database import fetch_one, get_engine, identity, execute

COOKIE_NAME = "gh_session"

ROLES = ("ADMIN", "LEAD_INVESTIGATOR", "INVESTIGATOR", "AUDITOR")
WRITE_ROLES = ("ADMIN", "LEAD_INVESTIGATOR", "INVESTIGATOR")
MANAGER_ROLES = ("ADMIN", "LEAD_INVESTIGATOR")
OVERSIGHT_ROLES = ("ADMIN", "LEAD_INVESTIGATOR", "AUDITOR")

PERMISSIONS = {
    "case.create": MANAGER_ROLES,
    "case.update": MANAGER_ROLES,
    "case.assign": MANAGER_ROLES,
    "case.delete": ("ADMIN",),
    "evidence.register": WRITE_ROLES,
    "evidence.verify": ROLES,
    "custody.transfer": WRITE_ROLES,
    "audit.view_all": OVERSIGHT_ROLES,
    "ai.analyze": OVERSIGHT_ROLES,
    "ai.alert_review": OVERSIGHT_ROLES,
    "ai.rules_edit": ("ADMIN",),
    "investigators.manage": ("ADMIN",),
    "reports.generate": ROLES,
}


@dataclass
class CurrentUser:
    investigator_id: int
    name: str
    email: str
    role: str
    session_id: int

    def can(self, permission: str) -> bool:
        return self.role in PERMISSIONS.get(permission, ())

    @property
    def sees_all_cases(self) -> bool:
        return self.role in OVERSIGHT_ROLES

    def public(self) -> dict:
        return {"investigator_id": self.investigator_id, "name": self.name, "email": self.email,
                "role": self.role,
                "permissions": sorted(p for p in PERMISSIONS if self.can(p))}


@dataclass
class RequestContext:
    conn: Connection
    user: CurrentUser
    ip: str | None


def client_ip(request: Request) -> str | None:
    # Direct connection address. X-Forwarded-For is NOT trusted (it is
    # attacker-controlled unless a known reverse proxy sets it).
    return request.client.host if request.client else None


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def resolve_session(conn: Connection, token: str | None) -> CurrentUser | None:
    if not token or len(token) > 100:
        return None
    row = fetch_one(conn, """
        SELECT s.session_id, i.investigator_id, i.investigator_name, i.email, i.role
          FROM app_sessions s
          JOIN investigators i ON i.investigator_id = s.investigator_id
         WHERE s.token_hash = :h AND s.revoked_at IS NULL AND s.expires_at > NOW()
           AND i.is_active = 1""", {"h": hash_token(token)})
    if not row:
        return None
    return CurrentUser(row["investigator_id"], row["investigator_name"], row["email"],
                       row["role"], row["session_id"])


def get_context(request: Request) -> Iterator[RequestContext]:
    """FastAPI dependency: one DB connection per request, with the
    authenticated investigator attached for the audit triggers."""
    ip = client_ip(request)
    with get_engine().connect() as conn:
        user = resolve_session(conn, request.cookies.get(COOKIE_NAME))
        if user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in or session expired")
        with identity(conn, user.investigator_id, ip):
            yield RequestContext(conn, user, ip)


def require(permission: str):
    def checker(ctx: RequestContext = Depends(get_context)) -> RequestContext:
        if not ctx.user.can(permission):
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                f"Your role ({ctx.user.role}) is not allowed to perform this action")
        return ctx
    return checker


def ensure_case_access(ctx: RequestContext, case_id: int) -> None:
    ok = fetch_one(ctx.conn, "SELECT fn_has_case_access(:u, :c) AS ok, "
                             "(SELECT COUNT(*) FROM cases WHERE case_id = :c) AS found",
                   {"u": ctx.user.investigator_id, "c": case_id})
    if not ok or not ok["found"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    if not ok["ok"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not assigned to this case")


def revoke_session(conn: Connection, session_id: int) -> None:
    execute(conn, "UPDATE app_sessions SET revoked_at = NOW() WHERE session_id = :s AND revoked_at IS NULL",
            {"s": session_id})


def session_hours() -> int:
    return get_settings().session_hours
