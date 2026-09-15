import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Lock, Mail, Loader2, AlertCircle, Landmark, ShieldCheck } from 'lucide-react';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth!, email, password);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Domínio não autorizado no Firebase. Contate o administrador.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Sem conexão com a internet. Verifique e tente novamente.');
      } else {
        setError('Erro ao autenticar: ' + (err.code ?? err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container animate-fade-in">
      <div className="login-card panel">
        <div className="login-header">
          <div className="login-mark">
            <Landmark size={22} />
          </div>
          <h2>Acesso Restrito</h2>
          <p>Credenciais institucionais para o ambiente de pré-validação Siconfi.</p>
        </div>

        <div className="login-secure">
          <ShieldCheck size={14} />
          <span>Processamento local · Dados fiscais não são enviados à nuvem</span>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="login-email">E-mail institucional</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@prefeitura.gov.br"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Senha</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="login-foot">
          Pré-validação local · Dados não saem do navegador
        </div>
      </div>
    </div>
  );
}
