import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FiPlus, FiCheckCircle, FiTrash2, FiEdit2, FiX, FiCalendar, FiArrowRight, FiDatabase, FiArchive, FiRotateCcw } from 'react-icons/fi';

const empty = { name: '', start_date: '', end_date: '', is_current: false };

// Isolation physique de la base par année scolaire (ADMIN)
function YearIsolationCard() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newYear, setNewYear] = useState('');
  const [reset, setReset] = useState({ grades: true, attendance: true, financials: true });

  const load = useCallback(() => {
    api.get('/schoolyear/archives/').then(r => setData(r.data)).catch(() => setData(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const archiveNow = async () => {
    setBusy(true);
    try { const r = await api.post('/schoolyear/archive/', {}); alert(r.data.message + ' (' + r.data.file + ')'); load(); }
    catch (e) { alert('Erreur: ' + (e.response?.data?.error || '')); }
    finally { setBusy(false); }
  };

  const startNewYear = async () => {
    if (!newYear.trim()) { alert('Nom de la nouvelle année requis.'); return; }
    if (!window.confirm(`Clôturer l'année en cours (archivée) et démarrer "${newYear}" ?\nLes données cochées seront réinitialisées. Cette action est importante.`)) return;
    setBusy(true);
    try {
      const r = await api.post('/schoolyear/new/', {
        name: newYear.trim(), confirm: true,
        reset_grades: reset.grades, reset_attendance: reset.attendance, reset_financials: reset.financials,
      });
      alert(`${r.data.message}\nArchive : ${r.data.archived.file}`);
      setNewYear(''); load();
    } catch (e) { alert('Erreur: ' + (e.response?.data?.error || '')); }
    finally { setBusy(false); }
  };

  const restore = async (filename) => {
    if (!window.confirm(`Restaurer "${filename}" comme base active ?\nLa base actuelle sera sauvegardée. Un redémarrage du serveur sera nécessaire.`)) return;
    setBusy(true);
    try { const r = await api.post('/schoolyear/restore/', { filename, confirm: true }); alert(r.data.message + `\nSauvegarde: ${r.data.backup}`); load(); }
    catch (e) { alert('Erreur: ' + (e.response?.data?.error || '')); }
    finally { setBusy(false); }
  };

  if (!data) return null;
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FiDatabase size={16} /><h3 style={{ margin: 0 }}>Isolation par année (base physique)</h3>
      </div>
      <div className="card-body">
        <p style={{ fontSize: '0.82rem', color: '#667085', marginTop: 0 }}>
          Année active : <strong>{data.active_year}</strong>. Chaque année clôturée est copiée dans son propre
          fichier de base de données sous <code>data/annees/</code>.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
          <button className="btn btn-secondary" onClick={archiveNow} disabled={busy}>
            <FiArchive size={14} /> Archiver l'année en cours
          </button>
        </div>

        <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 6 }}>Clôturer & démarrer une nouvelle année</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, flex: '1 1 160px' }}>
              <label style={{ fontSize: '0.75rem' }}>Nom de la nouvelle année</label>
              <input className="form-control" placeholder="2026-2027" value={newYear} onChange={e => setNewYear(e.target.value)} />
            </div>
            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <input type="checkbox" checked={reset.grades} onChange={e => setReset({ ...reset, grades: e.target.checked })} /> Réinit. notes
            </label>
            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <input type="checkbox" checked={reset.attendance} onChange={e => setReset({ ...reset, attendance: e.target.checked })} /> Réinit. présences
            </label>
            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <input type="checkbox" checked={reset.financials} onChange={e => setReset({ ...reset, financials: e.target.checked })} /> Réinit. finances
            </label>
            <button className="btn btn-primary" onClick={startNewYear} disabled={busy}>Démarrer</button>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 6 }}>
            Élèves, classes, matières, personnel et réglages sont conservés. L'année en cours est archivée avant réinitialisation.
          </div>
        </div>

        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>Archives ({data.archives.length})</div>
        {data.archives.length === 0 ? (
          <div style={{ color: '#98a2b3', fontSize: '0.83rem' }}>Aucune archive.</div>
        ) : (
          <div style={{ border: '1px solid #eef0f4', borderRadius: 8 }}>
            {data.archives.map(a => (
              <div key={a.filename} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderBottom: '1px solid #f5f7fa', fontSize: '0.83rem' }}>
                <FiArchive size={13} color="#98a2b3" />
                <span style={{ flex: 1, fontFamily: 'monospace' }}>{a.filename}</span>
                <span style={{ color: '#98a2b3' }}>{a.size_kb} Ko</span>
                <button className="btn btn-sm btn-secondary" title="Restaurer cette année" onClick={() => restore(a.filename)} disabled={busy}>
                  <FiRotateCcw size={13} /> Restaurer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AcademicYears() {
  const { user } = useAuth();
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  // Transfert inter-années
  const [promo, setPromo] = useState(false);
  const [promoSrc, setPromoSrc] = useState('');
  const [promoClasses, setPromoClasses] = useState([]);
  const [promoTargets, setPromoTargets] = useState({}); // {classeId: targetName}
  const [promoYearMode, setPromoYearMode] = useState('new'); // 'new' | 'existing'
  const [promoTargetYearId, setPromoTargetYearId] = useState('');
  const [promoTargetYearName, setPromoTargetYearName] = useState('');
  const [promoSetCurrent, setPromoSetCurrent] = useState(true);
  const [promoting, setPromoting] = useState(false);

  const openPromo = () => {
    setPromo(true); setPromoSrc(''); setPromoClasses([]); setPromoTargets({});
    setPromoYearMode('new'); setPromoTargetYearId(''); setPromoTargetYearName('');
    setPromoSetCurrent(true);
  };

  const loadPromoClasses = async (yearId) => {
    setPromoSrc(yearId);
    if (!yearId) { setPromoClasses([]); return; }
    try {
      const res = await api.get(`/classes/?academic_year=${yearId}&page_size=200`);
      const list = res.data.results || res.data;
      setPromoClasses(list);
      const map = {};
      list.forEach(c => { map[c.id] = c.name; });
      setPromoTargets(map);
    } catch { setPromoClasses([]); }
  };

  const runPromotion = async () => {
    const mappings = promoClasses.map(c => ({
      source_classe_id: c.id,
      target_classe_name: (promoTargets[c.id] || c.name).trim(),
    })).filter(m => m.target_classe_name);
    if (!mappings.length) { alert('Aucune classe à transférer.'); return; }
    const payload = { mappings, set_current: promoSetCurrent };
    if (promoYearMode === 'existing') {
      if (!promoTargetYearId) { alert('Choisissez l\'année cible.'); return; }
      payload.target_year_id = Number(promoTargetYearId);
    } else {
      if (!promoTargetYearName.trim()) { alert('Saisissez le nom de l\'année cible.'); return; }
      payload.target_year_name = promoTargetYearName.trim();
    }
    if (!window.confirm(`Transférer les élèves de ${mappings.length} classe(s) vers l'année cible ?`)) return;
    setPromoting(true);
    try {
      const res = await api.post('/classes/promote/', payload);
      alert(`${res.data.promoted} élève(s) transféré(s) vers ${res.data.target_year}.\n${res.data.created_classes} classe(s) créée(s).`);
      setPromo(false); fetchYears();
    } catch (err) { alert('Erreur: ' + JSON.stringify(err.response?.data)); }
    finally { setPromoting(false); }
  };

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={openPromo}><FiArrowRight /> Transfert inter-années</button>
          <button className="btn btn-primary" onClick={openCreate}><FiPlus /> Nouvelle année</button>
        </div>
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

      {user?.role === 'ADMIN' && <YearIsolationCard />}

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

      {promo && (
        <div className="modal-overlay" onClick={() => setPromo(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <h3>Transfert inter-années</h3>
              <button className="btn-icon" onClick={() => setPromo(false)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Année source</label>
                <select className="form-control" value={promoSrc} onChange={e => loadPromoClasses(e.target.value)}>
                  <option value="">Sélectionner l'année de départ…</option>
                  {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Année cible</label>
                  <select className="form-control" value={promoYearMode} onChange={e => setPromoYearMode(e.target.value)}>
                    <option value="new">Nouvelle année</option>
                    <option value="existing">Année existante</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{promoYearMode === 'new' ? "Nom de l'année cible" : "Choisir l'année cible"}</label>
                  {promoYearMode === 'new' ? (
                    <input className="form-control" placeholder="2026-2027" value={promoTargetYearName}
                      onChange={e => setPromoTargetYearName(e.target.value)} />
                  ) : (
                    <select className="form-control" value={promoTargetYearId} onChange={e => setPromoTargetYearId(e.target.value)}>
                      <option value="">—</option>
                      {years.filter(y => String(y.id) !== String(promoSrc)).map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {promoClasses.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Correspondance des classes (classe source → classe cible)</label>
                  <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #eef0f4', borderRadius: 8, marginTop: 6 }}>
                    {promoClasses.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderBottom: '1px solid #f5f7fa' }}>
                        <span style={{ minWidth: 130, fontSize: '0.85rem' }}>{c.name} <span style={{ color: '#98a2b3' }}>({c.student_count ?? 0})</span></span>
                        <FiArrowRight size={13} color="#98a2b3" />
                        <input className="form-control" style={{ flex: 1 }} value={promoTargets[c.id] || ''}
                          onChange={e => setPromoTargets({ ...promoTargets, [c.id]: e.target.value })}
                          placeholder="Classe cible (ex: 5ème A)" />
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#98a2b3', marginTop: 6 }}>
                    Indiquez la classe de destination (créée si elle n'existe pas). Videz un champ pour ne pas transférer cette classe.
                    Les élèves inactifs ne sont pas transférés.
                  </p>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginTop: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={promoSetCurrent} onChange={e => setPromoSetCurrent(e.target.checked)} />
                Définir l'année cible comme année courante
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setPromo(false)}>Annuler</button>
              <button type="button" className="btn btn-primary" disabled={promoting || !promoClasses.length} onClick={runPromotion}>
                {promoting ? '...' : 'Lancer le transfert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AcademicYears;
