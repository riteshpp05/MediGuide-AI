# MediGuide AI — Project Vision, Goals & Roadmap

> **Document purpose:** This is the single source of truth for what MediGuide AI is, why it exists, what's already built, and what's next. Anyone reading this — a recruiter, a teammate, or future-you six months from now — should understand the full picture in one pass.

---

## 1. Problem Statement

Millions of people search symptoms online every day and land on unreliable, unsourced, or fear-mongering content. Existing tools fall into two broken categories:

- **Generic chatbots** that hallucinate medical facts with no citations and no safety net.
- **Static symptom checkers** (rule-based) that are rigid, can't reason across multiple symptoms, and can't explain *why* they reached a conclusion.

**The gap:** There is no accessible, transparent, safety-first assistant that reasons like a clinician, cites real evidence, and knows the difference between "let's monitor this" and "call an ambulance now."

## 2. Project Goal

> Build a **medically-grounded, evidence-cited, safety-first AI assistant** that helps users understand symptoms and medical questions through real clinical reasoning — never guessing, always sourcing, and always erring toward caution when human life is at risk.

MediGuide AI is explicitly **not** trying to diagnose or replace a doctor. Its goal is to be the smartest, safest *first step* between "I don't know what's wrong" and "I need to see someone."

### Guiding principles (non-negotiable)
1. **Safety over helpfulness.** A missed emergency flag is a worse failure than an overly cautious one.
2. **No hallucination.** Every clinical claim must trace back to a retrieved document or trusted source.
3. **Transparency.** The user (or evaluator) can always see *why* the system said what it said.
4. **Humility.** Confidence is expressed, not assumed. Uncertain answers say so.

---

## 3. Current System (v1 — What's Already Built)

| Layer | Technology | Role |
|---|---|---|
| Frontend | Streamlit | Chat UI |
| LLM Engine | Llama 3.3 70B (via Groq) | Reasoning & response generation |
| Vector Store | FAISS | Local medical PDF retrieval |
| Reranker | Cross-Encoder | Filters top 6 most relevant evidence chunks |
| Web Search | Tavily API | Restricted to trusted domains (WHO, NIH, ADA, Mayo Clinic) |
| Orchestration | LangChain + LangGraph | Pipeline & multi-step reasoning flow |
| Memory | SQLite | Conversation history + answer cache |

### Current Pipeline (4 nodes)
```
User Input
   │
   ▼
[1] Input Processing ──► Cache check → Entity extraction → Emergency detection
   │
   ▼
[2] Retrieval & Reranking ──► FAISS search → Cross-encoder rerank → Top 6 chunks
   │
   ▼
[3] Conditional Web Search ──► Trusted-domain-only fallback if PDF evidence insufficient
   │
   ▼
[4] Clinical Reasoning (LLM) ──► Patient summary → Differential diagnosis → Cited recommendation
```

**What's genuinely strong here already:** deterministic emergency detection *before* the LLM is even called, evidence reranking (not just naive top-k), and domain-restricted web search. This is meaningfully more rigorous than a typical RAG demo.

---

## 4. What's Missing (v1 → v2 Gap Analysis)

A senior reviewer's honest read: **the pipeline is well-engineered, but it's unproven.** There is no evidence yet that the system is *actually* safe or accurate — only that it's architecturally sound. v2 closes that gap.

---

## 5. Roadmap — Goals for v2

### 🎯 Goal A: Prove it's safe (Evaluation Harness) — **Highest Priority**
The single most important thing this project is missing. Without this, every safety claim is just an assertion.

- [ ] Build a golden test set: 150–200 curated Q&A pairs (normal questions + edge cases + adversarial prompts)
- [ ] Build a **dedicated emergency-detection benchmark** — this number matters more than any other metric in the whole project. Target: measure and report recall (missed emergencies are the worst possible failure)
- [ ] Add faithfulness scoring (RAGAS or custom): does every claim in the answer trace to retrieved evidence?
- [ ] Track hallucination rate via manual + automated sampling
- [ ] Publish results in the README as a scorecard, not just a features list

### 🎯 Goal B: Make it self-check its own answers (Verifier Agent)
- [ ] Add a second LangGraph node: a verifier LLM pass that checks the drafted answer against retrieved evidence and flags unsupported claims before the response ever reaches the user
- [ ] Reject or rewrite responses that fail verification

### 🎯 Goal C: Express uncertainty, not just answers
- [ ] Add confidence scoring per differential diagnosis
- [ ] Surface a visible "⚠️ limited evidence" banner when sources are thin or conflicting
- [ ] Detect and flag contradictions between PDF evidence and web search results (e.g., outdated document vs. current WHO guidance)

### 🎯 Goal D: Realistic triage, not binary emergency/not-emergency
- [ ] Move from binary emergency detection to a graded urgency scale (inspired by the real-world Emergency Severity Index): *Emergency now → Same-day care → Monitor 48h → Routine*

### 🎯 Goal E: Explainability trace
- [ ] Expose a "How I reached this answer" expandable panel: retrieved chunks, rerank scores, whether web search fired and why, which emergency rule (if any) triggered

### 🎯 Goal F: Production-grade guardrails
- [ ] PII scrubbing before logging/caching conversations
- [ ] Rate limiting / abuse pattern detection
- [ ] Documented, enforced refusal policy for anything beyond educational scope (e.g., specific controlled-substance dosing)

---

## 6. UI Goal: Floating Assistant Widget

**Requirement:** Instead of (or in addition to) a full-page Streamlit chat, add a **floating chatbot widget docked in the bottom-right corner** of a dashboard — the familiar "Intercom-style" pattern — so MediGuide can sit on top of any screen/dashboard rather than being the whole page.

### Suggested approach
- Since Streamlit doesn't natively support floating overlay widgets well, the corner-widget pattern is best built as a **custom HTML/CSS/JS component** (via `streamlit.components.v1.html`) or, if you want it production-grade, migrate the frontend shell to a lightweight React/Next.js layer that embeds the existing LangGraph backend as an API.
- **Collapsed state:** a circular floating action button (bottom-right, fixed position, subtle pulse/glow if there's an unread emergency-related message).
- **Expanded state:** a slide-up chat panel (~380px wide, ~600px tall) docked to the corner, not full-screen — so it always feels like an overlay on top of real work, not a replacement for the page.
- **Emergency state override:** if the emergency detector fires, the widget should visually change (red border, non-dismissible banner) — the UI itself should reflect the urgency tier from Goal D, not just plain text in a chat bubble.
- **Persistent across dashboard pages:** if you build this as a real dashboard (e.g., a patient portal, hospital ops view), the widget should persist in a shared layout component so it's available everywhere, not re-mounted per page.

### My recommendation
Keep Streamlit for rapid iteration on the reasoning pipeline (backend), but treat the **UI as a separate concern**: expose your LangGraph pipeline as a FastAPI backend, then build the corner-widget frontend in React so you get real control over positioning, animation, and state — this also happens to be a stronger portfolio signal (shows you can separate concerns and ship a real product surface, not just a Streamlit demo).

---

## 7. Success Criteria (How We'll Know v2 Is Done)

| Metric | Target |
|---|---|
| Emergency detection recall | Measured & reported (aim as close to 100% as possible; false positives acceptable, false negatives are not) |
| Faithfulness score (claims traced to evidence) | Measured & reported, tracked over time |
| Verifier agent catch rate | % of unsupported claims caught before reaching user |
| UI | Persistent floating widget, urgency-aware visual states |
| Documentation | This roadmap + published eval scorecard in README |

---

## 8. One-Line Pitch (for resume / portfolio)

> *"MediGuide AI — a safety-first, evidence-cited medical reasoning assistant with a measured emergency-detection recall rate, self-verifying RAG pipeline, and graded clinical urgency triage — not just another medical chatbot."*
