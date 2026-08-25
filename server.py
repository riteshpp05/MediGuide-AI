import os
import sys
import json
import uuid
import time
import asyncio
import logging
import sqlite3
from typing import Optional, Dict, Any, List
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, AIMessage

# Import backend orchestration
from backend import (
    chatbot,
    retrieve_all_threads,
    delete_thread as backend_delete_thread,
    check_system_health,
    get_cache_stats,
    clear_cache,
    extract_entities,
    detect_emergency,
    build_patient_summary,
    get_retriever,
    get_llm,
    FAISS_INDEX_DIR,
    EMBEDDING_MODEL,
    GROQ_MODEL,
    PROMPT_VERSION,
)

# Logger setup
logger = logging.getLogger("mediguide_server")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

app = FastAPI(
    title="MediGuide AI — Clinical Intelligence API",
    description="High-performance backend API with SSE streaming, clinical reasoning, and LangGraph memory persistence",
    version="2.0.0"
)

# Enable CORS for React frontend (Vite default :3000, :5173, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────
# THREAD METADATA PERSISTENCE (SQLite)
# ──────────────────────────────────────────────────────────────
_meta_conn = sqlite3.connect("threads_meta.db", check_same_thread=False)
_meta_conn.execute("""
    CREATE TABLE IF NOT EXISTS threads_meta (
        thread_id   TEXT PRIMARY KEY,
        title       TEXT,
        is_pinned   INTEGER DEFAULT 0,
        created_at  TEXT,
        updated_at  TEXT
    )
""")
_meta_conn.commit()


def get_or_create_thread_meta(thread_id: str, default_title: str = "New Consultation") -> dict:
    row = _meta_conn.execute(
        "SELECT thread_id, title, is_pinned, created_at, updated_at FROM threads_meta WHERE thread_id = ?",
        (thread_id,)
    ).fetchone()
    now_iso = datetime.utcnow().isoformat()
    if row:
        return {
            "thread_id": row[0],
            "title": row[1],
            "is_pinned": bool(row[2]),
            "created_at": row[3],
            "updated_at": row[4],
        }
    else:
        _meta_conn.execute(
            "INSERT INTO threads_meta (thread_id, title, is_pinned, created_at, updated_at) VALUES (?, ?, 0, ?, ?)",
            (thread_id, default_title, now_iso, now_iso)
        )
        _meta_conn.commit()
        return {
            "thread_id": thread_id,
            "title": default_title,
            "is_pinned": False,
            "created_at": now_iso,
            "updated_at": now_iso,
        }


def update_thread_meta(thread_id: str, title: Optional[str] = None, is_pinned: Optional[bool] = None):
    now_iso = datetime.utcnow().isoformat()
    if title is not None and is_pinned is not None:
        _meta_conn.execute(
            "UPDATE threads_meta SET title = ?, is_pinned = ?, updated_at = ? WHERE thread_id = ?",
            (title, 1 if is_pinned else 0, now_iso, thread_id)
        )
    elif title is not None:
        _meta_conn.execute(
            "UPDATE threads_meta SET title = ?, updated_at = ? WHERE thread_id = ?",
            (title, now_iso, thread_id)
        )
    elif is_pinned is not None:
        _meta_conn.execute(
            "UPDATE threads_meta SET is_pinned = ?, updated_at = ? WHERE thread_id = ?",
            (1 if is_pinned else 0, now_iso, thread_id)
        )
    _meta_conn.commit()


# ──────────────────────────────────────────────────────────────
# SCHEMAS
# ──────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    patient_context: Optional[Dict[str, Any]] = None

class ThreadUpdate(BaseModel):
    title: Optional[str] = None
    is_pinned: Optional[bool] = None

class SettingsUpdate(BaseModel):
    groq_api_key: Optional[str] = None
    tavily_api_key: Optional[str] = None
    model: Optional[str] = None

class TriageRequest(BaseModel):
    text: str


# ──────────────────────────────────────────────────────────────
# SYSTEM HEALTH & TELEMETRY
# ──────────────────────────────────────────────────────────────
@app.get("/api/health")
def api_health():
    """Retrieve complete system diagnostic health report."""
    health_data = check_system_health()
    return health_data


@app.get("/api/knowledge-base/info")
def api_knowledge_base_info():
    """Inspect knowledge base vector store stats and documents."""
    data_files = []
    if os.path.exists("data"):
        for f in os.listdir("data"):
            fp = os.path.join("data", f)
            if os.path.isfile(fp):
                data_files.append({
                    "name": f,
                    "size_mb": round(os.path.getsize(fp) / (1024 * 1024), 2),
                    "modified": datetime.fromtimestamp(os.path.getmtime(fp)).strftime("%Y-%m-%d %H:%M:%S")
                })

    index_exists = os.path.exists(FAISS_INDEX_DIR)
    index_files = []
    index_size_mb = 0.0
    if index_exists:
        for f in os.listdir(FAISS_INDEX_DIR):
            fp = os.path.join(FAISS_INDEX_DIR, f)
            sz = os.path.getsize(fp) / (1024 * 1024)
            index_size_mb += sz
            index_files.append({"name": f, "size_mb": round(sz, 2)})

    return {
        "status": "ready" if index_exists else "missing_index",
        "embedding_model": EMBEDDING_MODEL,
        "index_dir": FAISS_INDEX_DIR,
        "total_index_size_mb": round(index_size_mb, 2),
        "source_documents": data_files,
        "index_files": index_files,
        "reranker": "ms-marco-MiniLM-L-6-v2 (CrossEncoder)",
        "pipeline_version": PROMPT_VERSION,
    }


# ──────────────────────────────────────────────────────────────
# CACHE ENDPOINTS
# ──────────────────────────────────────────────────────────────
@app.get("/api/cache/stats")
def api_cache_stats():
    """Get smart SQLite answer cache statistics."""
    return get_cache_stats()


@app.post("/api/cache/clear")
def api_cache_clear():
    """Purge answer cache."""
    success = clear_cache()
    return {"success": success, "message": "Cache successfully cleared" if success else "Failed to clear cache"}


# ──────────────────────────────────────────────────────────────
# CONVERSATION THREAD MANAGEMENT
# ──────────────────────────────────────────────────────────────
def get_thread_details(thread_id: str):
    """Retrieve metadata and message count for a thread."""
    messages = []
    try:
        config = {"configurable": {"thread_id": thread_id}}
        state = chatbot.get_state(config)
        if state and state.values and "messages" in state.values:
            for msg in state.values["messages"]:
                if hasattr(msg, "content") and msg.content:
                    role = "user" if isinstance(msg, HumanMessage) else "assistant"
                    messages.append({"role": role, "content": msg.content})
    except Exception as e:
        logger.warning("Error fetching thread %s: %s", thread_id, e)

    meta = get_or_create_thread_meta(thread_id)
    
    # Auto-generate title if default and user messages exist
    title = meta["title"]
    if title == "New Consultation" and messages:
        first_user_msg = next((m["content"] for m in messages if m["role"] == "user"), None)
        if first_user_msg:
            cleaned = first_user_msg.strip().replace("\n", " ")
            title = cleaned[:36] + ("…" if len(cleaned) > 36 else "")
            update_thread_meta(thread_id, title=title)
            meta["title"] = title

    preview = messages[-1]["content"][:100] + "…" if messages else "No messages yet"

    return {
        "id": thread_id,
        "title": meta["title"],
        "is_pinned": meta["is_pinned"],
        "created_at": meta["created_at"],
        "updated_at": meta["updated_at"],
        "message_count": len(messages),
        "preview": preview,
    }


@app.get("/api/threads")
def api_list_threads():
    """List all conversation threads sorted by pinned status and update time."""
    thread_ids = retrieve_all_threads()
    
    # Also fetch threads from meta DB that might not have checkpoints yet
    rows = _meta_conn.execute("SELECT thread_id FROM threads_meta").fetchall()
    all_ids = set(thread_ids).union({r[0] for r in rows})
    
    threads_data = []
    for tid in all_ids:
        threads_data.append(get_thread_details(tid))
    
    # Sort pinned first, then newest updated
    threads_data.sort(key=lambda t: (1 if t["is_pinned"] else 0, t["updated_at"]), reverse=True)
    return threads_data


@app.post("/api/threads")
def api_create_thread():
    """Create a new empty conversation thread."""
    new_id = str(uuid.uuid4())
    meta = get_or_create_thread_meta(new_id)
    return {
        "id": new_id,
        "title": meta["title"],
        "is_pinned": meta["is_pinned"],
        "created_at": meta["created_at"],
        "updated_at": meta["updated_at"],
        "message_count": 0,
        "preview": "No messages yet"
    }


@app.get("/api/threads/{thread_id}/messages")
def api_get_thread_messages(thread_id: str):
    """Retrieve full chronological message history for a thread."""
    config = {"configurable": {"thread_id": thread_id}}
    state = chatbot.get_state(config)
    messages = []
    
    if state and state.values and "messages" in state.values:
        for i, msg in enumerate(state.values["messages"]):
            if hasattr(msg, "content"):
                role = "user" if isinstance(msg, HumanMessage) else "assistant"
                messages.append({
                    "id": f"{thread_id}-{i}",
                    "role": role,
                    "content": msg.content,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
    meta = get_or_create_thread_meta(thread_id)
    return {
        "thread_id": thread_id,
        "meta": meta,
        "messages": messages
    }


@app.put("/api/threads/{thread_id}")
def api_update_thread(thread_id: str, update: ThreadUpdate):
    """Update title or pinned status of a thread."""
    update_thread_meta(thread_id, title=update.title, is_pinned=update.is_pinned)
    return get_thread_details(thread_id)


@app.delete("/api/threads/{thread_id}")
def api_delete_thread(thread_id: str):
    """Delete a thread from database and metadata."""
    backend_delete_thread(thread_id)
    _meta_conn.execute("DELETE FROM threads_meta WHERE thread_id = ?", (thread_id,))
    _meta_conn.commit()
    return {"success": True, "deleted_id": thread_id}


# ──────────────────────────────────────────────────────────────
# TRIAGE & ENTITY EXTRACTION API
# ──────────────────────────────────────────────────────────────
@app.post("/api/triage/analyze")
def api_triage_analyze(req: TriageRequest):
    """Fast deterministic triage check & regex entity extraction."""
    entities = extract_entities(req.text)
    is_emergency, category = detect_emergency(req.text)
    if not is_emergency and entities.get("symptoms"):
        for symptom in entities["symptoms"]:
            is_emergency, category = detect_emergency(symptom)
            if is_emergency:
                break
                
    summary = build_patient_summary(entities)
    return {
        "entities": entities,
        "is_emergency": is_emergency,
        "emergency_category": category,
        "patient_summary": summary,
    }


# ──────────────────────────────────────────────────────────────
# REAL-TIME SSE CHAT STREAMING
# ──────────────────────────────────────────────────────────────
@app.post("/api/chat/stream")
async def api_chat_stream(req: ChatRequest):
    """
    Stream AI responses token-by-token with real-time pipeline event updates (SSE).
    """
    user_message = req.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    thread_id = req.thread_id or str(uuid.uuid4())
    get_or_create_thread_meta(thread_id)
    update_thread_meta(thread_id)  # update timestamp

    # Format user message if structured patient context provided
    formatted_user_prompt = user_message
    if req.patient_context:
        ctx_parts = []
        if req.patient_context.get("age"):
            ctx_parts.append(f"Age: {req.patient_context['age']}")
        if req.patient_context.get("gender"):
            ctx_parts.append(f"Gender: {req.patient_context['gender']}")
        if req.patient_context.get("symptoms"):
            s_list = req.patient_context['symptoms']
            s_str = ", ".join(s_list) if isinstance(s_list, list) else str(s_list)
            ctx_parts.append(f"Symptoms: {s_str}")
        if req.patient_context.get("duration"):
            ctx_parts.append(f"Duration: {req.patient_context['duration']}")
        if req.patient_context.get("severity"):
            ctx_parts.append(f"Severity: {req.patient_context['severity']}")
        if ctx_parts:
            formatted_user_prompt = f"[{' | '.join(ctx_parts)}]\n{user_message}"

    async def event_generator():
        # Step 1: Notify start & input processing
        yield f"data: {json.dumps({'type': 'stage', 'stage': 'input_processing', 'label': 'Input triage & emergency scan'})}\n\n"
        await asyncio.sleep(0.02)

        # Fast client triage feedback
        entities = extract_entities(formatted_user_prompt)
        is_emergency, category = detect_emergency(formatted_user_prompt)
        if not is_emergency and entities.get("symptoms"):
            for s in entities["symptoms"]:
                is_emergency, category = detect_emergency(s)
                if is_emergency:
                    break

        yield f"data: {json.dumps({'type': 'triage', 'is_emergency': is_emergency, 'category': category, 'entities': entities})}\n\n"

        yield f"data: {json.dumps({'type': 'stage', 'stage': 'retrieval', 'label': 'Querying FAISS Knowledge Base & Cross-Encoder'})}\n\n"
        await asyncio.sleep(0.02)

        config = {"configurable": {"thread_id": thread_id}}
        full_response_text = ""
        current_stage = "retrieval"
        has_yielded_token = False

        try:
            # LangGraph stream in thread pool to prevent blocking event loop
            def run_stream():
                return list(chatbot.stream(
                    {"messages": [HumanMessage(content=formatted_user_prompt)]},
                    config=config,
                    stream_mode="messages",
                ))

            # Stream chunks
            chunks = await asyncio.to_thread(run_stream)

            for chunk, metadata in chunks:
                node = metadata.get("langgraph_node", "")
                
                if node == "web_search" and current_stage != "web_search":
                    current_stage = "web_search"
                    yield f"data: {json.dumps({'type': 'stage', 'stage': 'web_search', 'label': 'Cross-referencing trusted medical web sources'})}\n\n"
                elif node == "verifier" and current_stage != "verifier":
                    current_stage = "verifier"
                    yield f"data: {json.dumps({'type': 'stage', 'stage': 'clinical_reasoning', 'label': 'Synthesizing differential diagnosis & clinical plan'})}\n\n"

                if hasattr(chunk, "content") and chunk.content:
                    if node in ("verifier", "input_processing", ""):
                        content_piece = chunk.content
                        full_response_text += content_piece
                        has_yielded_token = True
                        yield f"data: {json.dumps({'type': 'token', 'token': content_piece})}\n\n"
                        await asyncio.sleep(0.003)

            # If no streaming content was produced (e.g. state node return)
            if not has_yielded_token:
                state = chatbot.get_state(config)
                if state and state.values and "messages" in state.values:
                    last_msg = state.values["messages"][-1]
                    if isinstance(last_msg, AIMessage):
                        full_response_text = last_msg.content
                        yield f"data: {json.dumps({'type': 'token', 'token': full_response_text})}\n\n"

            # Parse extracted sources from response text
            sources = []
            if "📚 **References:**" in full_response_text or "📚 Sources" in full_response_text or "📄" in full_response_text:
                for line in full_response_text.splitlines():
                    clean = line.strip()
                    if clean.startswith("📄") or clean.startswith("🌐") or clean.startswith("- 📄") or clean.startswith("- 🌐"):
                        sources.append(clean.lstrip("- "))

            is_cache_hit = "⚡ **Answered from cache**" in full_response_text or "Answered from cache" in full_response_text

            yield f"data: {json.dumps({'type': 'done', 'full_text': full_response_text, 'sources': sources, 'entities': entities, 'is_emergency': is_emergency, 'emergency_category': category, 'is_cache_hit': is_cache_hit, 'thread_id': thread_id})}\n\n"

        except Exception as e:
            logger.error("Chat streaming error: %s", e)
            error_msg = str(e)
            user_friendly = "Could not complete the clinical reasoning request."
            if "Invalid API Key" in error_msg or "401" in error_msg:
                user_friendly = "Invalid or expired Groq API Key. Please update your API key in the top-right Settings modal."
            elif "rate_limit" in error_msg.lower() or "429" in error_msg:
                user_friendly = "Groq API rate limit exceeded. Please wait a moment or switch models."

            yield f"data: {json.dumps({'type': 'error', 'message': user_friendly, 'detail': error_msg})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# ──────────────────────────────────────────────────────────────
# SETTINGS & API KEY CONFIGURATION
# ──────────────────────────────────────────────────────────────
@app.post("/api/settings/update-key")
def api_update_settings(settings: SettingsUpdate):
    """
    Dynamically update API keys or model, test the Groq LLM connection, and persist to .env.
    """
    updated = {}
    env_lines = []
    
    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            env_lines = f.readlines()

    def set_env_var(key: str, val: str):
        os.environ[key] = val
        found = False
        new_lines = []
        for line in env_lines:
            if line.strip().startswith(f"{key}="):
                new_lines.append(f"{key}={val}\n")
                found = True
            else:
                new_lines.append(line)
        if not found:
            new_lines.append(f"\n{key}={val}\n")
        return new_lines

    if settings.groq_api_key:
        clean_key = settings.groq_api_key.strip()
        env_lines = set_env_var("GROQ_API_KEY", clean_key)
        updated["groq_api_key"] = "Updated"
        # Test Groq key
        get_llm(api_key=clean_key, force_reload=True)

    if settings.tavily_api_key:
        clean_tavily = settings.tavily_api_key.strip()
        env_lines = set_env_var("TAVILY_API_KEY", clean_tavily)
        updated["tavily_api_key"] = "Updated"

    if settings.model:
        clean_model = settings.model.strip()
        env_lines = set_env_var("GROQ_MODEL", clean_model)
        updated["model"] = clean_model
        get_llm(model=clean_model, force_reload=True)

    try:
        with open(".env", "w", encoding="utf-8") as f:
            f.writelines(env_lines)
    except Exception as e:
        logger.error("Error writing .env file: %s", e)

    # Re-run health check
    health = check_system_health()
    return {
        "success": True,
        "updated": updated,
        "health": health
    }


# ──────────────────────────────────────────────────────────────
# SERVE REACT PRODUCTION BUILD
# ──────────────────────────────────────────────────────────────
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend-react", "dist")
if os.path.exists(DIST_DIR):
    assets_dir = os.path.join(DIST_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_spa(full_path: str):
        # Let API routes pass through
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="API route not found")
        target = os.path.join(DIST_DIR, full_path)
        if full_path and os.path.isfile(target):
            return FileResponse(target)
        index_file = os.path.join(DIST_DIR, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "MediGuide AI Backend API running. React build not found."}


# ──────────────────────────────────────────────────────────────
# SERVER ENTRYPOINT
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    logger.info("Starting MediGuide AI FastAPI Server on http://localhost:%d", port)
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)

