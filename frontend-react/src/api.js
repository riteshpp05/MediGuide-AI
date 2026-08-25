/**
 * MediGuide AI — API Client
 * Connects to FastAPI backend server on http://localhost:8000
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchHealth() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return await res.json();
  } catch (err) {
    return {
      groq: false,
      faiss_index: false,
      model: 'Unknown',
      message: `Cannot connect to server: ${err.message}`,
      has_api_key: false,
    };
  }
}

export async function fetchKnowledgeBaseInfo() {
  const res = await fetch(`${BASE_URL}/api/knowledge-base/info`);
  if (!res.ok) throw new Error('Failed to fetch knowledge base stats');
  return await res.json();
}

export async function fetchThreads() {
  const res = await fetch(`${BASE_URL}/api/threads`);
  if (!res.ok) throw new Error('Failed to fetch conversation threads');
  return await res.json();
}

export async function createThread() {
  const res = await fetch(`${BASE_URL}/api/threads`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create new thread');
  return await res.json();
}

export async function fetchThreadMessages(threadId) {
  const res = await fetch(`${BASE_URL}/api/threads/${threadId}/messages`);
  if (!res.ok) throw new Error('Failed to fetch thread messages');
  return await res.json();
}

export async function updateThread(threadId, data) {
  const res = await fetch(`${BASE_URL}/api/threads/${threadId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update thread');
  return await res.json();
}

export async function deleteThread(threadId) {
  const res = await fetch(`${BASE_URL}/api/threads/${threadId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete thread');
  return await res.json();
}

export async function fetchCacheStats() {
  const res = await fetch(`${BASE_URL}/api/cache/stats`);
  if (!res.ok) throw new Error('Failed to fetch cache stats');
  return await res.json();
}

export async function clearCache() {
  const res = await fetch(`${BASE_URL}/api/cache/clear`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clear cache');
  return await res.json();
}

export async function updateSettings(settings) {
  const res = await fetch(`${BASE_URL}/api/settings/update-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return await res.json();
}

export async function analyzeTriage(text) {
  const res = await fetch(`${BASE_URL}/api/triage/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Failed to analyze triage');
  return await res.json();
}

/**
 * Stream chat response using SSE (Server-Sent Events)
 */
export async function streamChat({ message, threadId, patientContext, onStage, onToken, onTriage, onDone, onError }) {
  try {
    const response = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        thread_id: threadId,
        patient_context: patientContext,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server returned HTTP ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep the last incomplete chunk

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'stage' && onStage) {
              onStage(data.stage, data.label);
            } else if (data.type === 'triage' && onTriage) {
              onTriage(data);
            } else if (data.type === 'token' && onToken) {
              onToken(data.token);
            } else if (data.type === 'done' && onDone) {
              onDone(data);
            } else if (data.type === 'error' && onError) {
              onError(data.message, data.detail);
            }
          } catch (jsonErr) {
            console.warn('Failed to parse SSE JSON payload:', jsonStr, jsonErr);
          }
        }
      }
    }
  } catch (err) {
    if (onError) {
      onError(err.message || 'Stream connection failed');
    }
  }
}
