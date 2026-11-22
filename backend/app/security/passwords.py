"""Password hashing with bcrypt (adaptive, salted, cost factor 12)."""
from __future__ import annotations

import hashlib
import base64

import bcrypt

_ROUNDS = 12
# A real bcrypt hash of a random value, used to keep login timing similar
# when the e-mail does not exist (prevents account enumeration by timing).
_DUMMY_HASH = bcrypt.hashpw(b"ghost-hunter-dummy", bcrypt.gensalt(_ROUNDS))


def _prepare(password: str) -> bytes:
    raw = password.encode("utf-8")
    # bcrypt only uses the first 72 bytes; pre-hash longer passwords
    if len(raw) > 72:
        raw = base64.b64encode(hashlib.sha256(raw).digest())
    return raw


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prepare(password), bcrypt.gensalt(_ROUNDS)).decode("ascii")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        bcrypt.checkpw(_prepare(password), _DUMMY_HASH)
        return False
    try:
        return bcrypt.checkpw(_prepare(password), password_hash.encode("ascii"))
    except ValueError:
        return False


def password_problems(password: str) -> list[str]:
    problems = []
    if len(password) < 10:
        problems.append("at least 10 characters")
    if not any(c.isupper() for c in password):
        problems.append("an upper-case letter")
    if not any(c.islower() for c in password):
        problems.append("a lower-case letter")
    if not any(c.isdigit() for c in password):
        problems.append("a digit")
    if not any(not c.isalnum() for c in password):
        problems.append("a symbol")
    return problems
