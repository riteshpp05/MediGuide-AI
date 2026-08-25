import React, { useState } from 'react';
import { 
  Activity, 
  Stethoscope, 
  Database, 
  Globe, 
  Sparkles, 
  Settings as SettingsIcon, 
  Sun, 
  Moon, 
  Menu, 
  BookOpen, 
  UserPlus, 
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export default function Header({ 
  health, 
  theme, 
  onToggleTheme, 
  onOpenSettings, 
  onOpenKnowledgeBase, 
  onOpenPatientIntake, 
  onOpenShortcuts,
  onToggleMobileSidebar 
}) {
  const [showStatusPopup, setShowStatusPopup] = useState(false);

  const isHealthy = health?.groq && health?.faiss_index;
  const isWarning = health?.faiss_index && !health?.groq;

  return (
    <header className="sticky top-0 z-30 h-16 border-none bg-clinical-50/90 dark:bg-navy-900/90 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between transition-colors duration-300">
      {/* Left: Mobile Toggle & Brand Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-lg text-clinical-500 hover:text-clinical-900 dark:text-clinical-400 dark:hover:text-white hover:bg-clinical-100 dark:hover:bg-clinical-800 transition-colors"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-medical-500/10 to-medical-600/20 border border-medical-500/20 group-hover:border-medical-500/50 shadow-sm transition-all">
            <Stethoscope className="w-5 h-5 text-medical-600 dark:text-medical-400 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-medical-500 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-medical-500" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-medical-600 to-indigo-600 dark:from-medical-400 dark:to-indigo-400 bg-clip-text text-transparent">
                MediGuide AI
              </span>
              <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-medical-100 text-medical-700 border border-medical-200 dark:bg-medical-900/30 dark:border-medical-500/30 dark:text-medical-300 uppercase tracking-wider">
                Clinical v2.0
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-clinical-500 dark:text-clinical-400 font-medium leading-none mt-0.5">
              Differential Diagnosis & Evidence RAG
            </p>
          </div>
        </div>
      </div>

      {/* Middle: System Telemetry Indicator (Interactive) */}
      <div className="relative hidden md:block">
        <button
          onClick={() => setShowStatusPopup(!showStatusPopup)}
          onMouseEnter={() => setShowStatusPopup(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-clinical-100 dark:bg-navy-850 border border-clinical-200 dark:border-white/10 hover:border-medical-500/40 transition-all shadow-sm"
        >
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isHealthy ? 'bg-pulse-emerald' : isWarning ? 'bg-pulse-amber' : 'bg-pulse-red'
            }`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              isHealthy ? 'bg-pulse-emerald' : isWarning ? 'bg-pulse-amber' : 'bg-pulse-red'
            }`} />
          </span>
          <span className="text-clinical-700 dark:text-clinical-300">
            {isHealthy ? 'System Active' : isWarning ? 'API Key Needed' : 'Service Alert'}
          </span>
          <span className="text-[10px] text-clinical-500 font-mono">
            ({health?.model ? health.model.split('-')[0] : 'LLM'})
          </span>
        </button>

        {/* Telemetry Popover */}
        {showStatusPopup && (
          <div
            onMouseLeave={() => setShowStatusPopup(false)}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 rounded-2xl bg-white dark:bg-navy-900 p-4 shadow-xl border border-clinical-200 dark:border-white/10 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-clinical-100 dark:border-white/10">
              <span className="font-semibold text-clinical-900 dark:text-clinical-100">System Telemetry</span>
              <span className="text-[10px] font-mono text-medical-600 dark:text-medical-400">RAG Node 4</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-clinical-600 dark:text-clinical-300">
                  <Activity className="w-3.5 h-3.5 text-medical-500" />
                  <span>Groq Cloud LLM</span>
                </div>
                <span className="flex items-center gap-1 font-mono">
                  {health?.groq ? (
                    <span className="text-pulse-emerald flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Online</span>
                  ) : (
                    <span className="text-pulse-amber flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Setup Key</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-clinical-600 dark:text-clinical-300">
                  <Database className="w-3.5 h-3.5 text-pulse-cyan" />
                  <span>FAISS Vector DB</span>
                </div>
                <span className="text-pulse-emerald flex items-center gap-1 font-mono">
                  {health?.faiss_index ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3 text-pulse-red" />}
                  {health?.faiss_index ? 'Indexed' : 'Missing'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-clinical-600 dark:text-clinical-300">
                  <Sparkles className="w-3.5 h-3.5 text-pulse-indigo" />
                  <span>Cross-Encoder Reranker</span>
                </div>
                <span className="text-pulse-emerald font-mono">
                  {health?.reranker ? 'Active' : 'Fallback'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-clinical-600 dark:text-clinical-300">
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  <span>Tavily Web Search</span>
                </div>
                <span className="text-pulse-emerald font-mono">
                  {health?.tavily ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-clinical-100 dark:border-white/10 flex items-center justify-between text-[11px] text-clinical-500 dark:text-clinical-400">
              <span>Model: <code className="text-medical-600 dark:text-medical-400 font-mono text-[10px]">{health?.model || 'Groq'}</code></span>
              <button 
                onClick={() => { setShowStatusPopup(false); onOpenSettings(); }}
                className="text-medical-600 dark:text-medical-400 hover:underline font-medium"
              >
                Configure
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Quick Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Structured Patient Intake Button */}
        <button
          onClick={onOpenPatientIntake}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-medical-500/10 to-indigo-500/10 hover:from-medical-500/20 hover:to-indigo-500/20 dark:from-medical-500/20 dark:to-indigo-500/20 dark:hover:from-medical-500/30 dark:hover:to-indigo-500/30 border border-medical-200 dark:border-medical-500/30 text-medical-700 dark:text-medical-300 text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Patient Intake</span>
        </button>

        {/* Knowledge Base */}
        <button
          onClick={onOpenKnowledgeBase}
          className="p-2 rounded-xl text-clinical-500 hover:text-clinical-900 dark:text-clinical-400 dark:hover:text-clinical-100 hover:bg-clinical-100 dark:hover:bg-navy-850 transition-colors"
          title="Knowledge Base Explorer"
        >
          <BookOpen className="w-4 h-4" />
        </button>

        {/* Keyboard shortcuts */}
        <button
          onClick={onOpenShortcuts}
          className="hidden sm:block p-2 rounded-xl text-clinical-500 hover:text-clinical-900 dark:text-clinical-400 dark:hover:text-clinical-100 hover:bg-clinical-100 dark:hover:bg-navy-850 transition-colors"
          title="Keyboard Shortcuts"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Theme Switcher */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl text-clinical-500 hover:text-clinical-900 dark:text-clinical-400 dark:hover:text-clinical-100 hover:bg-clinical-100 dark:hover:bg-navy-850 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-clinical-500 hover:text-clinical-900 dark:text-clinical-400 dark:hover:text-clinical-100 hover:bg-clinical-100 dark:hover:bg-navy-850 transition-colors relative"
          title="Settings & API Configuration"
        >
          <SettingsIcon className="w-4 h-4" />
          {!health?.groq && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-pulse-amber" />
          )}
        </button>
      </div>
    </header>
  );
}
