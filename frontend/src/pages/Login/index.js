import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiLock, FiUser } from 'react-icons/fi';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      if (user.role === 'TEACHER') navigate('/teacher');
      else if (user.role === 'AGENT') navigate('/scan');
      else navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Identifiants invalides.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-visual">
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: 'linear-gradient(135deg, #f59e0b, #b45309)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: '2rem', fontWeight: 800, color: 'white'
          }}>SP</div>
          <h2>SchoolPro</h2>
          <p>Plateforme numérique de gestion scolaire — Optimisez l'administration de votre établissement</p>
          <div style={{
            marginTop: 48, display: 'flex', gap: 32,
            justifyContent: 'center', flexWrap: 'wrap'
          }}>
            {[
              { n: '500+', l: 'Élèves gérés' },
              { n: '50+', l: 'Professeurs' },
              { n: '99.5%', l: 'Disponibilité' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{s.n}</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="login-form-side">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1>Connexion</h1>
          <p className="login-subtitle">Accédez à votre espace personnel</p>

          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label><FiUser size={14} style={{ marginRight: 6 }} />Nom d'utilisateur</label>
            <input
              type="text" className="form-control"
              placeholder="Entrez votre identifiant"
              value={username} onChange={(e) => setUsername(e.target.value)}
              required autoFocus
            />
          </div>

          <div className="form-group">
            <label><FiLock size={14} style={{ marginRight: 6 }} />Mot de passe</label>
            <input
              type="password" className="form-control"
              placeholder="Entrez votre mot de passe"
              value={password} onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.8rem', color: '#98a2b3' }}>
            Comptes de test : admin / admin123 — directeur / directeur123 — prof_math / prof123 — agent / agent123
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
