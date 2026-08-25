import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import PatientIntakeModal from './components/PatientIntakeModal';
import SettingsModal from './components/SettingsModal';
import KnowledgeBaseModal from './components/KnowledgeBaseModal';
import ExportModal from './components/ExportModal';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';

import { 
  fetchHealth, 
  fetchThreads, 
  createThread, 
  fetchThreadMessages, 
  updateThread, 
  deleteThread, 
  fetchCacheStats, 
  clearCache, 
  streamChat 
} from './api';

export default function App() {
  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('mediguide_theme') || 'dark');

  // Core Data State
  const [health, setHealth] = useState(null);
  const [cacheStats, setCacheStats] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);

  // Streaming State
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStage, setStreamingStage] = useState(null);
  const [streamingToken, setStreamingToken] = useState('');
  const [currentTriage, setCurrentTriage] = useState(null);

  // UI / Modal States
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isPatientIntakeOpen, setIsPatientIntakeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [exportData, setExportData] = useState(null); // { thread, singleContent }

  // Apply Theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('mediguide_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Initial Load & Polling
  const refreshHealthAndCache = useCallback(async () => {
    try {
      const [h, c] = await Promise.all([fetchHealth(), fetchCacheStats()]);
      setHealth(h);
      setCacheStats(c);
    } catch (e) {
      console.error('Telemetry refresh error:', e);
    }
  }, []);

  const refreshThreadsList = useCallback(async () => {
    try {
      const threadList = await fetchThreads();
      setThreads(threadList);
      return threadList;
    } catch (e) {
      console.error('Failed to load threads:', e);
      return [];
    }
  }, []);

  useEffect(() => {
    refreshHealthAndCache();
    refreshThreadsList().then((list) => {
      if (list && list.length > 0) {
        handleSelectThread(list[0].id);
      } else {
        handleNewThread();
      }
    });

    const interval = setInterval(refreshHealthAndCache, 30000);
    return () => clearInterval(interval);
  }, [refreshHealthAndCache, refreshThreadsList]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewThread();
      } else if (isCmdOrCtrl && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setIsPatientIntakeOpen(true);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsKnowledgeBaseOpen(true);
      } else if (e.key === 'Escape') {
        setIsPatientIntakeOpen(false);
        setIsSettingsOpen(false);
        setIsKnowledgeBaseOpen(false);
        setIsShortcutsOpen(false);
        setExportData(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Thread Operations
  const handleSelectThread = async (threadId) => {
    setActiveThreadId(threadId);
    setStreamingToken('');
    setStreamingStage(null);
    try {
      const res = await fetchThreadMessages(threadId);
      setMessages(res.messages || []);
    } catch (e) {
      console.error('Failed to load thread messages:', e);
      setMessages([]);
    }
  };

  const handleNewThread = async () => {
    try {
      const newThread = await createThread();
      setThreads(prev => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
      setMessages([]);
      setStreamingToken('');
      setStreamingStage(null);
    } catch (e) {
      console.error('Error creating thread:', e);
    }
  };

  const handleDeleteThread = async (threadId) => {
    try {
      await deleteThread(threadId);
      const updated = threads.filter(t => t.id !== threadId);
      setThreads(updated);
      if (activeThreadId === threadId) {
        if (updated.length > 0) {
          handleSelectThread(updated[0].id);
        } else {
          handleNewThread();
        }
      }
    } catch (e) {
      console.error('Failed to delete thread:', e);
    }
  };

  const handleUpdateThread = async (threadId, data) => {
    try {
      const updated = await updateThread(threadId, data);
      setThreads(prev => prev.map(t => (t.id === threadId ? { ...t, ...updated } : t)));
    } catch (e) {
      console.error('Failed to update thread:', e);
    }
  };

  const handleClearCache = async () => {
    try {
      await clearCache();
      const updated = await fetchCacheStats();
      setCacheStats(updated);
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
  };

  // Send Message / Stream Execution
  const handleSendMessage = async (userText, patientContext = null) => {
    if (!userText || isStreaming) return;

    let currentId = activeThreadId;
    if (!currentId) {
      const newThread = await createThread();
      currentId = newThread.id;
      setActiveThreadId(currentId);
      setThreads(prev => [newThread, ...prev]);
    }

    // Add User Message to feed immediately
    const userMsgObj = {
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsgObj]);

    // Reset streaming state
    setIsStreaming(true);
    setStreamingStage('input_processing');
    setStreamingToken('');
    setCurrentTriage(null);

    let accumulatedText = '';

    await streamChat({
      message: userText,
      threadId: currentId,
      patientContext,
      onStage: (stage, label) => {
        setStreamingStage(stage);
      },
      onTriage: (triageData) => {
        setCurrentTriage(triageData);
      },
      onToken: (token) => {
        accumulatedText += token;
        setStreamingToken(accumulatedText);
      },
      onDone: (data) => {
        const finalContent = data.full_text || accumulatedText;
        const assistantMsgObj = {
          role: 'assistant',
          content: finalContent,
          sources: data.sources || [],
          entities: data.entities || {},
          is_emergency: data.is_emergency || false,
          is_cache_hit: data.is_cache_hit || false,
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, assistantMsgObj]);
        setIsStreaming(false);
        setStreamingToken('');
        setStreamingStage(null);

        // Refresh threads list & cache metrics
        refreshThreadsList();
        refreshHealthAndCache();
      },
      onError: (message, detail) => {
        const errorContent = `⚠️ **Clinical Engine Communication Alert**\n\n${message}\n\n${detail ? `\`${detail}\`` : ''}\n\n👉 *Click the **Settings ⚙️** icon in the top right to verify your Groq API Key.*`;
        
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: errorContent,
            timestamp: new Date().toISOString(),
          }
        ]);
        setIsStreaming(false);
        setStreamingToken('');
        setStreamingStage(null);
      }
    });
  };

  const handleExport = (thread = null, singleContent = null) => {
    const activeThreadObj = thread || threads.find(t => t.id === activeThreadId) || {
      title: 'Active Consultation',
      messages
    };
    setExportData({ thread: activeThreadObj, singleContent });
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-clinical-50 dark:bg-navy-900 text-clinical-900 dark:text-clinical-50 font-sans select-none transition-colors duration-300">
      {/* Top Global Header */}
      <Header
        health={health}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenKnowledgeBase={() => setIsKnowledgeBaseOpen(true)}
        onOpenPatientIntake={() => setIsPatientIntakeOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
      />

      {/* Main Workspace (Sidebar + Chat View) */}
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={handleSelectThread}
          onNewThread={handleNewThread}
          onDeleteThread={handleDeleteThread}
          onUpdateThread={handleUpdateThread}
          cacheStats={cacheStats}
          onClearCache={handleClearCache}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onExportConversation={handleExport}
        />

        <ChatArea
          messages={messages}
          isStreaming={isStreaming}
          streamingStage={streamingStage}
          streamingToken={streamingToken}
          currentTriage={currentTriage}
          onSendMessage={handleSendMessage}
          onOpenPatientIntake={() => setIsPatientIntakeOpen(true)}
          onExportConversation={handleExport}
          health={health}
        />
      </div>

      {/* Modals & Drawers */}
      <PatientIntakeModal
        isOpen={isPatientIntakeOpen}
        onClose={() => setIsPatientIntakeOpen(false)}
        onSubmitCase={(prompt, patientData) => handleSendMessage(prompt, patientData)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        health={health}
        cacheStats={cacheStats}
        onClearCache={handleClearCache}
        onRefreshHealth={refreshHealthAndCache}
      />

      <KnowledgeBaseModal
        isOpen={isKnowledgeBaseOpen}
        onClose={() => setIsKnowledgeBaseOpen(false)}
      />

      <ExportModal
        isOpen={!!exportData}
        onClose={() => setExportData(null)}
        thread={exportData?.thread}
        singleContent={exportData?.singleContent}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
