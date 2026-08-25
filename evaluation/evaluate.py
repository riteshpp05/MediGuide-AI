import json
import time
import os
import sys
from datetime import datetime
from langchain_core.messages import HumanMessage

# Ensure we can import from the parent directory if running inside /evaluation
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import chatbot
from evaluation.judges import evaluate_faithfulness, evaluate_clinical_concepts

def run_evaluation():
    print("Starting MediGuide AI Evaluation Harness (Goal A)")
    
    # Load test set
    test_set_path = os.path.join(os.path.dirname(__file__), "golden_test_set.json")
    with open(test_set_path, "r") as f:
        test_cases = json.load(f)
        
    print(f"Loaded {len(test_cases)} test cases.\n")

    results = []
    
    total_latency = 0
    emergency_true_positives = 0
    emergency_false_negatives = 0
    emergency_false_positives = 0
    emergency_true_negatives = 0
    
    faithful_count = 0
    total_concept_score = 0
    
    for idx, case in enumerate(test_cases):
        case_id = case["id"]
        category = case["category"]
        print(f"[{idx+1}/{len(test_cases)}] Running {case_id} ({category})...")
        
        start_time = time.time()
        
        # Invoke backend
        try:
            config = {"configurable": {"thread_id": f"eval_thread_{case_id}_{int(time.time())}"}}
            inputs = {"messages": [HumanMessage(content=case["prompt"])]}
            
            output_state = chatbot.invoke(inputs, config=config)
            
            latency = time.time() - start_time
            total_latency += latency
            
            # Extract outputs
            final_message = output_state["messages"][-1].content if output_state.get("messages") else ""
            is_emergency = output_state.get("is_emergency", False)
            context = output_state.get("reranked_context", "") + "\n" + output_state.get("web_results_text", "")
            
            # 1. Emergency Recall Math
            expected_emergency = case.get("expected_emergency_flag", False)
            if expected_emergency and is_emergency:
                emergency_true_positives += 1
            elif expected_emergency and not is_emergency:
                emergency_false_negatives += 1
            elif not expected_emergency and is_emergency:
                emergency_false_positives += 1
            else:
                emergency_true_negatives += 1
                
            # 2. Concept Recall
            concept_eval = evaluate_clinical_concepts(final_message, case.get("required_clinical_concepts", []))
            total_concept_score += concept_eval["score"]
            
            # 3. LLM-as-a-judge Faithfulness
            faith_eval = evaluate_faithfulness(case["prompt"], final_message, context)
            if faith_eval["is_faithful"]:
                faithful_count += 1
                
            results.append({
                "id": case_id,
                "latency_sec": round(latency, 2),
                "expected_emergency": expected_emergency,
                "detected_emergency": is_emergency,
                "concept_score": concept_eval["score"],
                "missing_concepts": concept_eval["missing"],
                "is_faithful": faith_eval["is_faithful"],
                "faithfulness_reasoning": faith_eval["reasoning"]
            })
            
            print(f"  -> Done in {latency:.2f}s | Emergency: {is_emergency} (Expected: {expected_emergency}) | Faithful: {faith_eval['is_faithful']}")
            
        except Exception as e:
            print(f"  -> ERROR running {case_id}: {str(e)}")
            results.append({
                "id": case_id,
                "error": str(e)
            })

    # Generate Scorecard
    total_emergencies = emergency_true_positives + emergency_false_negatives
    recall = (emergency_true_positives / total_emergencies * 100) if total_emergencies > 0 else 100
    
    total_non_emergencies = emergency_true_negatives + emergency_false_positives
    specificity = (emergency_true_negatives / total_non_emergencies * 100) if total_non_emergencies > 0 else 100
    
    faithfulness_rate = (faithful_count / len(test_cases)) * 100
    avg_concept_score = (total_concept_score / len(test_cases)) * 100
    avg_latency = total_latency / len(test_cases)
    
    scorecard_path = os.path.join(os.path.dirname(__file__), "evaluation_scorecard.md")
    
    with open(scorecard_path, "w", encoding="utf-8") as f:
        f.write("# 🩺 MediGuide AI Evaluation Scorecard\n\n")
        f.write(f"**Date Run:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Total Test Cases:** {len(test_cases)}\n\n")
        
        f.write("## 🚨 Safety & Emergency Metrics\n")
        f.write("> *Goal: 100% Recall. Missed emergencies are catastrophic failures.*\n\n")
        f.write(f"- **Emergency Recall (True Positive Rate):** {recall:.1f}%\n")
        f.write(f"  - Captured: {emergency_true_positives} / {total_emergencies}\n")
        f.write(f"  - Missed (DANGER): {emergency_false_negatives} / {total_emergencies}\n")
        f.write(f"- **Emergency Specificity (True Negative Rate):** {specificity:.1f}%\n")
        f.write(f"  - Over-triaged (False Positives): {emergency_false_positives} / {total_non_emergencies} *(Acceptable safety buffer)*\n\n")
        
        f.write("## 🧠 Clinical Reasoning Metrics\n")
        f.write(f"- **Faithfulness Score (No Hallucinations):** {faithfulness_rate:.1f}%\n")
        f.write("  - *Evaluated via LLM-as-a-judge strictly against retrieved RAG context.*\n")
        f.write(f"- **Clinical Concept Recall:** {avg_concept_score:.1f}%\n")
        f.write(f"- **Average Inference Latency:** {avg_latency:.2f} seconds\n\n")
        
        f.write("## 📝 Detailed Case Results\n\n")
        f.write("| ID | Category | Emerg Expected | Emerg Detected | Faithful | Missing Concepts |\n")
        f.write("|---|---|---|---|---|---|\n")
        
        for r in results:
            if "error" in r:
                f.write(f"| {r['id']} | ERROR | - | - | - | {r['error']} |\n")
            else:
                emerg_match = "✅" if r["expected_emergency"] == r["detected_emergency"] else ("⚠️ (Over-triage)" if r["detected_emergency"] else "❌ (MISSED)")
                faith_icon = "✅" if r["is_faithful"] else "❌"
                missing = ", ".join(r["missing_concepts"]) if r["missing_concepts"] else "None"
                cat = next(c["category"] for c in test_cases if c["id"] == r["id"])
                f.write(f"| {r['id']} | {cat} | {r['expected_emergency']} | {r['detected_emergency']} {emerg_match} | {faith_icon} | {missing} |\n")

    print(f"\nEvaluation complete! Scorecard written to {scorecard_path}")
    print(f"Emergency Recall: {recall:.1f}%")
    print(f"Faithfulness: {faithfulness_rate:.1f}%")

if __name__ == "__main__":
    run_evaluation()
