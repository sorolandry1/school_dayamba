import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiActivity, FiSearch, FiRefreshCw } from 'react-icons/fi';

const ACTION_LABELS = {
  LOGIN: 'Connexion',
  GRADE_ADD: 'Note ajoutée',
  GRADE_EDIT: 'Note modifiée',
  GRADE_DELETE: 'Note supprimée',
  PAYMENT_ADD: 'Paiement enregistré',
  PAYMENT_EDIT: 'Paiement modifié',
  PASSWORD_RESET: 'Réinitialisation MDP',
  STUDENT_ADD: 'Élève ajouté',
  STUDENT_EDIT: 'Élève modifié',
  STUDENT_DELETE: 'Élève supprimé',
};

const ACTION_COLORS = {
  LOGIN: { bg: '#dbeafe', color: '#1d4ed8' },
  GRADE_ADD: { bg: '#dcfce7', color: '#166534' },
  GRADE_EDIT: { bg: '#fef9c3', color: '#854d0e' },
  GRADE_DELETE: { bg: '#fee2e2', color: '#991b1b' },
  PAYMENT_ADD: { bg: '#dcfce7', color: '#166534' },
  PAYMENT_EDIT: { bg: '#fef9c3', color: '#854d0e' },
  PASSWORD_RESET: { bg: '#f3e8ff', color: '#7e22ce' },
  STUDENT_ADD: { bg: '#dcfce7', color: '#166534' },
  STUDENT_EDIT: { bg: '#fef9c3', color: '#854d0e' },
  STUDENT_DELETE: { bg: '#fee2e2', color: '#991b1b' },
};

function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    const params = {};
    if (filterAction) params.action = filterAction;
    api.get('/auth/activity-logs/', { params })
      .then(res => setLogs(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, [filterAction]);

  const filtered = logs.filter(log =>
    !search ||
    log.user?.toLowerCase().includes(search.toLowerCase()) ||
    log.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Journal d'activité</h2>
          <p>Historique des actions effectuées sur le système</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLogs}>
          <FiRefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <FiSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#98a2b3' }} />
            <input
              className="form-control"
              style={{ paddingLeft: 32 }}
              placeholder="Rechercher par utilisateur ou description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-control"
            style={{ width: 220 }}
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
          >
            <option value="">Toutes les actions</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3><FiActivity size={16} style={{ marginRight: 8 }} />Événements ({filtered.length})</h3>
        </div>
        {loading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date / Heure</th>
                  <th>Utilisateur</th>
                  <th>Rôle</th>
                  <th>Action</th>
                  <th>Description</th>
                  <th>Modification</th>
                  <th>Appareil</th>
                  <th>IP / Localisation</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: '#98a2b3', padding: 32 }}>Aucun événement trouvé</td></tr>
                ) : filtered.map(log => {
                  const colors = ACTION_COLORS[log.action] || { bg: '#f1f5f9', color: '#475569' };
                  return (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#667085' }}>{log.timestamp}</td>
                      <td style={{ fontWeight: 600 }}>{log.user}</td>
                      <td style={{ fontSize: '0.82rem', color: '#667085' }}>{log.role}</td>
                      <td>
                        <span style={{
                          background: colors.bg, color: colors.color,
                          padding: '3px 10px', borderRadius: 20,
                          fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap',
                        }}>
                          {log.action_label || log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', maxWidth: 260 }}>{log.description}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {(log.old_value || log.new_value) ? (
                          <span>
                            <span style={{ color: '#991b1b', textDecoration: 'line-through' }}>{log.old_value || '∅'}</span>
                            {' → '}
                            <span style={{ color: '#166534', fontWeight: 600 }}>{log.new_value || '∅'}</span>
                          </span>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#667085', whiteSpace: 'nowrap' }}>
                        {(log.browser || log.os) ? `${log.browser || '?'} · ${log.os || '?'}` : '—'}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#98a2b3' }}>
                        <span style={{ fontFamily: 'monospace' }}>{log.ip_address || '—'}</span>
                        {log.location && <div style={{ color: '#667085' }}>{log.location}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityLogs;
