import uuid
import streamlit as st
from datetime import datetime

from langchain_core.messages import HumanMessage

from backend import (
    chatbot,
    retrieve_all_threads,
    check_system_health,
    delete_thread,
    checkpointer,
    get_cache_stats,
    clear_cache,
)

# ──────────────────────────────────────────────────────────────
# PAGE CONFIG
# ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="MediGuide AI — Medical Assistant",
    page_icon="🩺",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ──────────────────────────────────────────────────────────────
# CLEAN NATIVE CSS OVERRIDES
# ──────────────────────────────────────────────────────────────
st.markdown("""
<style>
    /* Clean up the main container spacing */
    .block-container {
        padding-top: 2rem !important;
        padding-bottom: 5rem !important;
        max-width: 840px !important;
    }
    
    /* Hide the top decoration line */
    [data-testid="stDecoration"] {
        display: none !important;
    }
    

    /* Style all buttons to look premium */
    .stButton > button {
        border-radius: 8px !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        transition: all 0.2s ease !important;
        padding: 8px 16px !important;
    }
    
    .stButton > button:hover {
        border-color: #6366f1 !important;
        color: #6366f1 !important;
        background-color: rgba(99, 102, 241, 0.05) !important;
    }

    /* Style the Chat Input */
    [data-testid="stChatInput"] {
        border-radius: 12px !important;
    }
</style>
""", unsafe_allow_html=True)


# ──────────────────────────────────────────────────────────────
# HEALTH CHECK
# ──────────────────────────────────────────────────────────────
@st.cache_data(ttl=30)
def run_health_check():
    return check_system_health()

health = run_health_check()


# ──────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────
def load_thread_messages(thread_id):
    """Load messages from a thread's checkpoint."""
    try:
        config = {"configurable": {"thread_id": thread_id}}
        state = chatbot.get_state(config)
        if state and state.values and "messages" in state.values:
            messages = []
            for msg in state.values["messages"]:
                if hasattr(msg, "content"):
                    role = "user" if isinstance(msg, HumanMessage) else "assistant"
                    messages.append({"role": role, "content": msg.content})
            return messages
    except Exception:
        pass
    return []


def get_thread_label(thread_id):
    """Get a meaningful label for a thread (first user message)."""
    try:
        config = {"configurable": {"thread_id": thread_id}}
        state = chatbot.get_state(config)
        if state and state.values and "messages" in state.values:
            for msg in state.values["messages"]:
                if isinstance(msg, HumanMessage) and msg.content:
                    label = msg.content[:35]
                    if len(msg.content) > 35:
                        label += "…"
                    return label
    except Exception:
        pass
    return f"New conversation"


# ──────────────────────────────────────────────────────────────
# SESSION STATE
# ──────────────────────────────────────────────────────────────
if "messages" not in st.session_state:
    st.session_state.messages = []

if "trigger_input" not in st.session_state:
    st.session_state.trigger_input = None

if "thread_id" not in st.session_state:
    st.session_state.thread_id = str(uuid.uuid4())

if "threads" not in st.session_state:
    st.session_state.threads = retrieve_all_threads()


# ──────────────────────────────────────────────────────────────
# SIDEBAR — Navigation
# ──────────────────────────────────────────────────────────────
with st.sidebar:
    # Header
    st.markdown("<h1 style='text-align: center; font-size: 2.2rem; margin-bottom: 0;'>🩺 MediGuide AI</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; color: #a1a1aa; font-size: 0.9rem;'>Clinical Reasoning Engine</p>", unsafe_allow_html=True)
    
    st.divider()
    
    # Status
    ollama_status = "🟢" if health["ollama"] else "🔴"
    faiss_status = "🟢" if health["faiss_index"] else "🔴"
    reranker_status = "🟢" if health.get("reranker") else "🟡"
    
    st.markdown(f"**System Status**")
    st.markdown(
        f"{ollama_status} LLM (`{health['model']}`)<br>"
        f"{faiss_status} Knowledge Base<br>"
        f"{reranker_status} Reranker<br>"
        f"🔖 Pipeline `{health.get('pipeline_version', 'v1')}`",
        unsafe_allow_html=True,
    )
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # New Chat
    if st.button("➕ New Conversation", use_container_width=True):
        st.session_state.messages = []
        new_thread = str(uuid.uuid4())
        st.session_state.thread_id = new_thread
        if new_thread not in st.session_state.threads:
            st.session_state.threads.append(new_thread)
        st.rerun()

    st.markdown("<br>", unsafe_allow_html=True)
    
    st.divider()
    st.markdown("**Cache Stats**")
    stats = get_cache_stats()
    st.markdown(f"⚡ Cached answers: `{stats['total_cached']}`")
    st.markdown(f"🎯 Cache hits: `{stats['total_hits']}`")
    st.markdown(f"💰 Tokens saved: `~{stats['tokens_saved']}`")
    if st.button("🗑️ Clear Cache", use_container_width=True):
        clear_cache()
        st.success("Cache cleared!")
        st.rerun()
    
    st.markdown("<br>", unsafe_allow_html=True)

    # Chat History
    if st.session_state.threads:
        st.markdown("**Recent Chats**")
        
        for tid in reversed(st.session_state.threads):
            # Use native Streamlit columns that align perfectly
            col1, col2 = st.columns([5, 1])
            with col1:
                label = get_thread_label(tid)
                is_active = tid == st.session_state.thread_id
                btn_label = f"{'▸ ' if is_active else ''}{label}"
                
                if st.button(btn_label, key=f"select_{tid}", use_container_width=True):
                    st.session_state.thread_id = tid
                    st.session_state.messages = load_thread_messages(tid)
                    st.rerun()
            with col2:
                if st.button("🗑️", key=f"del_{tid}"):
                    delete_thread(tid)
                    st.session_state.threads.remove(tid)
                    if st.session_state.thread_id == tid:
                        st.session_state.messages = []
                        st.session_state.thread_id = str(uuid.uuid4())
                    st.rerun()


# ──────────────────────────────────────────────────────────────
# MAIN AREA — Health Warnings
# ──────────────────────────────────────────────────────────────
if not health["faiss_index"]:
    st.error("⚠️ **Knowledge base not found.** Run: `python backend.py --ingest`")

if not health["ollama"]:
    st.warning(f"⚠️ **Cannot reach Ollama model** `{health['model']}`. Make sure Ollama is running.")


# ──────────────────────────────────────────────────────────────
# WELCOME SCREEN
# ──────────────────────────────────────────────────────────────
if not st.session_state.messages:
    # Beautiful welcome header
    st.markdown("<h1 style='text-align: center; font-size: 2.8rem; margin-bottom: 0; color: #f8fafc;'>How can I help you today?</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; color: #94a3b8; font-size: 1.1rem; margin-bottom: 3rem;'>Ask me anything about medical conditions, treatments, and clinical scenarios from the uploaded reference materials.</p>", unsafe_allow_html=True)

    # Suggestion Chips — includes clinical scenarios
    suggestions = [
        "A 45-year-old male has chest pain radiating to the left arm, sweating, and nausea. What could this be?",
        "What are the symptoms of liver cirrhosis?",
        "What are the latest diabetes treatment guidelines?",
        "How are gallstones detected on ultrasound?",
    ]

    cols = st.columns(2)
    for i, text in enumerate(suggestions):
        with cols[i % 2]:
            if st.button(f"💬 {text}", key=f"suggestion_{i}", use_container_width=True):
                st.session_state.trigger_input = text
                st.rerun()

    st.markdown("<br><br>", unsafe_allow_html=True)
    
    # Disclaimer
    st.info("⚕️ **Medical Disclaimer**: This AI provides information from uploaded medical references only. Not a substitute for professional medical advice. Always consult a qualified healthcare provider.")


# ──────────────────────────────────────────────────────────────
# DISPLAY EXISTING MESSAGES
# ──────────────────────────────────────────────────────────────
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])


# ──────────────────────────────────────────────────────────────
# CHAT INPUT & RESPONSE
# ──────────────────────────────────────────────────────────────
user_input = st.chat_input("Ask a medical question…")

if st.session_state.trigger_input:
    user_input = st.session_state.trigger_input
    st.session_state.trigger_input = None

if user_input:
    # Input validation
    if len(user_input) > 2000:
        st.warning("⚠️ Please keep your question under 2,000 characters.")
        st.stop()

    # Save & display user message
    st.session_state.messages.append({"role": "user", "content": user_input})
    with st.chat_message("user"):
        st.markdown(user_input)

    # Config for this thread
    CONFIG = {
        "configurable": {
            "thread_id": st.session_state.thread_id,
        }
    }

    # AI response — real token-by-token streaming
    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        full_response = ""

        try:
            for chunk, metadata in chatbot.stream(
                {"messages": [HumanMessage(content=user_input)]},
                config=CONFIG,
                stream_mode="messages",
            ):
                if hasattr(chunk, "content") and chunk.content:
                    # Only stream tokens from clinical reasoning & input (cache hits)
                    # Skip internal nodes (entity extraction, retrieval, etc.)
                    node = metadata.get("langgraph_node", "")
                    if node in ("clinical_reasoning", "input_processing", ""):
                        full_response += chunk.content
                        message_placeholder.markdown(full_response + " ▌")
            message_placeholder.markdown(full_response)
        except Exception as e:
            full_response = (
                f"⚠️ **Connection Error**\n\n"
                f"Could not get a response from the AI model. "
                f"Please ensure Ollama is running.\n\n"
                f"`{str(e)}`"
            )
            message_placeholder.error(full_response)

    # Save AI response
    st.session_state.messages.append(
        {"role": "assistant", "content": full_response}
    )

    # Add thread to list if new
    if st.session_state.thread_id not in st.session_state.threads:
        st.session_state.threads.append(st.session_state.thread_id)