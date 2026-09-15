import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Moon, Sun, LogOut, Loader2, KeyRound, Landmark, Building2, CalendarDays,
  LayoutDashboard, ListChecks, Gauge, Wrench, Table2, FileCheck2, Menu, X
} from 'lucide-react';
import Dropzone from './components/Dropzone';
import AIChat from './components/AIChat';
import ReportDashboard from './components/ReportDashboard';
import Login from './components/Login';
import ChangePasswordModal from './components/ChangePasswordModal';
import { auth, isFirebaseConfigured } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { loadRulesMetadata } from './core/rulesMetadata';
import { ValidationResult, RuleDefinition } from './core/types';
import type { AppNav } from './navigation';

const INATIVIDADE_MS = 30 * 60 * 1000;

function userInitials(user: User | null): string {
  const email = user?.email ?? '';
  if (!email) return 'VS';
  const part = email.split('@')[0];
  const bits = part.split(/[._-]/).filter(Boolean);
  if (bits.length >= 2) return (bits[0][0] + bits[1][0]).toUpperCase();
  return part.slice(0, 2).toUpperCase();
}

function userDisplayName(user: User | null): string {
  if (user?.displayName) return user.displayName;
  if (user?.email) return user.email.split('@')[0].replace(/[._-]/g, ' ');
  return 'Usuário local';
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [files, setFiles] = useState<File[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [rulesMap, setRulesMap] = useState<Map<string, RuleDefinition>>(new Map());
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiResults, setAiResults] = useState<ValidationResult[]>([]);
  const [aiMeta, setAiMeta] = useState<{ enteId?: string; periodo?: string }>({});
  const [nav, setNav] = useState<AppNav>('carga');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ errors: 0, warnings: 0, infos: 0, capag: 0, suggested: 0, scorePct: 0, scoreOk: 0, scoreTotal: 0 });

  const [lastLoadAt, setLastLoadAt] = useState<string | null>(null);

  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  useEffect(() => {
    loadRulesMetadata()
      .then(map => setRulesMap(map))
      .catch(() => {})
      .finally(() => setRulesLoaded(true));
  }, []);

  const resetTimer = useCallback(() => {
    if (!isFirebaseConfigured || !auth) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(async () => {
      await signOut(auth!);
      alert('Sessão encerrada por inatividade (30 minutos). Faça login novamente.');
    }, INATIVIDADE_MS);
  }, []);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetTimer]);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoadingAuth(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleLogout = async () => {
    if (auth) await signOut(auth);
    setFiles([]);
    setAiResults([]);
    setAiMeta({});
    setNav('carga');
  };

  const handleFiles = (f: File[]) => {
    setFiles(f);
    setLastLoadAt(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));
    setNav('validacoes');
    setSidebarOpen(false);
  };

  const handleReset = () => {
    setFiles([]);
    setAiResults([]);
    setAiMeta({});
    setLastLoadAt(null);
    setStats({ errors: 0, warnings: 0, infos: 0, capag: 0, suggested: 0, scorePct: 0, scoreOk: 0, scoreTotal: 0 });
    setNav('carga');
  };

  if (loadingAuth) {
    return (
      <div className="app-loading">
        <Loader2 size={40} className="spin" style={{ color: 'var(--gov-800)' }} />
      </div>
    );
  }

  const headerBrand = (
    <div className="inst-brand">
      <div className="inst-brand-mark">
        <Landmark size={22} />
      </div>
      <div className="inst-brand-text">
        <div className="inst-brand-row">
          <span className="inst-brand-name">Validador Siconfi</span>
          <span className="inst-badge">Pré-validação local</span>
        </div>
        <span className="inst-brand-sub">Auditoria contábil da MSC e relatórios fiscais (D1–D4)</span>
      </div>
    </div>
  );

  // Login — mesmo estilo institucional, sem sidebar
  if (isFirebaseConfigured && !user) {
    return (
      <div className="app-shell login-shell">
        <header className="inst-header">
          {headerBrand}
        </header>
        <div className="inst-body">
          <main className="inst-main" style={{ justifyContent: 'center', maxWidth: 480 }}>
            <Login />
          </main>
          <footer className="inst-footer">
            <div>
              <span>Validador Siconfi · Pré-validação local</span>
            </div>
            <div>Dados processados somente no navegador</div>
          </footer>
        </div>
      </div>
    );
  }

  const inconsistencias = stats.errors + stats.warnings;
  const hasResults = files.length > 0;

  return (
    <div className="app-shell">
      <header className="inst-header">
        <div className="inst-header-left">
          <button
            className="icon-btn sidebar-toggle"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Menu"
            title="Menu"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          {headerBrand}
          <div className="inst-meta">
            <div className="inst-meta-chip">
              <Building2 size={18} />
              <div>
                <span className="label">Ente Federativo</span>
                <span className="value">
                  {aiMeta.enteId
                    ? <><span className="mono">{aiMeta.enteId}</span> (código IBGE)</>
                    : '—'}
                </span>
              </div>
            </div>
            <div className="inst-meta-chip">
              <CalendarDays size={18} />
              <div>
                <span className="label">Exercício de Referência</span>
                <span className="value">{aiMeta.periodo ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="inst-header-right">
          <div className="inst-secure">
            <span className="dot" />
            <span>Ambiente Seguro (Processamento em Memória Local)</span>
          </div>
          <button className="inst-btn" onClick={toggleTheme} title="Tema">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span className="hide-sm">Tema</span>
          </button>
          {isFirebaseConfigured && user && (
            <>
              <button className="inst-btn" onClick={() => setShowChangePassword(true)} title="Alterar senha">
                <KeyRound size={16} />
              </button>
              <div className="inst-user">
                <div className="inst-user-info">
                  <div className="inst-user-name">{userDisplayName(user)}</div>
                  <div className="inst-user-role">{user.email}</div>
                </div>
                <div className="inst-avatar">{userInitials(user)}</div>
                <button className="icon-btn" onClick={handleLogout} title="Sair" aria-label="Sair">
                  <LogOut size={16} />
                </button>
              </div>
            </>
          )}
          {!isFirebaseConfigured && (
            <div className="inst-user">
              <div className="inst-user-info">
                <div className="inst-user-name">Modo local</div>
                <div className="inst-user-role">Sem autenticação</div>
              </div>
              <div className="inst-avatar">VS</div>
            </div>
          )}
        </div>
      </header>

      <aside className={`inst-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="inst-sidebar-nav">
          <div className="inst-nav-section">Módulos da Auditoria</div>
          <button
            className={`inst-nav-item ${nav === 'carga' ? 'active' : ''}`}
            onClick={() => { setNav('carga'); setSidebarOpen(false); }}
          >
            <span className="nav-left">
              <LayoutDashboard size={18} />
              Visão Geral &amp; Carga
            </span>
          </button>
          <button
            className={`inst-nav-item ${nav === 'validacoes' ? 'active' : ''}`}
            onClick={() => { setNav('validacoes'); setSidebarOpen(false); }}
            disabled={!hasResults}
          >
            <span className="nav-left">
              <ListChecks size={18} />
              Regras D1 a D4 STN
            </span>
            {inconsistencias > 0 && (
              <span className="inst-nav-count danger">{inconsistencias}</span>
            )}
          </button>
          <button
            className={`inst-nav-item ${nav === 'capag' ? 'active' : ''}`}
            onClick={() => { setNav('capag'); setSidebarOpen(false); }}
            disabled={!hasResults}
          >
            <span className="nav-left">
              <Gauge size={18} />
              CAPAG &amp; Limites LRF
            </span>
            {stats.capag > 0 && (
              <span className="inst-nav-count warn">{stats.capag}</span>
            )}
          </button>
          <button
            className={`inst-nav-item ${nav === 'ajustes' ? 'active' : ''}`}
            onClick={() => { setNav('ajustes'); setSidebarOpen(false); }}
            disabled={!hasResults}
          >
            <span className="nav-left">
              <Wrench size={18} />
              Ajustes PCASP Sugeridos
            </span>
            {stats.suggested > 0 && (
              <span className="inst-nav-count info">{stats.suggested}</span>
            )}
          </button>
          <button
            className={`inst-nav-item ${nav === 'relatorios' ? 'active' : ''}`}
            onClick={() => { setNav('relatorios'); setSidebarOpen(false); }}
            disabled={!hasResults}
          >
            <span className="nav-left">
              <Table2 size={18} />
              Matriz de Saldos (MSC)
            </span>
          </button>
          <a
            className="inst-nav-item"
            href="https://cauc.tesouro.gov.br"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <span className="nav-left">
              <FileCheck2 size={18} />
              Extratos &amp; Certidões CAUC
            </span>
          </a>

          {hasResults && stats.scoreTotal > 0 && (
            <div className="inst-sidebar-summary">
              <div className="row">
                <span>Índice Geral de Consistência</span>
                <span className="pct">{stats.scorePct.toFixed(1)}%</span>
              </div>
              <div className="inst-progress">
                <span style={{ width: `${Math.min(100, stats.scorePct)}%` }} />
              </div>
              <div className="hint">
                {stats.scoreOk} regras sem ressalvas em {stats.scoreTotal} aplicáveis ao ente.
              </div>
            </div>
          )}
        </div>

        <div className="inst-sidebar-foot">
          <div className="row">
            <span>Base normativa:</span>
            <span className="val">MCASP / STN</span>
          </div>
          <div className="row">
            <span>Última carga:</span>
            <span className="val">{lastLoadAt ?? '—'}</span>
          </div>
        </div>
      </aside>

      <div className="inst-body">
        <main className="inst-main">
          {!rulesLoaded && !hasResults && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Carregando metadados de regras…
            </p>
          )}

          {files.length === 0 || nav === 'carga' ? (
            <Dropzone
              onFilesDropped={handleFiles}
              files={files}
              onReset={hasResults ? handleReset : undefined}
              onGoValidacoes={hasResults ? () => setNav('validacoes') : undefined}
            />
          ) : (
            <ReportDashboard
              files={files}
              rulesMap={rulesMap}
              nav={nav}
              onReset={handleReset}
              onResultsReady={(r, m) => { setAiResults(r); setAiMeta(m); }}
              onStats={setStats}
            />
          )}
        </main>

        <footer className="inst-footer">
          <div>
            <span>Validador Siconfi · Pré-validação local</span>
            <span className="sep">·</span>
            <span>Regras alinhadas ao Siconfi / MCASP</span>
          </div>
          <div>Dados processados somente no navegador · Não é o sistema oficial da STN</div>
        </footer>
      </div>

      {showChangePassword && isFirebaseConfigured && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      <AIChat results={aiResults} meta={aiMeta} />
    </div>
  );
}

export default App;
