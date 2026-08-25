import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + N / ⌘ + N', desc: 'Start a new medical consultation' },
    { key: 'Enter ↵', desc: 'Send medical query' },
    { key: 'Shift + Enter', desc: 'Insert new line in chat input' },
    { key: 'Ctrl + , / ⌘ + ,', desc: 'Open Settings & API configuration' },
    { key: 'Ctrl + I / ⌘ + I', desc: 'Open Structured Patient Intake Form' },
    { key: 'Ctrl + B / ⌘ + B', desc: 'Open Knowledge Base Explorer' },
    { key: 'Esc', desc: 'Close any active modal' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-navy-950/95 border border-clinical-200 dark:border-white/15 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-clinical-200 dark:border-white/10 flex items-center justify-between bg-clinical-50 dark:bg-navy-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-medical-50 dark:bg-teal-500/20 text-medical-600 dark:text-teal-300 border border-medical-200 dark:border-teal-500/30">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-clinical-900 dark:text-slate-100 text-base">Keyboard Shortcuts</h2>
              <p className="text-xs text-clinical-500 dark:text-slate-400">Power user workflow shortcuts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-clinical-500 dark:text-slate-400 hover:text-clinical-900 dark:hover:text-white hover:bg-clinical-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-2.5 text-xs">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-clinical-200 dark:border-white/5 shadow-sm">
              <span className="text-clinical-800 dark:text-slate-300">{s.desc}</span>
              <kbd className="px-2 py-1 rounded bg-clinical-100 dark:bg-slate-800 border border-clinical-200 dark:border-white/10 font-mono text-[11px] text-medical-600 dark:text-teal-300 font-semibold shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-clinical-200 dark:border-white/10 bg-clinical-50 dark:bg-slate-900/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-clinical-200 dark:bg-slate-800 hover:bg-clinical-300 dark:hover:bg-slate-700 text-clinical-900 dark:text-white font-semibold text-xs transition-colors shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
