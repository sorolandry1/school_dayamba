import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiPlus, FiCheckCircle, FiTrash2, FiEdit2, FiX, FiCalendar } from 'react-icons/fi';

const empty = { name: '', start_date: '', end_date: '', is_current: false };

function AcademicYears() {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const fetchYears = useCallback(async () => {
    try {
      const res = await api.get('/classes/academic-years/');
      setYears(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchYears(); }, [fetchYears]);

  const openCreate = () => {
    const y = new Date().getFullYear();
    setForm({ ...empty, name: `${y}-${y + 1}`, start_date: `${y}-10-01`, end_date: `${y + 1}-07-31` });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (y) => {
    setForm({ name: y.name, start_date: y.start_date, end_date: y.end_date, is_current: y.is_current });
    setEditId(y.id);
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) await api.patch(`/classes/academic-years/${editId}/`, form);
      else await api.post('/classes/academic-years/', form);
      setModal(false);
      fetchYears();
    } catch (err) {
      alert('Erreur: ' + JSON.stringify(err.response?.data));
    } finally { setSaving(false); }
  };

  const setCurrent = async (y) => {
    try {
      await api.post(`/classes/academic-years/${y.id}/set_current/`);
      fetchYears();
    } catch { alert('Action impossible.'); }
  };

  const handleDelete = async (y) => {
    if (!window.confirm(`Supprimer l'année ${y.name} ? (les classes associées seront affectées)`)) return;
    try {
      await api.delete(`/classes/academic-years/${y.id}/`);
      fetchYears();
    } catch { alert('Suppression impossible (année utilisée par des classes).'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Années scolaires</h2>
          <p>{years.length} année(s) — définissez l'année courante</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><FiPlus /> Nouvelle année</button>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? <div className="loading-container"><div className="spinner" /></div> : (
            <table>
              <thead>
                <tr><th>Année</th><th>Début</th><th>Fin</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {years.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>Aucune année scolaire</td></tr>
                ) : years.map(y => (
                  <tr key={y.id}>
                    <td><strong><FiCalendar size={13} style={{ marginRight: 6 }} />{y.name}</strong></td>
                    <td>{y.start_date}</td>
                    <td>{y.end_date}</td>
                    <td>
                      {y.is_current
                        ? <span className="badge badge-success">Année courante</span>
                        : <span className="badge" style={{ background: '#f1f5f9', color: '#667085' }}>Archivée</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!y.is_current && (
                          <button className="btn btn-sm btn-secondary" title="Définir comme courante" onClick={() => setCurrent(y)}>
                            <FiCheckCircle size={14} /> Activer
                          </button>
                        )}
                        <button className="btn btn-sm btn-secondary" title="Modifier" onClick={() => openEdit(y)}><FiEdit2 size={14} /></button>
                        <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => handleDelete(y)}><FiTrash2 size={14} /></button>
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>{editId ? "Modifier l'année" : 'Nouvelle année scolaire'}</h3>
              <button className="btn-icon" onClick={() => setModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nom de l'année</label>
                  <input className="form-control" required placeholder="2025-2026"
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date de début</label>
                    <input type="date" className="form-control" required
                      value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Date de fin</label>
                    <input type="date" className="form-control" required
                      value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_current}
                    onChange={e => setForm({ ...form, is_current: e.target.checked })} />
                  Définir comme année courante
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

export default AcademicYears;
