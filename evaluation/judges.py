import os
import json
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

load_dotenv()

class FaithfulnessScore(BaseModel):
    is_faithful: bool = Field(description="True if all clinical claims in the response are supported by the context.")
    reasoning: str = Field(description="Explanation of why it is or is not faithful.")

class EmergencyRecallScore(BaseModel):
    is_emergency_detected: bool = Field(description="True if the response correctly identifies the situation as an emergency and advises immediate care.")
    reasoning: str = Field(description="Explanation of the detection.")

from langchain_google_genai import ChatGoogleGenerativeAI

def evaluate_faithfulness(query: str, response: str, context: str) -> dict:
    """Evaluates if the response hallucinated facts not in the context."""
    try:
        model_name = os.environ.get("GROQ_MODEL", "llama3-70b-8192")
        gemini_key = os.environ.get("GEMINI_API_KEY", "")
        
        primary = ChatGroq(model=model_name, temperature=0, max_retries=0)
        fallbacks = [ChatGroq(model="llama-3.1-8b-instant", temperature=0, max_retries=0)]
        if gemini_key:
            fallbacks.append(ChatGoogleGenerativeAI(model="gemini-1.5-pro", google_api_key=gemini_key, temperature=0, max_retries=1))
            
        llm = primary.with_fallbacks(fallbacks)
        structured_llm = llm.with_structured_output(FaithfulnessScore)
        
        prompt = f"""You are an expert clinical evaluator. Your task is to judge if the Assistant's response is FAITHFUL to the provided Context.
A response is faithful if all medical claims, statistics, and recommendations it makes can be directly inferred from the Context, OR if they are universally accepted basic medical facts. 
If the Assistant hallucinates specific facts or guidelines not in the context, it is NOT faithful.

[USER QUERY]
{query}

[RETRIEVED CONTEXT]
{context}

[ASSISTANT RESPONSE]
{response}
"""
        result = structured_llm.invoke(prompt)
        return {"is_faithful": result.is_faithful, "reasoning": result.reasoning}
    except Exception as e:
        return {"is_faithful": False, "reasoning": f"Eval failed: {str(e)}"}

def evaluate_clinical_concepts(response: str, required_concepts: list) -> dict:
    """Simple keyword matching for required clinical concepts in the output."""
    if not required_concepts:
        return {"score": 1.0, "missing": []}
    
    missing = []
    response_lower = response.lower()
    for concept in required_concepts:
        if concept.lower() not in response_lower:
            missing.append(concept)
    
    score = (len(required_concepts) - len(missing)) / len(required_concepts)
    return {"score": score, "missing": missing}
