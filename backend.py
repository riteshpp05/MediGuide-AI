import os
import sys
import logging
import sqlite3
import hashlib
import json
import time
import re
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.sqlite import SqliteSaver
from typing import TypedDict, Annotated

RERANKER_AVAILABLE = True

load_dotenv()

# ══════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════
GROQ_MODEL      = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
FAISS_INDEX_DIR = os.getenv("FAISS_INDEX_DIR", "faiss_index")
CHUNK_SIZE      = int(os.getenv("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP   = int(os.getenv("CHUNK_OVERLAP", "200"))
RETRIEVER_K     = int(os.getenv("RETRIEVER_K", "12"))   # Increased for reranking headroom
RERANK_TOP_K    = int(os.getenv("RERANK_TOP_K", "6"))    # Final chunks after reranking
TAVILY_API_KEY  = os.getenv("TAVILY_API_KEY", "")
CACHE_TTL       = int(os.getenv("CACHE_TTL", "86400"))   # 24 hours

# ── Versioning (for composite cache keys) ─────────────────────
PROMPT_VERSION = "v2.0-clinical"
MODEL_VERSION  = GROQ_MODEL
KB_VERSION     = (
    str(int(os.path.getmtime(FAISS_INDEX_DIR)))
    if os.path.exists(FAISS_INDEX_DIR)
    else "none"
)

_embeddings_instance = None

def get_embeddings():
    global _embeddings_instance
    if _embeddings_instance is None:
        logger.info("Loading HuggingFace embeddings (%s)...", EMBEDDING_MODEL)
        _embeddings_instance = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
        logger.info("HuggingFace embeddings loaded successfully.")
    return _embeddings_instance


# ══════════════════════════════════════════════════════════════
# CACHE SETUP (SQLite-based) — version-aware keys
# ══════════════════════════════════════════════════════════════
_cache_conn = sqlite3.connect("answer_cache.db", check_same_thread=False)
_cache_conn.execute("""
    CREATE TABLE IF NOT EXISTS answer_cache (
        question_hash TEXT PRIMARY KEY,
        question      TEXT,
        answer        TEXT,
        sources       TEXT,
        created_at    REAL,
        hit_count     INTEGER DEFAULT 0
    )
""")
_cache_conn.execute("""
    CREATE TABLE IF NOT EXISTS cache_stats (
        id            INTEGER PRIMARY KEY,
        total_cached  INTEGER DEFAULT 0,
        total_hits    INTEGER DEFAULT 0,
        tokens_saved  INTEGER DEFAULT 0
    )
""")
_cache_conn.execute(
    "INSERT OR IGNORE INTO cache_stats (id, total_cached, total_hits, tokens_saved) VALUES (1, 0, 0, 0)"
)
_cache_conn.commit()


def _make_hash(question: str) -> str:
    """Create a version-aware hash so caches auto-invalidate on prompt/model/KB changes."""
    normalized = question.lower().strip()
    composite = f"{normalized}|{PROMPT_VERSION}|{MODEL_VERSION}|{KB_VERSION}"
    return hashlib.md5(composite.encode()).hexdigest()


def get_cached_answer(question: str):
    """Check cache — returns (answer, sources) or None if not found / expired."""
    question_hash = _make_hash(question)
    try:
        row = _cache_conn.execute(
            "SELECT answer, sources, created_at FROM answer_cache WHERE question_hash = ?",
            (question_hash,)
        ).fetchone()
        if not row:
            return None

        answer, sources, created_at = row
        if time.time() - created_at > CACHE_TTL:
            _cache_conn.execute(
                "DELETE FROM answer_cache WHERE question_hash = ?", (question_hash,)
            )
            _cache_conn.commit()
            logger.info("Cache expired for: %s", question[:50])
            return None

        _cache_conn.execute(
            "UPDATE answer_cache SET hit_count = hit_count + 1 WHERE question_hash = ?",
            (question_hash,)
        )
        _cache_conn.execute(
            "UPDATE cache_stats SET total_hits = total_hits + 1, tokens_saved = tokens_saved + 500 WHERE id = 1"
        )
        _cache_conn.commit()
        logger.info("Cache HIT — %s", question[:50])
        return answer, sources
    except Exception as e:
        logger.error("Cache read error: %s", e)
        return None


def store_cached_answer(question: str, answer: str, sources: str):
    """Store an answer in cache."""
    question_hash = _make_hash(question)
    try:
        _cache_conn.execute(
            """INSERT OR REPLACE INTO answer_cache
               (question_hash, question, answer, sources, created_at, hit_count)
               VALUES (?, ?, ?, ?, ?, 0)""",
            (question_hash, question, answer, sources, time.time())
        )
        _cache_conn.execute(
            "UPDATE cache_stats SET total_cached = total_cached + 1 WHERE id = 1"
        )
        _cache_conn.commit()
        logger.info("Cache STORED: %s", question[:50])
    except Exception as e:
        logger.error("Cache write error: %s", e)


def get_cache_stats() -> dict:
    """Return cache statistics for the UI."""
    try:
        row = _cache_conn.execute(
            "SELECT total_cached, total_hits, tokens_saved FROM cache_stats WHERE id = 1"
        ).fetchone()
        if row:
            return {"total_cached": row[0], "total_hits": row[1], "tokens_saved": row[2]}
    except Exception as e:
        logger.error("Cache stats error: %s", e)
    return {"total_cached": 0, "total_hits": 0, "tokens_saved": 0}


def clear_cache():
    """Clear all cached answers."""
    try:
        _cache_conn.execute("DELETE FROM answer_cache")
        _cache_conn.execute(
            "UPDATE cache_stats SET total_cached=0, total_hits=0, tokens_saved=0 WHERE id=1"
        )
        _cache_conn.commit()
        logger.info("Cache cleared")
        return True
    except Exception as e:
        logger.error("Cache clear error: %s", e)
        return False


# ══════════════════════════════════════════════════════════════
# BUILD FAISS INDEX
# ══════════════════════════════════════════════════════════════
def build_faiss_index(data_dir="data"):
    if not os.path.exists(data_dir):
        logger.error("Folder '%s' not found", data_dir)
        return
    loader = DirectoryLoader(data_dir, glob="*.pdf", loader_cls=PyPDFLoader)
    documents = loader.load()
    if not documents:
        logger.error("No PDF files found in '%s'", data_dir)
        return
    logger.info("Loaded %d pages", len(documents))
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
    )
    chunks = splitter.split_documents(documents)
    original_count = len(chunks)

    seen = set()
    unique_chunks = []
    for chunk in chunks:
        content_hash = hashlib.md5(chunk.page_content.strip().encode()).hexdigest()
        if content_hash not in seen:
            seen.add(content_hash)
            unique_chunks.append(chunk)

    chunks = unique_chunks
    logger.info(
        "Deduplication: %d unique chunks kept, %d duplicates removed",
        len(unique_chunks), original_count - len(unique_chunks),
    )
    vectorstore = FAISS.from_documents(chunks, get_embeddings())
    vectorstore.save_local(FAISS_INDEX_DIR)
    logger.info("FAISS index saved")


# ══════════════════════════════════════════════════════════════
# CACHED RETRIEVER (lazy-loaded)
# ══════════════════════════════════════════════════════════════
_retriever_cache = None

def get_retriever(k=None):
    global _retriever_cache
    if _retriever_cache is None:
        k = k or RETRIEVER_K
        if not os.path.exists(FAISS_INDEX_DIR):
            return None
        db = FAISS.load_local(
            FAISS_INDEX_DIR, get_embeddings(),
            allow_dangerous_deserialization=True
        )
        _retriever_cache = db.as_retriever(
            search_type="mmr",
            search_kwargs={"k": k, "fetch_k": 30, "lambda_mult": 0.7}
        )
        logger.info("Retriever loaded (k=%d, MMR)", k)
    return _retriever_cache


# ══════════════════════════════════════════════════════════════
# CROSS-ENCODER RERANKER (lazy-loaded)
# ══════════════════════════════════════════════════════════════
_reranker_cache = None

def get_reranker():
    """Lazy-load the cross-encoder reranker (~22 MB model, downloaded once)."""
    global _reranker_cache, RERANKER_AVAILABLE
    if _reranker_cache is None and RERANKER_AVAILABLE:
        try:
            from sentence_transformers import CrossEncoder
            _reranker_cache = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
            logger.info("Cross-encoder reranker loaded")
        except Exception as e:
            RERANKER_AVAILABLE = False
            logger.warning("CrossEncoder could not be loaded (%s) — using standard retrieval", e)
            return None
    return _reranker_cache


def rerank_documents(query, docs, top_k=None):
    """Rerank retrieved documents using cross-encoder. Falls back to truncation."""
    top_k = top_k or RERANK_TOP_K
    if not docs:
        return []
    reranker = get_reranker()
    if reranker is None:
        logger.info("Reranker unavailable — returning first %d docs", top_k)
        return docs[:top_k]
    pairs = [(query, doc.page_content) for doc in docs]
    scores = reranker.predict(pairs)
    scored_docs = sorted(zip(scores, docs), key=lambda x: x[0], reverse=True)
    logger.info(
        "Reranked %d docs → top %d (scores: %.3f … %.3f)",
        len(docs), top_k,
        scored_docs[0][0] if scored_docs else 0,
        scored_docs[min(top_k - 1, len(scored_docs) - 1)][0] if scored_docs else 0,
    )
    return [doc for _, doc in scored_docs[:top_k]]


_llm_instance = None

def get_llm(api_key=None, model=None, force_reload=False):
    global _llm_instance
    key = api_key or os.getenv("GROQ_API_KEY", "")
    mdl = model or os.getenv("GROQ_MODEL", GROQ_MODEL)
    if _llm_instance is None or force_reload or api_key:
        _llm_instance = ChatGroq(
            groq_api_key=key if key else "missing-key",
            model=mdl,
            temperature=0.0,
            max_retries=1,
            timeout=10,
        )
        logger.info("LLM initialised — %s", mdl)
    return _llm_instance


# ══════════════════════════════════════════════════════════════
# EMERGENCY DETECTION (deterministic — no LLM call)
# ══════════════════════════════════════════════════════════════
EMERGENCY_PATTERNS = {
    "cardiac": [
        "chest pain", "heart attack", "cardiac arrest",
        "myocardial infarction", "crushing chest",
    ],
    "stroke": [
        "stroke", "facial drooping", "slurred speech",
        "sudden weakness on one side", "face drooping",
    ],
    "respiratory": [
        "cannot breathe", "can't breathe", "difficulty breathing",
        "choking", "severe asthma attack", "respiratory arrest",
    ],
    "neurological": [
        "seizure", "unconscious", "unresponsive",
        "loss of consciousness", "convulsion", "fainting",
    ],
    "toxicological": [
        "overdose", "poisoning", "ingested poison",
        "drug overdose", "toxic ingestion",
    ],
    "psychiatric": [
        "suicidal", "suicide", "self-harm",
        "want to die", "kill myself", "ending my life",
    ],
    "hemorrhagic": [
        "severe bleeding", "hemorrhage", "bleeding profusely",
        "won't stop bleeding", "massive blood loss",
    ],
    "allergic": [
        "anaphylaxis", "severe allergic reaction",
        "throat swelling", "can't swallow after allergic",
    ],
}


def detect_emergency(text: str):
    """Deterministic emergency check. Returns (is_emergency, category)."""
    text_lower = text.lower()
    for category, keywords in EMERGENCY_PATTERNS.items():
        for keyword in keywords:
            if keyword in text_lower:
                return True, category
    return False, None


# ══════════════════════════════════════════════════════════════
# MEDICAL ENTITY EXTRACTION (regex-based — fast, no LLM call)
# ══════════════════════════════════════════════════════════════
SYMPTOM_KEYWORDS = [
    "chest pain", "headache", "fever", "cough", "nausea", "vomiting",
    "diarrhea", "shortness of breath", "dizziness", "fatigue",
    "abdominal pain", "back pain", "joint pain", "sweating",
    "bleeding", "swelling", "rash", "numbness", "tingling",
    "weakness", "blurred vision", "weight loss", "weight gain",
    "difficulty breathing", "palpitations", "confusion",
    "loss of consciousness", "seizure", "tremor", "muscle pain",
    "sore throat", "runny nose", "wheezing", "chest tightness",
    "loss of appetite", "insomnia", "anxiety", "depression",
    "urinary frequency", "blood in urine", "blood in stool",
    "dark stool", "jaundice", "itching", "hair loss",
    "night sweats", "chills", "edema", "bruising",
]


def extract_entities(text: str) -> dict:
    """Regex-based medical entity extraction from user query."""
    entities = {
        "age": None,
        "gender": None,
        "symptoms": [],
        "medications": [],
        "conditions": [],
        "duration": None,
        "severity": None,
    }

    # ── Age ───────────────────────────────────────────────────
    age_match = re.search(
        r"\b(\d{1,3})\s*[-–]?\s*(?:year|yr|y\.?o\.?|years?\s*old)\b", text, re.I
    )
    if age_match:
        age_val = int(age_match.group(1))
        if 0 < age_val < 130:
            entities["age"] = age_val

    # ── Gender ────────────────────────────────────────────────
    gender_match = re.search(
        r"\b(male|female|man|woman|boy|girl|gentleman|lady)\b", text, re.I
    )
    if gender_match:
        g = gender_match.group(1).lower()
        entities["gender"] = (
            "male" if g in ("male", "man", "boy", "gentleman") else "female"
        )

    # ── Symptoms ──────────────────────────────────────────────
    text_lower = text.lower()
    for symptom in SYMPTOM_KEYWORDS:
        if symptom in text_lower:
            entities["symptoms"].append(symptom)

    # ── Duration ──────────────────────────────────────────────
    duration_match = re.search(
        r"(?:for|since|past|last|over)\s+(\d+\s+(?:day|week|month|year|hour|minute)s?)",
        text, re.I,
    )
    if duration_match:
        entities["duration"] = duration_match.group(1)

    # ── Severity ──────────────────────────────────────────────
    severity_match = re.search(
        r"\b(mild|moderate|severe|acute|chronic|intense|sharp|dull|burning|throbbing)\b",
        text, re.I,
    )
    if severity_match:
        entities["severity"] = severity_match.group(1).lower()

    return entities


# ══════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════
def build_patient_summary(entities: dict) -> str:
    """Build a human-readable patient summary from extracted entities."""
    parts = []
    if entities.get("age"):
        parts.append(f"• Age: {entities['age']} years old")
    if entities.get("gender"):
        parts.append(f"• Gender: {entities['gender'].title()}")
    if entities.get("symptoms"):
        parts.append(f"• Presenting symptoms: {', '.join(entities['symptoms'])}")
    if entities.get("severity"):
        parts.append(f"• Severity: {entities['severity']}")
    if entities.get("duration"):
        parts.append(f"• Duration: {entities['duration']}")
    if entities.get("medications"):
        parts.append(f"• Current medications: {', '.join(entities['medications'])}")
    if entities.get("conditions"):
        parts.append(f"• Known conditions: {', '.join(entities['conditions'])}")
    return "\n".join(parts) if parts else "No specific patient information provided."


def build_enriched_query(question: str, entities: dict) -> str:
    """Build an enriched FAISS query from the question + extracted entities."""
    parts = [question]
    if entities.get("symptoms"):
        parts.append("symptoms: " + ", ".join(entities["symptoms"]))
    if entities.get("conditions"):
        parts.append("conditions: " + ", ".join(entities["conditions"]))
    return " ".join(parts)


# ══════════════════════════════════════════════════════════════
# PROMPTS — Clinical Reasoning Engine
# ══════════════════════════════════════════════════════════════

CLINICAL_FORMAT = """
**🏥 Patient Summary**
<Summarize patient information: age, gender, symptoms, duration, severity, relevant history.>

**🔬 Clinical Interpretation**
<Analyze the symptom pattern. What does this presentation suggest clinically? How do patient-specific factors influence the assessment?>

**📋 Differential Diagnoses** (ranked by severity and likelihood)
1. **[Most Dangerous — Rule Out First]** <Diagnosis> — <Why this must be ruled out first> (Citation)
2. **[Most Likely]** <Diagnosis> — <Evidence supporting this as the most probable cause> (Citation)
3. <Other possibility> — <Brief reasoning> (Citation)

**⚡ Recommended Actions**
- <Immediate action or first-aid step>
- <Diagnostic tests or investigations to consider>
- <When to seek emergency care vs. routine follow-up>

**🚨 Emergency Warning Signs**
- <Red flag symptom 1 that requires immediate medical attention>
- <Red flag symptom 2>

**❓ Missing Information**
- <What additional history, lab results, or physical exam findings would help narrow the diagnosis?>

**📚 Sources**
- 📄 <filename, Page X>   ← only if document evidence was used
- 🌐 <domain (full URL)>  ← only if web evidence was used

---
⚕️ This information is for educational purposes only. Always consult a qualified healthcare provider for personal medical advice.
"""

SIMPLE_FORMAT = """
**[Direct Answer]**
<1-2 sentences answering the question directly. Include citation immediately.>

**[Details]**
- <Supporting point 1> (Citation)
- <Supporting point 2> (Citation)
- <Supporting point 3 if needed> (Citation)
- Maximum 5 bullet points. Each 1-2 sentences.

**[Sources]**
- 📄 <filename, Page X>   ← only if document evidence was used
- 🌐 <domain (full URL)>  ← only if web evidence was used

---
⚕️ This information is for educational purposes only. Always consult a qualified healthcare provider for personal medical advice.
"""

CLINICAL_SYSTEM_PROMPT = """
You are MediGuide AI, a clinical reasoning medical assistant.

You analyze patient queries using retrieved medical evidence and provide structured clinical assessments.
Use retrieved documents and web results as supporting evidence.
You may perform clinical reasoning and differential diagnosis based on retrieved evidence.
Always prioritize the most dangerous diagnosis first (rule-out approach).
Explain how patient-specific factors (age, gender, comorbidities) influence your assessment.

══════════════════════════════════════
PATIENT CONTEXT:
{patient_summary}

RETRIEVED MEDICAL EVIDENCE (from uploaded PDFs):
{context}

WEB SEARCH RESULTS (from trusted medical sources):
{web_results}

CONVERSATION HISTORY:
{chat_history}

EMERGENCY STATUS: {emergency_status}
══════════════════════════════════════

══════════════════════════════════════
RESPONSE FORMAT — follow this structure exactly:
══════════════════════════════════════
{format_instructions}

══════════════════════════════════════
RULES:
══════════════════════════════════════
1. Use retrieved documents and web results as evidence. You may reason clinically based on this evidence.
2. Always consider the most dangerous diagnosis first (rule-out worst-case approach).
3. Cite every factual claim: use (Document, Page X) or (Web: domain.com).
4. Explain medical terms in brackets: "portal hypertension [high blood pressure in liver veins]"
5. Consider patient-specific factors: age, gender, comorbidities affect diagnosis probability.
6. If evidence is insufficient, clearly state what additional information is needed.
7. Source priority: Documents first. Use Web only when documents are insufficient.
8. Never guess drug dosages. Never provide specific treatment plans or prescriptions.
9. For follow-up questions, resolve pronouns (it, that, this, the condition) using conversation history before answering.
10. Every response MUST end with the disclaimer: ⚕️ This information is for educational purposes only. Always consult a qualified healthcare provider for personal medical advice.

══════════════════════════════════════
SPECIAL CASES:
══════════════════════════════════════

IF emergency_status is NOT "None":
Start your response with EXACTLY this line:
⚠️ EMERGENCY — Please call emergency services immediately (112 / 911). Do not wait. This requires immediate professional medical attention.
Then provide relevant first-aid guidance from the evidence if available.
Then provide the clinical assessment using the response format above.

IF the question is NOT about health or medicine (coding, travel, cooking, finance, sports, etc.):
Respond with EXACTLY:
I'm MediGuide AI, a medical assistant. I can only answer health and medical questions based on provided references. Please ask me a medical or health-related question.
---
⚕️ This information is for educational purposes only. Always consult a qualified healthcare provider for personal medical advice.

IF no relevant information exists in documents or web results:
Respond with EXACTLY:
I'm sorry, I don't have information about that in the provided medical references or trusted medical websites. Please consult a qualified healthcare provider for this question.
---
⚕️ This information is for educational purposes only. Always consult a qualified healthcare provider for personal medical advice.
"""


# ══════════════════════════════════════════════════════════════
# INPUT SANITIZATION
# ══════════════════════════════════════════════════════════════
def sanitize_input(text, max_length=2000):
    if not text or not isinstance(text, str):
        return ""
    return text.strip()[:max_length]


# ══════════════════════════════════════════════════════════════
# LANGGRAPH STATE — expanded for multi-node pipeline
# ══════════════════════════════════════════════════════════════
class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    # ── Pipeline fields ──
    sanitized_question: str
    extracted_entities: dict
    is_emergency: bool
    emergency_category: str
    reranked_context: str
    web_results_text: str
    sources_list: list
    chat_history: str
    is_verified: bool
    verification_attempts: int
    draft_response: str
    is_guideline_query: bool
    is_cache_hit: bool


# ══════════════════════════════════════════════════════════════
# NODE 1 — INPUT PROCESSING
# Cache check ➜ Entity extraction ➜ Emergency detection ➜ History
# ══════════════════════════════════════════════════════════════
def input_node(state: ChatState):
    """Sanitize, check cache, extract entities, detect emergency, format history."""
    messages = state["messages"]
    last_human = next(
        (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
    )
    question = sanitize_input(last_human.content if last_human else "")

    if not question:
        return {
            "messages": [AIMessage(content="Please enter a valid question.")],
            "is_cache_hit": True,
        }

    # ── Cache check ───────────────────────────────────────────
    cached = get_cached_answer(question)
    if cached:
        answer, sources = cached
        full = f"⚡ **Answered from cache**\n\n{answer}"
        return {
            "messages": [AIMessage(content=full)],
            "sanitized_question": question,
            "is_cache_hit": True,
        }

    # ── Entity extraction ─────────────────────────────────────
    entities = extract_entities(question)
    logger.info("Extracted entities: %s", json.dumps(entities, default=str))

    # ── Emergency detection (question + extracted symptoms) ───
    is_emergency, emergency_category = detect_emergency(question)
    if not is_emergency and entities.get("symptoms"):
        for symptom in entities["symptoms"]:
            is_emergency, emergency_category = detect_emergency(symptom)
            if is_emergency:
                break

    if is_emergency:
        logger.warning("🚨 EMERGENCY detected — category: %s", emergency_category)

    # ── Chat history formatting ───────────────────────────────
    history_messages = messages[:-1][-6:]
    chat_history_lines = []
    for msg in history_messages:
        if isinstance(msg, HumanMessage):
            chat_history_lines.append(f"User: {msg.content}")
        elif isinstance(msg, AIMessage):
            chat_history_lines.append(f"Assistant: {msg.content}")
    chat_history = "\n".join(chat_history_lines) or "No prior conversation."

    # ── Guideline / time-sensitive detection ───────────────────
    guideline_keywords = [
        "latest", "newest", "current", "2024", "2025", "2026",
        "recent", "new", "updated", "today", "modern",
        "guideline", "recommendation", "protocol", "standard of care",
    ]
    is_guideline_query = any(kw in question.lower() for kw in guideline_keywords)

    return {
        "sanitized_question": question,
        "extracted_entities": entities,
        "is_emergency": is_emergency,
        "emergency_category": emergency_category or "",
        "chat_history": chat_history,
        "is_guideline_query": is_guideline_query,
        "is_cache_hit": False,
    }


# ══════════════════════════════════════════════════════════════
# NODE 2 — RETRIEVAL + RERANKING
# Entity-enriched FAISS search ➜ Cross-encoder rerank
# ══════════════════════════════════════════════════════════════
def retrieval_node(state: ChatState):
    """FAISS retrieval with entity-enriched query + cross-encoder reranking."""
    question = state.get("sanitized_question", "")
    entities = state.get("extracted_entities", {})

    retriever = get_retriever()
    if retriever is None:
        return {
            "reranked_context": "No relevant documents found in knowledge base.",
            "sources_list": [],
        }

    # Build enriched query for better retrieval
    enriched_query = build_enriched_query(question, entities)
    logger.info("Enriched query: %s", enriched_query[:120])

    docs = retriever.invoke(enriched_query)

    # Rerank with cross-encoder
    reranked = rerank_documents(question, docs, top_k=RERANK_TOP_K)

    # Format context
    context_parts = []
    sources_list = []
    for i, doc in enumerate(reranked):
        source_file = os.path.basename(doc.metadata.get("source", "Unknown"))
        page_num = doc.metadata.get("page", "N/A")
        header = f"[Source {i + 1}: {source_file}, Page {page_num}]"
        context_parts.append(f"{header}\n{doc.page_content}")
        sources_list.append(f"📄 {source_file}, Page {page_num}")

    context = "\n\n".join(context_parts) if context_parts else "No relevant documents found."
    logger.info("Retrieval: %d docs → reranked to %d", len(docs), len(reranked))

    return {
        "reranked_context": context,
        "sources_list": sources_list,
    }


# ══════════════════════════════════════════════════════════════
# NODE 3 — WEB SEARCH (Tavily)
# Triggered for guideline queries or empty retrieval
# ══════════════════════════════════════════════════════════════
def web_search_node(state: ChatState):
    """Tavily web search — enhanced domains, guideline-aware."""
    is_guideline = state.get("is_guideline_query", False)
    has_docs = bool(state.get("sources_list"))
    question = state.get("sanitized_question", "")
    sources_list = list(state.get("sources_list", []))  # copy to avoid mutation

    web_results_text = "No web search results available."

    if (is_guideline or not has_docs) and TAVILY_API_KEY:
        logger.info(
            "Web search triggered — guideline=%s, has_docs=%s", is_guideline, has_docs
        )
        try:
            max_results = 5 if is_guideline else 3
            tavily_tool = TavilySearchResults(
                max_results=max_results,
                include_domains=[
                    "mayoclinic.org", "nih.gov", "who.int",
                    "webmd.com", "medlineplus.gov",
                    "pubmed.ncbi.nlm.nih.gov",
                    "diabetes.org", "kdigo.org",
                    "cochranelibrary.com", "uptodate.com",
                ],
            )
            web_docs = tavily_tool.invoke({"query": question})
            if web_docs and isinstance(web_docs, list):
                web_parts = []
                for i, res in enumerate(web_docs):
                    url = res.get("url", "Unknown")
                    domain = url.split("//")[-1].split("/")[0]
                    content = res.get("content", "")
                    web_parts.append(f"[Web Source {i + 1}: {domain}]\n{content}")
                    sources_list.append(f"🌐 {domain} ({url})")
                web_results_text = "\n\n".join(web_parts)
                logger.info("Web search returned %d results", len(web_docs))
        except Exception as e:
            logger.warning("Tavily search failed: %s", e)

    return {
        "web_results_text": web_results_text,
        "sources_list": sources_list,
    }


# ══════════════════════════════════════════════════════════════
# NODE 4 — CLINICAL REASONING + RESPONSE GENERATION
# Single LLM call — differential diagnosis, severity ranking, formatting
# ══════════════════════════════════════════════════════════════
def clinical_reasoning_node(state: ChatState):
    """Clinical reasoning → formatted response → cache → AIMessage."""
    question = state.get("sanitized_question", "")
    entities = state.get("extracted_entities", {})
    is_emergency = state.get("is_emergency", False)
    emergency_category = state.get("emergency_category", "")
    context = state.get("reranked_context", "No documents available.")
    web_results = state.get("web_results_text", "No web search results available.")
    chat_history = state.get("chat_history", "No prior conversation.")
    sources_list = state.get("sources_list", [])

    # ── Build patient summary ─────────────────────────────────
    patient_summary = build_patient_summary(entities)

    # ── Choose response format ────────────────────────────────
    has_clinical_context = bool(entities.get("age") or entities.get("symptoms"))
    format_instructions = CLINICAL_FORMAT if has_clinical_context else SIMPLE_FORMAT

    # ── Emergency status string ───────────────────────────────
    emergency_status = (
        f"EMERGENCY DETECTED — Category: {emergency_category.upper()}"
        if is_emergency
        else "None"
    )

    # ── Build prompt ──────────────────────────────────────────
    prompt = ChatPromptTemplate.from_messages([
        ("system", CLINICAL_SYSTEM_PROMPT),
        ("human", "{question}"),
    ])

    chain = prompt | get_llm()

    try:
        response = chain.invoke({
            "patient_summary": patient_summary,
            "context": context,
            "web_results": web_results,
            "chat_history": chat_history,
            "emergency_status": emergency_status,
            "format_instructions": format_instructions,
            "question": question,
        })
        answer = response.content

        # ── Cache (skip emergencies, fallbacks, off-topic) ────
        skip_cache_phrases = [
            "⚠️ EMERGENCY",
            "I'm sorry, I don't have information",
            "I'm MediGuide AI, a medical assistant",
        ]
        sources_text = "\n".join(sources_list)
        if not any(phrase in answer for phrase in skip_cache_phrases):
            store_cached_answer(question, answer, sources_text)

        # ── Append references ─────────────────────────────────
        if sources_list:
            answer = f"{answer}\n\n---\n📚 **References:**\n{sources_text}"

        return {"draft_response": answer}

    except Exception as e:
        logger.error("LLM error: %s", e)
        return {"draft_response": f"⚠️ Error communicating with the AI model.\n\n`{str(e)}`"}


# ══════════════════════════════════════════════════════════════
# GRAPH ROUTING
# ══════════════════════════════════════════════════════════════
def route_after_input(state: ChatState) -> str:
    """Route to END on cache hit, otherwise continue pipeline."""
    if state.get("is_cache_hit", False):
        return END
    return "retrieval"


# ══════════════════════════════════════════════════════════════
# CHECKPOINTER
# ══════════════════════════════════════════════════════════════
_conn = sqlite3.connect("chatbot.db", check_same_thread=False)
checkpointer = SqliteSaver(conn=_conn)


# ══════════════════════════════════════════════════════════════

def verifier_node(state: ChatState):
    """Goal B: The Verifier Agent checks the drafted answer against retrieved evidence."""
    last_message = state.get("draft_response", "")
    if "Error communicating" in last_message or "I'm sorry, I don't have information" in last_message:
        return {"messages": [AIMessage(content=last_message)], "is_verified": False}
        
    context = state.get("reranked_context", "") + "\n" + state.get("web_results_text", "")
    question = state.get("sanitized_question", "")
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are the MediGuide Verification Agent. Your only job is to ensure the Assistant's Draft Response is medically FAITHFUL to the provided Context.\nIf the draft contains specific clinical claims, dosages, or facts NOT present in the context, you MUST rewrite the response to remove or correct them.\nIf it is already faithful, output the draft exactly as is.\n\nCRITICAL INSTRUCTION: You MUST append the exact string '\n\n*[🛡️ Verified by Clinical Faithfulness Agent]*' to the very end of your output."),
        ("human", "USER QUERY:\n{question}\n\nEVIDENCE CONTEXT:\n{context}\n\nDRAFT RESPONSE:\n{draft}\n\nPlease output the verified, finalized response (and nothing else).")
    ])
    
    chain = prompt | get_llm()
    try:
        response = chain.invoke({"question": question, "context": context, "draft": last_message})
        return {"messages": [AIMessage(content=response.content)], "is_verified": True}
    except Exception as e:
        logger.error("Verifier error: %s", e)
        return {"messages": [AIMessage(content=last_message)], "is_verified": False}

# GRAPH WIRING — 4-node clinical reasoning pipeline
# ══════════════════════════════════════════════════════════════
graph = StateGraph(ChatState)

graph.add_node("input_processing", input_node)
graph.add_node("retrieval", retrieval_node)
graph.add_node("web_search", web_search_node)
graph.add_node("clinical_reasoning", clinical_reasoning_node)
graph.add_node("verifier", verifier_node)

graph.add_edge(START, "input_processing")
graph.add_conditional_edges("input_processing", route_after_input)
graph.add_edge("retrieval", "web_search")
graph.add_edge("web_search", "clinical_reasoning")
graph.add_edge("clinical_reasoning", "verifier")
graph.add_edge("verifier", END)

chatbot = graph.compile(checkpointer=checkpointer)
logger.info("Clinical reasoning pipeline compiled — 4 nodes, prompt %s", PROMPT_VERSION)


# ══════════════════════════════════════════════════════════════
# THREAD UTILITIES
# ══════════════════════════════════════════════════════════════
def retrieve_all_threads():
    try:
        thread_ids = set()
        for checkpoint in checkpointer.list(None):
            thread_ids.add(checkpoint.config["configurable"]["thread_id"])
        return sorted(list(thread_ids))
    except Exception as e:
        logger.error("Error retrieving threads: %s", e)
        return []


def delete_thread(thread_id):
    try:
        _conn.execute(
            "DELETE FROM checkpoints WHERE thread_id = ?", (thread_id,)
        )
        _conn.commit()
        return True
    except Exception as e:
        logger.error("Error deleting thread: %s", e)
        return False


# ══════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════
def check_system_health(api_key=None):
    current_key = api_key or os.getenv("GROQ_API_KEY", "")
    current_model = os.getenv("GROQ_MODEL", GROQ_MODEL)
    has_valid_key = bool(current_key and not current_key.startswith("your-") and len(current_key) > 10)
    
    health = {
        "groq": False,
        "faiss_index": os.path.exists(FAISS_INDEX_DIR),
        "model": current_model,
        "pipeline_version": PROMPT_VERSION,
        "reranker": RERANKER_AVAILABLE,
        "has_api_key": has_valid_key,
        "tavily": bool(os.getenv("TAVILY_API_KEY", "") and not os.getenv("TAVILY_API_KEY", "").startswith("your-")),
        "message": "Healthy"
    }

    if not health["faiss_index"]:
        health["message"] = "Knowledge base index missing. Please run vector ingestion."
    elif not has_valid_key:
        health["message"] = "Groq API key not configured or empty."
    else:
        try:
            test_llm = get_llm(api_key=current_key, model=current_model)
            test_llm.invoke([HumanMessage(content="test")])
            health["groq"] = True
            health["message"] = "All systems operational"
        except Exception as e:
            health["groq"] = False
            health["message"] = f"Groq LLM connection error: {str(e)}"
            
    return health


# ══════════════════════════════════════════════════════════════
# MAIN — CLI entry point for indexing
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    if "--ingest" in sys.argv:
        build_faiss_index()
    else:
        logger.info("Usage: python backend.py --ingest")