# ❤️ Cardiology Evaluation Cases

> These questions test the clinical reasoning engine's ability to perform differential diagnosis for cardiac presentations, rank diagnoses by severity, and identify red flags.

---

## Case C1 — Acute Coronary Syndrome (Classic Presentation)

**Question:**
A 45-year-old male smoker with a family history of heart disease presents with chest pain radiating to the left arm, sweating, nausea, and shortness of breath that started 45 minutes ago. What are the possible causes, immediate actions, and emergency warning signs?

**Expected Behavior:**
- ✅ Emergency banner triggered (category: `cardiac`)
- ✅ Entity extraction: age=45, gender=male, symptoms=[chest pain, sweating, nausea, shortness of breath]
- ✅ Most dangerous diagnosis: Acute Coronary Syndrome (STEMI/NSTEMI)
- ✅ Differential: ACS > Aortic dissection > Pulmonary embolism > Pneumothorax
- ✅ Risk factors acknowledged: smoking, family history, male, age
- ✅ Immediate actions: aspirin, call 911, do not exert

---

## Case C2 — Atypical Chest Pain (Non-Cardiac)

**Question:**
A 28-year-old female with no risk factors has sharp, stabbing chest pain that worsens when she takes a deep breath and improves when leaning forward. She also had a mild cold last week. What could this be?

**Expected Behavior:**
- ✅ Clinical format with patient summary
- ✅ Most likely: Pericarditis (pleuritic pain + positional relief + recent viral illness)
- ✅ Differential: Pericarditis > Pleuritis > Costochondritis > Anxiety
- ✅ Low probability of ACS mentioned (young, female, no risk factors, atypical pattern)
- ✅ Recommended: ECG, inflammatory markers (CRP, ESR)

---

## Case C3 — Heart Failure Symptoms

**Question:**
A 70-year-old male with a history of hypertension has been experiencing progressive shortness of breath on exertion, swollen ankles, waking up at night gasping for air, and gaining weight despite eating less. What condition do these symptoms suggest?

**Expected Behavior:**
- ✅ Clinical format with patient summary
- ✅ Most likely: Congestive Heart Failure (CHF)
- ✅ Symptoms mapped: dyspnea on exertion, peripheral edema, PND (paroxysmal nocturnal dyspnea), weight gain (fluid retention)
- ✅ Hypertension as likely cause acknowledged
- ✅ Recommended tests: BNP/NT-proBNP, echocardiogram, chest X-ray

---

## Case C4 — Arrhythmia / Atrial Fibrillation

**Question:**
A 65-year-old woman feels her heart racing irregularly, along with dizziness and mild shortness of breath. This has happened three times this week, each lasting about 20 minutes. What could be causing this?

**Expected Behavior:**
- ✅ Clinical format
- ✅ Most likely: Atrial Fibrillation (paroxysmal)
- ✅ Differential: AFib > SVT > Premature atrial complexes > Anxiety
- ✅ Stroke risk mentioned (AFib increases stroke risk — CHA₂DS₂-VASc)
- ✅ Recommended: ECG/Holter monitor, thyroid function tests
- ✅ Missing info: caffeine intake, thyroid history, medication list

---

## Case C5 — Hypertensive Crisis

**Question:**
A 50-year-old male presents with a severe headache, blood pressure of 210/130 mmHg, blurred vision, chest pain, and confusion. He has not been taking his blood pressure medication for the past 2 weeks. What is this and what should be done?

**Expected Behavior:**
- ✅ Emergency banner likely triggered (chest pain + severe presentation)
- ✅ Hypertensive emergency recognized (BP >180/120 with end-organ damage)
- ✅ End-organ damage signs: headache (brain), blurred vision (eyes), chest pain (heart), confusion (brain)
- ✅ Immediate action: Emergency services, IV antihypertensive (hospital), do NOT rapidly drop BP
- ✅ Medication non-compliance identified as cause

---

## Case C6 — Deep Vein Thrombosis / Pulmonary Embolism

**Question:**
A 35-year-old woman who recently took a 12-hour flight has sudden onset of sharp chest pain, shortness of breath, and rapid heart rate. Her left calf is also swollen and painful. What could this be?

**Expected Behavior:**
- ✅ Most dangerous: Pulmonary Embolism (PE) from DVT
- ✅ Risk factors: prolonged immobility (long flight), female, calf swelling suggesting DVT
- ✅ Wells criteria components mentioned
- ✅ Immediate: Emergency evaluation, CT pulmonary angiography
- ✅ Warning: Do NOT massage the swollen leg

---

## Case C7 — Valvular Heart Disease (Simple Question)

**Question:**
What is aortic stenosis and what symptoms does it cause?

**Expected Behavior:**
- ✅ Simple format (no patient info)
- ✅ Definition: narrowing of the aortic valve
- ✅ Classic triad: syncope (fainting), angina (chest pain), dyspnea (shortness of breath)
- ✅ Causes: age-related calcification, bicuspid aortic valve, rheumatic heart disease
- ✅ Citations from PDF sources
