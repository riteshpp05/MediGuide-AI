# ══════════════════════════════════════════════════════════════
# MediGuide AI — Production Dockerfile (Optimized)
# ══════════════════════════════════════════════════════════════
# Multi-stage, optimized build for a Streamlit + LangChain app
# Target: Linux/amd64 | Python 3.11 slim
# Optimization: Forces CPU-only PyTorch to save ~5 GB of space.
# ══════════════════════════════════════════════════════════════

# ── Stage 1: Builder ─────────────────────────────────────────
FROM python:3.11-slim AS builder

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

# OPTIMIZATION: Explicitly install CPU-only version of PyTorch first.
# If we don't do this, sentence-transformers will pull the massive CUDA binaries.
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt


# ── Stage 2: Runtime ─────────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL maintainer="Ritesh <riteshpp05@gmail.com>" \
      org.opencontainers.image.title="MediGuide AI" \
      org.opencontainers.image.description="Medical RAG Chatbot with Clinical Reasoning" \
      org.opencontainers.image.version="2.0.0" \
      org.opencontainers.image.source="https://github.com/riteshpp05/MediGuide-AI"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/home/mediguide/.cache/huggingface

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN groupadd --gid 1000 mediguide && \
    useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash mediguide

WORKDIR /home/mediguide/app

# Copy application source code
COPY --chown=mediguide:mediguide .streamlit/ ./.streamlit/
COPY --chown=mediguide:mediguide .env.example ./.env.example
COPY --chown=mediguide:mediguide requirements.txt ./requirements.txt
COPY --chown=mediguide:mediguide backend.py ./backend.py
COPY --chown=mediguide:mediguide frontend.py ./frontend.py

# Copy pre-built FAISS index
COPY --chown=mediguide:mediguide faiss_index/ ./faiss_index/

# OPTIMIZATION: Removed COPY data/ and COPY evaluation/
# They are not needed for runtime and just bloat the image.

RUN mkdir -p /home/mediguide/app/logs && \
    mkdir -p /home/mediguide/.cache/huggingface && \
    chown -R mediguide:mediguide /home/mediguide

USER mediguide

ENV STREAMLIT_SERVER_HEADLESS=true \
    STREAMLIT_SERVER_ADDRESS=0.0.0.0 \
    STREAMLIT_SERVER_PORT=8501 \
    STREAMLIT_BROWSER_GATHER_USAGE_STATS=false

EXPOSE 8501

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl --fail http://localhost:8501/_stcore/health || exit 1

ENTRYPOINT ["streamlit", "run", "frontend.py", \
    "--server.maxUploadSize=50", \
    "--server.fileWatcherType=none"]
