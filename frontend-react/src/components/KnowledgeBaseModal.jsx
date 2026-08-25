import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  FileText, 
  Layers, 
  Cpu, 
  CheckCircle2, 
  Sparkles, 
  BookOpen, 
  HardDrive, 
  RefreshCw 
} from 'lucide-react';
import { fetchKnowledgeBaseInfo } from '../api';

export default function KnowledgeBaseModal({ isOpen, onClose }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadInfo();
    }
  }, [isOpen]);

  const loadInfo = async () => {
    setLoading(true);
    try {
      const data = await fetchKnowledgeBaseInfo();
      setInfo(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-navy-950/95 border border-clinical-200 dark:border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-clinical-200 dark:border-white/10 flex items-center justify-between bg-clinical-50 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-cyan-500/20 text-indigo-600 dark:text-cyan-300 border border-indigo-200 dark:border-cyan-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-clinical-900 dark:text-slate-100 text-base">Knowledge Base & Vector Index</h2>
              <p className="text-xs text-clinical-500 dark:text-slate-400">
                FAISS Vector Store, Embeddings Architecture, and Ingested Medical Literature
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 text-xs">
          {loading ? (
            <div className="text-center py-12 text-clinical-500 dark:text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-medical-600 dark:text-teal-400" />
              <p>Inspecting vector database and index files…</p>
            </div>
          ) : (
            <>
              {/* Architecture Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-clinical-200 dark:border-white/5 shadow-sm">
                  <div className="text-[10px] text-clinical-500 dark:text-slate-400">Embedding Model</div>
                  <div className="font-mono font-bold text-medical-700 dark:text-teal-300 mt-1 truncate">all-MiniLM-L6</div>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-clinical-200 dark:border-white/5 shadow-sm">
                  <div className="text-[10px] text-clinical-500 dark:text-slate-400">Vector Dimension</div>
                  <div className="font-mono font-bold text-indigo-600 dark:text-cyan-300 mt-1">384-d</div>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-clinical-200 dark:border-white/5 shadow-sm">
                  <div className="text-[10px] text-clinical-500 dark:text-slate-400">Search Strategy</div>
                  <div className="font-mono font-bold text-purple-600 dark:text-indigo-300 mt-1">MMR (λ=0.7)</div>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-clinical-200 dark:border-white/5 shadow-sm">
                  <div className="text-[10px] text-clinical-500 dark:text-slate-400">Reranker Model</div>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-300 mt-1 truncate">ms-marco-L6</div>
                </div>
              </div>

              {/* Ingested PDF Documents */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-clinical-800 dark:text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-medical-600 dark:text-teal-400" />
                    <span>Ingested Medical Literature (`data/`)</span>
                  </label>
                  <span className="text-[10px] text-clinical-500 dark:text-slate-500">PDF Ingestion Source</span>
                </div>

                {info?.source_documents?.length > 0 ? (
                  <div className="space-y-1.5">
                    {info.source_documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-clinical-50 dark:bg-slate-900/70 border border-clinical-200 dark:border-white/5 text-xs shadow-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-medical-600 dark:text-teal-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="font-semibold text-clinical-900 dark:text-slate-200 block truncate">{doc.name}</span>
                            <span className="text-[10px] text-clinical-500 dark:text-slate-500 font-mono">Last updated: {doc.modified}</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-medical-50 dark:bg-teal-500/15 text-medical-700 dark:text-teal-300 font-mono text-[11px] border border-medical-200 dark:border-teal-500/25">
                          {doc.size_mb} MB
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-clinical-50 dark:bg-slate-900/50 border border-clinical-200 dark:border-white/5 text-center text-clinical-500 dark:text-slate-400 shadow-sm">
                    No PDF files found in `data/`.
                  </div>
                )}
              </div>

              {/* FAISS Index Files */}
              <div className="space-y-2">
                <label className="font-bold text-clinical-800 dark:text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-indigo-600 dark:text-cyan-400" />
                  <span>Persistent Vector Storage (`faiss_index/`)</span>
                </label>

                <div className="p-3.5 rounded-2xl bg-clinical-50 dark:bg-slate-900/60 border border-clinical-200 dark:border-white/10 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-clinical-700 dark:text-slate-300">Total Index Size on Disk:</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-cyan-400">{info?.total_index_size_mb || 0} MB</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono text-clinical-600 dark:text-slate-400">
                    {info?.index_files?.map((f, i) => (
                      <div key={i} className="p-2 rounded-lg bg-white dark:bg-slate-950/80 border border-clinical-200 dark:border-white/5 flex items-center justify-between shadow-sm">
                        <span>{f.name}</span>
                        <span className="text-clinical-500 dark:text-slate-500">{f.size_mb} MB</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pipeline Explanation */}
              <div className="p-3.5 rounded-2xl bg-medical-50 dark:bg-slate-900/40 border border-medical-200 dark:border-white/5 space-y-1.5 text-clinical-700 dark:text-slate-400 text-xs leading-relaxed shadow-sm">
                <div className="font-semibold text-clinical-900 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-medical-600 dark:text-teal-400" />
                  <span>How Retrieval & Reranking Works</span>
                </div>
                <p>
                  1. <strong>Entity Enrichment:</strong> User questions are enriched with detected medical symptoms and demographics.<br/>
                  2. <strong>MMR Search:</strong> Maximal Marginal Relevance retrieves 12 candidate chunks from FAISS to ensure diversity.<br/>
                  3. <strong>Cross-Encoder:</strong> The cross-encoder neural model scores semantic relevance and filters down to the top 6 highest-scoring chunks.<br/>
                  4. <strong>Web Cross-Check:</strong> If guidelines or protocols are referenced, Tavily queries PubMed, WHO, and NIH in real-time.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-clinical-200 dark:border-white/10 bg-clinical-50 dark:bg-slate-900/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-clinical-200 dark:bg-slate-800 hover:bg-clinical-300 dark:hover:bg-slate-700 text-clinical-900 dark:text-white font-semibold text-xs transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
