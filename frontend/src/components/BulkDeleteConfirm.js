import React, { useState } from 'react';
import { FiX, FiAlertTriangle, FiTrash2, FiLock } from 'react-icons/fi';

/**
 * Modal de confirmation d'une suppression multiple, protégée par le mot de
 * passe de l'utilisateur connecté.
 *
 * Props :
 *   count     : nombre d'éléments sélectionnés
 *   itemLabel : libellé, ex. "élève(s)" ou "compte(s)"
 *   onCancel  : fermeture sans action
 *   onConfirm : async (password) => {}  — doit lever (throw) en cas d'échec
 *               pour que l'erreur s'affiche ici.
 */
export default function BulkDeleteConfirm({ count, itemLabel, onCancel, onConfirm }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) { setError('Saisissez votre mot de passe.'); return; }
    setBusy(true);
    setError('');
    try {
      await onConfirm(password);
      // En cas de succès, le parent ferme le modal.
    } catch (err) {
      setError(err?.response?.data?.error || 'Suppression impossible.');
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 1200 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b42318' }}>
            <FiAlertTriangle /> Confirmer la suppression
          </h3>
          <button className="btn-icon" onClick={onCancel}><FiX /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div style={{
              background: '#fef3f2', border: '1px solid #fecdca',
              borderRadius: 8, padding: '12px 14px', marginBottom: 16,
              color: '#912018', fontSize: '0.88rem',
            }}>
              Vous êtes sur le point de supprimer définitivement{' '}
              <strong>{count} {itemLabel}</strong>. Cette action est{' '}
              <strong>irréversible</strong>.
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FiLock size={14} /> Confirmez avec votre mot de passe
              </label>
              <input
                type="password"
                className="form-control"
                autoFocus
                value={password}
                placeholder="Votre mot de passe"
                onChange={e => { setPassword(e.target.value); setError(''); }}
              />
            </div>
            {error && (
              <div style={{ color: '#d92d20', fontSize: '0.82rem', marginTop: 10 }}>
                {error}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
              Annuler
            </button>
            <button type="submit" className="btn btn-danger" disabled={busy}>
              <FiTrash2 size={14} /> {busy ? 'Suppression…' : `Supprimer (${count})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
