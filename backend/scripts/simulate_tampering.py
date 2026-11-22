"""DEMONSTRATION HELPER - simulates an attacker editing a stored evidence file
directly on disk (outside the application), so you can show that SHA-256
verification detects it.

    python backend/scripts/simulate_tampering.py 3          # tamper evidence 3
    python backend/scripts/simulate_tampering.py 3 --restore

It only changes the FILE. The database is not touched, exactly like a real
file-system attack - nothing in MySQL "knows" until someone clicks Verify.
--restore puts back the copy saved before tampering (verification then
returns VERIFIED again, and the history still shows the earlier failure).
"""
from __future__ import annotations

import argparse
import shutil
import stat
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import pymysql  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.utils.files import resolve_stored  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("evidence_id", type=int)
    ap.add_argument("--restore", action="store_true")
    a = ap.parse_args()
    s = get_settings()
    conn = pymysql.connect(host=s.db_host, port=s.db_port, user=s.db_app_user, password=s.db_app_password,
                           database=s.db_name)
    with conn.cursor() as c:     # read-only lookup of where the file is stored
        c.execute("SELECT file_path, evidence_type FROM evidence WHERE evidence_id = %s", (a.evidence_id,))
        row = c.fetchone()
    conn.close()
    if not row:
        print("No such evidence"); return 1
    path = resolve_stored(s.storage_dir, row[0])
    if path is None or not path.exists():
        print(f"Stored file not found: {path}"); return 1
    backup = path.with_name(path.name + ".original")
    path.chmod(path.stat().st_mode | stat.S_IWRITE)
    if a.restore:
        if not backup.exists():
            print("No backup to restore"); return 1
        shutil.copyfile(backup, path)
        backup.unlink()
        print(f"Restored original content of {path.name}")
        return 0
    if not backup.exists():
        shutil.copyfile(path, backup)
    with open(path, "ab") as f:
        if row[1] in ("TXT", "CSV", "LOG", "JSON"):
            f.write(b"\n9999,INSERTED BY ATTACKER\n" if row[1] == "CSV" else b"\n[tampered] line appended\n")
        else:
            f.write(b"\n% tampered\n")      # trailing bytes keep PDF/PNG/JPEG viewable
    print(f"Tampered with {path} (backup: {backup.name}). Now click 'Verify integrity' in the app.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
