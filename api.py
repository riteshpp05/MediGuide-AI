import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import json
import logging
from langchain_core.messages import HumanMessage
from backend import chatbot

app = FastAPI(title="MediGuide AI API")

# Mount a static directory to serve the frontend
import os
os.makedirs("static", exist_ok=True)

class ChatRequest(BaseModel):
    message: str
    thread_id: str

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    config = {"configurable": {"thread_id": req.thread_id}}
    
    async def event_stream():
        try:
            for chunk, metadata in chatbot.stream(
                {"messages": [HumanMessage(content=req.message)]},
                config=config,
                stream_mode="messages"
            ):
                if hasattr(chunk, "content") and chunk.content:
                    node = metadata.get("langgraph_node", "")
                    if node in ("clinical_reasoning", "input_processing", ""):
                        # Send SSE
                        data = json.dumps({"content": chunk.content})
                        yield f"data: {data}\n\n"
        except Exception as e:
            error_msg = f"⚠️ Connection Error: {str(e)}"
            yield f"data: {json.dumps({'content': error_msg, 'error': True})}\n\n"
            
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
