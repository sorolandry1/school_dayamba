import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiBook, FiPlus, FiEdit2, FiTrash2, FiX, FiSave } from 'react-icons/fi';

const EMPTY_FORM = { name: '', coefficient: 1, classe: '', teacher: '' };

function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClasse, setFilterClasse] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | 'edit'
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get('/subjects/', { params: filterClasse ? { classe: filterClasse } : {} }),
      api.get('/classes/'),
      api.get('/teachers/'),
    ]).then(([subRes, clsRes, tchRes]) => {
      setSubjects(subRes.data.results || subRes.data);
      setClasses(clsRes.data.results || clsRes.data);
      setTeachers(tchRes.data.results || tchRes.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [filterClasse]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModal('create');
  };

  const openEdit = (s) => {
    setForm({
      name: s.name,
      coefficient: s.coefficient,
      classe: s.classe,
      teacher: s.teacher || '',
    });
    setEditId(s.id);
    setModal('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        coefficient: form.coefficient,
        // Conserve la classe d'une matière déjà rattachée (édition) ;
        // null pour une nouvelle matière (matière générale, sans classe)
        classe: form.classe || null,
        teacher: form.teacher || null,
      };
      if (modal === 'create') {
        await api.post('/subjects/', payload);
      } else {
        await api.patch(`/subjects/${editId}/`, payload);
      }
      setModal(null);
      fetchAll();
    } catch (err) {
      alert('Erreur: ' + JSON.stringify(err.response?.data));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Supprimer la matière "${name}" ?`)) return;
    try {
      await api.delete(`/subjects/${id}/`);
      fetchAll();
    } catch {
      alert('Impossible de supprimer cette matière.');
    }
  };

  // Group by classe for display
  const byClasse = {};
  subjects.forEach(s => {
    const key = s.classe_name || 'Matières générales';
    if (!byClasse[key]) byClasse[key] = [];
    byClasse[key].push(s);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Gestion des matières</h2>
          <p>{subjects.length} matière{subjects.length !== 1 ? 's' : ''} au total</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <FiPlus size={15} /> Nouvelle matière
        </button>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <select
            className="form-control"
            style={{ maxWidth: 280 }}
            value={filterClasse}
            onChange={e => setFilterClasse(e.target.value)}
          >
            <option value="">Toutes les classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : subjects.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>
            <FiBook size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p>Aucune matière trouvée. Créez-en une pour commencer.</p>
          </div>
        </div>
      ) : (
        Object.entries(byClasse).map(([classeName, subs]) => (
          <div key={classeName} className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3><FiBook size={15} style={{ marginRight: 8 }} />{classeName}</h3>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Matière</th>
                    <th>Coefficient</th>
                    <th>Professeur assigné</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>
                        <span style={{
                          background: '#dbeafe', color: '#1d4ed8',
                          padding: '2px 10px', borderRadius: 12,
                          fontSize: '0.82rem', fontWeight: 700,
                        }}>
                          {s.coefficient}
                        </span>
                      </td>
                      <td>
                        {s.teacher_name ? (
                          <span style={{ color: '#344054' }}>{s.teacher_name}</span>
                        ) : (
                          <span style={{ color: '#f59e0b', fontSize: '0.82rem' }}>Non assigné</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-icon" title="Modifier" onClick={() => openEdit(s)}>
                            <FiEdit2 size={15} />
                          </button>
                          <button className="btn-icon" title="Supprimer"
                            style={{ color: '#ef4444' }}
                            onClick={() => handleDelete(s.id, s.name)}>
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Nouvelle matière' : 'Modifier la matière'}</h3>
              <button className="btn-icon" onClick={() => setModal(null)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nom de la matière *</label>
                  <input className="form-control" required value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Mathématiques" />
                </div>
                <div className="form-group">
                  <label>Coefficient *</label>
                  <input type="number" className="form-control" required
                    min="0.5" max="10" step="0.5"
                    value={form.coefficient}
                    onChange={e => setForm({ ...form, coefficient: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Professeur assigné</label>
                  <select className="form-control" value={form.teacher}
                    onChange={e => setForm({ ...form, teacher: e.target.value })}>
                    <option value="">— Aucun —</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <FiSave size={14} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Subjects;
