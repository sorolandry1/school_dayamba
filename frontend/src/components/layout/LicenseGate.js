import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FiLock, FiKey, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';

/**
 * Barrière de licence : bloque l'application quand la licence est expirée et
 * affiche l'écran d'activation. Affiche aussi une bannière d'avertissement
 * quand l'échéance approche (≤ 7 jours).
 */
export default function LicenseGate({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/license/status/');
      setStatus(res.data);
    } catch {
      setStatus(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const activate = async (e) => {
    e.preventDefault();
    setError(''); setActivating(true);
    try {
      const res = await api.post('/license/activate/', { code: code.trim() });
      setStatus(res.data);
      setCode('');
    } catch (err) {
      setError(err.response?.data?.error || 'Activation impossible.');
    } finally { setActivating(false); }
  };

  if (loading) return null;

  const isAdmin = user?.role === 'ADMIN';

  // ── Licence expirée : écran bloquant ──
  if (status && !status.is_valid) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ background: '#fee2e2', color: '#dc2626', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiLock size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#111827' }}>Licence expirée</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                {status.trial ? "La période d'essai est terminée." : 'Votre licence a expiré.'}
              </p>
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', margin: '14px 0', fontSize: '0.85rem' }}>
            Identifiant machine :
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', color: '#1d4ed8', letterSpacing: 1 }}>
              {status.machine_id}
            </div>
            <div style={{ color: '#6b7280', marginTop: 4 }}>
              Communiquez cet identifiant lors du paiement (Mobile Money) pour recevoir votre code.
            </div>
          </div>

          {isAdmin ? (
            <form onSubmit={activate}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Code d'activation</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input className="form-control" style={{ flex: 1, fontFamily: 'monospace' }} value={code}
                  onChange={e => setCode(e.target.value)} placeholder="Collez votre code ici…" required />
                <button className="btn btn-primary" disabled={activating} type="submit">
                  <FiKey size={14} /> {activating ? '...' : 'Activer'}
                </button>
              </div>
              {error && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: 8 }}>{error}</div>}
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', fontSize: '0.85rem' }}>
              <FiAlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              Veuillez contacter l'administrateur de l'établissement pour renouveler la licence.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Licence valide : bannière si échéance proche ──
  const warn = status && status.is_valid && status.days_left <= 7;
  return (
    <>
      {warn && !dismissed && (
        <div style={{
          background: status.days_left <= 3 ? '#fef2f2' : '#fffbeb',
          borderBottom: `1px solid ${status.days_left <= 3 ? '#fecaca' : '#fde68a'}`,
          color: status.days_left <= 3 ? '#b91c1c' : '#92400e',
          padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem',
        }}>
          <FiAlertTriangle size={15} />
          <span>
            {status.trial ? "Période d'essai" : 'Licence'} : il reste <strong>{status.days_left} jour(s)</strong>.
            {isAdmin ? " Pensez à activer un code de renouvellement." : " Prévenez l'administrateur."}
          </span>
          <button onClick={() => setDismissed(true)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}>×</button>
        </div>
      )}
      {children}
    </>
  );
}
