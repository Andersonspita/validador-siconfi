import { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { auth } from '../firebase';
import { KeyRound, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import './ChangePasswordModal.css';

interface Props {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (auth?.currentUser) {
        await updatePassword(auth!.currentUser!, newPassword);
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Por segurança, faça login novamente antes de alterar a senha.');
      } else {
        setError('Ocorreu um erro ao alterar a senha.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card animate-fade-in">
        <button onClick={onClose} className="close-btn" aria-label="Fechar">
          <X size={20} />
        </button>

        <div className="modal-header">
          <KeyRound size={32} className="modal-icon" />
          <h3>Alterar Senha</h3>
          <p>Defina uma nova senha de acesso.</p>
        </div>

        {success ? (
          <div className="success-message">
            <CheckCircle size={48} className="success-icon" />
            <p>Senha alterada com sucesso!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            {error && (
              <div className="error-message">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            
            <div className="form-group">
              <label>Nova Senha</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="No mínimo 6 caracteres" 
                required 
              />
            </div>
            
            <div className="form-group">
              <label>Confirmar Nova Senha</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha" 
                required 
              />
            </div>
            
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? <Loader2 size={20} className="spin" /> : 'Salvar Nova Senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
