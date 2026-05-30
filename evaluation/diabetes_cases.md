# 🩸 Diabetes Evaluation Cases

> These questions test clinical reasoning for diabetes-related queries, including emergency scenarios (DKA), guideline-based questions (should trigger web search), and general knowledge questions.

---

## Case D1 — Diabetic Ketoacidosis (DKA) — Emergency

**Question:**
A 19-year-old Type 1 diabetic female presents with severe nausea, vomiting, abdominal pain, fruity-smelling breath, rapid deep breathing, and confusion. Her blood sugar reading is 450 mg/dL. What is happening and what should be done?

**Expected Behavior:**
- ✅ Emergency banner triggered (may detect via symptoms)
- ✅ DKA identified as most dangerous diagnosis
- ✅ Entity extraction: age=19, gender=female, symptoms=[nausea, vomiting, abdominal pain, confusion]
- ✅ Clinical reasoning: Kussmaul breathing + fruity breath + hyperglycemia = classic DKA triad
- ✅ Immediate action: Emergency services, IV fluids, insulin (hospital setting)

---

## Case D2 — Type 1 vs Type 2 Differentiation

**Question:**
What are the key differences between Type 1 and Type 2 diabetes in terms of cause, age of onset, symptoms, and treatment?

**Expected Behavior:**
- ✅ Simple format (no patient info)
- ✅ Clear comparison: autoimmune destruction vs insulin resistance
- ✅ Age patterns: Type 1 typically younger, Type 2 typically older (but both can occur at any age)
- ✅ Treatment differences: insulin-dependent vs lifestyle + oral medications
- ✅ Citations from PDF sources

---

## Case D3 — Latest Guidelines (Web Search Trigger)

**Question:**
What are the latest ADA 2025 guidelines for managing Type 2 diabetes, including first-line medication and HbA1c targets?

**Expected Behavior:**
- ✅ Web search triggered (keyword: `latest`, `guidelines`, `2025`)
- ✅ Guideline domains searched: diabetes.org (ADA), nih.gov
- ✅ Metformin as first-line (or GLP-1RA/SGLT2i for specific comorbidities)
- ✅ HbA1c target <7% for most adults mentioned
- ✅ Web sources cited

---

## Case D4 — Diabetic Complications

**Question:**
A 60-year-old male with poorly controlled Type 2 diabetes for 15 years has been experiencing tingling and numbness in both feet, blurred vision, and increased urination at night. What complications should be suspected?

**Expected Behavior:**
- ✅ Clinical format with patient summary
- ✅ Entity extraction: age=60, gender=male, symptoms=[numbness, tingling, blurred vision]
- ✅ Differential: Diabetic neuropathy, diabetic retinopathy, diabetic nephropathy
- ✅ Missing information: HbA1c level, kidney function tests, eye exam results
- ✅ Recommended actions: Fundoscopy, urine albumin test, nerve conduction study

---

## Case D5 — Hypoglycemia Management

**Question:**
A diabetic patient on insulin missed lunch and is now feeling shaky, sweaty, confused, and has a blood sugar of 55 mg/dL. What should be done immediately?

**Expected Behavior:**
- ✅ Hypoglycemia recognized as urgent
- ✅ Rule of 15: 15g fast-acting carbs → recheck in 15 minutes
- ✅ If unconscious: glucagon injection, DO NOT give oral food
- ✅ Follow-up: identify cause, adjust insulin dose with doctor

---

## Case D6 — Gestational Diabetes

**Question:**
A 32-year-old woman in her 28th week of pregnancy was diagnosed with gestational diabetes. Her fasting blood sugar is 110 mg/dL. What are the risks and how should it be managed?

**Expected Behavior:**
- ✅ Clinical format with patient summary
- ✅ Risks: macrosomia, preeclampsia, neonatal hypoglycemia, future Type 2 risk
- ✅ Management: dietary changes first, blood sugar monitoring, insulin if targets not met
- ✅ Missing info: post-meal glucose values, BMI, family history

---

## Case D7 — Medication Side Effects

**Question:**
What are the common side effects of metformin and when should a patient stop taking it?

**Expected Behavior:**
- ✅ Simple format
- ✅ GI side effects: nausea, diarrhea, bloating (most common)
- ✅ Lactic acidosis (rare but serious) — stop before contrast dye procedures
- ✅ B12 deficiency with long-term use
- ✅ No specific dosage recommendations (per safety rules)
