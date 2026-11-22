#!/bin/bash
set -e

echo "=========================================================="
echo "  SQL Ghost Hunter - Digital Forensics Container Engine   "
echo "=========================================================="

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_ADMIN_USER="${DB_ADMIN_USER:-root}"
DB_ADMIN_PASSWORD="${DB_ADMIN_PASSWORD:-}"
DB_NAME="${DB_NAME:-ghost_hunter}"

echo "[*] Waiting for MySQL database at ${DB_HOST}:${DB_PORT}..."

# Wait for MySQL service to accept connections
python - << 'EOF'
import sys
import time
import pymysql
import os

host = os.environ.get("DB_HOST", "mysql")
port = int(os.environ.get("DB_PORT", "3306"))
user = os.environ.get("DB_ADMIN_USER", "root")
password = os.environ.get("DB_ADMIN_PASSWORD", "")

deadline = time.time() + 90
connected = False
while time.time() < deadline:
    try:
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            connect_timeout=3,
            autocommit=True
        )
        conn.close()
        connected = True
        print(f"[+] Successfully reached MySQL server at {host}:{port}")
        break
    except Exception as exc:
        print(f"[-] Waiting for MySQL... ({exc})")
        time.sleep(2)

if not connected:
    print("[!] FATAL: Could not establish connection to MySQL within timeout.", file=sys.stderr)
    sys.exit(1)
EOF

# Verify or initialize schema
echo "[*] Checking database schema status for '${DB_NAME}'..."
python - << 'EOF'
import sys
import pymysql
import os
import subprocess

host = os.environ.get("DB_HOST", "mysql")
port = int(os.environ.get("DB_PORT", "3306"))
user = os.environ.get("DB_ADMIN_USER", "root")
password = os.environ.get("DB_ADMIN_PASSWORD", "")
db_name = os.environ.get("DB_NAME", "ghost_hunter")

try:
    conn = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        connect_timeout=5,
        autocommit=True
    )
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=%s", (db_name,))
        table_count = cur.fetchone()[0]
    conn.close()

    if table_count < 10:
        print(f"[*] Schema '{db_name}' requires initialization ({table_count} tables found). Running setup_database.py...")
        subprocess.run([sys.executable, "backend/scripts/setup_database.py", "--yes"], check=True)
        print("[+] Schema initialization complete.")
    else:
        print(f"[+] Schema '{db_name}' already initialized with {table_count} tables.")
except Exception as exc:
    print(f"[!] Notice during schema check: {exc}. Attempting setup...")
    subprocess.run([sys.executable, "backend/scripts/setup_database.py", "--yes"], check=True)
EOF

echo "[+] Starting SQL Ghost Hunter server..."
exec "$@"
