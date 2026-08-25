import React, { useState } from 'react';
import { 
  X, 
  Key, 
  Cpu, 
  Globe, 
  Database, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Eye, 
  EyeOff, 
  Zap, 
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { updateSettings } from '../api';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  health, 
  cacheStats, 
  onClearCache, 
  onRefreshHealth 
}) {
  if (!isOpen) return null;

  const [groqKey, setGroqKey] = useState('');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [tavilyKey, setTavilyKey] = useState('');
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(health?.model || 'llama-3.3-70b-versatile');
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // { success: bool, message: str }

  const availableModels = [
    { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Active)', desc: 'Top clinical reasoning performance & deep differential diagnosis' },
    { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B', desc: 'Ultra-fast medical inference with high domain knowledge' },
    { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B', desc: 'Fast, lightweight reasoning model' },
    { id: 'groq/compound', name: 'Groq Compound Engine', desc: 'Multi-agent orchestration model' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', desc: 'Meta Llama 3.3 clinical reasoning' },
  ];

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    const payload = {};
    if (groqKey.trim()) payload.groq_api_key = groqKey.trim();
    if (tavilyKey.trim()) payload.tavily_api_key = tavilyKey.trim();
    if (selectedModel) payload.model = selectedModel;

    try {
      const res = await updateSettings(payload);
      if (res.success) {
        setSaveStatus({
          success: res.health.groq,
          message: res.health.groq 
            ? 'API Settings successfully updated and verified online!' 
            : `Saved, but Groq returned: ${res.health.message}`
        });
        if (onRefreshHealth) onRefreshHealth();
      }
    } catch (err) {
      setSaveStatus({
        success: false,
        message: err.message || 'Failed to update settings'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-navy-950/95 border border-clinical-200 dark:border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-clinical-200 dark:border-white/10 flex items-center justify-between bg-clinical-50 dark:bg-navy-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-medical-50 dark:bg-teal-500/20 text-medical-600 dark:text-teal-300 border border-medical-200 dark:border-teal-500/30">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-clinical-900 dark:text-slate-100 text-base">Settings & Cloud LLM API Keys</h2>
              <p className="text-xs text-clinical-500 dark:text-slate-400">
                Configure Groq inference engine, search keys, and cache parameters
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
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 text-xs">
          {/* Status Message */}
          {saveStatus && (
            <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
              saveStatus.success 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200' 
                : 'bg-red-50 dark:bg-rose-950/40 border-red-200 dark:border-rose-500/40 text-red-700 dark:text-rose-200'
            }`}>
              {saveStatus.success ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-xs leading-relaxed">{saveStatus.message}</div>
            </div>
          )}

          {/* Section 1: Groq API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-clinical-800 dark:text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>1. Groq Cloud API Key</span>
                {health?.groq ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-normal">● Connected</span>
                ) : (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-normal">● Key Required</span>
                )}
              </label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-medical-600 dark:text-teal-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative">
              <input
                type={showGroqKey ? 'text' : 'password'}
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-clinical-200 dark:border-white/10 text-clinical-900 dark:text-white placeholder-clinical-400 dark:placeholder-slate-500 focus:outline-none focus:border-medical-500 dark:focus:border-teal-500 font-mono text-xs shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowGroqKey(!showGroqKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-clinical-400 dark:text-slate-400 hover:text-clinical-700 dark:hover:text-white"
              >
                {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-clinical-500 dark:text-slate-500">
              Your API key is used directly with Groq's high-speed LPU inference API.
            </p>
          </div>

          {/* Section 2: Model Picker */}
          <div className="space-y-1.5">
            <label className="font-bold text-clinical-800 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
              2. Inference LLM Model
            </label>
            <div className="space-y-1.5">
              {availableModels.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all shadow-sm ${
                    selectedModel === m.id
                      ? 'bg-medical-50 dark:bg-teal-500/15 border-medical-500 dark:border-teal-500 text-medical-800 dark:text-teal-200'
                      : 'bg-white dark:bg-slate-900/60 border-clinical-200 dark:border-white/10 text-clinical-700 dark:text-slate-300 hover:bg-clinical-50 dark:hover:bg-slate-900'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={m.id}
                    checked={selectedModel === m.id}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="mt-0.5 text-medical-500 dark:text-teal-500 focus:ring-medical-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-clinical-900 dark:text-white">{m.name}</div>
                    <div className="text-[11px] text-clinical-500 dark:text-slate-400 mt-0.5">{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Section 3: Tavily API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-clinical-800 dark:text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>3. Tavily Medical Web Search Key (Optional)</span>
                {health?.tavily && <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-normal">● Enabled</span>}
              </label>
              <a
                href="https://tavily.com"
                target="_blank"
                rel="noreferrer"
                className="text-medical-600 dark:text-teal-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>Get Tavily Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative">
              <input
                type={showTavilyKey ? 'text' : 'password'}
                value={tavilyKey}
                onChange={(e) => setTavilyKey(e.target.value)}
                placeholder="tvly-..."
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-clinical-200 dark:border-white/10 text-clinical-900 dark:text-white placeholder-clinical-400 dark:placeholder-slate-500 focus:outline-none focus:border-medical-500 dark:focus:border-teal-500 font-mono text-xs shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowTavilyKey(!showTavilyKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-clinical-400 dark:text-slate-400 hover:text-clinical-700 dark:hover:text-white"
              >
                {showTavilyKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-clinical-500 dark:text-slate-500">
              Used when questions query recent medical guidelines (2024-2026) or when document retrieval yields no results.
            </p>
          </div>

          {/* Section 4: Cache Management */}
          <div className="p-3.5 rounded-2xl bg-clinical-50 dark:bg-slate-900/80 border border-clinical-200 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-clinical-800 dark:text-slate-300 text-xs flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Answer Cache Database</span>
              </div>
              <button
                type="button"
                onClick={onClearCache}
                className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-red-600 dark:text-rose-300 text-xs font-semibold border border-red-200 dark:border-rose-500/30 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Purge Cache</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-clinical-200 dark:border-white/5 shadow-sm">
                <div className="text-[10px] text-clinical-500 dark:text-slate-400">Total Entries</div>
                <div className="font-mono font-bold text-clinical-900 dark:text-white text-sm mt-0.5">{cacheStats?.total_cached || 0}</div>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-clinical-200 dark:border-white/5 shadow-sm">
                <div className="text-[10px] text-clinical-500 dark:text-slate-400">Total Hits</div>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">{cacheStats?.total_hits || 0}</div>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-clinical-200 dark:border-white/5 shadow-sm">
                <div className="text-[10px] text-clinical-500 dark:text-slate-400">Est. Tokens Saved</div>
                <div className="font-mono font-bold text-medical-600 dark:text-teal-400 text-sm mt-0.5">~{cacheStats?.tokens_saved || 0}</div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-clinical-200 dark:border-white/10 bg-clinical-50 dark:bg-slate-900/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onRefreshHealth}
            className="flex items-center gap-1 text-clinical-500 dark:text-slate-400 hover:text-clinical-900 dark:hover:text-white text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Test Connectivity</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-clinical-600 dark:text-slate-400 hover:text-clinical-900 dark:hover:text-white text-xs font-semibold"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-medical-600 to-indigo-600 dark:from-teal-500 dark:to-cyan-500 hover:opacity-90 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Testing & Saving…' : 'Save & Verify'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
