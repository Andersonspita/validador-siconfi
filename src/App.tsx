import { useState, useEffect } from 'react';
import { Moon, Sun, ShieldCheck } from 'lucide-react';
import Dropzone from './components/Dropzone';
import ReportDashboard from './components/ReportDashboard';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="app-container">
      <header className="glass-header">
        <div className="header-content">
          <div className="logo-container">
            <ShieldCheck className="logo-icon" size={32} />
            <h1>Validador <span>Siconfi</span></h1>
          </div>
          <div className="header-actions">
            <button onClick={toggleTheme} className="icon-btn" aria-label="Toggle Theme">
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
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
    </div>
  );
}

export default App;
