import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';
import { 
  Send, 
  Mic, 
  MicOff, 
  Sparkles, 
  AlertTriangle, 
  Check, 
  Copy, 
  Volume2, 
  VolumeX, 
  ShieldAlert, 
  Heart, 
  Brain, 
  Stethoscope, 
  Pill, 
  Baby, 
  Activity, 
  PhoneCall,
  Download,
  ThumbsUp,
  ThumbsDown,
  Sliders,
  Flame
} from 'lucide-react';

export default function ChatArea({
  messages,
  isStreaming,
  streamingStage,
  streamingToken,
  currentTriage,
  onSendMessage,
  onOpenPatientIntake,
  onExportConversation,
  health
}) {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [feedback, setFeedback] = useState({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingToken, streamingStage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputText]);

  const toggleSpeechRecognition = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(prev => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognition.onerror = (err) => {
        console.error('Speech recognition error:', err);
        setIsRecording(false);
      };
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  const handleToggleSpeech = (text, index) => {
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/[#*`_~[\]]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/📄|🌐|🚨|⚡|🏥|🔬|📋|❓|📚/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = speechRate;
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    try {
      confetti({ particleCount: 25, spread: 40, origin: { y: 0.8 }, colors: ['#14b8a6', '#06b6d4', '#6366f1'] });
    } catch (e) {}
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSend = () => {
    if (!inputText.trim() || isStreaming) return;
    onSendMessage(inputText.trim());
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clinicalPromptCards = [
    {
      category: 'Emergency Triage',
      icon: Flame,
      color: 'bg-red-50 dark:bg-rose-500/10 text-red-600 dark:text-rose-400 border-red-200 dark:border-rose-500/30',
      title: 'Acute Chest Pain in 58M',
      prompt: '58yo male presenting with sudden onset crushing substernal chest pain radiating to left jaw and shoulder for 45 minutes, accompanied by diaphoresis and mild nausea. History of hypertension.'
    },
    {
      category: 'Cardiology',
      icon: Heart,
      color: 'bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-500/30',
      title: 'Palpitations & Syncope',
      prompt: 'What are the main causes and differential diagnoses for episodic palpitations followed by lightheadedness and near-syncope in a 42-year-old female?'
    },
    {
      category: 'Pharmacology',
      icon: Pill,
      color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
      title: 'Drug Interaction: Warfarin + NSAID',
      prompt: 'Explain the clinical risk and mechanism of interaction when combining Warfarin with Ibuprofen or other NSAIDs. What safer alternatives exist?'
    },
    {
      category: 'Pediatrics',
      icon: Baby,
      color: 'bg-teal-50 dark:bg-emerald-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-500/30',
      title: 'Pediatric High Fever & Rash',
      prompt: '4-year-old child with persistent 5-day fever of 39.5°C, bilateral conjunctival injection without exudate, strawberry tongue, and polymorphous rash. What should be ruled out?'
    },
    {
      category: 'Neurology',
      icon: Brain,
      color: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30',
      title: 'Acute Thunderclap Headache',
      prompt: '35-year-old patient experiencing the sudden onset of the most severe headache of their life ("worst headache of life") reaching peak intensity within 1 minute. Clinical approach and red flags.'
    },
    {
      category: 'Internal Medicine',
      icon: Stethoscope,
      color: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/30',
      title: 'CKD & Glycemic Targets',
      prompt: 'What are the KDIGO guideline recommendations for glycemic control and SGLT2 inhibitors in patients with Stage 3 Chronic Kidney Disease and Type 2 Diabetes?'
    }
  ];

  return (
    <main className="flex-1 flex flex-col h-full bg-white dark:bg-navy-900 overflow-hidden relative transition-colors duration-300">
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-4xl mx-auto py-6 md:py-10 space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-medical-50 border border-medical-200 text-medical-700 dark:bg-teal-500/10 dark:border-teal-500/25 dark:text-teal-300 text-xs font-semibold shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Multi-Stage Medical RAG & LangGraph Engine</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-clinical-900 via-medical-600 to-indigo-600 dark:from-slate-100 dark:via-teal-100 dark:to-cyan-300 bg-clip-text text-transparent pb-1">
                Clinical Intelligence & Differential Reasoning
              </h1>
              <p className="text-clinical-500 dark:text-slate-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
                Grounded in uploaded medical literature and authoritative web guidelines (WHO, NIH, Mayo Clinic).
              </p>
            </div>

            <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-navy-850 border border-clinical-200 dark:border-teal-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm dark:shadow-glow-teal">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-medical-50 dark:bg-teal-500/20 text-medical-600 dark:text-teal-300 border border-medical-200 dark:border-teal-500/30">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-clinical-900 dark:text-slate-200 text-sm">Structured Patient Case Intake</h2>
                  <p className="text-xs text-clinical-500 dark:text-slate-400 mt-1">
                    Input patient age, sex, vitals, symptoms, duration, and severity for a comprehensive differential diagnosis.
                  </p>
                </div>
              </div>
              <button
                onClick={onOpenPatientIntake}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-medical-600 to-indigo-600 dark:from-teal-500 dark:to-cyan-500 hover:opacity-90 text-white font-bold text-xs shadow-md transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                Launch Case Builder →
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider uppercase text-clinical-500 dark:text-slate-400">
                  Quick Clinical Consultation Scenarios
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {clinicalPromptCards.map((card, i) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => onSendMessage(card.prompt)}
                      className={`text-left p-4 rounded-xl border transition-all duration-150 flex flex-col justify-between group shadow-sm hover:shadow-md ${card.color} hover:scale-[1.02] active:scale-[0.98] bg-white dark:bg-navy-850`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5`}>
                            {card.category}
                          </span>
                          <Icon className="w-4 h-4 opacity-75 group-hover:scale-110 transition-transform" />
                        </div>
                        <h3 className="font-bold text-sm mb-1.5 text-clinical-900 dark:text-slate-200">
                          {card.title}
                        </h3>
                        <p className="text-xs text-clinical-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                          {card.prompt}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Explore assessment →
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-clinical-50 dark:bg-navy-850 border border-clinical-200 dark:border-white/5 text-clinical-600 dark:text-slate-400 text-xs flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-medical-500 dark:text-teal-400 flex-shrink-0" />
              <div className="leading-relaxed">
                <strong className="text-clinical-900 dark:text-slate-300">Clinical Decision Support Disclaimer:</strong> MediGuide AI is designed for medical educational and clinical reasoning research. It synthesizes evidence from reference literature and medical databases. It does not replace clinical judgment or direct patient care.
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6 pb-4">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isAssistant = msg.role === 'assistant';
              const isEmergency = msg.content.includes('⚠️ EMERGENCY') || msg.content.includes('call emergency services');

              return (
                <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5 animate-in fade-in duration-200`}>
                  {isAssistant && (
<div className="flex items-center gap-2 px-1 text-[11px] text-clinical-500 dark:text-slate-400 font-medium">
                      <>
                        <div className="w-5 h-5 rounded-full bg-medical-100 dark:bg-teal-500/20 border border-medical-200 dark:border-teal-500/40 flex items-center justify-center text-medical-600 dark:text-teal-300">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-medical-700 dark:text-teal-300">MediGuide</span>
                        {msg.content.includes('Answered from cache') && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-[9px] font-mono">
                            ⚡ Cache Hit
                          </span>
                        )}
                      </>
</div>
)}

                  <div className={`
                    relative max-w-[95%] md:max-w-3xl p-4 md:p-5 text-[15px] transition-all
                      ${isUser 
                        ? 'bg-clinical-100 dark:bg-slate-700 text-clinical-900 dark:text-slate-200 rounded-[24px] ml-8' 
                        : 'bg-transparent text-clinical-900 dark:text-slate-200 mr-4 md:mr-8 w-full'}
                  `}>
                    {isAssistant && isEmergency && (
                      <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-gradient-to-r dark:from-rose-950/80 dark:to-red-950/60 border border-red-200 dark:border-rose-500/80 text-red-900 dark:text-rose-200 shadow-sm dark:shadow-glow-red animate-pulse-slow">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 text-red-600 dark:text-rose-300 font-bold text-sm">
                            <AlertTriangle className="w-5 h-5 animate-bounce" />
                            <span>CRITICAL MEDICAL ALERT — EMERGENCY</span>
                          </div>
                          <a href="tel:911" className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-colors w-full sm:w-auto">
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Call 911 / 112</span>
                          </a>
                        </div>
                        <p className="text-xs text-red-700 dark:text-rose-100/90 leading-relaxed mt-2 sm:mt-0">
                          Symptoms match high-acuity emergency protocols. Direct physical assessment and emergency intervention is urgently advised.
                        </p>
                      </div>
                    )}

                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>

                    {isAssistant && (
                      <div className="mt-5 pt-3 border-t border-clinical-100 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-clinical-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleSpeech(msg.content, idx)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                              speakingIndex === idx 
                                ? 'bg-medical-50 dark:bg-teal-500/20 text-medical-600 dark:text-teal-300 border-medical-200 dark:border-teal-500/40' 
                                : 'hover:bg-clinical-50 dark:hover:bg-slate-800 border-transparent hover:border-clinical-200 dark:hover:border-white/5'
                            }`}
                          >
                            {speakingIndex === idx ? (
                              <>
                                <VolumeX className="w-3.5 h-3.5" />
                                <span className="font-medium">Pause</span>
                                <div className="flex items-center gap-0.5 ml-1">
                                  <span className="w-1 h-3 bg-current rounded-full wave-bar" />
                                  <span className="w-1 h-3 bg-current rounded-full wave-bar" />
                                  <span className="w-1 h-3 bg-current rounded-full wave-bar" />
                                </div>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>Read Aloud</span>
                              </>
                            )}
                          </button>
                          {speakingIndex === idx && (
                            <select
                              value={speechRate}
                              onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                              className="text-[11px] bg-white dark:bg-slate-800 border border-clinical-200 dark:border-white/10 rounded-lg px-2 py-1 text-clinical-700 dark:text-slate-300 focus:outline-none"
                            >
                              <option value="0.9">0.9x</option>
                              <option value="1.0">1.0x</option>
                              <option value="1.25">1.25x</option>
                              <option value="1.5">1.5x</option>
                            </select>
                          )}
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2">
                          <button onClick={() => handleCopy(msg.content, idx)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-clinical-50 dark:hover:bg-slate-800 border border-transparent hover:border-clinical-200 dark:hover:border-white/10 transition-colors">
                            {copiedIndex === idx ? <><Check className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-500">Copied!</span></> : <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>}
                          </button>
                          <button onClick={() => onExportConversation(null, msg.content)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-clinical-50 dark:hover:bg-slate-800 border border-transparent hover:border-clinical-200 dark:hover:border-white/10 transition-colors hidden sm:flex">
                            <Download className="w-3.5 h-3.5" />
                            <span>Export</span>
                          </button>
                          <div className="h-4 w-px bg-clinical-200 dark:bg-white/10 mx-1 hidden sm:block"></div>
                          <button onClick={() => setFeedback(prev => ({ ...prev, [idx]: 'up' }))} className={`p-1.5 rounded-lg hover:bg-clinical-50 dark:hover:bg-slate-800 ${feedback[idx] === 'up' ? 'text-emerald-500' : ''}`}>
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setFeedback(prev => ({ ...prev, [idx]: 'down' }))} className={`p-1.5 rounded-lg hover:bg-clinical-50 dark:hover:bg-slate-800 ${feedback[idx] === 'down' ? 'text-red-500' : ''}`}>
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isStreaming && (
              <div className="flex flex-col items-start space-y-2 animate-in fade-in duration-150 w-full">
                <div className="flex items-center gap-2 px-1 text-[11px] text-medical-600 dark:text-teal-300 font-medium">
                  <div className="w-5 h-5 rounded-full bg-medical-100 dark:bg-teal-500/20 border border-medical-200 dark:border-teal-500/40 flex items-center justify-center">
                    <Activity className="w-3 h-3 animate-spin" />
                  </div>
                  <span>Clinical Reasoning Pipeline Executing…</span>
                </div>

                <div className="w-full max-w-[95%] md:max-w-3xl bg-white dark:bg-navy-850 rounded-2xl p-4 md:p-5 text-sm shadow-sm border border-medical-300 dark:border-teal-500/30">
                  <div className="mb-5 p-3.5 rounded-xl bg-clinical-50 dark:bg-slate-950/80 border border-clinical-200 dark:border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-medical-600 dark:text-teal-300 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 animate-pulse text-medical-500 dark:text-teal-400" />
                        <span>Active Pipeline Stage:</span>
                      </span>
                      <span className="text-[10px] font-mono text-clinical-500 dark:text-slate-400 bg-white dark:bg-black/20 px-2 py-0.5 rounded border border-clinical-200 dark:border-white/5">LangGraph 4-Node</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                      <div className={`p-2 rounded-lg text-[10px] text-center font-bold border transition-colors ${streamingStage === 'input_processing' ? 'bg-medical-100 dark:bg-teal-500/20 border-medical-300 dark:border-teal-500 text-medical-700 dark:text-teal-300 shadow-sm' : 'bg-white dark:bg-slate-900 border-clinical-200 dark:border-white/5 text-clinical-500 dark:text-slate-400'}`}>1. Triage Scan</div>
                      <div className={`p-2 rounded-lg text-[10px] text-center font-bold border transition-colors ${streamingStage === 'retrieval' ? 'bg-cyan-50 dark:bg-cyan-500/20 border-cyan-300 dark:border-cyan-500 text-cyan-700 dark:text-cyan-300 shadow-sm' : streamingStage === 'web_search' || streamingStage === 'clinical_reasoning' ? 'bg-medical-50 dark:bg-teal-950/40 border-medical-200 dark:border-teal-500/30 text-medical-600 dark:text-teal-400' : 'bg-white dark:bg-slate-900 border-clinical-200 dark:border-white/5 text-clinical-500 dark:text-slate-400'}`}>2. FAISS RAG</div>
                      <div className={`p-2 rounded-lg text-[10px] text-center font-bold border transition-colors ${streamingStage === 'web_search' ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm' : streamingStage === 'clinical_reasoning' ? 'bg-medical-50 dark:bg-teal-950/40 border-medical-200 dark:border-teal-500/30 text-medical-600 dark:text-teal-400' : 'bg-white dark:bg-slate-900 border-clinical-200 dark:border-white/5 text-clinical-500 dark:text-slate-400'}`}>3. Web Evidence</div>
                      <div className={`p-2 rounded-lg text-[10px] text-center font-bold border transition-colors ${streamingStage === 'clinical_reasoning' ? 'bg-indigo-50 dark:bg-indigo-500/20 border-indigo-300 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'bg-white dark:bg-slate-900 border-clinical-200 dark:border-white/5 text-clinical-500 dark:text-slate-400'}`}>4. Reasoning LLM</div>
                    </div>
                  </div>

                  {streamingToken ? (
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingToken}</ReactMarkdown>
                      <span className="typing-cursor" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-4 text-clinical-500 dark:text-slate-400 text-xs font-medium">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-medical-400 dark:bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-medical-400 dark:bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-medical-400 dark:bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span>Retrieving evidence and formulating clinical assessment…</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      <div className="p-3 md:p-5 border-t border-clinical-200 dark:border-white/10 bg-white/95 dark:bg-navy-950/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] px-1 text-clinical-500 dark:text-slate-400 gap-2 sm:gap-0">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto">
              <button onClick={onOpenPatientIntake} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-medical-50 hover:bg-medical-100 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 border border-medical-200 dark:border-teal-500/30 text-medical-700 dark:text-teal-300 font-semibold whitespace-nowrap transition-colors">
                <Sliders className="w-3 h-3" />
                <span>Patient Intake Form</span>
              </button>
              <button onClick={() => setInputText(prev => `${prev ? prev + ' ' : ''}Check for red flag emergency symptoms, contraindications, and differential diagnoses.`)} className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-clinical-100 hover:bg-clinical-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-clinical-200 dark:border-white/10 text-clinical-700 dark:text-slate-300 font-semibold whitespace-nowrap transition-colors">
                <ShieldAlert className="w-3 h-3" />
                <span>Add Rule-Out Directive</span>
              </button>
            </div>
            <div className="hidden sm:flex items-center gap-2 font-mono text-[10px]">
              <span>Enter ↵ to send</span>
              <span>•</span>
              <span>Shift+Enter for newline</span>
            </div>
          </div>

          <div className="relative flex items-end gap-2 p-2 rounded-full bg-clinical-100 dark:bg-navy-850 border-none border-clinical-200 dark:border-white/15 focus-within:border-medical-500 dark:focus-within:border-teal-500/60 focus-within:ring-4 focus-within:ring-medical-500/10 dark:focus-within:ring-teal-500/10 transition-all shadow-sm">
            <button
              onClick={toggleSpeechRecognition}
              className={`p-2.5 rounded-full transition-all duration-200 flex-shrink-0 ${isRecording ? 'bg-red-100 dark:bg-rose-500/20 text-red-600 dark:text-rose-400 border border-red-200 dark:border-rose-500/40 animate-pulse' : 'text-clinical-500 dark:text-slate-400 hover:text-clinical-900 dark:hover:text-slate-200 hover:bg-clinical-200 dark:hover:bg-slate-800'}`}
              title={isRecording ? 'Stop Speech Dictation' : 'Dictate Symptoms by Voice'}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask any medical question or describe patient symptoms (e.g. 58M chest pain radiating to jaw)…"
              className="flex-1 bg-transparent text-clinical-900 dark:text-slate-100 placeholder-clinical-400 dark:placeholder-slate-500 text-sm focus:outline-none resize-none py-2.5 max-h-44"
            />

            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isStreaming}
              className="p-3 rounded-full bg-gradient-to-r from-medical-600 to-indigo-600 dark:from-teal-500 dark:to-cyan-500 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md transition-all hover:scale-105 active:scale-95 flex-shrink-0"
              title="Send Medical Query"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center pt-1">
            <p className="text-[10px] text-clinical-500 dark:text-slate-500 leading-tight">
              MediGuide AI is for clinical information & differential reasoning. Always verify critical findings with primary diagnostic protocols.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
