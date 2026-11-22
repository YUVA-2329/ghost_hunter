"""Evidence file validation, safe storage and SHA-256 hashing."""
from __future__ import annotations

import hashlib
import json
import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

CHUNK = 1024 * 1024

# extension -> evidence_type (must match chk_evidence_type in the schema)
ALLOWED_EXTENSIONS = {
    ".pdf": "PDF", ".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG",
    ".txt": "TXT", ".csv": "CSV", ".json": "JSON", ".log": "LOG",
}
TEXT_TYPES = {"TXT", "CSV", "JSON", "LOG"}
MEDIA_TYPES = {
    "PDF": "application/pdf", "PNG": "image/png", "JPEG": "image/jpeg",
    "TXT": "text/plain", "CSV": "text/csv", "JSON": "application/json", "LOG": "text/plain",
}


class FileRejected(ValueError):
    pass


@dataclass
class StoredFile:
    relative_path: str     # stored in evidence.file_path, e.g. evidence/3f2a....pdf
    absolute_path: Path
    evidence_type: str
    size: int
    sha256: str
    display_name: str


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(CHUNK), b""):
            h.update(chunk)
    return h.hexdigest()


def sanitize_display_name(name: str | None) -> str:
    """Keep only the base name and safe characters - the original name is
    shown to users but NEVER used as a path on disk."""
    base = re.split(r"[\\/]", name or "")[-1]
    base = re.sub(r"[^\w.\- ()]+", "_", base).strip(" .")
    return (base or "evidence")[:200]


def detect_type(extension: str, head: bytes) -> str:
    """Validate that the file content matches its extension (magic bytes)."""
    ext = extension.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise FileRejected(f"File type '{ext or 'none'}' is not allowed. Allowed: "
                           + ", ".join(sorted(ALLOWED_EXTENSIONS)))
    etype = ALLOWED_EXTENSIONS[ext]
    if etype == "PDF" and not head.startswith(b"%PDF-"):
        raise FileRejected("Content is not a valid PDF document")
    if etype == "PNG" and not head.startswith(b"\x89PNG\r\n\x1a\n"):
        raise FileRejected("Content is not a valid PNG image")
    if etype == "JPEG" and not head.startswith(b"\xff\xd8\xff"):
        raise FileRejected("Content is not a valid JPEG image")
    if etype in TEXT_TYPES:
        if b"\x00" in head:
            raise FileRejected("Text evidence must not contain binary data")
        try:
            head.decode("utf-8")
        except UnicodeDecodeError as exc:
            # a multi-byte character may be cut at the end of the sample
            if exc.start < len(head) - 4:
                raise FileRejected("Text evidence must be UTF-8 encoded") from exc
    return etype


def resolve_stored(storage_dir: Path, relative_path: str) -> Path | None:
    """Map a stored relative path to an absolute path INSIDE storage_dir."""
    root = Path(storage_dir).resolve()
    candidate = (root / relative_path).resolve()
    if root not in candidate.parents:
        return None
    return candidate


def store_upload(stream: BinaryIO, original_name: str | None, storage_dir: Path, max_bytes: int) -> StoredFile:
    """Stream an upload to disk while hashing it; validate size and content.

    The file is written under a random name (uuid) in storage/evidence, so a
    user-supplied file name can never overwrite or escape the folder.
    """
    display = sanitize_display_name(original_name)
    ext = os.path.splitext(display)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise FileRejected(f"File type '{ext or 'none'}' is not allowed. Allowed: "
                           + ", ".join(sorted(ALLOWED_EXTENSIONS)))
    evidence_dir = Path(storage_dir) / "evidence"
    tmp_dir = Path(storage_dir) / "tmp"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    name = f"{uuid.uuid4().hex}{ext}"
    tmp_path = tmp_dir / (name + ".part")
    h = hashlib.sha256()
    size = 0
    head = b""
    try:
        with open(tmp_path, "wb") as out:
            while True:
                chunk = stream.read(CHUNK)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    raise FileRejected(f"File exceeds the maximum size of {max_bytes // (1024 * 1024)} MB")
                if len(head) < 8192:
                    head += chunk[: 8192 - len(head)]
                h.update(chunk)
                out.write(chunk)
        if size == 0:
            raise FileRejected("The file is empty")
        etype = detect_type(ext, head)
        if etype == "JSON" and size <= 5 * 1024 * 1024:
            try:
                json.loads(tmp_path.read_text(encoding="utf-8-sig"))
            except (ValueError, UnicodeDecodeError) as exc:
                raise FileRejected("JSON evidence is not valid JSON") from exc
        final = evidence_dir / name
        os.replace(tmp_path, final)
        try:
            os.chmod(final, 0o440)   # read-only on POSIX; best effort on Windows
        except OSError:
            pass
        return StoredFile(f"evidence/{name}", final, etype, size, h.hexdigest(), display)
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
