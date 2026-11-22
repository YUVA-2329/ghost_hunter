"""Split a MySQL script into individual statements.

Understands the client-side ``DELIMITER`` command (needed for stored
procedures and triggers), quoted strings, back-ticked identifiers and
``--`` / ``#`` / ``/* */`` comments. Used by ``scripts/setup_database.py`` so
the SQL files can be installed on Windows without the ``mysql`` CLI.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

_DELIM_RE = re.compile(r"[ \t]*DELIMITER[ \t]+(\S+)[ \t]*(?:\r?\n|$)", re.IGNORECASE)


@dataclass
class Statement:
    sql: str      # statement text without the trailing delimiter
    start: int    # index in the original script where the statement starts
    end: int      # index just after the delimiter


def split_sql(script: str) -> list[Statement]:
    out: list[Statement] = []
    delim = ";"
    i, n = 0, len(script)
    start: int | None = None
    at_line_start = True
    while i < n:
        ch = script[i]
        # DELIMITER command (only valid at the start of a line, outside a statement)
        if at_line_start and start is None:
            m = _DELIM_RE.match(script, i)
            if m:
                delim = m.group(1)
                i = m.end()
                at_line_start = True
                continue
        # comments
        if script.startswith("--", i) and (i + 2 >= n or script[i + 2] in " \t\r\n"):
            j = script.find("\n", i)
            i = n if j == -1 else j + 1
            at_line_start = True
            continue
        if ch == "#":
            j = script.find("\n", i)
            i = n if j == -1 else j + 1
            at_line_start = True
            continue
        if script.startswith("/*", i):
            j = script.find("*/", i + 2)
            if start is None:
                start = i if script.startswith("/*!", i) else None
            i = n if j == -1 else j + 2
            at_line_start = False
            continue
        # quoted text
        if ch in ("'", '"', "`"):
            if start is None:
                start = i
            q = ch
            i += 1
            while i < n:
                c = script[i]
                if c == "\\" and q != "`":
                    i += 2
                    continue
                if c == q:
                    if i + 1 < n and script[i + 1] == q:  # doubled quote
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            at_line_start = False
            continue
        # delimiter
        if script.startswith(delim, i):
            if start is not None:
                sql = script[start:i].strip()
                if sql:
                    out.append(Statement(sql, start, i + len(delim)))
            start = None
            i += len(delim)
            at_line_start = False
            continue
        if ch == "\n":
            at_line_start = True
        elif not ch.isspace():
            if start is None:
                start = i
            at_line_start = False
        i += 1
    if start is not None:
        sql = script[start:].strip()
        if sql:
            out.append(Statement(sql, start, n))
    return out
