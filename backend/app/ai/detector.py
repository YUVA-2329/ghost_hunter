"""Anomaly detection over the REAL audit trail stored in MySQL.

Three kinds of detection are used and always labelled as such:

* RULE        - deterministic rules with configurable thresholds
                (detection_rules table). Fully explainable.
* STATISTICAL - z-score of an actor's hourly operation count against the
                population of all actor-hours (leave-one-out baseline).
* ML          - optional unsupervised IsolationForest (scikit-learn). Runs
                only if scikit-learn is installed and enough history exists.
                No model is trained on labelled attacks; findings are hints.

Every finding carries a score breakdown (which factor added how many
points), so the risk score can always be explained. A finding is a reason
to investigate - never proof of malicious intent.

Findings are stored in ai_alerts. A fingerprint (rule + subject + first
event) makes analysis idempotent: re-running updates the same alert.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import math
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from statistics import median
from typing import Any, Callable, Iterable

from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..config import get_settings

log = logging.getLogger("ghosthunter.detector")

DATA_ACTIONS = ("INSERT", "UPDATE", "DELETE")
VERIFICATION_FIELDS = {"current_hash", "integrity_status", "last_verified_at"}
DESCRIPTIVE_EVIDENCE_FIELDS = {"evidence_name", "evidence_type", "description", "file_path", "case_id"}


def risk_level(score: int) -> str:
    """Python mirror of the SQL function fn_risk_level (same thresholds)."""
    return "CRITICAL" if score >= 85 else "HIGH" if score >= 60 else "MEDIUM" if score >= 35 else "LOW"


def sklearn_available() -> bool:
    try:
        import sklearn  # noqa: F401
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# data structures
# ---------------------------------------------------------------------------
@dataclass
class Finding:
    rule_code: str
    method: str
    title: str
    summary: str
    breakdown: list[tuple[str, int]]
    facts: dict
    key: str
    first_at: dt.datetime | None
    last_at: dt.datetime | None
    case_id: int | None = None
    investigator_id: int | None = None
    evidence_id: int | None = None

    @property
    def score(self) -> int:
        return max(0, min(100, sum(p for _, p in self.breakdown)))

    @property
    def explanation(self) -> str:
        why = "; ".join(f"{label} (+{pts})" if pts >= 0 else f"{label} ({pts})" for label, pts in self.breakdown)
        return (f"{risk_level(self.score)}: {self.summary} "
                f"Risk score {self.score}/100 = {why}. "
                "This is an indicator for review, not proof of malicious activity.")

    @property
    def fingerprint(self) -> str:
        return hashlib.sha256(f"{self.rule_code}|{self.key}".encode()).hexdigest()


@dataclass
class Event:
    log_id: int
    ts: dt.datetime
    action: str
    source: str
    table: str | None
    record_id: int | None
    case_id: int | None
    investigator_id: int | None
    actor_name: str
    db_user: str | None
    risk: str
    old: dict | None
    new: dict | None
    details: str | None = None
    changed: set = field(default_factory=set)

    @property
    def actor_key(self) -> str:
        return f"inv:{self.investigator_id}" if self.investigator_id else f"db:{self.db_user or 'unknown'}"

    @property
    def unidentified(self) -> bool:
        return self.investigator_id is None

    @property
    def is_data_change(self) -> bool:
        return self.action in DATA_ACTIONS and self.source == "TRIGGER"

    @property
    def is_verification_refresh(self) -> bool:
        return (self.table == "evidence" and self.action == "UPDATE"
                and bool(self.changed) and self.changed <= VERIFICATION_FIELDS)


def _loads(v: Any) -> Any:
    if isinstance(v, (bytes, str)):
        try:
            return json.loads(v)
        except ValueError:
            return None
    return v


def _changed(old: dict | None, new: dict | None) -> set:
    if not old or not new:
        return set()
    return {k for k in set(old) | set(new) if old.get(k) != new.get(k)}


def _fmt(t: dt.datetime | None) -> str:
    return t.strftime("%Y-%m-%d %H:%M") if t else "?"


def _clusters(items: list, window_min: int, ts: Callable[[Any], dt.datetime] = lambda e: e.ts) -> list[list]:
    """Greedy time clusters: each cluster spans at most window_min minutes."""
    items = sorted(items, key=ts)
    out, i, n = [], 0, len(items)
    win = dt.timedelta(minutes=window_min)
    while i < n:
        j = i
        while j + 1 < n and ts(items[j + 1]) - ts(items[i]) <= win:
            j += 1
        out.append(items[i:j + 1])
        i = j + 1
    return out


def _main_case(events: Iterable[Event]) -> int | None:
    c = Counter(e.case_id for e in events if e.case_id)
    return c.most_common(1)[0][0] if c else None


# ---------------------------------------------------------------------------
# analysis context (all data is read once from MySQL)
# ---------------------------------------------------------------------------
class Analysis:
    def __init__(self, conn: Connection, lookback_days: int):
        self.conn = conn
        self.since = dt.datetime.now() - dt.timedelta(days=lookback_days)
        self.rules = {r["rule_code"]: dict(r) for r in conn.execute(text(
            "SELECT * FROM detection_rules")).mappings()}
        for r in self.rules.values():
            r["params"] = _loads(r.get("params")) or {}
        self.names = {r["investigator_id"]: r["investigator_name"] for r in conn.execute(text(
            "SELECT investigator_id, investigator_name FROM investigators")).mappings()}
        self.case_codes = {r["case_id"]: r["case_code"] for r in conn.execute(text(
            "SELECT case_id, case_code FROM cases")).mappings()}
        self.events: list[Event] = []
        for r in conn.execute(text("""
                SELECT log_id, `timestamp`, action_type, event_source, table_name, record_id,
                       related_case_id, investigator_id, db_user, risk_level, old_values, new_values, details
                  FROM audit_logs WHERE `timestamp` >= :since ORDER BY `timestamp`, log_id"""),
                {"since": self.since}).mappings():
            old, new = _loads(r["old_values"]), _loads(r["new_values"])
            inv = r["investigator_id"]
            self.events.append(Event(
                r["log_id"], r["timestamp"], r["action_type"], r["event_source"], r["table_name"],
                r["record_id"], r["related_case_id"], inv,
                self.names.get(inv, f"UNIDENTIFIED ({r['db_user']})") if inv else f"UNIDENTIFIED ({r['db_user']})",
                r["db_user"], r["risk_level"], old, new, r["details"], _changed(old, new)))
        self.logins = [dict(r) for r in conn.execute(text("""
                SELECT attempt_id, email, investigator_id, ip_address, attempted_at, success, failure_reason
                  FROM login_attempts WHERE attempted_at >= :since ORDER BY attempted_at, attempt_id"""),
                {"since": self.since}).mappings()]
        oh = self.rules.get("OFF_HOURS_ACTIVITY", {}).get("params") or {}
        self.work_start = int(oh.get("start_hour", 8))
        self.work_end = int(oh.get("end_hour", 20))

    def rule(self, code: str) -> dict | None:
        r = self.rules.get(code)
        return r if r and r["is_enabled"] else None

    def off_hours(self, t: dt.datetime) -> bool:
        return t.hour < self.work_start or t.hour >= self.work_end

    def case_label(self, case_id: int | None) -> str:
        return self.case_codes.get(case_id, f"case {case_id}") if case_id else "no specific case"

    def actor_bonus(self, events: list[Event]) -> list[tuple[str, int]]:
        extra = []
        if any(e.unidentified for e in events):
            extra.append(("no authenticated application identity (direct database access)", 15))
        if any(self.off_hours(e.ts) for e in events):
            extra.append((f"outside working hours {self.work_start:02d}:00-{self.work_end:02d}:00", 10))
        return extra


# ---------------------------------------------------------------------------
# RULES
# ---------------------------------------------------------------------------
def rule_integrity(a: Analysis, only_evidence: int | None = None) -> list[Finding]:
    rule = a.rule("INTEGRITY_FAILURE")
    if not rule:
        return []
    params = {"since": a.since}
    extra = ""
    if only_evidence:
        extra = " AND ic.evidence_id = :e"
        params["e"] = only_evidence
    rows = [dict(r) for r in a.conn.execute(text(f"""
        SELECT ic.check_id, ic.evidence_id, ic.expected_hash, ic.actual_hash, ic.verification_result,
               ic.check_context, ic.checked_at, ic.checked_by, e.evidence_name, e.case_id,
               e.integrity_status AS current_status
          FROM integrity_checks ic JOIN evidence e ON e.evidence_id = ic.evidence_id
         WHERE ic.verification_result <> 'VERIFIED' AND ic.checked_at >= :since {extra}
         ORDER BY ic.checked_at, ic.check_id"""), params).mappings()]
    by_ev: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        by_ev[r["evidence_id"]].append(r)
    out = []
    for eid, fails in by_ev.items():
        n, first, last = len(fails), fails[0], fails[-1]
        code = f"EV-{eid:04d}"
        breakdown = [(f"rule INTEGRITY_FAILURE base score", int(rule["base_score"]))]
        if n > 1:
            breakdown.append((f"{n} failed verifications (repeated failure)", min(10, 5 * (n - 1))))
        if last["current_status"] == "VERIFIED":
            breakdown.append(("file matches the original hash again (restored)", -40))
        who = a.names.get(last["checked_by"], "?")
        if last["verification_result"] == "MISSING":
            what = "the stored evidence file could not be found"
        else:
            what = (f"expected (original) SHA-256 {last['expected_hash'][:16]}… but computed "
                    f"{last['actual_hash'][:16]}…")
        summary = (f"Evidence {code} '{last['evidence_name']}' ({a.case_label(last['case_id'])}) changed after "
                   f"registration: {n} SHA-256 verification(s) failed, latest by {who} at {_fmt(last['checked_at'])}; "
                   f"{what}.")
        out.append(Finding(
            "INTEGRITY_FAILURE", "RULE", f"Evidence {code} failed integrity verification", summary, breakdown,
            {"evidence_id": eid, "failed_check_ids": [f["check_id"] for f in fails],
             "expected_hash": last["expected_hash"], "latest_actual_hash": last["actual_hash"],
             "latest_result": last["verification_result"], "current_status": last["current_status"]},
            f"evidence:{eid}:{first['check_id']}", first["checked_at"], last["checked_at"],
            case_id=last["case_id"], investigator_id=None, evidence_id=eid))
    return out


def _actor_cluster_rule(a: Analysis, code: str, events: list[Event], noun: str, per_extra: int = 5) -> list[Finding]:
    rule = a.rule(code)
    if not rule:
        return []
    thr, win = int(rule["threshold"]), int(rule["window_minutes"])
    groups: dict[str, list[Event]] = defaultdict(list)
    for e in events:
        groups[e.actor_key].append(e)
    out = []
    for actor, evs in groups.items():
        for cl in _clusters(evs, win):
            if len(cl) < thr:
                continue
            n = len(cl)
            tables = Counter(e.table for e in cl)
            breakdown = [(f"rule {code} base score", int(rule["base_score"]))]
            if n > thr:
                breakdown.append((f"{n - thr} more than the threshold of {thr}", min(20, per_extra * (n - thr))))
            breakdown += a.actor_bonus(cl)
            summary = (f"{n} {noun} by {cl[0].actor_name} between {_fmt(cl[0].ts)} and {_fmt(cl[-1].ts)} "
                       f"(threshold {thr} within {win} min) on "
                       + ", ".join(f"{t} x{c}" for t, c in tables.most_common()) + ".")
            out.append(Finding(code, "RULE", f"{n} {noun} by {cl[0].actor_name}", summary, breakdown,
                               {"log_ids": [e.log_id for e in cl], "records": [[e.table, e.record_id] for e in cl]},
                               f"{actor}:{cl[0].log_id}", cl[0].ts, cl[-1].ts,
                               case_id=_main_case(cl), investigator_id=cl[0].investigator_id))
    return out


def rule_repeated_delete(a: Analysis) -> list[Finding]:
    evs = [e for e in a.events if e.is_data_change and e.action == "DELETE"]
    return _actor_cluster_rule(a, "REPEATED_DELETE", evs, "DELETE operations")


def rule_bulk_update(a: Analysis) -> list[Finding]:
    evs = [e for e in a.events if e.is_data_change and e.action == "UPDATE" and not e.is_verification_refresh]
    return _actor_cluster_rule(a, "BULK_UPDATE", evs, "UPDATE operations", per_extra=2)


def rule_evidence_access(a: Analysis) -> list[Finding]:
    rule = a.rule("EVIDENCE_ACCESS_BURST")
    if not rule:
        return []
    evs = [e for e in a.events if e.action == "EVIDENCE_DOWNLOAD"]
    found = _actor_cluster_rule(a, "EVIDENCE_ACCESS_BURST", evs, "evidence downloads")
    for f in found:
        ids = set(f.facts["log_ids"])
        cl = [e for e in evs if e.log_id in ids]
        cases = {e.case_id for e in cl if e.case_id}
        if len(cases) > 1:
            f.breakdown.append((f"files from {len(cases)} different cases", 10))
        # failed-login burst for the same investigator shortly before?
        inv = cl[0].investigator_id
        if inv:
            start = cl[0].ts - dt.timedelta(hours=3)
            fails = [l for l in a.logins if l["investigator_id"] == inv and not l["success"]
                     and start <= l["attempted_at"] <= cl[0].ts]
            if len(fails) >= 3:
                f.breakdown.append((f"preceded by {len(fails)} failed logins on the same account", 15))
        f.facts["cases"] = sorted(cases)
    return found


def rule_failed_logins(a: Analysis) -> list[Finding]:
    rule = a.rule("FAILED_LOGINS")
    if not rule:
        return []
    thr, win = int(rule["threshold"]), int(rule["window_minutes"])
    by_email: dict[str, list[dict]] = defaultdict(list)
    for l in a.logins:
        if not l["success"]:
            by_email[l["email"]].append(l)
    out = []
    for email, fails in by_email.items():
        for cl in _clusters(fails, win, ts=lambda l: l["attempted_at"]):
            n = len(cl)
            if n < thr:
                continue
            ips = sorted({l["ip_address"] for l in cl if l["ip_address"]})
            breakdown = [("rule FAILED_LOGINS base score", int(rule["base_score"]))]
            if n > thr:
                breakdown.append((f"{n - thr} more failures than the threshold of {thr}", min(15, 3 * (n - thr))))
            success = next((l for l in a.logins if l["email"] == email and l["success"]
                            and cl[-1]["attempted_at"] <= l["attempted_at"] <= cl[-1]["attempted_at"] + dt.timedelta(minutes=30)
                            and l["ip_address"] in ips), None)
            if success:
                breakdown.append(("followed by a SUCCESSFUL login from the same address (possible account takeover)", 20))
            if any(a.off_hours(l["attempted_at"]) for l in cl):
                breakdown.append((f"outside working hours {a.work_start:02d}:00-{a.work_end:02d}:00", 10))
            summary = (f"{n} failed logins for {email} between {_fmt(cl[0]['attempted_at'])} and "
                       f"{_fmt(cl[-1]['attempted_at'])} from {', '.join(ips) or 'unknown address'} "
                       f"(threshold {thr} within {win} min)"
                       + (f"; successful login at {_fmt(success['attempted_at'])}." if success else "."))
            out.append(Finding("FAILED_LOGINS", "RULE", f"{n} failed logins for {email}", summary, breakdown,
                               {"attempt_ids": [l["attempt_id"] for l in cl], "ips": ips,
                                "success_attempt_id": success["attempt_id"] if success else None},
                               f"{email}:{cl[0]['attempt_id']}", cl[0]["attempted_at"],
                               (success or cl[-1])["attempted_at"], investigator_id=cl[0]["investigator_id"]))
    return out


def rule_off_hours(a: Analysis) -> list[Finding]:
    rule = a.rule("OFF_HOURS_ACTIVITY")
    if not rule:
        return []
    thr, win = int(rule["threshold"]), int(rule["window_minutes"])
    evs = [e for e in a.events if a.off_hours(e.ts) and (
        (e.is_data_change and not e.is_verification_refresh) or e.action in ("EVIDENCE_DOWNLOAD", "LOGIN"))]
    groups: dict[str, list[Event]] = defaultdict(list)
    for e in evs:
        groups[e.actor_key].append(e)
    out = []
    for actor, items in groups.items():
        for cl in _clusters(items, win):
            n = len(cl)
            if n < thr:
                continue
            breakdown = [("rule OFF_HOURS_ACTIVITY base score", int(rule["base_score"]))]
            if n > 1:
                breakdown.append((f"{n} operations in the session", min(20, 3 * (n - 1))))
            if any(e.unidentified for e in cl):
                breakdown.append(("no authenticated application identity (direct database access)", 15))
            kinds = Counter(e.action for e in cl)
            summary = (f"{n} operation(s) by {cl[0].actor_name} between {_fmt(cl[0].ts)} and {_fmt(cl[-1].ts)}, "
                       f"outside working hours {a.work_start:02d}:00-{a.work_end:02d}:00 ("
                       + ", ".join(f"{k} x{v}" for k, v in kinds.most_common()) + ").")
            out.append(Finding("OFF_HOURS_ACTIVITY", "RULE", f"Off-hours activity by {cl[0].actor_name}", summary,
                               breakdown, {"log_ids": [e.log_id for e in cl]}, f"{actor}:{cl[0].log_id}",
                               cl[0].ts, cl[-1].ts, case_id=_main_case(cl), investigator_id=cl[0].investigator_id))
    return out


def rule_direct_db(a: Analysis) -> list[Finding]:
    rule = a.rule("DIRECT_DB_CHANGE")
    if not rule:
        return []
    thr, win = int(rule["threshold"]), int(rule["window_minutes"])
    evs = [e for e in a.events if e.is_data_change and e.unidentified]
    groups: dict[str, list[Event]] = defaultdict(list)
    for e in evs:
        groups[e.db_user or "unknown"].append(e)
    out = []
    for dbu, items in groups.items():
        for cl in _clusters(items, win):
            n = len(cl)
            if n < thr:
                continue
            breakdown = [("rule DIRECT_DB_CHANGE base score", int(rule["base_score"]))]
            if n > 1:
                breakdown.append((f"{n} changes in the session", min(15, 3 * (n - 1))))
            if any(e.risk in ("HIGH", "CRITICAL") for e in cl):
                breakdown.append(("includes HIGH/CRITICAL changes", 10))
            if any(a.off_hours(e.ts) for e in cl):
                breakdown.append((f"outside working hours {a.work_start:02d}:00-{a.work_end:02d}:00", 10))
            ops = Counter(f"{e.action} {e.table}" for e in cl)
            summary = (f"{n} data change(s) made directly in MySQL as '{dbu}' with no application login, "
                       f"between {_fmt(cl[0].ts)} and {_fmt(cl[-1].ts)}: "
                       + ", ".join(f"{k} x{v}" for k, v in ops.most_common()) + ".")
            out.append(Finding("DIRECT_DB_CHANGE", "RULE", f"Changes made outside the application ({dbu})", summary,
                               breakdown, {"log_ids": [e.log_id for e in cl], "db_user": dbu},
                               f"{dbu}:{cl[0].log_id}", cl[0].ts, cl[-1].ts, case_id=_main_case(cl)))
    return out


def rule_sensitive(a: Analysis) -> list[Finding]:
    rule = a.rule("SENSITIVE_MODIFICATION")
    if not rule:
        return []
    out = []
    for e in a.events:
        reason = None
        if e.table == "evidence" and e.action == "UPDATE" and e.changed & DESCRIPTIVE_EVIDENCE_FIELDS:
            reason = "evidence metadata changed (" + ", ".join(sorted(e.changed & DESCRIPTIVE_EVIDENCE_FIELDS)) + ")"
        elif e.table == "evidence" and e.action == "DELETE":
            reason = "an evidence record was deleted"
        elif e.table == "investigators" and e.action == "UPDATE" and e.changed & {"role", "is_active"}:
            reason = "investigator privileges changed (" + ", ".join(sorted(e.changed & {"role", "is_active"})) + ")"
        elif e.table == "investigators" and e.action == "DELETE":
            reason = "an investigator account was deleted"
        elif e.table == "detection_rules" and e.action == "UPDATE":
            reason = f"detection rule {(e.new or {}).get('rule_code', '')} was reconfigured"
            if (e.old or {}).get("is_enabled") == 1 and (e.new or {}).get("is_enabled") == 0:
                reason += " and DISABLED"
        elif (e.table == "ai_alerts" and e.action == "UPDATE" and (e.new or {}).get("status") == "DISMISSED"
              and (e.old or {}).get("severity") in ("HIGH", "CRITICAL")):
            reason = "a HIGH/CRITICAL alert was dismissed"
        if not reason:
            continue
        breakdown = [("rule SENSITIVE_MODIFICATION base score", int(rule["base_score"]))]
        breakdown += a.actor_bonus([e])
        if "DISABLED" in reason:
            breakdown.append(("a detector was switched off", 15))
        changes = [f"{k}: {json.dumps((e.old or {}).get(k))} -> {json.dumps((e.new or {}).get(k))}"
                   for k in sorted(e.changed) if k not in VERIFICATION_FIELDS][:4]
        summary = (f"{reason[0].upper() + reason[1:]} by {e.actor_name} at {_fmt(e.ts)} "
                   f"({e.table} #{e.record_id or '-'})" + (": " + "; ".join(changes) if changes else "") + ".")
        out.append(Finding("SENSITIVE_MODIFICATION", "RULE", f"Sensitive change: {reason}", summary, breakdown,
                           {"log_ids": [e.log_id], "table": e.table, "record_id": e.record_id},
                           f"log:{e.log_id}", e.ts, e.ts, case_id=e.case_id, investigator_id=e.investigator_id,
                           evidence_id=e.record_id if e.table == "evidence" else None))
    return out


def rule_repeated_record(a: Analysis) -> list[Finding]:
    rule = a.rule("REPEATED_RECORD_CHANGE")
    if not rule:
        return []
    thr, win = int(rule["threshold"]), int(rule["window_minutes"])
    groups: dict[tuple, list[Event]] = defaultdict(list)
    for e in a.events:
        if e.is_data_change and e.action in ("UPDATE", "DELETE") and not e.is_verification_refresh and e.record_id:
            groups[(e.table, e.record_id)].append(e)
    out = []
    for (tbl, rid), items in groups.items():
        for cl in _clusters(items, win):
            n = len(cl)
            if n < thr:
                continue
            fields = sorted(set().union(*(e.changed for e in cl)) - VERIFICATION_FIELDS)
            actors = sorted({e.actor_name for e in cl})
            breakdown = [("rule REPEATED_RECORD_CHANGE base score", int(rule["base_score"]))]
            if n > thr:
                breakdown.append((f"{n - thr} more changes than the threshold of {thr}", min(15, 5 * (n - thr))))
            breakdown += a.actor_bonus(cl)
            summary = (f"{tbl} record #{rid} was changed {n} times between {_fmt(cl[0].ts)} and {_fmt(cl[-1].ts)} "
                       f"by {', '.join(actors)} (threshold {thr} within {win} min); fields changed: "
                       f"{', '.join(fields) or 'n/a'}.")
            out.append(Finding("REPEATED_RECORD_CHANGE", "RULE", f"{tbl} #{rid} changed {n} times", summary,
                               breakdown, {"log_ids": [e.log_id for e in cl], "fields": fields},
                               f"{tbl}:{rid}:{cl[0].log_id}", cl[0].ts, cl[-1].ts,
                               case_id=_main_case(cl), investigator_id=cl[0].investigator_id,
                               evidence_id=rid if tbl == "evidence" else None))
    return out


def _actor_hour_buckets(a: Analysis) -> dict[tuple[str, dt.datetime], list[Event]]:
    buckets: dict[tuple[str, dt.datetime], list[Event]] = defaultdict(list)
    for e in a.events:
        if e.action in ("ANALYSIS_RUN", "AI_QUERY", "REPORT_GENERATED"):
            continue
        buckets[(e.actor_key, e.ts.replace(minute=0, second=0, microsecond=0))].append(e)
    return buckets


def _operations(evs: list[Event]) -> int:
    # one user action can write several audit rows at the same instant
    # (e.g. register evidence = evidence + custody + integrity rows)
    return len({e.ts for e in evs})


def rule_zscore(a: Analysis) -> list[Finding]:
    rule = a.rule("HIGH_ACTIVITY_ZSCORE")
    if not rule:
        return []
    thr = float(rule["threshold"])
    min_events = int((rule["params"] or {}).get("min_events", 5))
    buckets = _actor_hour_buckets(a)
    counts = {k: _operations(v) for k, v in buckets.items()}
    if len(counts) < 10:
        return []
    out = []
    values = list(counts.values())
    total, total_sq, n = sum(values), sum(v * v for v in values), len(values)
    for (actor, hour), c in counts.items():
        if c < min_events:
            continue
        m = (total - c) / (n - 1)                       # leave-one-out baseline
        var = max((total_sq - c * c) / (n - 1) - m * m, 0.0)
        sd = max(math.sqrt(var), 0.5)
        z = (c - m) / sd
        if z < thr:
            continue
        evs = buckets[(actor, hour)]
        breakdown = [("statistical HIGH_ACTIVITY_ZSCORE base score", int(rule["base_score"])),
                     (f"z-score {z:.1f} above threshold {thr:g}", int(min(20, 5 * (z - thr))))]
        breakdown += a.actor_bonus(evs)
        summary = (f"{evs[0].actor_name} performed {c} distinct operations in the hour starting {_fmt(hour)}; "
                   f"the typical actor-hour has {m:.1f} (std {sd:.1f}), so z = {z:.1f}.")
        out.append(Finding("HIGH_ACTIVITY_ZSCORE", "STATISTICAL", f"Unusually high activity by {evs[0].actor_name}",
                           summary, breakdown, {"log_ids": [e.log_id for e in evs], "z_score": round(z, 2),
                                                "baseline_mean": round(m, 2), "baseline_std": round(sd, 2),
                                                "operations": c},
                           f"{actor}:{hour.isoformat()}", evs[0].ts, evs[-1].ts,
                           case_id=_main_case(evs), investigator_id=evs[0].investigator_id))
    return out


FEATURES = ("operations", "deletes", "updates", "downloads", "logins", "high_risk", "tables", "off_hours")


def rule_isolation_forest(a: Analysis) -> list[Finding]:
    rule = a.rule("ISOLATION_FOREST")
    if not rule or not sklearn_available():
        return []
    from sklearn.ensemble import IsolationForest   # optional dependency

    buckets = _actor_hour_buckets(a)
    keys = list(buckets)
    if len(keys) < int((rule["params"] or {}).get("min_samples", 20)):
        return []
    rows = []
    for k in keys:
        evs = buckets[k]
        rows.append([_operations(evs), sum(e.action == "DELETE" for e in evs),
                     sum(e.action == "UPDATE" and not e.is_verification_refresh for e in evs),
                     sum(e.action == "EVIDENCE_DOWNLOAD" for e in evs), sum(e.action == "LOGIN" for e in evs),
                     sum(e.risk in ("HIGH", "CRITICAL") for e in evs), len({e.table for e in evs if e.table}),
                     int(a.off_hours(k[1]))])
    contamination = min(max(float(rule["threshold"]), 0.01), 0.5)
    model = IsolationForest(n_estimators=200, contamination=contamination, random_state=42)
    labels = model.fit_predict(rows)
    scores = model.score_samples(rows)            # lower = more anomalous
    med = [median(col) for col in zip(*rows)]
    lo, hi = min(scores), max(scores)
    out = []
    for k, lab, sc, feat in zip(keys, labels, scores, rows):
        if lab != -1 or feat[0] < 2:
            continue
        evs = buckets[k]
        strength = 0 if hi == lo else (hi - sc) / (hi - lo)       # 0..1
        unusual = [f"{FEATURES[i]}={feat[i]} (median {med[i]:g})" for i in range(len(FEATURES)) if feat[i] > med[i]]
        breakdown = [("ML ISOLATION_FOREST base score", int(rule["base_score"])),
                     (f"anomaly strength {strength:.2f}", int(round(25 * strength)))]
        summary = (f"The unsupervised IsolationForest model found the activity profile of {evs[0].actor_name} in the "
                   f"hour starting {_fmt(k[1])} unusual compared with all {len(keys)} actor-hours: "
                   + ", ".join(unusual[:5]) + ".")
        out.append(Finding("ISOLATION_FOREST", "ML", f"Unusual activity profile: {evs[0].actor_name}", summary,
                           breakdown, {"log_ids": [e.log_id for e in evs], "features": dict(zip(FEATURES, feat)),
                                       "model": "IsolationForest(n_estimators=200, random_state=42)",
                                       "contamination": contamination},
                           f"{k[0]}:{k[1].isoformat()}", evs[0].ts, evs[-1].ts,
                           case_id=_main_case(evs), investigator_id=evs[0].investigator_id))
    return out


RULES: list[Callable[[Analysis], list[Finding]]] = [
    rule_integrity, rule_repeated_delete, rule_bulk_update, rule_failed_logins, rule_off_hours,
    rule_direct_db, rule_sensitive, rule_repeated_record, rule_evidence_access, rule_zscore,
    rule_isolation_forest,
]


# ---------------------------------------------------------------------------
# persistence
# ---------------------------------------------------------------------------
UPSERT_SQL = text("""
    INSERT INTO ai_alerts (rule_code, detection_method, severity, risk_score, title, explanation,
                           supporting_facts, related_case_id, related_investigator_id, related_evidence_id,
                           fingerprint, first_event_at, last_event_at)
    VALUES (:rule, :method, fn_risk_level(:score), :score, :title, :explanation, :facts,
            :case_id, :inv, :ev, :fp, :first_at, :last_at) AS new
    ON DUPLICATE KEY UPDATE
        risk_score = new.risk_score, severity = new.severity, title = new.title,
        explanation = new.explanation, supporting_facts = new.supporting_facts,
        last_event_at = new.last_event_at""")


def persist(conn: Connection, findings: list[Finding]) -> dict:
    inserted = updated = 0
    existing = set()
    if findings:
        fps = {f"f{i}": f.fingerprint for i, f in enumerate(findings)}
        existing = set(conn.execute(text("SELECT fingerprint FROM ai_alerts WHERE fingerprint IN ("
                                         + ", ".join(f":{k}" for k in fps) + ")"), fps).scalars())
    for f in findings:
        facts = dict(f.facts)
        facts["score_breakdown"] = [{"factor": lbl, "points": pts} for lbl, pts in f.breakdown]
        res = conn.execute(UPSERT_SQL, {
            "rule": f.rule_code, "method": f.method, "score": f.score, "title": f.title[:200],
            "explanation": f.explanation, "facts": json.dumps(facts, default=str),
            "case_id": f.case_id, "inv": f.investigator_id, "ev": f.evidence_id,
            "fp": f.fingerprint, "first_at": f.first_at, "last_at": f.last_at})
        if f.fingerprint not in existing:
            inserted += 1
        elif res.rowcount == 2:
            updated += 1
    return {"inserted": inserted, "updated": updated}


def run_analysis(conn: Connection, lookback_days: int | None = None) -> dict:
    a = Analysis(conn, lookback_days or get_settings().analysis_lookback_days)
    findings: list[Finding] = []
    by_rule: dict[str, int] = {}
    for fn in RULES:
        try:
            got = fn(a)
        except Exception:                      # one faulty rule must not stop the others
            log.exception("detector rule %s failed", fn.__name__)
            got = []
        findings.extend(got)
        if got:
            by_rule[got[0].rule_code] = by_rule.get(got[0].rule_code, 0) + len(got)
    stats = persist(conn, findings)
    return {"events_analysed": len(a.events), "login_attempts_analysed": len(a.logins),
            "findings": len(findings), "new_alerts": stats["inserted"], "updated_alerts": stats["updated"],
            "by_rule": by_rule, "ml_available": sklearn_available(),
            "lookback_days": lookback_days or get_settings().analysis_lookback_days,
            "ran_at": dt.datetime.now().isoformat(sep=" ", timespec="seconds")}


def raise_integrity_alert(conn: Connection, evidence_id: int) -> int | None:
    """Immediately create/update the integrity alert for one evidence item."""
    a = Analysis(conn, get_settings().analysis_lookback_days)
    findings = rule_integrity(a, only_evidence=evidence_id)
    if not findings:
        return None
    persist(conn, findings)
    return conn.execute(text("SELECT alert_id FROM ai_alerts WHERE fingerprint = :f"),
                        {"f": findings[0].fingerprint}).scalar()
