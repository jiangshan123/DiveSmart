import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import './ChatAssistant.css';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const nextUser: ChatMessage = { role: 'user', content: text };
    const history = [...messages, nextUser];
    setMessages(history);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const res = await axios.post<{
        success: boolean;
        data?: { reply: string };
        error?: string;
      }>(`${API_BASE}/api/chat`, { messages: history }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000,
      });
      const payload = res.data;
      const reply = payload?.data?.reply;
      if (!payload?.success || reply === undefined) {
        throw new Error(payload?.error || 'Unexpected response');
      }
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object' && 'error' in e.response.data
          ? String((e.response.data as { error?: string }).error)
          : e instanceof Error
            ? e.message
            : 'Request failed';
      setError(msg);
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  return (
    <div className="chat-assistant-root">
      {!open && (
        <button
          type="button"
          className="chat-assistant-fab"
          aria-label="Open dive assistant chat"
          onClick={() => setOpen(true)}
        >
          💬
        </button>
      )}
      {open && (
        <div className="chat-assistant-panel" role="dialog" aria-label="Dive assistant">
          <div className="chat-assistant-header">
            <span>Dive assistant(Gemini-lite)</span>
            <button type="button" className="chat-assistant-close" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          <div className="chat-assistant-messages" ref={listRef}>
            {messages.length === 0 && (
              <p className="chat-assistant-hint">
                Ask about NZ dive sites, gear, or trip planning. Not a substitute for professional instruction.
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === 'user'
                    ? 'chat-assistant-bubble chat-assistant-bubble--user'
                    : 'chat-assistant-bubble chat-assistant-bubble--assistant'
                }
              >
                {msg.content}
              </div>
            ))}
            {loading && <div className="chat-assistant-typing">Thinking…</div>}
            {error && <div className="chat-assistant-error">{error}</div>}
          </div>
          <div className="chat-assistant-input-row">
            <input
              className="chat-assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              className="chat-assistant-send"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
