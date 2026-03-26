import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiBook, FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiTrendingUp } from 'react-icons/fi';

const EMPTY_FORM = {
  subject: '',
  date: new Date().toISOString().slice(0, 10),
  topic: '',
  objectives: '',
  content_covered: '',
  homework: '',
  progression_percent: 0,
};

function LessonLog() {
  const [logs, setLogs] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterSubject, setFilterSubject] = useState('');
  const [expanded, setExpanded] = useState(null);

  const fetchLogs = () => {
    setLoading(true);
    const params = filterSubject ? { subject: filterSubject } : {};
    api.get('/teachers/lesson-logs/', { params })
      .then(r => setLogs(r.data.results || r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/subjects/my_subjects/')
      .then(r => setSubjects(r.data.results || r.data))
      .catch(console.error);
  }, []);

  useEffect(() => { fetchLogs(); }, [filterSubject]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, subject: subjects[0]?.id || '' });
    setEditId(null);
    setModal('form');
  };

  const openEdit = (log) => {
    setForm({
      subject: log.subject,
      date: log.date,
      topic: log.topic,
      objectives: log.objectives,
      content_covered: log.content_covered,
      homework: log.homework,
      progression_percent: log.progression_percent,
    });
    setEditId(log.id);
    setModal('form');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.patch(`/teachers/lesson-logs/${editId}/`, form);
      } else {
        await api.post('/teachers/lesson-logs/', form);
      }
      setModal(null);
      fetchLogs();
    } catch (err) {
      alert('Erreur: ' + JSON.stringify(err.response?.data));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette entrée du cahier de texte ?')) return;
    await api.delete(`/teachers/lesson-logs/${id}/`);
    fetchLogs();
  };

  // Group by subject for progression display
  const progressionBySubject = {};
  logs.forEach(log => {
    if (!progressionBySubject[log.subject_name] || log.progression_percent > progressionBySubject[log.subject_name]) {
      progressionBySubject[log.subject_name] = log.progression_percent;
    }
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Cahier de Texte</h2>
          <p>Suivi pédagogique et progression des programmes</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <FiPlus size={15} /> Nouveau cours
        </button>
      </div>

      {/* Progression bars */}
      {Object.keys(progressionBySubject).length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3><FiTrendingUp size={16} style={{ marginRight: 8 }} />Progression du programme</h3>
          </div>
          <div className="card-body">
            {Object.entries(progressionBySubject).map(([subj, pct]) => (
              <div key={subj} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600 }}>{subj}</span>
                  <span style={{ color: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#3b5beb', fontWeight: 700 }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4, width: `${pct}%`,
                    background: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#3b5beb',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <select className="form-control" style={{ maxWidth: 280 }}
            value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
            <option value="">Toutes les matières</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name} — {s.classe_name}</option>)}
          </select>
        </div>
      </div>

      {/* Logs list */}
      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : logs.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 48, color: '#98a2b3' }}>
            <FiBook size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p>Aucune entrée dans le cahier de texte.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openCreate}>
              <FiPlus size={14} /> Créer la première entrée
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {logs.map(log => (
            <div key={log.id} className="card">
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', cursor: 'pointer',
                }}
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>{log.topic}</span>
                    {log.progression_percent > 0 && (
                      <span style={{
                        background: '#dbeafe', color: '#1d4ed8',
                        padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                      }}>
                        Programme: {log.progression_percent}%
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#667085' }}>
                    <span style={{ fontWeight: 600, color: '#344054' }}>{log.subject_name}</span>
                    {' · '}{log.classe_name}{' · '}
                    <span>{log.date}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn-icon" onClick={e => { e.stopPropagation(); openEdit(log); }}>
                    <FiEdit2 size={15} />
                  </button>
                  <button className="btn-icon" style={{ color: '#ef4444' }}
                    onClick={e => { e.stopPropagation(); handleDelete(log.id); }}>
                    <FiTrash2 size={15} />
                  </button>
                  <span style={{ color: '#98a2b3', fontSize: '0.85rem', marginLeft: 4 }}>
                    {expanded === log.id ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {expanded === log.id && (
                <div style={{ borderTop: '1px solid #f2f4f7', padding: '16px 20px', background: '#fafbff' }}>
                  {log.objectives && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                        Objectifs
                      </div>
                      <div style={{ fontSize: '0.88rem' }}>{log.objectives}</div>
                    </div>
                  )}
                  {log.content_covered && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                        Contenu couvert
                      </div>
                      <div style={{ fontSize: '0.88rem' }}>{log.content_covered}</div>
                    </div>
                  )}
                  {log.homework && (
                    <div style={{
                      padding: '10px 14px', background: '#fef9c3', borderRadius: 8,
                      border: '1px solid #fde68a', fontSize: '0.88rem',
                    }}>
                      <span style={{ fontWeight: 700, color: '#854d0e' }}>Travail maison: </span>
                      {log.homework}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal === 'form' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>{editId ? 'Modifier le cours' : 'Nouveau cours'}</h3>
              <button className="btn-icon" onClick={() => setModal(null)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Matière *</label>
                    <select className="form-control" required value={form.subject}
                      onChange={e => setForm({ ...form, subject: e.target.value })}>
                      <option value="">Sélectionner...</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name} — {s.classe_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date *</label>
                    <input type="date" className="form-control" required value={form.date}
                      onChange={e => setForm({ ...form, date: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Intitulé du cours / Thème *</label>
                  <input className="form-control" required value={form.topic}
                    onChange={e => setForm({ ...form, topic: e.target.value })}
                    placeholder="Ex: Les équations du second degré" />
                </div>

                <div className="form-group">
                  <label>Objectifs pédagogiques</label>
                  <textarea className="form-control" rows={2} value={form.objectives}
                    onChange={e => setForm({ ...form, objectives: e.target.value })}
                    placeholder="Compétences visées par cette séance..." />
                </div>

                <div className="form-group">
                  <label>Contenu couvert</label>
                  <textarea className="form-control" rows={3} value={form.content_covered}
                    onChange={e => setForm({ ...form, content_covered: e.target.value })}
                    placeholder="Résumé de ce qui a été fait en cours..." />
                </div>

                <div className="form-group">
                  <label>Travail à la maison</label>
                  <input className="form-control" value={form.homework}
                    onChange={e => setForm({ ...form, homework: e.target.value })}
                    placeholder="Exercices, pages à lire..." />
                </div>

                <div className="form-group">
                  <label>Progression du programme: <strong>{form.progression_percent}%</strong></label>
                  <input type="range" min={0} max={100} step={5}
                    value={form.progression_percent}
                    onChange={e => setForm({ ...form, progression_percent: Number(e.target.value) })}
                    style={{ width: '100%' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#98a2b3' }}>
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button>
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

export default LessonLog;
