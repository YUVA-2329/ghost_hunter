"""Test fixtures. Tests run against a SEPARATE database (ghost_hunter_test by
default) and a temporary evidence folder, so your demo data is untouched.
Requires a running MySQL 8 server and the admin credentials in .env."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TEST_DB = os.environ.get("GH_TEST_DB", "ghost_hunter_test")
STORAGE = Path(tempfile.mkdtemp(prefix="gh_storage_"))

os.environ["DB_NAME"] = TEST_DB
os.environ["STORAGE_DIR"] = str(STORAGE)
os.environ["AUTO_ANALYSIS_MINUTES"] = "0"
os.environ["OLLAMA_URL"] = "http://127.0.0.1:9"      # nothing listens there -> offline mode
sys.path.insert(0, str(ROOT / "backend"))

H = {"X-Requested-With": "GhostHunter"}
ACCOUNTS = {
    "admin": ("admin@ghosthunter.local", "Admin@Ghost2026"),
    "lead": ("vikram.mehta@ghosthunter.local", "Lead@Ghost2026"),
    "priya": ("priya.sharma@ghosthunter.local", "Priya@Ghost2026"),
    "rahul": ("rahul.verma@ghosthunter.local", "Rahul@Ghost2026"),
    "auditor": ("meera.iyer@ghosthunter.local", "Audit@Ghost2026"),
}


@pytest.fixture(scope="session", autouse=True)
def database():
    r = subprocess.run([sys.executable, str(ROOT / "backend" / "scripts" / "setup_database.py"), "--yes",
                        "--database", TEST_DB], capture_output=True, text=True, env=os.environ.copy())
    assert r.returncode == 0, r.stdout + r.stderr
    yield
    shutil.rmtree(STORAGE, ignore_errors=True)


@pytest.fixture(scope="session")
def app(database):
    from app.main import app as fastapi_app
    return fastapi_app


def _client(app, who: str):
    from fastapi.testclient import TestClient
    c = TestClient(app)
    email, pw = ACCOUNTS[who]
    r = c.post("/api/auth/login", json={"email": email, "password": pw}, headers=H)
    assert r.status_code == 200, r.text
    c.headers.update(H)
    return c


@pytest.fixture
def client_for(app):
    made = []

    def make(who: str):
        c = _client(app, who)
        made.append(c)
        return c
    yield make
    for c in made:
        c.close()


@pytest.fixture
def admin_db():
    """Privileged connection WITHOUT application identity (like MySQL Workbench)."""
    import pymysql
    from app.config import get_settings
    s = get_settings()
    conn = pymysql.connect(host=s.db_host, port=s.db_port, user=s.db_admin_user, password=s.db_admin_password,
                           database=TEST_DB, autocommit=True, cursorclass=pymysql.cursors.DictCursor)
    yield conn
    conn.close()


@pytest.fixture
def app_db():
    """Connection as the least-privilege application account."""
    import pymysql
    from app.config import get_settings
    s = get_settings()
    conn = pymysql.connect(host=s.db_host, port=s.db_port, user=s.db_app_user, password=s.db_app_password,
                           database=TEST_DB, autocommit=True, cursorclass=pymysql.cursors.DictCursor)
    yield conn
    conn.close()


def make_pdf(text: str) -> bytes:
    content = f"BT /F1 12 Tf 50 780 Td ({text}) Tj ET"
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
            "/Resources << /Font << /F1 5 0 R >> >> >>",
            f"<< /Length {len(content)} >>\nstream\n{content}\nendstream",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    b = b"%PDF-1.4\n"
    offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(b))
        b += f"{i} 0 obj\n{o}\nendobj\n".encode()
    x = len(b)
    b += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    b += "".join(f"{o:010d} 00000 n \n" for o in offs).encode()
    b += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n".encode()
    return b
