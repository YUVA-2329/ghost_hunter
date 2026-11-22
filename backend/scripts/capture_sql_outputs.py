"""Run a demonstration SQL script and write the ACTUAL results back into it.

Every statement followed by an output block

    -- [[OUTPUT]]
    -- [[/OUTPUT]]

gets that block replaced with the real result produced by MySQL, so the
"sample output" in the SQL files is genuine. Run it again at any time:

    python backend/scripts/capture_sql_outputs.py sql/05_joins.sql

Uses the ROOT/admin credentials from .env (DB_ADMIN_USER / DB_ADMIN_PASSWORD).
"""
from __future__ import annotations

import datetime as dt
import decimal
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import pymysql  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.utils.sql_script import split_sql  # noqa: E402

BLOCK_RE = re.compile(r"-- \[\[OUTPUT\]\]\n(?:--.*\n)*?-- \[\[/OUTPUT\]\]\n?")
MAX_ROWS = 15
MAX_CELL = 64


def _cell(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, (bytes, bytearray)):
        v = v.decode("utf-8", "replace")
    if isinstance(v, (dt.datetime, dt.date)):
        v = v.isoformat(sep=" ") if isinstance(v, dt.datetime) else v.isoformat()
    if isinstance(v, decimal.Decimal):
        v = format(v, "f")
    s = str(v).replace("\n", " ")
    return s if len(s) <= MAX_CELL else s[: MAX_CELL - 3] + "..."


def format_result(cur) -> list[str]:
    lines: list[str] = []
    while True:
        if cur.description:
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            shown = [[_cell(v) for v in r] for r in rows[:MAX_ROWS]]
            widths = [max([len(c)] + [len(r[k]) for r in shown]) for k, c in enumerate(cols)]
            sep = "+" + "+".join("-" * (w + 2) for w in widths) + "+"
            lines.append(sep)
            lines.append("| " + " | ".join(c.ljust(w) for c, w in zip(cols, widths)) + " |")
            lines.append(sep)
            for r in shown:
                lines.append("| " + " | ".join(v.ljust(w) for v, w in zip(r, widths)) + " |")
            lines.append(sep)
            more = f" (showing first {MAX_ROWS})" if len(rows) > MAX_ROWS else ""
            lines.append(f"{len(rows)} row(s){more}")
        else:
            lines.append(f"Query OK, {max(cur.rowcount, 0)} row(s) affected")
        if not cur.nextset():
            break
    return lines


def run(path: Path) -> None:
    s = get_settings()
    text = path.read_text(encoding="utf-8")
    stmts = split_sql(text)
    conn = pymysql.connect(host=s.db_host, port=s.db_port, user=s.db_admin_user,
                           password=s.db_admin_password, autocommit=True, charset="utf8mb4")
    outputs: dict[int, list[str]] = {}
    with conn.cursor() as cur:
        for k, st in enumerate(stmts):
            if re.match(r"(?i)^USE\s", st.sql):
                cur.execute(re.sub(r"\bghost_hunter\b", s.db_name, st.sql))
                continue
            try:
                cur.execute(st.sql)
                outputs[k] = format_result(cur)
            except pymysql.MySQLError as exc:
                outputs[k] = [f"ERROR {exc.args[0]}: {exc.args[1]}"]
    conn.close()

    # replace each output block with the output of the statement just before it
    pieces, last = [], 0
    for m in BLOCK_RE.finditer(text):
        prev = [k for k, st in enumerate(stmts) if st.end <= m.start()]
        body = outputs.get(prev[-1], ["(no result)"]) if prev else ["(no statement)"]
        block = "-- [[OUTPUT]]\n" + "".join(f"--   {line}\n" for line in body) + "-- [[/OUTPUT]]\n"
        pieces.append(text[last:m.start()])
        pieces.append(block)
        last = m.end()
    pieces.append(text[last:])
    path.write_text("".join(pieces), encoding="utf-8")
    errors = sum(1 for v in outputs.values() if v and v[0].startswith("ERROR"))
    print(f"{path.name}: {len(stmts)} statements, {len(outputs)} results captured, {errors} error(s)")


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        run(Path(arg))
