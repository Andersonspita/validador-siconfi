import { useState, useRef, useEffect } from 'react';
import { ValidationResult } from '../core/types';
import { sendMessage, buildSuggestions, isAIConfigured, AIMessage } from '../core/aiService';
import './AIChat.css';

interface Props {
  results: ValidationResult[];
  meta: { enteId?: string; periodo?: string };
}

export default function AIChat({ results, meta }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const suggestions = buildSuggestions(results);

  useEffect(() => {
    if (open && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setError(null);
    const newMessages: AIMessage[] = [...messages, { role: 'user', content: q }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const reply = await sendMessage(newMessages, results, meta);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao contactar a IA.');
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  if (!isAIConfigured) {
    return (
      <div className="ai-not-configured">
        <span>🤖</span>
        <div>
          <strong>Assistente IA disponível</strong>
          <p>Configure <code>VITE_OPENAI_API_KEY</code> no <code>.env</code> e refaça o deploy para ativar o assistente.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        className={`ai-fab ${open ? 'ai-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Assistente IA"
        title="Assistente IA — tire dúvidas sobre os resultados"
      >
        {open ? '✕' : '🤖'}
        {!open && messages.length === 0 && <span className="ai-fab-label">Pergunte à IA</span>}
        {messages.filter(m => m.role === 'assistant').length > 0 && !open && (
          <span className="ai-badge">{messages.filter(m => m.role === 'assistant').length}</span>
        )}
      </button>

      {/* Painel do chat */}
      {open && (
        <div className="ai-panel" role="dialog" aria-label="Assistente IA SICONFI">
          <div className="ai-header">
            <div className="ai-header-info">
              <span className="ai-avatar">🤖</span>
              <div>
                <p className="ai-title">Assistente Fiscal IA</p>
                <p className="ai-subtitle">Especialista em SICONFI · PCASP · LRF · CAPAG</p>
              </div>
            </div>
            <button className="ai-close" onClick={() => setOpen(false)} aria-label="Fechar">✕</button>
          </div>

          <div className="ai-messages">
            {messages.length === 0 && (
              <div className="ai-welcome">
                <p>Olá! Analisei <strong>{results.length} resultado(s)</strong> de validação para <strong>{meta.enteId ?? 'o município'}</strong>. Como posso ajudar?</p>
                <div className="ai-suggestions">
                  {suggestions.map((s, i) => (
                    <button key={i} className="ai-suggestion" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`}>
                {m.role === 'assistant' && <span className="ai-msg-avatar">🤖</span>}
                <div className="ai-msg-bubble">
                  {m.content.split('\n').map((line, j) => (
                    <span key={j}>{line}{j < m.content.split('\n').length - 1 && <br />}</span>
                  ))}
                </div>
              </div>
            ))}

            {loading && (
              <div className="ai-msg ai-msg-bot">
                <span className="ai-msg-avatar">🤖</span>
                <div className="ai-msg-bubble ai-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}

            {error && <div className="ai-error">{error}</div>}
            <div ref={endRef} />
          </div>

          <div className="ai-input-row">
            <textarea
              className="ai-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pergunte sobre os resultados… (Enter para enviar)"
              rows={2}
              disabled={loading}
            />
            <button
              className="ai-send"
              onClick={() => send()}
              disabled={!input.trim() || loading}
              aria-label="Enviar"
            >
              ↗
            </button>
          </div>
        </div>
      )}
    </>
  );
}
