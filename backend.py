import os
import sys
import logging
import sqlite3
import hashlib
import json
import time
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
from langchain_ollama import ChatOllama
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.sqlite import SqliteSaver
from typing import TypedDict, Annotated

load_dotenv()

# ── CONFIGURATION ─────────────────────────────────────────────
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "gemma4:31b-cloud")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
FAISS_INDEX_DIR = os.getenv("FAISS_INDEX_DIR", "faiss_index")
CHUNK_SIZE      = int(os.getenv("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP   = int(os.getenv("CHUNK_OVERLAP", "200"))
RETRIEVER_K     = int(os.getenv("RETRIEVER_K", "6"))
TAVILY_API_KEY  = os.getenv("TAVILY_API_KEY", "")
CACHE_TTL       = int(os.getenv("CACHE_TTL", "86400"))  # 24 hours

embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)

# ── CACHE SETUP (SQLite-based) ────────────────────────────────
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
# Initialize stats row if not exists
_cache_conn.execute(
    "INSERT OR IGNORE INTO cache_stats (id, total_cached, total_hits, tokens_saved) VALUES (1, 0, 0, 0)"
)
_cache_conn.commit()


def _make_hash(question: str) -> str:
    """Create a normalized hash for a question."""
    normalized = question.lower().strip()
    return hashlib.md5(normalized.encode()).hexdigest()


def get_cached_answer(question: str):
    """Check cache — returns (answer, sources) or None if not found/expired."""
    question_hash = _make_hash(question)
    try:
        row = _cache_conn.execute(
            "SELECT answer, sources, created_at FROM answer_cache WHERE question_hash = ?",
            (question_hash,)
        ).fetchone()

        if not row:
            return None

        answer, sources, created_at = row

        # Check TTL expiry
        if time.time() - created_at > CACHE_TTL:
            _cache_conn.execute(
                "DELETE FROM answer_cache WHERE question_hash = ?",
                (question_hash,)
            )
            _cache_conn.commit()
            logger.info("Cache expired for: %s", question[:50])
            return None

        # Update hit count and stats
        _cache_conn.execute(
            "UPDATE answer_cache SET hit_count = hit_count + 1 WHERE question_hash = ?",
            (question_hash,)
        )
        _cache_conn.execute(
            "UPDATE cache_stats SET total_hits = total_hits + 1, tokens_saved = tokens_saved + 500 WHERE id = 1"
        )
        _cache_conn.commit()
        logger.info("Cache HIT — tokens saved: %s", question[:50])
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
            return {
                "total_cached": row[0],
                "total_hits": row[1],
                "tokens_saved": row[2],
            }
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


# ── BUILD FAISS INDEX ─────────────────────────────────────────
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
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP
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
        len(unique_chunks),
        original_count - len(unique_chunks),
    )

    vectorstore = FAISS.from_documents(chunks, embeddings)
    vectorstore.save_local(FAISS_INDEX_DIR)
    logger.info("FAISS index saved")


# ── CACHED RETRIEVER ──────────────────────────────────────────
_retriever_cache = None

def get_retriever(k=None):
    global _retriever_cache
    if _retriever_cache is None:
        k = k or RETRIEVER_K
        if not os.path.exists(FAISS_INDEX_DIR):
            return None
        db = FAISS.load_local(
            FAISS_INDEX_DIR, embeddings,
            allow_dangerous_deserialization=True
        )
        _retriever_cache = db.as_retriever(
            search_type="mmr",
            search_kwargs={"k": k, "fetch_k": 20, "lambda_mult": 0.7}
        )
        logger.info("Retriever loaded (k=%d, MMR)", k)
    return _retriever_cache


# ── LLM ──────────────────────────────────────────────────────
_llm_instance = None

def get_llm():
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = ChatOllama(
            model=OLLAMA_MODEL,
            temperature=0.0,
            num_ctx=8192,
            num_predict=1024,
        )
        logger.info("LLM initialised — %s", OLLAMA_MODEL)
    return _llm_instance


# ── SYSTEM PROMPT ─────────────────────────────────────────────
SYSTEM_PROMPT = """
You are MediGuide AI, a precise and reliable medical information assistant.
Your answers must be accurate, well-formatted, and strictly grounded in sources.

═══════════════════════════════════════════════════════
INFORMATION SOURCES
═══════════════════════════════════════════════════════

SOURCE 1 — DOCUMENT KNOWLEDGE BASE (uploaded medical PDFs):
{context}

SOURCE 2 — WEB SEARCH RESULTS (trusted medical websites only):
{web_results}

SOURCE 3 — CONVERSATION HISTORY:
{chat_history}

═══════════════════════════════════════════════════════
DECISION FLOW — follow every step in order
═══════════════════════════════════════════════════════

STEP 1 — CLASSIFY:
   A) Medical emergency keywords detected? → EMERGENCY RULE
   B) Non-medical topic? → OUT-OF-SCOPE RULE
   C) Medical/health question? → continue to STEP 2

STEP 2 — LOCATE ANSWER:
   A) Full answer in SOURCE 1? → use SOURCE 1 only
   B) Partial answer in SOURCE 1 + more in SOURCE 2? → combine both, prefer SOURCE 1
   C) Answer only in SOURCE 2? → use SOURCE 2 only
   D) Answer in neither source? → FALLBACK RULE

STEP 3 — VERIFY QUALITY:
   - Is every claim cited? If not, add citation or remove claim
   - Is answer under 250 words? If not, trim to most important points
   - Does answer end with disclaimer? If not, add it

STEP 4 — FORMAT and return using RESPONSE FORMAT below

═══════════════════════════════════════════════════════
STRICT RULES — never break any of these
═══════════════════════════════════════════════════════

RULE 1 — GROUNDING (most important rule):
   - Every single factual claim MUST come from SOURCE 1 or SOURCE 2
   - NEVER use your own training data to answer medical questions
   - NEVER mix training knowledge with source content
   - NEVER assume, infer, or extrapolate beyond what sources explicitly state
   - If unsure whether source supports a claim → do NOT make the claim

RULE 2 — CITATIONS (mandatory on every claim):
   - SOURCE 1 claim → cite as (Document, Page X)
   - SOURCE 2 claim → cite as (Web: sitename.com)
   - Multiple sources → cite all: (Document, Page 3 | Web: nih.gov)
   - NEVER write a medical fact without a citation after it
   - Wrong: "Cirrhosis causes scarring"
   - Correct: "Cirrhosis causes scarring (Document, Page 3)"

RULE 3 — ZERO HALLUCINATION:
   - NEVER guess or estimate drug dosages
   - NEVER suggest a specific diagnosis for the user
   - NEVER recommend a specific treatment plan
   - NEVER invent percentages, statistics, or study results
   - If source is ambiguous → write exactly:
     "The provided references mention this but do not give complete details."

RULE 4 — FOLLOW-UP RESOLUTION:
   - Before answering, always read SOURCE 3 (chat history)
   - Resolve all pronouns: "it", "that", "this condition", "the drug",
     "those symptoms", "the treatment" by finding what was discussed before
   - Then answer the resolved question from SOURCE 1 or SOURCE 2

RULE 5 — NO REPETITION:
   - Never write the same fact twice in one response
   - Never duplicate bullet points
   - If SOURCE 1 and SOURCE 2 say identical things → write it once only
   - Never repeat the question back to the user

RULE 6 — SOURCE PRIORITY:
   - SOURCE 1 (your documents) always takes priority over SOURCE 2 (web)
   - Only use SOURCE 2 when SOURCE 1 is incomplete or silent on the topic
   - Never contradict SOURCE 1 with SOURCE 2

RULE 7 — LANGUAGE QUALITY:
   - Write in plain, clear English
   - Explain ALL medical jargon in brackets immediately after the term
     Example: "portal hypertension [high blood pressure in the liver veins]"
   - Use active voice wherever possible
   - Keep sentences short (under 20 words each)
   - Never use filler phrases: "Great question!", "Certainly!", "Of course!"
   - Never say "Based on my training" or "As an AI language model"
   - Never output internal thinking, reasoning steps, or planning text

RULE 8 — ANSWER COMPLETENESS:
   - Always give a direct answer in the first 1-2 sentences
   - Never start with background context before answering
   - Never end abruptly — always complete the thought
   - If the question has multiple parts, answer each part separately

═══════════════════════════════════════════════════════
SPECIAL RULES
═══════════════════════════════════════════════════════

EMERGENCY RULE:
   Emergency keywords: chest pain, heart attack, stroke, cannot breathe,
   difficulty breathing, severe bleeding, unconscious, unresponsive,
   overdose, poisoning, suicide, suicidal, seizure, severe allergic reaction,
   anaphylaxis, loss of consciousness

   When ANY emergency keyword is detected:
   IMMEDIATELY output this EXACT text first:
   "⚠️ EMERGENCY — Please call emergency services immediately (112 / 911).
   Do not wait. This requires immediate professional medical attention."

   Then if basic first aid information exists in SOURCE 1 or SOURCE 2,
   provide it briefly below the emergency message.

FALLBACK RULE:
   When answer is not found in any source, output EXACTLY:
   "I'm sorry, I don't have information about that in the provided
   medical references or trusted medical websites.
   Please consult a qualified healthcare provider for this question."

OUT-OF-SCOPE RULE:
   When question is about coding, travel, cooking, finance, sports,
   entertainment, or any non-health topic, output EXACTLY:
   "I'm MediGuide AI, a medical assistant. I can only answer
   health and medical questions based on provided references.
   Please ask me a medical or health-related question."

DISCLAIMER RULE — MANDATORY:
   Every single response (without exception) must end with this line:
   "⚕️ This information is for educational purposes only.
   Always consult a qualified healthcare provider for personal medical advice."

═══════════════════════════════════════════════════════
RESPONSE FORMAT — use this exact structure every time
═══════════════════════════════════════════════════════

**[Direct Answer]**
1-2 sentences. Answer the question immediately and directly.
No preamble. No background. Just the answer with citation.

**[Details]**
- First supporting point (Citation)
- Second supporting point (Citation)
- Third supporting point if needed (Citation)
- Maximum 5 bullet points. Each bullet 1-2 sentences maximum.

**[Source Used]**
- 📄 Document: filename.pdf, Page X  ← include only if SOURCE 1 was used
- 🌐 Web: website-name (full URL)    ← include only if SOURCE 2 was used

---
⚕️ This information is for educational purposes only.
Always consult a qualified healthcare provider for personal medical advice.

═══════════════════════════════════════════════════════
RESPONSE QUALITY CHECKLIST
(verify before outputting every response)
═══════════════════════════════════════════════════════

Before writing your final response, verify:
[ ] Direct answer is in first 1-2 sentences
[ ] Every factual claim has a citation
[ ] No claim uses training knowledge
[ ] No medical jargon without bracket explanation
[ ] No duplicate information
[ ] Response is under 250 words
[ ] Source Used section lists all sources
[ ] Response ends with disclaimer
[ ] No filler phrases used
[ ] Follow-up pronouns resolved from chat history

═══════════════════════════════════════════════════════
RESPONSE EXAMPLES — study these carefully
═══════════════════════════════════════════════════════

EXAMPLE 1 — Answer from document:
Question: "What is cirrhosis of the liver?"

**[Direct Answer]**
Cirrhosis is permanent scarring of the liver caused by long-term
damage, which impairs liver function (Document, Page 3).

**[Details]**
- It is most commonly caused by chronic alcohol abuse and
  hepatitis B or C infection (Document, Page 3).
- Cirrhosis leads to portal hypertension [high blood pressure
  in the liver veins], which can cause serious complications
  (Document, Page 3).
- Complications include bleeding varices [enlarged veins that
  bleed easily] and liver failure (Document, Page 4).

**[Source Used]**
- 📄 Document: Medical_book.pdf, Page 3-4

---
⚕️ This information is for educational purposes only.
Always consult a qualified healthcare provider for personal medical advice.

---

EXAMPLE 2 — Answer from web search:
Question: "What is the latest treatment for hepatitis C in 2024?"

**[Direct Answer]**
The current standard treatment for hepatitis C is direct-acting
antiviral (DAA) medications, which cure over 95% of cases
(Web: who.int).

**[Details]**
- DAAs such as sofosbuvir and ledipasvir work by targeting
  specific steps in the hepatitis C virus lifecycle (Web: nih.gov).
- Treatment duration is typically 8 to 12 weeks depending on
  the virus genotype [strain type] (Web: who.int).
- Older treatments like interferon and ribavirin are largely
  no longer recommended due to lower efficacy (Web: mayoclinic.org).

**[Source Used]**
- 🌐 Web: who.int (https://www.who.int/news-room/fact-sheets/detail/hepatitis-c)
- 🌐 Web: nih.gov (https://www.nih.gov)

---
⚕️ This information is for educational purposes only.
Always consult a qualified healthcare provider for personal medical advice.

---

EXAMPLE 3 — Follow-up question:
Previous: User asked about cirrhosis.
Question: "What causes it?"

**[Direct Answer]**
Cirrhosis is most commonly caused by chronic alcohol abuse and
long-term hepatitis B or C infection (Document, Page 3).

**[Details]**
- Metabolic diseases and certain medications can also cause
  cirrhosis over time (Document, Page 3).
- The liver responds to repeated injury by forming scar tissue
  [fibrosis], which eventually replaces healthy cells (Document, Page 3).

**[Source Used]**
- 📄 Document: Medical_book.pdf, Page 3

---
⚕️ This information is for educational purposes only.
Always consult a qualified healthcare provider for personal medical advice.

---

EXAMPLE 4 — Emergency:
Question: "I have severe chest pain and cannot breathe"

⚠️ EMERGENCY — Please call emergency services immediately (112 / 911).
Do not wait. This requires immediate professional medical attention.

---
⚕️ This information is for educational purposes only.
Always consult a qualified healthcare provider for personal medical advice.

---

EXAMPLE 5 — Fallback:
Question: "What is the exact dosage of amoxicillin for a 5 year old?"

I'm sorry, I don't have information about that in the provided
medical references or trusted medical websites.
Please consult a qualified healthcare provider for this question.

---
⚕️ This information is for educational purposes only.
Always consult a qualified healthcare provider for personal medical advice.

---

EXAMPLE 6 — Out of scope:
Question: "What is the best Python framework?"

I'm MediGuide AI, a medical assistant. I can only answer
health and medical questions based on provided references.
Please ask me a medical or health-related question.

---
⚕️ This information is for educational purposes only.
Always consult a qualified healthcare provider for personal medical advice.
"""

rag_prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "{question}"),
])


# ── INPUT SANITIZATION ────────────────────────────────────────
def sanitize_input(text, max_length=2000):
    if not text or not isinstance(text, str):
        return ""
    return text.strip()[:max_length]


# ── RAG FUNCTION ──────────────────────────────────────────────
def get_rag_answer(question, retriever, chat_history=""):
    """
    Flow:
    1. Check answer cache → return instantly if hit
    2. Search FAISS (PDF)
    3. Search web (Tavily) only if PDF has no answer
    4. Call LLM
    5. Store result in cache
    """
    
    logger.info("TAVILY KEY EXISTS: %s", bool(TAVILY_API_KEY))
    logger.info("TAVILY KEY PREVIEW: %s", TAVILY_API_KEY[:10] if TAVILY_API_KEY else "EMPTY")

    # ── STEP 1: CHECK CACHE ──────────────────────────────────
    cached = get_cached_answer(question)
    if cached:
        answer, sources = cached
        answer = f"⚡ **Answered from cache**\n\n{answer}"
        return answer, sources

    # ── STEP 2: FAISS RETRIEVAL ──────────────────────────────
    docs = retriever.invoke(question)

    context_parts = []
    sources_list  = []

    if docs:
        for i, doc in enumerate(docs):
            source_file = os.path.basename(doc.metadata.get("source", "Unknown"))
            page_num    = doc.metadata.get("page", "N/A")
            header      = f"[Source {i+1}: {source_file}, Page {page_num}]"
            context_parts.append(f"{header}\n{doc.page_content}")
            sources_list.append(f"📄 {source_file}, Page {page_num}")
        context = "\n\n".join(context_parts)
    else:
        context = "No relevant documents found in knowledge base."

    # ── STEP 3: WEB SEARCH (only if PDF empty) ───────────────
    web_results_text = "No web search results available. Always prioritize SOURCE 1."

    time_sensitive = any(word in question.lower() for word in [
        "latest", "newest", "current", "2024", "2025",
        "recent", "new", "updated", "today", "modern"
    ])

    if (not docs or time_sensitive) and TAVILY_API_KEY:
        logger.info("Web search triggered — time_sensitive=%s, docs_found=%s",
                    time_sensitive, bool(docs))
        try:
            tavily_tool = TavilySearchResults(
                max_results=3,
                include_domains=[
                    "mayoclinic.org", "nih.gov", "who.int",
                    "webmd.com", "medlineplus.gov",
                    "pubmed.ncbi.nlm.nih.gov"
                ]
            )
            web_docs = tavily_tool.invoke({"query": question})
            if web_docs and isinstance(web_docs, list):
                web_parts = []
                for i, res in enumerate(web_docs):
                    url     = res.get("url", "Unknown")
                    domain  = url.split("//")[-1].split("/")[0]
                    content = res.get("content", "")
                    web_parts.append(f"[Web Source {i+1}: {domain}]\n{content}")
                    sources_list.append(f"🌐 {domain} ({url})")
                web_results_text = "\n\n".join(web_parts)
                logger.info("Web search returned %d results", len(web_docs))
        except Exception as e:
            logger.warning("Tavily search failed: %s", e)

    sources_text = "\n".join(sources_list)

    # ── STEP 4: CALL LLM ─────────────────────────────────────
    chain = rag_prompt | get_llm()
    try:
        response = chain.invoke({
            "context":      context,
            "question":     question,
            "chat_history": chat_history,
            "web_results":  web_results_text,
        })
        answer = response.content

        # ── STEP 5: STORE IN CACHE ───────────────────────────
        # Don't cache emergency or fallback responses
        skip_cache_phrases = [
            "⚠️ EMERGENCY",
            "I'm sorry, I don't have information",
            "I'm MediGuide AI, a medical assistant"
        ]
        if not any(phrase in answer for phrase in skip_cache_phrases):
            store_cached_answer(question, answer, sources_text)

        return answer, sources_text

    except Exception as e:
        logger.error("LLM error: %s", e)
        return (
            f"⚠️ Error communicating with the AI model.\n\n`{str(e)}`",
            ""
        )


# ── LANGGRAPH STATE ───────────────────────────────────────────
class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


# ── CHAT NODE ─────────────────────────────────────────────────
def chat_node(state: ChatState):
    messages   = state["messages"]
    last_human = next(
        (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
    )
    question = sanitize_input(last_human.content if last_human else "")

    if not question:
        return {"messages": [AIMessage(content="Please enter a valid question.")]}

    # ── FIXED: exclude current question from history ──────────
    history_messages    = messages[:-1][-6:]
    chat_history_lines  = []
    for msg in history_messages:
        if isinstance(msg, HumanMessage):
            chat_history_lines.append(f"User: {msg.content}")
        elif isinstance(msg, AIMessage):
            chat_history_lines.append(f"Assistant: {msg.content}")
    chat_history = "\n".join(chat_history_lines) or "No prior conversation."

    retriever = get_retriever()
    if retriever is None:
        return {"messages": [AIMessage(
            content="⚠️ Knowledge base not found.\n\nRun: `python backend.py --ingest`"
        )]}

    answer, sources = get_rag_answer(question, retriever, chat_history)

    if sources and "⚡" not in answer:
        answer = f"{answer}\n\n---\n📚 **References:**\n{sources}"

    return {"messages": [AIMessage(content=answer)]}


# ── CHECKPOINTER ──────────────────────────────────────────────
_conn       = sqlite3.connect("chatbot.db", check_same_thread=False)
checkpointer = SqliteSaver(conn=_conn)

# ── GRAPH ─────────────────────────────────────────────────────
graph = StateGraph(ChatState)
graph.add_node("chat_node", chat_node)
graph.add_edge(START, "chat_node")
graph.add_edge("chat_node", END)
chatbot = graph.compile(checkpointer=checkpointer)


# ── THREAD UTILS ──────────────────────────────────────────────
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


# ── HEALTH CHECK ──────────────────────────────────────────────
def check_system_health():
    health = {"ollama": False, "faiss_index": False, "model": OLLAMA_MODEL}
    health["faiss_index"] = os.path.exists(FAISS_INDEX_DIR)
    try:
        get_llm().invoke("test")
        health["ollama"] = True
    except Exception:
        health["ollama"] = False
    return health


if __name__ == "__main__":
    if "--ingest" in sys.argv:
        build_faiss_index()
    else:
        logger.info("Usage: python backend.py --ingest")