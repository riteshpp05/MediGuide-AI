# ══════════════════════════════════════════════════════════════
# MediGuide AI — Production Dockerfile (FastAPI + React 2.0)
# ══════════════════════════════════════════════════════════════
# Multi-stage build:
# Stage 1: Build React SPA (Node 20 Alpine)
# Stage 2: Python dependencies (PyTorch CPU-only)
# Stage 3: Minimal runtime container
# ══════════════════════════════════════════════════════════════

# ── Stage 1: React Frontend Builder ──────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend-react/package.json frontend-react/package-lock.json* ./
RUN npm install
COPY frontend-react/ ./
RUN npm run build

# ── Stage 2: Python Dependencies Builder ─────────────────────
FROM python:3.11-slim AS python-builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# ── Stage 3: Runtime ─────────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL maintainer="Ritesh <riteshpp05@gmail.com>" \
      org.opencontainers.image.title="MediGuide AI" \
      org.opencontainers.image.description="Medical RAG Chatbot with React UI & Clinical Reasoning" \
      org.opencontainers.image.version="2.0.0"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HF_HOME=/home/mediguide/.cache/huggingface

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=python-builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN groupadd --gid 1000 mediguide && \
    useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash mediguide

WORKDIR /home/mediguide/app

# Copy Python application code
COPY --chown=mediguide:mediguide .env.example ./.env.example
COPY --chown=mediguide:mediguide requirements.txt ./requirements.txt
COPY --chown=mediguide:mediguide backend.py ./backend.py
COPY --chown=mediguide:mediguide server.py ./server.py

# Copy pre-built FAISS index
COPY --chown=mediguide:mediguide faiss_index/ ./faiss_index/

# Copy React production build from Stage 1
COPY --from=frontend-builder --chown=mediguide:mediguide /app/dist ./frontend-react/dist

RUN mkdir -p /home/mediguide/app/logs && \
    mkdir -p /home/mediguide/.cache/huggingface && \
    chown -R mediguide:mediguide /home/mediguide

USER mediguide

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:8000/api/health || exit 1

CMD ["python", "server.py"]
