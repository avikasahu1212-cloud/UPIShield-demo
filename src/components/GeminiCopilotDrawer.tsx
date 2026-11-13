import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, Trash2, X } from 'lucide-react';

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
}

interface GeminiCopilotDrawerProps {
  open: boolean;
  onClose: () => void;
}

const ROLE_OPTIONS = [
  { id: 'sre_commander', label: 'SRE Incident Commander' },
  { id: 'risk_analyst', label: 'Risk & Continuity Analyst' },
  { id: 'db_architect', label: 'Database Reliability Architect' },
  { id: 'payment_auditor', label: 'Payment Integrity Auditor' },
];

const MODEL_OPTIONS = [
  { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen (General)' },
  { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon (Deep Reasoning)' },
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon (Complex Interactive)' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Fast)' },
];

export const GeminiCopilotDrawer: React.FC<GeminiCopilotDrawerProps> = ({ open, onClose }) => {
  const [role, setRole] = useState('sre_commander');
  const [model, setModel] = useState('gemini-4-hydrogen');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: 'model',
      text: 'UPIShield SRE Copilot ready. Ask about active incidents, dependency blast radius, October seasonal risk patterns, or payment idempotency safeguards.',
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending, open]);

  if (!open) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const nextHistory = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(nextHistory);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          role,
          history: messages.filter((_, idx) => idx > 0).map((m) => ({ role: m.role, text: m.text })),
          message: trimmed,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to get response from Gemini Copilot');
      }
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: json.reply, modelUsed: json.modelUsed },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copilot error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative w-full max-w-md bg-[#0A0F1E] border-l border-slate-800 flex flex-col h-full z-10 shadow-2xl">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-display text-sm font-semibold text-white">UPIShield SRE Copilot</h2>
              <p className="text-[11px] text-slate-400">Multi-turn Gemini resilience advisor</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setMessages([
                  {
                    role: 'model',
                    text: 'Conversation cleared. Ready for new infrastructure resilience analysis.',
                  },
                ])
              }
              title="Clear history"
              className="p-2 text-slate-400 hover:text-white cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close copilot"
              className="p-2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Role & Model Selectors */}
        <div className="p-3 border-b border-slate-800/80 bg-[#0C1222] grid grid-cols-2 gap-2 text-xs">
          <label className="block">
            <span className="text-[10px] text-slate-500 block mb-1">System Persona Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-8 px-2 rounded bg-[#060A14] border border-slate-800 text-[11px] text-slate-200"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-slate-500 block mb-1">Gemini Model</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-8 px-2 rounded bg-[#060A14] border border-slate-800 text-[11px] text-slate-200"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Scrollable Message Thread */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600/20 border border-blue-500/30 text-slate-100 ml-8'
                  : 'bg-[#0C1222] border border-slate-800 text-slate-200 mr-6'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
                <span>{msg.role === 'user' ? 'OPERATOR' : 'UPISHIELD COPILOT'}</span>
                {msg.modelUsed && <span>{msg.modelUsed}</span>}
              </div>
              {msg.text}
            </div>
          ))}

          {sending && (
            <div className="rounded-xl p-3 bg-[#0C1222] border border-slate-800 text-xs text-slate-400 mr-6">
              Analyzing UPIShield telemetry...
            </div>
          )}

          {error && (
            <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-[#0C1222] flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about blast radius, October risks, or recovery..."
            className="flex-1 h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send message"
            className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white flex items-center justify-center cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </aside>
    </div>
  );
};
