"""Dashboard, cases, investigators, evidence, custody and audit endpoints."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from ..database import execute, fetch_all, fetch_one
from ..schemas import (AssignmentCreate, CaseCreate, CaseStatusUpdate, CaseUpdate, CustodyTransferCreate,
                       InvestigatorCreate, InvestigatorUpdate)
from ..security.auth import RequestContext, ensure_case_access, get_context, require
from ..security.passwords import hash_password, password_problems
from ..services import audit, cases, custody, dashboard, evidence
from ..utils.files import MEDIA_TYPES, FileRejected

router = APIRouter(prefix="/api", tags=["core"])


# ---------------------------------------------------------------- dashboard
@router.get("/dashboard")
def get_dashboard(ctx: RequestContext = Depends(get_context)):
    return dashboard.dashboard(ctx)


# ---------------------------------------------------------------- investigators
@router.get("/investigators")
def list_investigators(ctx: RequestContext = Depends(get_context)):
    cols = "investigator_id, investigator_name, role, is_active"
    if ctx.user.can("investigators.manage"):
        cols += ", email, created_at"
    return fetch_all(ctx.conn, f"SELECT {cols} FROM investigators ORDER BY is_active DESC, investigator_name")


@router.post("/investigators", status_code=201)
def create_investigator(body: InvestigatorCreate, ctx: RequestContext = Depends(require("investigators.manage"))):
    problems = password_problems(body.password)
    if problems:
        raise HTTPException(400, "Password needs " + ", ".join(problems))
    execute(ctx.conn, """INSERT INTO investigators (investigator_name, email, role, password_hash)
                         VALUES (:n, :e, :r, :h)""",
            {"n": body.investigator_name, "e": body.email, "r": body.role, "h": hash_password(body.password)})
    return fetch_one(ctx.conn, "SELECT investigator_id, investigator_name, email, role FROM investigators WHERE email = :e",
                     {"e": body.email})


@router.patch("/investigators/{investigator_id}")
def update_investigator(investigator_id: int, body: InvestigatorUpdate,
                        ctx: RequestContext = Depends(require("investigators.manage"))):
    if investigator_id == ctx.user.investigator_id and (body.role or body.is_active is False):
        raise HTTPException(400, "You cannot change your own role or deactivate yourself")
    fields = {}
    if body.role:
        fields["role"] = body.role
    if body.is_active is not None:
        fields["is_active"] = 1 if body.is_active else 0
    if fields:
        sets = ", ".join(f"{k} = :{k}" for k in fields)       # keys from the fixed dict above
        execute(ctx.conn, f"UPDATE investigators SET {sets} WHERE investigator_id = :id", {**fields, "id": investigator_id})
        if fields.get("is_active") == 0:
            execute(ctx.conn, "UPDATE app_sessions SET revoked_at = NOW() WHERE investigator_id = :id AND revoked_at IS NULL",
                    {"id": investigator_id})
    return {"ok": True}


# ---------------------------------------------------------------- cases
@router.get("/cases")
def list_cases(status: Optional[str] = None, ctx: RequestContext = Depends(get_context)):
    return cases.list_cases(ctx, status)


@router.post("/cases", status_code=201)
def create_case(body: CaseCreate, ctx: RequestContext = Depends(require("case.create"))):
    cid = cases.create_case(ctx, body.case_title, body.case_description, body.priority)
    return cases.get_case(ctx, cid)


@router.get("/cases/{case_id}")
def get_case(case_id: int, ctx: RequestContext = Depends(get_context)):
    ensure_case_access(ctx, case_id)
    return cases.get_case(ctx, case_id)


@router.patch("/cases/{case_id}")
def update_case(case_id: int, body: CaseUpdate, ctx: RequestContext = Depends(require("case.update"))):
    ensure_case_access(ctx, case_id)
    cases.update_case(ctx, case_id, body.model_dump(exclude_none=True))
    return cases.get_case(ctx, case_id)


@router.post("/cases/{case_id}/status")
def set_case_status(case_id: int, body: CaseStatusUpdate, ctx: RequestContext = Depends(require("case.update"))):
    ensure_case_access(ctx, case_id)
    cases.set_status(ctx, case_id, body.case_status)
    return cases.get_case(ctx, case_id)


@router.post("/cases/{case_id}/assignments")
def assign(case_id: int, body: AssignmentCreate, ctx: RequestContext = Depends(require("case.assign"))):
    ensure_case_access(ctx, case_id)
    cases.assign(ctx, case_id, body.investigator_id, body.assignment_role)
    return cases.get_case(ctx, case_id)


@router.delete("/cases/{case_id}/assignments/{investigator_id}")
def unassign(case_id: int, investigator_id: int, ctx: RequestContext = Depends(require("case.assign"))):
    ensure_case_access(ctx, case_id)
    cases.unassign(ctx, case_id, investigator_id)
    return cases.get_case(ctx, case_id)


@router.delete("/cases/{case_id}")
def delete_case(case_id: int, ctx: RequestContext = Depends(require("case.delete"))):
    cases.delete_case(ctx, case_id)
    return {"ok": True, "deleted_case_id": case_id}


# ---------------------------------------------------------------- evidence
@router.get("/evidence")
def list_evidence(case_id: Optional[int] = None, status: Optional[str] = None,
                  ctx: RequestContext = Depends(get_context)):
    return evidence.list_evidence(ctx, case_id, status)


@router.post("/evidence", status_code=201)
def upload_evidence(case_id: int = Form(..., gt=0), description: Optional[str] = Form(None, max_length=500),
                    file: UploadFile = File(...), ctx: RequestContext = Depends(require("evidence.register"))):
    try:
        return evidence.register(ctx, case_id, (description or "").strip() or None, file.file, file.filename)
    except FileRejected as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/evidence/verify-all")
def verify_all(ctx: RequestContext = Depends(require("evidence.verify"))):
    results = evidence.verify_all(ctx)
    return {"checked": len(results), "results": results,
            "summary": {k: sum(r["result"] == k for r in results) for k in ("VERIFIED", "TAMPERED", "MISSING", "ERROR")}}


@router.get("/evidence/{evidence_id}")
def get_evidence(evidence_id: int, ctx: RequestContext = Depends(get_context)):
    return evidence.get_evidence(ctx, evidence_id)


@router.post("/evidence/{evidence_id}/verify")
def verify_evidence(evidence_id: int, ctx: RequestContext = Depends(require("evidence.verify"))):
    return evidence.verify(ctx, evidence_id)


@router.get("/evidence/{evidence_id}/download")
def download_evidence(evidence_id: int, ctx: RequestContext = Depends(get_context)):
    path, row = evidence.download_path(ctx, evidence_id)
    return FileResponse(path, media_type=MEDIA_TYPES.get(row["evidence_type"], "application/octet-stream"),
                        filename=row["evidence_name"], content_disposition_type="attachment",
                        headers={"X-Evidence-Integrity": row["integrity_status"]})


# ---------------------------------------------------------------- custody
@router.get("/custody")
def custody_overview(ctx: RequestContext = Depends(get_context)):
    return custody.overview(ctx)


@router.get("/custody/{evidence_id}")
def custody_history(evidence_id: int, ctx: RequestContext = Depends(get_context)):
    return custody.history(ctx, evidence_id)


@router.post("/custody/transfer", status_code=201)
def custody_transfer(body: CustodyTransferCreate, ctx: RequestContext = Depends(require("custody.transfer"))):
    return custody.transfer(ctx, body.evidence_id, body.to_investigator_id, body.transfer_reason)


# ---------------------------------------------------------------- audit
@router.get("/audit")
def audit_search(date_from: Optional[dt.date] = None, date_to: Optional[dt.date] = None,
                 investigator: Optional[str] = Query(None, pattern=r"^(none|\d{1,9})$"),
                 action: Optional[str] = None, risk: Optional[str] = None, table: Optional[str] = None,
                 case_id: Optional[int] = None, record_id: Optional[int] = None, source: Optional[str] = None,
                 page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
                 ctx: RequestContext = Depends(get_context)):
    return audit.search(ctx, date_from=date_from, date_to=date_to, investigator=investigator, action=action,
                        risk=risk, table=table, case_id=case_id, record_id=record_id, source=source,
                        page=page, page_size=page_size)


@router.get("/audit/options")
def audit_options(ctx: RequestContext = Depends(get_context)):
    return audit.filter_options(ctx)


@router.get("/audit/{log_id}")
def audit_event(log_id: int, ctx: RequestContext = Depends(get_context)):
    return audit.get_event(ctx, log_id)
