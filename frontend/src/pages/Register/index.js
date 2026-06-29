import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { FiUser, FiLock, FiPhone, FiMail, FiCheckCircle, FiCircle, FiAlertTriangle, FiBook } from 'react-icons/fi';

const ROLE_LABELS = { TEACHER: 'Professeur', AGENT: "Agent d'accueil" };

// Conteneur centré — défini au niveau module pour ne pas être recréé à chaque
// rendu (sinon le formulaire se démonterait et perdrait le focus à la frappe).
function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16,
        padding: '32px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {children}
      </div>
    </div>
  );
}

function Register() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [invitation, setInvitation] = useState(null); // { role, role_display, note }
  const [invalidReason, setInvalidReason] = useState('');

  const [form, setForm] = useState({
    first_name: '', last_name: '', username: '',
    phone: '', email: '', password: '', confirm: '', subject_ids: [],
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Valide le lien au chargement
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/auth/register/${token}/`);
        if (res.data.valid) setInvitation(res.data);
        else setInvalidReason(res.data.reason || 'Lien invalide.');
      } catch (err) {
        setInvalidReason(err.response?.data?.reason || 'Lien invalide ou introuvable.');
      } finally {
        setChecking(false);
      }
    })();
  }, [token]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleSubject = (id) => setForm(f => ({
    ...f,
    subject_ids: f.subject_ids.includes(id)
      ? f.subject_ids.filter(x => x !== id)
      : [...f.subject_ids, id],
  }));

  // Matières (renvoyées par le lien) groupées par classe
  const subjectsByClasse = (invitation?.subjects || []).reduce((acc, s) => {
    const key = s.classe_name || 'Matières générales';
    (acc[key] = acc[key] || []).push(s);
    return acc;
  }, {});

  // Règles de robustesse du mot de passe (vérifiées en direct)
  const pwd = form.password;
  const pwdChecks = [
    { ok: pwd.length >= 8, label: 'Au moins 8 caractères' },
    { ok: /[A-Z]/.test(pwd), label: 'Une majuscule' },
    { ok: /[a-z]/.test(pwd), label: 'Une minuscule' },
    { ok: /\d/.test(pwd), label: 'Un chiffre' },
    { ok: /[^A-Za-z0-9]/.test(pwd), label: 'Un symbole (ex : ! @ # ?)' },
  ];
  const pwdStrong = pwdChecks.every(c => c.ok);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!pwdStrong) {
      setError('Le mot de passe ne respecte pas toutes les exigences de sécurité.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/auth/register/${token}/`, {
        first_name: form.first_name,
        last_name: form.last_name,
        username: form.username,
        phone: form.phone,
        email: form.email,
        password: form.password,
        subject_ids: invitation.role === 'TEACHER' ? form.subject_ids : [],
      });
      // Connexion automatique : on stocke la session puis on recharge
      const { access, refresh, user } = res.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(user));
      const dest = user.role === 'TEACHER' ? '/teacher'
        : user.role === 'AGENT' ? '/scan'
        : user.role === 'EDUCATEUR' ? '/educator'
        : '/dashboard';
      window.location.href = dest;
    } catch (err) {
      const data = err.response?.data;
      let msg = 'Une erreur est survenue. Réessayez.';
      if (typeof data === 'string') msg = data;
      else if (data?.error) msg = data.error;
      else if (data && typeof data === 'object') {
        msg = Object.entries(data).map(([f, m]) => `${Array.isArray(m) ? m.join(', ') : m}`).join(' · ');
      }
      setError(msg);
      setSubmitting(false);
    }
  };

  // ── États ────────────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div className="loading-container" style={{ height: '100vh' }}>
        <div className="spinner" />
        <p>Vérification du lien...</p>
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
          <Link to="/login" className="btn btn-secondary">Aller à la connexion</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #f59e0b, #b45309)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', fontWeight: 800, color: 'white',
        }}>SP</div>
        <h1 style={{ fontSize: '1.4rem', margin: '0 0 4px' }}>Création de votre compte</h1>
        <p style={{ color: '#667085', margin: 0 }}>
          Rôle : <strong>{invitation.role_display || ROLE_LABELS[invitation.role]}</strong>
          {invitation.note ? ` — ${invitation.note}` : ''}
        </p>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row" style={{ display: 'flex', gap: 12 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Nom</label>
            <input className="form-control" required value={form.last_name}
              onChange={e => setField('last_name', e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Prénom</label>
            <input className="form-control" required value={form.first_name}
              onChange={e => setField('first_name', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label><FiUser size={13} style={{ marginRight: 6 }} />Identifiant (login)</label>
          <input className="form-control" required value={form.username}
            autoComplete="username"
            onChange={e => setField('username', e.target.value)} />
        </div>

        <div className="form-row" style={{ display: 'flex', gap: 12 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label><FiPhone size={13} style={{ marginRight: 6 }} />Téléphone</label>
            <input className="form-control" required value={form.phone}
              onChange={e => setField('phone', e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label><FiMail size={13} style={{ marginRight: 6 }} />Email</label>
            <input type="email" className="form-control" required value={form.email}
              onChange={e => setField('email', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label><FiLock size={13} style={{ marginRight: 6 }} />Mot de passe</label>
          <input type="password" className="form-control" required
            placeholder="Mot de passe robuste" autoComplete="new-password"
            value={form.password} onChange={e => setField('password', e.target.value)} />
          {pwd && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
              {pwdChecks.map((c, i) => (
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
          <input type="password" className="form-control" required minLength={8}
            autoComplete="new-password"
            value={form.confirm} onChange={e => setField('confirm', e.target.value)} />
        </div>

        {invitation.role === 'TEACHER' && (
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiBook size={13} /> Vos matières
              {form.subject_ids.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>
                  {form.subject_ids.length} sélectionnée(s)
                </span>
              )}
            </label>
            {(invitation.subjects || []).length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#98a2b3', margin: 0 }}>
                Aucune matière disponible pour l'instant. Le directeur pourra vous en affecter plus tard.
              </p>
            ) : (
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0',
                borderRadius: 8, padding: 8 }}>
                {Object.entries(subjectsByClasse).map(([classeName, list]) => (
                  <div key={classeName} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                      color: '#98a2b3', margin: '4px 0' }}>{classeName}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      {list.map(s => {
                        const checked = form.subject_ids.includes(s.id);
                        return (
                          <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: '0.85rem', cursor: 'pointer', padding: '3px 4px', borderRadius: 6,
                            background: checked ? '#10b98115' : 'transparent' }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleSubject(s.id)} />
                            <span>{s.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <small style={{ color: '#98a2b3' }}>Facultatif — vous pourrez les modifier plus tard.</small>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={submitting || !pwdStrong}
          style={{ width: '100%', marginTop: 8 }}>
          <FiCheckCircle size={15} style={{ marginRight: 6 }} />
          {submitting ? 'Création...' : 'Créer mon compte'}
        </button>
      </form>

      <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.8rem', color: '#98a2b3' }}>
        Vous avez déjà un compte ? <Link to="/login">Se connecter</Link>
      </div>
    </Shell>
  );
}

export default Register;
