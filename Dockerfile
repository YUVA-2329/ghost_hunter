# ==============================================================================
# SQL Ghost Hunter - Production Container Image
# Multi-stage / Optimized Python 3.11-slim container
# ==============================================================================

FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies (curl for healthchecks, default-mysql-client for db diagnosis)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    default-mysql-client \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install python packages
COPY requirements.txt /app/
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy application directories and files
COPY backend /app/backend
COPY frontend /app/frontend
COPY sql /app/sql
COPY sample_evidence /app/sample_evidence
COPY docs /app/docs
COPY run.py /app/run.py
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

# Ensure storage directories exist, entrypoint is executable and has LF line endings
RUN mkdir -p /app/storage/evidence /app/storage/reports && \
    chmod +x /app/docker-entrypoint.sh

# Create non-root system user for defense-in-depth security
RUN useradd -u 1000 -m -s /bin/bash ghosthunter && \
    chown -R ghosthunter:ghosthunter /app

USER ghosthunter

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["python", "run.py"]
