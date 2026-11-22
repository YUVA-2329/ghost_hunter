"""Chain of custody - transfers are validated and written by sp_transfer_custody."""
from __future__ import annotations

from fastapi import HTTPException

from ..ai import detector
from ..database import call_procedure, fetch_all, fetch_one
from ..security.auth import RequestContext, ensure_case_access
from .evidence import current_file_hash


def overview(ctx: RequestContext) -> list[dict]:
    return fetch_all(ctx.conn, """
        SELECT v.evidence_id, v.evidence_code, v.evidence_name, v.case_id, v.case_code,
               v.integrity_status, v.custodian_id, v.custodian_name,
               (SELECT COUNT(*) FROM custody_transfers t WHERE t.evidence_id = v.evidence_id) AS transfers,
               (SELECT MAX(t.transfer_timestamp) FROM custody_transfers t
                 WHERE t.evidence_id = v.evidence_id) AS last_transfer_at
          FROM vw_evidence_overview v
         WHERE fn_has_case_access(:uid, v.case_id) = 1
         ORDER BY v.evidence_id""", {"uid": ctx.user.investigator_id})


def history(ctx: RequestContext, evidence_id: int) -> dict:
    ev = fetch_one(ctx.conn, "SELECT evidence_id, evidence_code, evidence_name, case_id, case_code, "
                             "custodian_id, custodian_name, integrity_status "
                             "FROM vw_evidence_overview WHERE evidence_id = :e", {"e": evidence_id})
    if not ev:
        raise HTTPException(404, "Evidence not found")
    ensure_case_access(ctx, ev["case_id"])
    ev["transfers"] = fetch_all(ctx.conn, """
        SELECT transfer_id, transferred_from, from_name, transferred_to, to_name, transfer_reason,
               transfer_timestamp, verification_status, hash_at_transfer, performed_by_name
          FROM vw_custody_history WHERE evidence_id = :e
         ORDER BY transfer_timestamp, transfer_id""", {"e": evidence_id})
    ev["eligible_receivers"] = fetch_all(ctx.conn, """
        SELECT i.investigator_id, i.investigator_name, i.role
          FROM investigators i
         WHERE i.is_active = 1 AND i.role <> 'AUDITOR'
           AND i.investigator_id <> COALESCE(:cur, 0)
           AND (i.role IN ('ADMIN','LEAD_INVESTIGATOR')
                OR EXISTS (SELECT 1 FROM case_assignments ca
                            WHERE ca.case_id = :c AND ca.investigator_id = i.investigator_id
                              AND ca.assignment_status = 'ACTIVE'))
         ORDER BY i.investigator_name""", {"cur": ev["custodian_id"], "c": ev["case_id"]})
    ev["can_transfer"] = ctx.user.can("custody.transfer") and (
        ev["custodian_id"] == ctx.user.investigator_id or ctx.user.role in ("ADMIN", "LEAD_INVESTIGATOR"))
    return ev


def transfer(ctx: RequestContext, evidence_id: int, to_id: int, reason: str) -> dict:
    ev = fetch_one(ctx.conn, "SELECT case_id, file_path FROM evidence WHERE evidence_id = :e", {"e": evidence_id})
    if not ev:
        raise HTTPException(404, "Evidence not found")
    ensure_case_access(ctx, ev["case_id"])
    actual = current_file_hash(ev["file_path"])     # hash verified at the moment of hand-over
    out = call_procedure(ctx.conn, "sp_transfer_custody", {
        "e": evidence_id, "to": to_id, "r": reason, "h": actual, "by": ctx.user.investigator_id},
        out=["transfer_id"])
    row = fetch_one(ctx.conn, "SELECT * FROM vw_custody_history WHERE transfer_id = :t", {"t": out["transfer_id"]})
    if row and row["verification_status"] != "VERIFIED":
        detector.raise_integrity_alert(ctx.conn, evidence_id)
    return row
