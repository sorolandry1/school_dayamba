import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { FiLock, FiCheckCircle, FiCircle, FiAlertTriangle } from 'react-icons/fi';

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

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [invalidReason, setInvalidReason] = useState('');
  const [username, setUsername] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/auth/password-reset/${token}/`);
        if (res.data.valid) { setValid(true); setUsername(res.data.username || ''); }
        else setInvalidReason(res.data.reason || 'Lien invalide.');
      } catch (err) {
        setInvalidReason(err.response?.data?.reason || 'Lien invalide ou introuvable.');
      } finally {
        setChecking(false);
      }
    })();
  }, [token]);

  const checks = [
    { ok: password.length >= 8, label: 'Au moins 8 caractères' },
    { ok: /[A-Z]/.test(password), label: 'Une majuscule' },
    { ok: /[a-z]/.test(password), label: 'Une minuscule' },
    { ok: /\d/.test(password), label: 'Un chiffre' },
    { ok: /[^A-Za-z0-9]/.test(password), label: 'Un symbole (ex : ! @ # ?)' },
  ];
  const strong = checks.every(c => c.ok);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!strong) { setError('Le mot de passe ne respecte pas toutes les exigences.'); return; }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setSubmitting(true);
    try {
      await api.post(`/auth/password-reset/${token}/`, { password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const data = err.response?.data;
      let msg = 'Une erreur est survenue.';
      if (data?.error) msg = data.error;
      else if (data?.password) msg = Array.isArray(data.password) ? data.password.join(', ') : data.password;
      setError(msg);
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="loading-container" style={{ height: '100vh' }}>
        <div className="spinner" /><p>Vérification du lien...</p>
      </div>
    );
  }

  if (invalidReason) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <FiAlertTriangle size={48} style={{ color: '#ef4444', marginBottom: 16 }} />
          <h2 style={{ margin: '0 0 8px' }}>Lien indisponible</h2>
          <p style={{ color: '#667085', marginBottom: 24 }}>{invalidReason}</p>
          <Link to="/forgot-password" className="btn btn-secondary">Demander un nouveau lien</Link>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <FiCheckCircle size={48} style={{ color: '#10b981', marginBottom: 16 }} />
          <h2 style={{ margin: '0 0 8px' }}>Mot de passe réinitialisé</h2>
          <p style={{ color: '#667085', marginBottom: 24 }}>
            Vous pouvez maintenant vous connecter. Redirection en cours...
          </p>
          <Link to="/login" className="btn btn-primary">Se connecter</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 style={{ fontSize: '1.4rem', margin: '0 0 4px' }}>Nouveau mot de passe</h1>
      <p style={{ color: '#667085', marginTop: 0, marginBottom: 20 }}>
        Compte : <strong>{username}</strong>
      </p>
      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
      {valid && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label><FiLock size={13} style={{ marginRight: 6 }} />Nouveau mot de passe</label>
            <input type="password" className="form-control" required autoComplete="new-password"
              placeholder="Mot de passe robuste" value={password}
              onChange={e => setPassword(e.target.value)} />
            {password && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0',
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
                {checks.map((c, i) => (
                  <li key={i} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center',
                    gap: 5, color: c.ok ? '#10b981' : '#98a2b3' }}>
                    {c.ok ? <FiCheckCircle size={12} /> : <FiCircle size={12} />} {c.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="form-group">
            <label><FiLock size={13} style={{ marginRight: 6 }} />Confirmer le mot de passe</label>
            <input type="password" className="form-control" required autoComplete="new-password"
              value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting || !strong}
            style={{ width: '100%', marginTop: 8 }}>
            {submitting ? 'Enregistrement...' : 'Réinitialiser le mot de passe'}
          </button>
        </form>
      )}
    </Shell>
  );
}

export default ResetPassword;
