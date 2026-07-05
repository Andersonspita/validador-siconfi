import { useState, useRef, useEffect } from 'react';
import { ValidationResult } from '../core/types';
import {
  sendMessage, buildSuggestions, isAIConfigured,
  saveKey, clearKey, AIMessage
} from '../core/aiService';
import './AIChat.css';

interface Props {
  results: ValidationResult[];
  meta: { enteId?: string; periodo?: string };
}

export default function AIChat({ results, meta }: Props) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [configured, setConfigured] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const suggestions = buildSuggestions(results);

  useEffect(() => {
    isAIConfigured().then(res => {
      setConfigured(res);
      setCheckingConfig(false);
    });
  }, []);

  useEffect(() => {
    if (open && endRef.current)
      endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Detecta carregamento de arquivo: injeta mensagem de contexto na conversa
  const prevResultsLen = useRef(0);
  useEffect(() => {
    const prev = prevResultsLen.current;
    const curr = results.length;
    prevResultsLen.current = curr;

    // Só age quando passa de sem resultados para com resultados
    if (prev === 0 && curr > 0) {
      const errors   = results.filter(r => r.severity === 'error').length;
      const warnings = results.filter(r => r.severity === 'warning').length;
      const capag    = results.filter(r => r.impactsCapag).length;

      const contextMsg: AIMessage = {
        role: 'assistant',
        content:
          `📂 Arquivo carregado! Agora tenho acesso ao resultado da validação` +
          (meta.enteId ? ` do ente **${meta.enteId}**` : '') +
          (meta.periodo ? ` — período ${meta.periodo}` : '') +
          `.

` +
          `Encontrei **${curr} ocorrência(s)**: ` +
          `${errors} erro(s) crítico(s)${capag ? ` (${capag} com risco CAPAG)` : ''}, ` +
          `${warnings} aviso(s).

` +
          `Como posso ajudar a corrigir os problemas encontrados?`,
      };

      setMessages(prev => {
        // Se não havia conversa, só atualiza as sugestões (não injeta msg)
        if (prev.length === 0) return prev;
        // Se havia conversa, injeta a mensagem de novo contexto
        return [...prev, contextMsg];
      });

      // Abre o chat automaticamente se estava fechado
      setOpen(true);
    }

    // Arquivo removido: notifica que voltou ao modo geral
    if (prev > 0 && curr === 0 && messages.length > 0) {
      setMessages(p => [...p, {
        role: 'assistant',
        content: '🔄 Arquivo removido. Voltei ao modo geral — pode me perguntar qualquer coisa sobre SICONFI, PCASP ou LRF.',
      }]);
    }
  }, [results.length]);  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveKey() {
    if (!keyInput.trim().startsWith('sk-')) {
      setError('Chave inválida — deve começar com "sk-".');
      return;
    }
    await saveKey(keyInput.trim());
    setConfigured(true);
    setKeyInput('');
    setError(null);
  }

  async function handleClearKey() {
    await clearKey();
    setConfigured(false);
    setMessages([]);
  }

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setError(null);
    const updated: AIMessage[] = [...messages, { role: 'user', content: q }];
    setMessages(updated);
    setLoading(true);
    try {
      const reply = await sendMessage(updated, results, meta);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao contactar a IA.');
      if (e.message?.includes('inválida') || e.message?.includes('401')) {
        clearKey(); setConfigured(false);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const answerCount = messages.filter(m => m.role === 'assistant').length;

  return (
    <>
      <button
        className={`ai-fab ${open ? 'ai-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Assistente IA"
        title="Assistente IA — tire dúvidas sobre os resultados"
      >
        {open ? '✕' : '🤖'}
        {!open && messages.length === 0 && <span className="ai-fab-label">Pergunte à IA</span>}
        {answerCount > 0 && !open && <span className="ai-badge">{answerCount}</span>}
      </button>

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
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {configured && (
                <button className="ai-close" onClick={handleClearKey} title="Remover chave desta sessão">🔑</button>
              )}
              <button className="ai-close" onClick={() => setOpen(false)} aria-label="Fechar">✕</button>
            </div>
          </div>

          <div className="ai-messages">

            {/* Loader caso esteja checando */}
            {checkingConfig && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Validando chave no servidor...
              </div>
            )}

            {/* Tela de configuração da chave */}
            {!configured && !checkingConfig && (
              <div className="ai-key-setup">
                <p className="ai-key-title">🔑 Configure sua chave OpenAI</p>
                <p className="ai-key-desc">
                  A chave é salva na nuvem de forma global — <strong>qualquer usuário autenticado</strong> na ferramenta poderá utilizá-la para conversar com a IA.
                </p>
                <input
                  type="password"
                  className="ai-key-input"
                  placeholder="sk-proj-..."
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                  autoFocus
                />
                <button className="ai-key-btn" onClick={handleSaveKey}>
                  Ativar assistente IA
                </button>
                <p className="ai-key-hint">
                  Gere sua chave em{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                    platform.openai.com/api-keys
                  </a>
                </p>
                {error && <div className="ai-error">{error}</div>}
              </div>
            )}

            {/* Chat */}
            {configured && (
              <>
                {messages.length === 0 && (
                  <div className="ai-welcome">
                    <p>
                      Analisei <strong>{results.length} resultado(s)</strong> para{' '}
                      <strong>{meta.enteId ?? 'o município'}</strong>. Como posso ajudar?
                    </p>
                    <div className="ai-suggestions">
                      {suggestions.map((s, i) => (
                        <button key={i} className="ai-suggestion" onClick={() => send(s)}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={`ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`}>
                    {m.role === 'assistant' && <span className="ai-msg-avatar">🤖</span>}
                    <div className="ai-msg-bubble">
                      {m.content.split('\n').map((line, j, arr) => (
                        <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
                      ))}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="ai-msg ai-msg-bot">
                    <span className="ai-msg-avatar">🤖</span>
                    <div className="ai-msg-bubble ai-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                )}

                {error && <div className="ai-error">{error}</div>}
                <div ref={endRef} />
              </>
            )}
          </div>

          {configured && (
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
              >↗</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
