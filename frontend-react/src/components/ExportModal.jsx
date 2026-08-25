import React from 'react';
import { X, Download, Printer, Copy, Check, FileText } from 'lucide-react';

export default function ExportModal({ isOpen, onClose, thread, singleContent }) {
  if (!isOpen) return null;

  const title = thread?.title || 'Clinical Consultation Summary';
  const timestamp = new Date().toLocaleString();

  let formattedReport = `# 🩺 MediGuide AI — Clinical Consultation Report\n`;
  formattedReport += `**Title:** ${title}\n`;
  formattedReport += `**Generated:** ${timestamp}\n`;
  formattedReport += `**Platform:** MediGuide Clinical Reasoning Engine v2.0\n`;
  formattedReport += `═══════════════════════════════════════════════════\n\n`;

  if (singleContent) {
    formattedReport += `### Clinical Assessment\n\n${singleContent}\n\n`;
  } else if (thread?.messages && thread.messages.length > 0) {
    thread.messages.forEach((msg, idx) => {
      formattedReport += `### [${msg.role === 'user' ? 'Physician / User Query' : 'MediGuide AI Assessment'}]\n`;
      formattedReport += `${msg.content}\n\n`;
      formattedReport += `───────────────────────────────────────────────────\n\n`;
    });
  } else {
    formattedReport += `No consultation content to export.\n`;
  }

  formattedReport += `\n═══════════════════════════════════════════════════\n`;
  formattedReport += `⚕️ **Medical Disclaimer**: This document is generated for clinical decision support, medical education, and reference purposes only. Not a substitute for formal clinical diagnosis or physician treatment order.\n`;

  const handleDownloadMarkdown = () => {
    const blob = new Blob([formattedReport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mediguide_consultation_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${title} - MediGuide Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; }
            h1 { color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 8px; font-size: 24px; }
            h3 { color: #1e293b; margin-top: 24px; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
            pre { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1; white-space: pre-wrap; font-size: 13px; }
            .disclaimer { margin-top: 40px; padding: 16px; background: #f1f5f9; border-left: 4px solid #0f766e; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <h1>🩺 MediGuide AI — Clinical Consultation Report</h1>
          <p><strong>Title:</strong> ${title}<br><strong>Date:</strong> ${timestamp}</p>
          <pre>${formattedReport}</pre>
          <div class="disclaimer">⚕️ <strong>Medical Disclaimer:</strong> This clinical report is for research and reference purposes only. Consult qualified healthcare professionals for diagnosis and direct care.</div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-navy-950/95 border border-clinical-200 dark:border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-clinical-200 dark:border-white/10 flex items-center justify-between bg-clinical-50 dark:bg-navy-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-medical-50 dark:bg-teal-500/20 text-medical-600 dark:text-teal-300 border border-medical-200 dark:border-teal-500/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-clinical-900 dark:text-slate-100 text-base">Export Clinical Consultation</h2>
              <p className="text-xs text-clinical-500 dark:text-slate-400">Download markdown or print clinical consultation summary</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-clinical-500 dark:text-slate-400 hover:text-clinical-900 dark:hover:text-white hover:bg-clinical-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between text-clinical-500 dark:text-slate-400">
            <span className="font-semibold text-clinical-900 dark:text-slate-200">Report Preview:</span>
            <span className="font-mono text-[11px]">{formattedReport.length} characters</span>
          </div>

          <pre className="p-4 rounded-2xl bg-clinical-50 dark:bg-slate-900/80 border border-clinical-200 dark:border-white/10 text-clinical-700 dark:text-slate-300 font-mono text-[11px] whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed shadow-inner">
            {formattedReport}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-clinical-200 dark:border-white/10 bg-clinical-50 dark:bg-slate-900/80 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-clinical-600 dark:text-slate-400 hover:text-clinical-900 dark:hover:text-white text-xs font-semibold"
          >
            Cancel
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-clinical-100 dark:hover:bg-slate-700 text-clinical-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors border border-clinical-200 dark:border-white/10 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleDownloadMarkdown}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-medical-600 to-indigo-600 dark:from-teal-500 dark:to-cyan-500 hover:opacity-90 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download .MD</span>
          </button>
        </div>
      </div>
    </div>
  );
}
