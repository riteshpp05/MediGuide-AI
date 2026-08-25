import React, { useState } from 'react';
import { 
  X, 
  User, 
  Activity, 
  Clock, 
  AlertCircle, 
  Pill, 
  FilePlus, 
  Check, 
  ChevronRight,
  Sliders,
  Sparkles
} from 'lucide-react';

export default function PatientIntakeModal({ isOpen, onClose, onSubmitCase }) {
  if (!isOpen) return null;

  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [symptoms, setSymptoms] = useState([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [duration, setDuration] = useState('3 days');
  const [severity, setSeverity] = useState('Moderate');
  const [comorbidities, setComorbidities] = useState([]);
  const [medications, setMedications] = useState('');
  const [notes, setNotes] = useState('');

  const commonSymptoms = [
    'Chest pain', 'Shortness of breath', 'High fever', 'Severe headache',
    'Palpitations', 'Dizziness / Vertigo', 'Abdominal pain', 'Nausea / Vomiting',
    'Cough with sputum', 'Joint swelling', 'Skin rash / Petechiae', 'Fatigue / Malaise'
  ];

  const commonComorbidities = [
    'Hypertension', 'Type 2 Diabetes', 'Coronary Artery Disease', 'Asthma / COPD',
    'Chronic Kidney Disease', 'Atrial Fibrillation', 'Obesity', 'Smoking History'
  ];

  const toggleSymptom = (sym) => {
    if (symptoms.includes(sym)) {
      setSymptoms(symptoms.filter(s => s !== sym));
    } else {
      setSymptoms([...symptoms, sym]);
    }
  };

  const addCustomSymptom = () => {
    if (customSymptom.trim() && !symptoms.includes(customSymptom.trim())) {
      setSymptoms([...symptoms, customSymptom.trim()]);
      setCustomSymptom('');
    }
  };

  const toggleComorbidity = (com) => {
    if (comorbidities.includes(com)) {
      setComorbidities(comorbidities.filter(c => c !== com));
    } else {
      setComorbidities([...comorbidities, com]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!age && symptoms.length === 0 && !notes.trim()) {
      alert('Please fill in at least patient age or symptoms.');
      return;
    }

    const patientData = {
      age: age ? parseInt(age, 10) : undefined,
      gender,
      symptoms,
      duration,
      severity,
      comorbidities,
      medications: medications ? medications.split(',').map(m => m.trim()).filter(Boolean) : []
    };

    let promptText = `Provide a comprehensive clinical differential diagnosis and recommended action plan for this patient:\n`;
    promptText += `• Demographics: ${age ? `${age}-year-old` : 'Patient'} ${gender}\n`;
    if (symptoms.length > 0) {
      promptText += `• Chief Complaint & Symptoms: ${symptoms.join(', ')}\n`;
    }
    promptText += `• Symptom Duration: ${duration}\n`;
    promptText += `• Acuity / Severity: ${severity}\n`;
    if (comorbidities.length > 0) {
      promptText += `• Past Medical History / Comorbidities: ${comorbidities.join(', ')}\n`;
    }
    if (medications.trim()) {
      promptText += `• Current Medications: ${medications}\n`;
    }
    if (notes.trim()) {
      promptText += `• Additional Clinical Notes & Vitals: ${notes.trim()}\n`;
    }

    onSubmitCase(promptText, patientData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-navy-950/95 border border-clinical-200 dark:border-teal-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-clinical-200 dark:border-white/10 flex items-center justify-between bg-clinical-50 dark:bg-navy-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-medical-50 dark:bg-teal-500/20 text-medical-600 dark:text-teal-300 border border-medical-200 dark:border-teal-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-clinical-900 dark:text-slate-100 text-base">Structured Patient Case Builder</h2>
              <p className="text-xs text-clinical-500 dark:text-slate-400">
                Input clinical data for deterministic entity extraction and differential ranking
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-clinical-500 dark:text-slate-400 hover:text-clinical-900 dark:hover:text-white hover:bg-clinical-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 text-xs">
          {/* Section 1: Demographics */}
          <div>
            <label className="font-bold text-clinical-800 dark:text-slate-300 uppercase tracking-wider text-[11px] block mb-2">
              1. Demographics & Vitals
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-clinical-500 dark:text-slate-400 block mb-1">Age (Years)</span>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 58"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-clinical-200 dark:border-white/10 text-clinical-900 dark:text-white placeholder-clinical-400 dark:placeholder-slate-500 focus:outline-none focus:border-medical-500 dark:focus:border-teal-500 shadow-sm"
                />
              </div>
              <div>
                <span className="text-clinical-500 dark:text-slate-400 block mb-1">Biological Sex</span>
                <div className="grid grid-cols-2 gap-2">
                  {['Male', 'Female'].map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => setGender(g)}
                      className={`py-2 rounded-xl border text-center font-medium transition-all shadow-sm ${
                        gender === g 
                          ? 'bg-medical-50 dark:bg-teal-500/20 border-medical-500 dark:border-teal-500 text-medical-800 dark:text-teal-300' 
                          : 'bg-white dark:bg-slate-900 border-clinical-200 dark:border-white/10 text-clinical-500 dark:text-slate-400 hover:text-clinical-900 dark:hover:text-white'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Symptoms Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-clinical-800 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                2. Presenting Symptoms
              </label>
              <span className="text-[10px] text-clinical-500 dark:text-slate-500">Select all that apply</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {commonSymptoms.map((sym) => {
                const isSelected = symptoms.includes(sym);
                return (
                  <button
                    type="button"
                    key={sym}
                    onClick={() => toggleSymptom(sym)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all shadow-sm ${
                      isSelected 
                        ? 'bg-medical-50 dark:bg-teal-500/25 border-medical-400 dark:border-teal-400 text-medical-800 dark:text-teal-200' 
                        : 'bg-white dark:bg-slate-900/90 border-clinical-200 dark:border-white/10 text-clinical-600 dark:text-slate-400 hover:text-clinical-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-1 text-medical-600 dark:text-teal-400" />}
                    {sym}
                  </button>
                );
              })}
            </div>

            {/* Custom Symptom Input */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={customSymptom}
                onChange={(e) => setCustomSymptom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomSymptom();
                  }
                }}
                placeholder="Type custom symptom and press Add…"
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-clinical-200 dark:border-white/10 text-clinical-900 dark:text-white placeholder-clinical-400 dark:placeholder-slate-500 focus:outline-none focus:border-medical-500 dark:focus:border-teal-500 text-xs shadow-sm"
              />
              <button
                type="button"
                onClick={addCustomSymptom}
                className="px-3 py-2 rounded-xl bg-clinical-100 dark:bg-slate-800 hover:bg-clinical-200 dark:hover:bg-slate-700 text-clinical-700 dark:text-slate-200 font-semibold text-xs border border-clinical-200 dark:border-white/10 shadow-sm"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Section 3: Duration & Acuity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-clinical-800 dark:text-slate-300 uppercase tracking-wider text-[11px] block mb-1">
                3. Symptom Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-clinical-200 dark:border-white/10 text-clinical-900 dark:text-white focus:outline-none focus:border-medical-500 dark:focus:border-teal-500 text-xs shadow-sm"
              >
                <option value="Under 1 hour (Sudden)">Under 1 hour (Hyperacute / Sudden)</option>
                <option value="Several hours">Several hours</option>
                <option value="1-3 days">1 to 3 days (Acute)</option>
                <option value="1-2 weeks">1 to 2 weeks (Subacute)</option>
                <option value="Over 1 month">Over 1 month (Chronic)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-clinical-800 dark:text-slate-300 uppercase tracking-wider text-[11px] block mb-1">
                4. Acuity & Severity Scale
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-clinical-200 dark:border-white/10 text-clinical-900 dark:text-white focus:outline-none focus:border-medical-500 dark:focus:border-teal-500 text-xs shadow-sm"
              >
                <option value="Mild (1-3/10)">Mild (Discomfort without impairment)</option>
                <option value="Moderate (4-6/10)">Moderate (Interferes with activities)</option>
                <option value="Severe (7-9/10)">Severe (Incapacitating)</option>
                <option value="Critical / Worst-Ever (10/10)">Critical / Red-Flag Emergency (10/10)</option>
              </select>
            </div>
          </div>

          {/* Section 4: Comorbidities */}
          <div>
            <label className="font-bold text-clinical-800 dark:text-slate-300 uppercase tracking-wider text-[11px] block mb-1.5">
              5. Past Medical History / Known Conditions
            </label>
            <div className="flex flex-wrap gap-1.5">
              {commonComorbidities.map((com) => {
                const isSelected = comorbidities.includes(com);
                return (
                  <button
                    type="button"
                    key={com}
                    onClick={() => toggleComorbidity(com)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all shadow-sm ${
                      isSelected 
                        ? 'bg-indigo-50 dark:bg-cyan-500/25 border-indigo-400 dark:border-cyan-400 text-indigo-700 dark:text-cyan-200' 
                        : 'bg-white dark:bg-slate-900 border-clinical-200 dark:border-white/10 text-clinical-600 dark:text-slate-400 hover:text-clinical-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-1 text-indigo-600 dark:text-cyan-400" />}
                    {com}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 5: Current Medications & Clinical Notes */}
          <div className="space-y-3">
            <div>
              <label className="font-bold text-clinical-800 dark:text-slate-300 uppercase tracking-wider text-[11px] block mb-1">
                6. Current Medications (Comma-separated)
              </label>
              <input
                type="text"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="e.g. Lisinopril 10mg, Metformin 500mg, Atorvastatin 20mg"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-clinical-200 dark:border-white/10 text-clinical-900 dark:text-white placeholder-clinical-400 dark:placeholder-slate-500 focus:outline-none focus:border-medical-500 dark:focus:border-teal-500 text-xs shadow-sm"
              />
            </div>

            <div>
              <label className="font-bold text-clinical-800 dark:text-slate-300 uppercase tracking-wider text-[11px] block mb-1">
                7. Specific Vitals / Physical Findings / Questions
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. BP 155/95, HR 105 bpm, O2 Sat 98%, no prior cardiac history…"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-clinical-200 dark:border-white/10 text-clinical-900 dark:text-white placeholder-clinical-400 dark:placeholder-slate-500 focus:outline-none focus:border-medical-500 dark:focus:border-teal-500 text-xs resize-none shadow-sm"
              />
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 border-t border-clinical-200 dark:border-white/10 bg-clinical-50 dark:bg-slate-900/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-clinical-600 dark:text-slate-400 hover:text-clinical-900 dark:hover:text-white text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-medical-600 to-indigo-600 dark:from-teal-500 dark:to-cyan-500 hover:opacity-90 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Clinical Assessment</span>
          </button>
        </div>
      </div>
    </div>
  );
}
