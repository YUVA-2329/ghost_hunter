# Contributing to SQL Ghost Hunter

Thank you for your interest in contributing to **SQL Ghost Hunter**!

Whether you are fixing a bug, adding new educational SQL queries, extending the AI anomaly detectors, or refining the liquid glass UI, your contributions are welcome.

---

## 1. Development Environment Setup

### Prerequisites
- **Python 3.10+** (Tested on Python 3.10, 3.11, 3.12, 3.13)
- **MySQL Server 8.0+** (or Docker Desktop)
- **Git**

### Clone and Install
```bash
# Clone the repository
git clone https://github.com/your-username/sql-ghost-hunter.git
cd sql-ghost-hunter

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your local MySQL credentials
```

---

## 2. Coding Standards

- **Python:**
  - Follow PEP 8 guidelines.
  - Type annotations are encouraged for all service functions and FastAPI endpoints.
  - Do NOT use raw string interpolation for SQL queries; always use bound parameters via SQLAlchemy Core (`:param`).
- **SQL:**
  - Database schema and trigger modifications must be backward compatible and placed in numbered migrations in `sql/`.
  - Maintain trigger immutability: the audit trail must remain strictly append-only.
- **Frontend:**
  - Standard ES modules without heavy frameworks or build steps.
  - Zero CDN dependencies: all assets must remain bundled locally in `frontend/assets/vendor/` to allow full offline air-gapped forensic operation.

---

## 3. Running the Test Suite

Before submitting a Pull Request, verify that all automated unit, integration, and security tests pass:

```bash
# Run the complete test suite
python -m pytest tests -v

# Run with coverage (optional)
python -m pytest tests --cov=backend/app -v
```

All 41 tests must pass cleanly.

---

## 4. Pull Request Workflow

1. **Fork the Repository:** Create your feature branch (`git checkout -b feature/forensic-timeline-enhancement`).
2. **Commit Changes:** Use clear, descriptive commit messages adhering to Conventional Commits:
   - `feat: add automated integrity batch re-verification`
   - `fix: resolve race condition in custody transfer logging`
   - `docs: update Viva defense questions for triggers`
3. **Verify Health Endpoint:** Verify that `GET /api/health` reports `HEALTHY` or `DEGRADED` (if Ollama is offline) with all components operational.
4. **Push and Open PR:** Push your branch to GitHub and open a Pull Request using the standard PR template.
