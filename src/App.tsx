import { useState, useEffect } from 'react';
import { Moon, Sun, ShieldCheck, LogOut, Loader2, KeyRound } from 'lucide-react';
import Dropzone from './components/Dropzone';
import ReportDashboard from './components/ReportDashboard';
import Login from './components/Login';
import ChangePasswordModal from './components/ChangePasswordModal';
import { auth } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [files, setFiles] = useState<File[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setFiles([]);
  };

  if (loadingAuth) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={48} className="spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-container">
        <header className="glass-header">
          <div className="header-content" style={{ justifyContent: 'center' }}>
            <div className="logo-container">
              <ShieldCheck className="logo-icon" size={32} />
              <h1>Validador <span>Siconfi</span></h1>
            </div>
          </div>
        </header>
        <Login />
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="glass-header">
        <div className="header-content">
          <div className="logo-container">
            <ShieldCheck className="logo-icon" size={32} />
            <h1>Validador <span>Siconfi</span></h1>
          </div>
          <div className="header-actions">
            <button onClick={toggleTheme} className="icon-btn" aria-label="Toggle Theme" title="Tema">
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button onClick={() => setShowChangePassword(true)} className="icon-btn" aria-label="Alterar Senha" title="Alterar Senha">
              <KeyRound size={20} />
            </button>
            <button onClick={handleLogout} className="icon-btn logout-btn" aria-label="Sair" title="Sair">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="hero-section">
          <h2>Garanta a qualidade da informação fiscal</h2>
          <p>Faça o upload da sua MSC, RREO, RGF ou DCA e antecipe possíveis erros nas validações do Siconfi (D1 a D4), protegendo a nota CAPAG do seu município.</p>
        </section>

        {files.length === 0 ? (
          <Dropzone onFilesDropped={setFiles} />
        ) : (
          <ReportDashboard files={files} onReset={() => setFiles([])} />
        )}
      </main>
      
      <footer className="app-footer">
        <p>Validador Local • Não enviamos seus dados financeiros para a nuvem.</p>
      </footer>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}

export default App;
