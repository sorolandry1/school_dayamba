import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiHome, FiToggleLeft, FiToggleRight, FiAlertCircle } from 'react-icons/fi';

const empty = { name: '', address: '', phone: '', email: '', is_active: true };

function Schools() {
  const { user } = useAuth();
  const [ecoles, setEcoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const fetchEcoles = useCallback(async () => {
    try {
      const res = await api.get('/auth/ecoles/');
      setEcoles(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEcoles(); }, [fetchEcoles]);

  if (user?.role !== 'ADMIN') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
        <FiAlertCircle size={48} style={{ color: '#ef4444' }} />
        <h3>Accès réservé au super-administrateur</h3>
      </div>
    );
  }

  const openCreate = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = (e) => {
    setForm({ name: e.name, address: e.address, phone: e.phone, email: e.email, is_active: e.is_active });
    setEditId(e.id); setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) await api.patch(`/auth/ecoles/${editId}/`, form);
      else await api.post('/auth/ecoles/', form);
      setModal(false);
      fetchEcoles();
    } catch (err) { alert('Erreur: ' + JSON.stringify(err.response?.data)); }
    finally { setSaving(false); }
  };

  const toggleActive = async (e) => {
    try { await api.patch(`/auth/ecoles/${e.id}/`, { is_active: !e.is_active }); fetchEcoles(); }
    catch { alert('Action impossible.'); }
  };

  const remove = async (e) => {
    if (!window.confirm(`Supprimer l'école "${e.name}" ? (${e.user_count} utilisateur(s) seront détachés)`)) return;
    try { await api.delete(`/auth/ecoles/${e.id}/`); fetchEcoles(); }
    catch { alert('Suppression impossible.'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Établissements</h2>
          <p>{ecoles.length} école(s) — une plateforme, plusieurs établissements</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><FiPlus /> Nouvelle école</button>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? <div className="loading-container"><div className="spinner" /></div> : (
            <table>
              <thead>
                <tr><th>École</th><th>Contact</th><th>Utilisateurs</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {ecoles.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>Aucune école</td></tr>
                ) : ecoles.map(e => (
                  <tr key={e.id}>
                    <td>
                      <strong><FiHome size={13} style={{ marginRight: 6 }} />{e.name}</strong>
                      {e.address && <div style={{ fontSize: '0.78rem', color: '#98a2b3' }}>{e.address}</div>}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {e.phone || '—'}{e.email ? <div style={{ color: '#98a2b3', fontSize: '0.78rem' }}>{e.email}</div> : null}
                    </td>
                    <td>{e.user_count}</td>
                    <td>
                      <span className={`badge ${e.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {e.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-secondary" title={e.is_active ? 'Désactiver' : 'Activer'} onClick={() => toggleActive(e)}>
                          {e.is_active ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                        </button>
                        <button className="btn btn-sm btn-secondary" title="Modifier" onClick={() => openEdit(e)}><FiEdit2 size={14} /></button>
                        <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => remove(e)}><FiTrash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>{editId ? "Modifier l'école" : 'Nouvelle école'}</h3>
              <button className="btn-icon" onClick={() => setModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nom de l'établissement *</label>
                  <input className="form-control" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Adresse</label>
                  <input className="form-control" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Téléphone</label>
                    <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" className="form-control" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  École active
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '...' : (editId ? 'Modifier' : 'Créer')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Schools;
