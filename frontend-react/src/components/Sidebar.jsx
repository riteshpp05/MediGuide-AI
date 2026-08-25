import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Pin, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Zap, 
  Download, 
  Database,
  Clock
} from 'lucide-react';

export default function Sidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onUpdateThread,
  cacheStats,
  onClearCache,
  isOpenMobile,
  onCloseMobile,
  onExportConversation
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Filter threads by search term
  const filteredThreads = threads.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.preview && t.preview.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const pinnedThreads = filteredThreads.filter(t => t.is_pinned);
  const unpinnedThreads = filteredThreads.filter(t => !t.is_pinned);

  const startRename = (thread, e) => {
    e.stopPropagation();
    setEditingId(thread.id);
    setEditTitle(thread.title);
  };

  const saveRename = (threadId, e) => {
    if (e) e.stopPropagation();
    if (editTitle.trim()) {
      onUpdateThread(threadId, { title: editTitle.trim() });
    }
    setEditingId(null);
  };

  const cancelRename = (e) => {
    if (e) e.stopPropagation();
    setEditingId(null);
  };

  const togglePin = (thread, e) => {
    e.stopPropagation();
    onUpdateThread(thread.id, { is_pinned: !thread.is_pinned });
  };

  const handleClearCacheClick = async () => {
    setIsClearingCache(true);
    await onClearCache();
    setIsClearingCache(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40
        w-80 h-full flex flex-col
        bg-clinical-100 dark:bg-navy-850
        border-none
        transition-transform duration-300 ease-in-out
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Top: New Consultation CTA */}
        <div className="p-4 border-b border-clinical-200 dark:border-white/10">
          <button
            onClick={() => {
              onNewThread();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-gradient-to-r from-medical-500 to-indigo-600 hover:from-medical-400 hover:to-indigo-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 group active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              <span>New Consultation</span>
            </div>
            <kbd className="hidden sm:inline-block text-[10px] bg-black/20 px-2 py-0.5 rounded text-white/90 font-mono">
              Ctrl+N
            </kbd>
          </button>

          {/* Search Box */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clinical-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-clinical-50 dark:bg-navy-900/80 border border-clinical-200 dark:border-white/10 text-clinical-900 dark:text-clinical-100 placeholder-clinical-400 focus:outline-none focus:border-medical-500/50 transition-colors"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-clinical-400 hover:text-clinical-600 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Middle: Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {/* Pinned Section */}
          {pinnedThreads.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 mb-1.5 text-[11px] font-semibold tracking-wider uppercase text-clinical-500">
                <Pin className="w-3 h-3 text-medical-500" />
                <span>Pinned</span>
              </div>
              <div className="space-y-1">
                {pinnedThreads.map(thread => renderThreadItem(thread))}
              </div>
            </div>
          )}

          {/* All Consultations */}
          <div>
            {pinnedThreads.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 mb-1.5 text-[11px] font-semibold tracking-wider uppercase text-clinical-500">
                <Clock className="w-3 h-3 text-clinical-400" />
                <span>Recent Consultations</span>
              </div>
            )}
            
            {unpinnedThreads.length === 0 && pinnedThreads.length === 0 ? (
              <div className="text-center py-10 px-4 text-clinical-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-medical-500" />
                <p className="text-xs font-medium text-clinical-700 dark:text-clinical-300">
                  {searchTerm ? 'No matching conversations' : 'No prior consultations'}
                </p>
                <p className="text-[11px] mt-1">
                  {searchTerm ? 'Try another keyword' : 'Start a medical question above'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {unpinnedThreads.map(thread => renderThreadItem(thread))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Cache Telemetry & Knowledge Base Snippet */}
        <div className="p-3.5 border-t border-clinical-200 dark:border-white/10 bg-clinical-50 dark:bg-navy-900/60 space-y-3">
          {/* Cache Stats Card */}
          <div className="p-3 rounded-xl bg-white dark:bg-navy-950/80 border border-clinical-200 dark:border-white/10 text-xs shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-clinical-800 dark:text-clinical-200">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Neural Answer Cache</span>
              </div>
              <button
                onClick={handleClearCacheClick}
                disabled={isClearingCache || cacheStats?.total_cached === 0}
                className="text-[10px] text-red-500 hover:text-red-600 dark:text-rose-400 dark:hover:text-rose-300 disabled:opacity-40 disabled:hover:text-red-500 font-medium transition-colors"
                title="Purge cached answer database"
              >
                {isClearingCache ? 'Clearing…' : 'Purge'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-1.5 rounded-lg bg-clinical-50 dark:bg-navy-900/90 border border-clinical-100 dark:border-white/5">
                <div className="text-[10px] text-clinical-500 dark:text-clinical-400">Cached</div>
                <div className="font-mono font-bold text-clinical-800 dark:text-clinical-200 mt-0.5">
                  {cacheStats?.total_cached || 0}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-clinical-50 dark:bg-navy-900/90 border border-clinical-100 dark:border-white/5">
                <div className="text-[10px] text-clinical-500 dark:text-clinical-400">Hits</div>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {cacheStats?.total_hits || 0}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-clinical-50 dark:bg-navy-900/90 border border-clinical-100 dark:border-white/5">
                <div className="text-[10px] text-clinical-500 dark:text-clinical-400">Tokens</div>
                <div className="font-mono font-bold text-medical-600 dark:text-teal-400 mt-0.5">
                  ~{cacheStats?.tokens_saved || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Knowledge Base Summary Chip */}
          <div className="flex items-center justify-between text-[11px] text-clinical-500 px-1">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-500 dark:text-cyan-400" />
              <span>Medical_book.pdf</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-cyan-500/10 text-indigo-600 dark:text-cyan-300 border border-indigo-200 dark:border-cyan-500/20">
              FAISS MMR
            </span>
          </div>
        </div>
      </aside>
    </>
  );

  function renderThreadItem(thread) {
    const isActive = thread.id === activeThreadId;
    const isEditing = editingId === thread.id;
    const isConfirmingDelete = confirmDeleteId === thread.id;

    return (
      <div
        key={thread.id}
        onClick={() => {
          if (!isEditing && !isConfirmingDelete) {
            onSelectThread(thread.id);
            if (onCloseMobile) onCloseMobile();
          }
        }}
        className={`
          group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all duration-150
          ${isActive 
            ? 'bg-medical-50 dark:bg-gradient-to-r dark:from-medical-500/20 dark:to-cyan-500/15 border border-medical-200 dark:border-medical-500/40 text-medical-800 dark:text-teal-200 shadow-sm' 
            : 'hover:bg-clinical-50 dark:hover:bg-navy-900/90 text-clinical-700 dark:text-clinical-300 border border-transparent'}
        `}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-medical-600 dark:text-teal-400' : 'text-clinical-400 group-hover:text-clinical-600 dark:group-hover:text-clinical-300'}`} />

          {isEditing ? (
            <div className="flex items-center gap-1 flex-1 mr-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveRename(thread.id, e);
                  if (e.key === 'Escape') cancelRename(e);
                }}
                autoFocus
                className="w-full text-xs bg-white dark:bg-navy-900 border border-medical-500 rounded px-1.5 py-0.5 text-clinical-900 dark:text-white focus:outline-none"
              />
              <button onClick={(e) => saveRename(thread.id, e)} className="p-1 hover:text-emerald-500 dark:hover:text-emerald-400 text-clinical-500">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={cancelRename} className="p-1 hover:text-red-500 dark:hover:text-rose-400 text-clinical-500">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : isConfirmingDelete ? (
            <div className="flex items-center justify-between flex-1 text-red-600 dark:text-rose-300" onClick={(e) => e.stopPropagation()}>
              <span className="text-[11px] font-medium">Delete consultation?</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteThread(thread.id);
                    setConfirmDeleteId(null);
                  }}
                  className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-rose-500/20 hover:bg-red-200 dark:hover:bg-rose-500/30 text-red-700 dark:text-rose-300 text-[10px] font-bold"
                >
                  Yes
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(null);
                  }}
                  className="px-1.5 py-0.5 rounded bg-clinical-200 dark:bg-clinical-800 text-clinical-700 dark:text-clinical-400 text-[10px]"
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium truncate block">
                  {thread.title}
                </span>
                {thread.is_pinned && (
                  <Pin className="w-2.5 h-2.5 text-medical-500 dark:text-teal-400 flex-shrink-0 fill-medical-500 dark:fill-teal-400" />
                )}
              </div>
              <div className="text-[10px] text-clinical-500 truncate mt-0.5">
                {thread.message_count ? `${thread.message_count} messages` : 'Empty'}
              </div>
            </div>
          )}
        </div>

        {/* Action icons on hover */}
        {!isEditing && !isConfirmingDelete && (
          <div className="hidden group-hover:flex items-center gap-1 ml-2 text-clinical-400">
            <button
              onClick={(e) => togglePin(thread, e)}
              className={`p-1 rounded hover:text-medical-600 dark:hover:text-teal-400 hover:bg-clinical-200 dark:hover:bg-clinical-800 ${thread.is_pinned ? 'text-medical-600 dark:text-teal-400' : ''}`}
              title={thread.is_pinned ? 'Unpin' : 'Pin to top'}
            >
              <Pin className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExportConversation(thread);
              }}
              className="p-1 rounded hover:text-indigo-600 dark:hover:text-cyan-400 hover:bg-clinical-200 dark:hover:bg-clinical-800"
              title="Export consultation"
            >
              <Download className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => startRename(thread, e)}
              className="p-1 rounded hover:text-clinical-900 dark:hover:text-white hover:bg-clinical-200 dark:hover:bg-clinical-800"
              title="Rename"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(thread.id);
              }}
              className="p-1 rounded hover:text-red-500 dark:hover:text-rose-400 hover:bg-clinical-200 dark:hover:bg-clinical-800"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  }
}
