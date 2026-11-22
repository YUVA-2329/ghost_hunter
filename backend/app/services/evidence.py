"""Digital evidence: registration, SHA-256 verification, download."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import BinaryIO

from fastapi import HTTPException

from ..ai import detector
from ..config import get_settings
from ..database import DatabaseRuleError, call_procedure, fetch_all, fetch_one
from ..security.auth import RequestContext, ensure_case_access
from ..utils.files import resolve_stored, sha256_file, store_upload

log = logging.getLogger("ghosthunter.evidence")


def list_evidence(ctx: RequestContext, case_id: int | None = None, status: str | None = None) -> list[dict]:
    sql = "SELECT * FROM vw_evidence_overview WHERE fn_has_case_access(:uid, case_id) = 1"
    params: dict = {"uid": ctx.user.investigator_id}
    if case_id:
        sql += " AND case_id = :c"
        params["c"] = case_id
    if status:
        sql += " AND integrity_status = :s"
        params["s"] = status
    return fetch_all(ctx.conn, sql + " ORDER BY evidence_id", params)


def get_evidence_row(ctx: RequestContext, evidence_id: int) -> dict:
    row = fetch_one(ctx.conn, "SELECT * FROM vw_evidence_overview WHERE evidence_id = :e", {"e": evidence_id})
    if not row:
        raise HTTPException(404, "Evidence not found")
    ensure_case_access(ctx, row["case_id"])
    return row


def get_evidence(ctx: RequestContext, evidence_id: int) -> dict:
    row = get_evidence_row(ctx, evidence_id)
    row["integrity_history"] = fetch_all(ctx.conn, """
        SELECT check_id, expected_hash, actual_hash, verification_result, check_context,
               checked_at, checked_by_name
          FROM vw_integrity_history WHERE evidence_id = :e ORDER BY checked_at DESC, check_id DESC""",
        {"e": evidence_id})
    row["custody_history"] = fetch_all(ctx.conn, """
        SELECT transfer_id, from_name, to_name, transfer_reason, transfer_timestamp,
               verification_status, hash_at_transfer, performed_by_name
          FROM vw_custody_history WHERE evidence_id = :e ORDER BY transfer_timestamp, transfer_id""",
        {"e": evidence_id})
    return row


def register(ctx: RequestContext, case_id: int, description: str | None,
             stream: BinaryIO, filename: str | None) -> dict:
    ensure_case_access(ctx, case_id)
    s = get_settings()
    stored = store_upload(stream, filename, s.storage_dir, s.max_upload_bytes)
    try:
        out = call_procedure(ctx.conn, "sp_register_evidence", {
            "c": case_id, "n": stored.display_name, "t": stored.evidence_type,
            "d": description, "p": stored.relative_path, "sz": stored.size,
            "h": stored.sha256, "by": ctx.user.investigator_id}, out=["evidence_id"])
    except Exception:
        # database refused the registration -> do not keep an orphan file
        try:
            stored.absolute_path.chmod(0o600)
            stored.absolute_path.unlink(missing_ok=True)
        except OSError:
            log.warning("could not remove rejected upload %s", stored.absolute_path)
        raise
    evidence_id = int(out["evidence_id"])
    return {"evidence_id": evidence_id, "sha256": stored.sha256, "size": stored.size,
            "evidence_type": stored.evidence_type, "evidence_name": stored.display_name,
            "integrity_status": "VERIFIED"}


def current_file_hash(file_path: str) -> str | None:
    """SHA-256 of the stored file right now, or None if it is missing."""
    path = resolve_stored(get_settings().storage_dir, file_path)
    if path is None or not path.is_file():
        return None
    return sha256_file(path)


def verify(ctx: RequestContext, evidence_id: int, context: str = "MANUAL") -> dict:
    row = fetch_one(ctx.conn, "SELECT evidence_id, case_id, file_path, original_hash, evidence_name "
                              "FROM evidence WHERE evidence_id = :e", {"e": evidence_id})
    if not row:
        raise HTTPException(404, "Evidence not found")
    ensure_case_access(ctx, row["case_id"])
    actual = current_file_hash(row["file_path"])
    out = call_procedure(ctx.conn, "sp_record_integrity_check",
                         {"e": evidence_id, "h": actual, "by": ctx.user.investigator_id, "ctx": context},
                         out=["result"])
    result = out["result"]
    alert = None
    if result != "VERIFIED":
        alert = detector.raise_integrity_alert(ctx.conn, evidence_id)
    return {"evidence_id": evidence_id, "evidence_name": row["evidence_name"], "result": result,
            "expected_hash": row["original_hash"], "actual_hash": actual,
            "alert_id": alert}


def verify_all(ctx: RequestContext) -> list[dict]:
    ids = [r["evidence_id"] for r in list_evidence(ctx)]
    results = []
    for eid in ids:
        try:
            results.append(verify(ctx, eid))
        except (DatabaseRuleError, HTTPException) as exc:
            results.append({"evidence_id": eid, "result": "ERROR",
                            "error": getattr(exc, "message", None) or getattr(exc, "detail", str(exc))})
    return results


def download_path(ctx: RequestContext, evidence_id: int) -> tuple[Path, dict]:
    row = get_evidence_row(ctx, evidence_id)
    file_row = fetch_one(ctx.conn, "SELECT file_path FROM evidence WHERE evidence_id = :e", {"e": evidence_id})
    path = resolve_stored(get_settings().storage_dir, file_row["file_path"])
    if path is None or not path.is_file():
        raise HTTPException(404, "The stored evidence file is missing - run an integrity check")
    call_procedure(ctx.conn, "sp_log_app_event", {
        "i": ctx.user.investigator_id, "a": "EVIDENCE_DOWNLOAD", "t": "evidence", "r": evidence_id,
        "c": row["case_id"], "d": f"Downloaded {row['evidence_name']}"[:500], "ip": ctx.ip, "risk": "LOW"})
    return path, row
