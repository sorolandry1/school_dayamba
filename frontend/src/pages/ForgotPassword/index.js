import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { FiMail, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';

function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16,
        padding: '32px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {children}
      </div>
    </div>
  );
}

function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/auth/password-reset/request/', { identifier });
    } catch {
      // On affiche le même message générique quoi qu'il arrive
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <FiCheckCircle size={48} style={{ color: '#10b981', marginBottom: 16 }} />
          <h2 style={{ margin: '0 0 8px' }}>Vérifiez votre boîte mail</h2>
          <p style={{ color: '#667085', marginBottom: 24 }}>
            Si un compte correspond à « {identifier} », un email contenant un lien de
            réinitialisation vient d'être envoyé. Le lien est valable 1 heure.
          </p>
          <Link to="/login" className="btn btn-secondary"><FiArrowLeft size={14} /> Retour à la connexion</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 style={{ fontSize: '1.4rem', margin: '0 0 4px' }}>Mot de passe oublié</h1>
      <p style={{ color: '#667085', marginTop: 0, marginBottom: 20 }}>
        Saisissez votre email ou votre identifiant. Nous vous enverrons un lien pour
        définir un nouveau mot de passe.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label><FiMail size={13} style={{ marginRight: 6 }} />Email ou identifiant</label>
          <input className="form-control" required autoFocus value={identifier}
            onChange={e => setIdentifier(e.target.value)} placeholder="ex : prof_math ou nom@mail.com" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting}
          style={{ width: '100%', marginTop: 8 }}>
          {submitting ? 'Envoi...' : 'Envoyer le lien'}
        </button>
      </form>
      <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.85rem' }}>
        <Link to="/login"><FiArrowLeft size={13} style={{ marginRight: 4 }} />Retour à la connexion</Link>
      </div>
    </Shell>
  );
}

export default ForgotPassword;
