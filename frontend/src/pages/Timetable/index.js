import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { FiPlus, FiTrash2, FiClock, FiX, FiMapPin, FiUpload, FiFileText, FiDownload } from 'react-icons/fi';
import { downloadFile } from '../../utils/downloadPdf';

const DAYS = [[0, 'Lundi'], [1, 'Mardi'], [2, 'Mercredi'], [3, 'Jeudi'], [4, 'Vendredi'], [5, 'Samedi']];
const empty = { subject: '', subject_name: '', room: '', day: 0, start_time: '08:00', end_time: '09:00' };

function Timetable() {
  const [classes, setClasses] = useState([]);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [entries, setEntries] = useState([]);
  const [scheduleFiles, setScheduleFiles] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get('/classes/current_year/').then(r => setClasses(r.data.results || r.data)).catch(() => { });
    api.get('/subjects/', { params: { page_size: 500 } }).then(r => setSubjects(r.data.results || r.data)).catch(() => { });
  }, []);

  const load = useCallback(() => {
    if (!selectedClasse) { setEntries([]); return; }
    setLoading(true);
    api.get(`/classes/schedule/?classe=${selectedClasse}&page_size=200`)
      .then(r => setEntries(r.data.results || r.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [selectedClasse]);

  useEffect(() => { load(); }, [load]);

  const loadScheduleFiles = async () => {
    if (!selectedClasse) { setScheduleFiles([]); return; }
    try {
      const res = await api.get('/classes/schedule-files/', { params: { classe: selectedClasse, page_size: 200 } });
      setScheduleFiles(res.data.results || res.data);
    } catch {
      setScheduleFiles([]);
    }
  };

  useEffect(() => { loadScheduleFiles(); }, [selectedClasse]);

  // Matières proposées : celles de la classe + globales
  const classSubjects = subjects.filter(s => String(s.classe) === String(selectedClasse) || !s.classe);

  const openAdd = (day) => { setForm({ ...empty, day }); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClasse) return;
    if (!form.subject && !form.subject_name.trim()) { alert('Choisissez une matière ou saisissez son nom.'); return; }
    setSaving(true);
    try {
      await api.post('/classes/schedule/', {
        classe: selectedClasse,
        subject: form.subject || null,
        subject_name: form.subject_name,
        room: form.room,
        day: form.day,
        start_time: form.start_time,
        end_time: form.end_time,
      });
      setModal(false);
      load();
    } catch (err) {
      alert('Erreur: ' + JSON.stringify(err.response?.data));
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Supprimer ce créneau ?')) return;
    try { await api.delete(`/classes/schedule/${id}/`); load(); } catch { alert('Suppression impossible.'); }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'].includes(ext)) {
      alert('Format non supporté. Utilisez PDF, Word, Excel ou image.');
      return;
    }
    setSelectedFile(file);
  };

  const uploadScheduleFile = async () => {
    if (!selectedClasse || !selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('classe', selectedClasse);
      formData.append('file', selectedFile);
      formData.append('label', selectedFile.name);
      await api.post('/classes/schedule-files/', formData);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = null;
      loadScheduleFiles();
    } catch (err) {
      alert('Erreur lors de l\'upload : ' + JSON.stringify(err.response?.data));
    } finally {
      setUploading(false);
    }
  };

  const deleteScheduleFile = async (id) => {
    if (!window.confirm('Supprimer ce fichier d\'emploi du temps ?')) return;
    try {
      await api.delete(`/classes/schedule-files/${id}/`);
      loadScheduleFiles();
    } catch {
      alert('Impossible de supprimer le fichier.');
    }
  };

  const byDay = (d) => entries.filter(e => e.day === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const classeName = classes.find(c => String(c.id) === String(selectedClasse))?.name || '';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Emploi du temps</h2>
          <p>Matières, salles et horaires par classe</p>
        </div>
      </div>

      <div className="filters-bar">
        <select className="form-control" style={{ width: 260 }}
          value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
          <option value="">Choisir une classe</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedClasse && (
          <button className="btn btn-secondary" onClick={() => downloadFile(`/reports/timetable/${selectedClasse}/`, `emploi_du_temps_${classeName}.pdf`)}>
            <FiDownload size={15} /> Télécharger (PDF)
          </button>
        )}
      </div>

      {selectedClasse && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" type="button" onClick={() => fileInputRef.current?.click()}>
                  <FiUpload size={16} style={{ marginRight: 6 }} />Importer fichier
                </button>
                <span style={{ color: '#475569', fontSize: '0.95rem' }}>
                  {selectedFile ? selectedFile.name : 'PDF, Word, Excel, image'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" type="button" disabled={!selectedFile || uploading} onClick={uploadScheduleFile}>
                  {uploading ? 'Téléversement...' : 'Uploader'}
                </button>
                {selectedFile && (
                  <button className="btn btn-secondary" type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = null; }}>
                    Annuler
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={handleFileChange}
              />
            </div>
            <div style={{ minWidth: 320 }}>
              {scheduleFiles.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {scheduleFiles.map(file => (
                    <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{file.label || file.file_url?.split('/').pop()}</div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                          {file.created_at?.slice(0, 10)}{file.uploaded_by_name ? ` · ${file.uploaded_by_name}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <a className="btn btn-outline-secondary btn-sm" href={file.file_url} target="_blank" rel="noreferrer">
                          <FiDownload size={14} />
                        </a>
                        <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => deleteScheduleFile(file.id)}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '0.95rem' }}>Aucun document d'emploi du temps attaché.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {!selectedClasse ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 60, color: '#98a2b3' }}>
          <FiClock size={42} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p>Sélectionnez une classe pour afficher son emploi du temps.</p>
        </div></div>
      ) : loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
          {DAYS.map(([d, label]) => (
            <div key={d} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{label}</h3>
                <button className="btn-icon" title="Ajouter un créneau" onClick={() => openAdd(d)}><FiPlus size={15} /></button>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                {byDay(d).length === 0 ? (
                  <span style={{ color: '#cbd5e1', fontSize: '0.8rem', textAlign: 'center', padding: 8 }}>—</span>
                ) : byDay(d).map(e => (
                  <div key={e.id} style={{
                    border: '1px solid #e2e8f0', borderLeft: '3px solid #3b5beb', borderRadius: 8, padding: '8px 10px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 6 }}>
                      <strong style={{ fontSize: '0.85rem' }}>{e.subject_label}</strong>
                      <button className="btn-icon" style={{ color: '#ef4444', padding: 0 }} onClick={() => remove(e.id)}><FiTrash2 size={13} /></button>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#667085', marginTop: 2 }}>
                      <FiClock size={11} /> {e.start_time?.slice(0, 5)}–{e.end_time?.slice(0, 5)}
                    </div>
                    {e.room && <div style={{ fontSize: '0.75rem', color: '#667085' }}><FiMapPin size={11} /> {e.room}</div>}
                    {e.teacher_name && <div style={{ fontSize: '0.72rem', color: '#98a2b3' }}>{e.teacher_name}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Nouveau créneau — {classeName}</h3>
              <button className="btn-icon" onClick={() => setModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Matière</label>
                  <select className="form-control" value={form.subject}
                    onChange={e => setForm({ ...form, subject: e.target.value })}>
                    <option value="">— Choisir / ou saisir ci-dessous —</option>
                    {classSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.classe_name ? ` (${s.classe_name})` : ''}</option>
                    ))}
                  </select>
                </div>
                {!form.subject && (
                  <div className="form-group">
                    <label>Matière (saisie libre)</label>
                    <input className="form-control" value={form.subject_name} placeholder="Ex : Mathématiques"
                      onChange={e => setForm({ ...form, subject_name: e.target.value })} />
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>Jour</label>
                    <select className="form-control" value={form.day}
                      onChange={e => setForm({ ...form, day: Number(e.target.value) })}>
                      {DAYS.map(([d, l]) => <option key={d} value={d}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Salle</label>
                    <input className="form-control" value={form.room} placeholder="Ex : Salle 3"
                      onChange={e => setForm({ ...form, room: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Heure début</label>
                    <input type="time" className="form-control" required value={form.start_time}
                      onChange={e => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Heure fin</label>
                    <input type="time" className="form-control" required value={form.end_time}
                      onChange={e => setForm({ ...form, end_time: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '...' : 'Ajouter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Timetable;
