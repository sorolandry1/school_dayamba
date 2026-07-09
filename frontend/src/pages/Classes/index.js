import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { downloadFile } from '../../utils/downloadPdf';
import {
  FiUsers, FiPrinter, FiBook, FiGrid,
  FiAward, FiAlertCircle, FiPlus, FiX, FiTrash2, FiLock, FiDollarSign, FiDownload, FiClock
} from 'react-icons/fi';

const LEVELS = ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'];

const fcfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

// Gestion de l'échéancier de pension (tranches) d'une classe.
function TranchesManager({ classeId, tuition }) {
  const [tranches, setTranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ label: '', amount: '', due_date: '' });
  const [saving, setSaving] = useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    api.get(`/classes/tranches/?classe=${classeId}`)
      .then(r => setTranches(r.data.results || r.data))
      .catch(() => setTranches([]))
      .finally(() => setLoading(false));
  }, [classeId]);

  useEffect(() => { load(); }, [load]);

  const total = tranches.reduce((s, t) => s + Number(t.amount || 0), 0);
  const diff = Number(tuition || 0) - total;

  const addTranche = async (e) => {
    e.preventDefault();
    if (!form.label || !form.amount) return;
    setSaving(true);
    try {
      await api.post('/classes/tranches/', {
        classe: classeId,
        label: form.label,
        amount: Number(form.amount) || 0,
        due_date: form.due_date || null,
        order: tranches.length + 1,
      });
      setForm({ label: '', amount: '', due_date: '' });
      load();
    } catch (err) {
      alert('Erreur: ' + JSON.stringify(err.response?.data));
    } finally { setSaving(false); }
  };

  const removeTranche = async (id) => {
    if (!window.confirm('Supprimer cette tranche ?')) return;
    await api.delete(`/classes/tranches/${id}/`);
    load();
  };

  return (
    <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid var(--gray-200)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <FiDollarSign size={15} color="#667085" />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#344054' }}>
          Tranches de pension (échéancier)
        </span>
        <span style={{ fontSize: '0.78rem', color: '#98a2b3' }}>
          — répartition automatique des versements
        </span>
      </div>

      {loading ? (
        <div style={{ color: '#98a2b3', fontSize: '0.85rem', padding: '6px 0' }}>Chargement…</div>
      ) : (
        <>
          {tranches.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ background: 'var(--gray-50)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>Tranche</th>
                  <th style={{ padding: '6px 8px' }}>Montant</th>
                  <th style={{ padding: '6px 8px' }}>Échéance</th>
                  <th style={{ padding: '6px 8px', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {tranches.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--gray-100)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{t.label}</td>
                    <td style={{ padding: '6px 8px' }}>{fcfa(t.amount)}</td>
                    <td style={{ padding: '6px 8px' }}>{t.due_date ? new Date(t.due_date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => removeTranche(t.id)}>
                        <FiTrash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tranches.length > 0 && (
            <div style={{
              fontSize: '0.8rem', marginBottom: 8,
              color: Math.abs(diff) < 0.5 ? '#276749' : '#b45309',
            }}>
              Total tranches : <strong>{fcfa(total)}</strong>
              {' · '}Scolarité : <strong>{fcfa(tuition)}</strong>
              {Math.abs(diff) >= 0.5 && (
                <> {' · '}Écart : <strong>{fcfa(diff)}</strong> (le total des tranches devrait égaler la scolarité)</>
              )}
            </div>
          )}

          <form onSubmit={addTranche} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, flex: '1 1 160px' }}>
              <label style={{ fontSize: '0.75rem' }}>Libellé</label>
              <input className="form-control" placeholder="ex: Inscription" value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="form-group" style={{ margin: 0, flex: '0 1 140px' }}>
              <label style={{ fontSize: '0.75rem' }}>Montant (FCFA)</label>
              <input type="number" min={0} step={1000} className="form-control" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="form-group" style={{ margin: 0, flex: '0 1 160px' }}>
              <label style={{ fontSize: '0.75rem' }}>Échéance</label>
              <input type="date" className="form-control" value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-sm btn-primary" disabled={saving} style={{ height: 38 }}>
              <FiPlus size={13} /> {saving ? '...' : 'Ajouter'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

const LEVEL_COLORS = {
  '6ème':      { bg: 'linear-gradient(135deg, #3b5beb, #1e40af)', light: '#eff6ff', badge: '#1d4ed8' },
  '5ème':      { bg: 'linear-gradient(135deg, #7c3aed, #4c1d95)', light: '#f5f3ff', badge: '#6d28d9' },
  '4ème':      { bg: 'linear-gradient(135deg, #0891b2, #0e7490)', light: '#ecfeff', badge: '#0e7490' },
  '3ème':      { bg: 'linear-gradient(135deg, #059669, #065f46)', light: '#ecfdf5', badge: '#047857' },
  '2nde':      { bg: 'linear-gradient(135deg, #d97706, #92400e)', light: '#fffbeb', badge: '#b45309' },
  '1ère':      { bg: 'linear-gradient(135deg, #db2777, #9d174d)', light: '#fdf2f8', badge: '#be185d' },
  'Terminale': { bg: 'linear-gradient(135deg, #374151, #111827)', light: '#f9fafb', badge: '#374151' },
};

export default function Classes() {
  const [classes, setClasses]             = useState([]);
  const [levelsMap, setLevelsMap]         = useState({});  // { levelName: levelId }
  const [currentYearId, setCurrentYearId] = useState(null);
  const [classStats, setClassStats]       = useState({});
  const [students, setStudents]           = useState({});
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedClasse, setSelectedClasse] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [printing, setPrinting]           = useState(null);

  // Modal ajout classe
  const [modal, setModal]         = useState(false);
  const [modalLevel, setModalLevel] = useState(null);
  const [formName, setFormName]   = useState('');
  const [formCapacity, setFormCapacity] = useState(50);
  const [formTuition, setFormTuition] = useState(0);
  // Édition de la scolarité d'une classe existante
  const [tuitionInput, setTuitionInput] = useState('');
  const [savingTuition, setSavingTuition] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  // Suppression de classe (confirmation par mot de passe)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [classesRes, statsRes, levelsRes, yearsRes] = await Promise.all([
        api.get('/classes/?page_size=100').catch(() => ({ data: { results: [] } })),
        api.get('/reports/class_stats/').catch(() => ({ data: [] })),
        api.get('/classes/levels/').catch(() => ({ data: [] })),
        api.get('/classes/academic-years/').catch(() => ({ data: [] })),
      ]);

      const cls = classesRes.data?.results || classesRes.data || [];
      setClasses(cls.filter(c => LEVELS.includes(c.level_name || c.level?.name)));

      const statsArr = statsRes.data?.results || statsRes.data || [];
      const statsMap = {};
      statsArr.forEach(s => { statsMap[s.classe_id] = s; });
      setClassStats(statsMap);

      // Map niveau name → id
      const lvls = levelsRes.data?.results || levelsRes.data || [];
      const lmap = {};
      lvls.forEach(l => { lmap[l.name] = l.id; });
      setLevelsMap(lmap);

      // Année académique courante
      const years = yearsRes.data?.results || yearsRes.data || [];
      const current = years.find(y => y.is_current) || years[0];
      if (current) setCurrentYearId(current.id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const classesByLevel = (levelName) =>
    classes.filter(c => (c.level_name || c.level?.name) === levelName);

  const handleSelectLevel = (levelName) => {
    if (selectedLevel === levelName) {
      setSelectedLevel(null);
      setSelectedClasse(null);
    } else {
      setSelectedLevel(levelName);
      setSelectedClasse(null);
    }
  };

  const handleSelectClasse = async (classe) => {
    if (selectedClasse?.id === classe.id) {
      setSelectedClasse(null);
      return;
    }
    setSelectedClasse(classe);
    setTuitionInput(classe.tuition_fee != null ? String(Math.round(Number(classe.tuition_fee))) : '0');
    if (!students[classe.id]) {
      setLoadingStudents(true);
      try {
        const res = await api.get(`/students/class_summary/?classe_id=${classe.id}`);
        setStudents(prev => ({ ...prev, [classe.id]: res.data || [] }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingStudents(false);
      }
    }
  };

  const handlePrintBulletin = async (studentId, studentName) => {
    setPrinting(studentId);
    try {
      const res = await api.get(`/reports/bulletin/${studentId}/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bulletin_${studentName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erreur lors de la génération du bulletin.');
    } finally {
      setPrinting(null);
    }
  };

  const saveTuition = async () => {
    if (!selectedClasse) return;
    setSavingTuition(true);
    try {
      const res = await api.patch(`/classes/${selectedClasse.id}/`, { tuition_fee: Number(tuitionInput) || 0 });
      setClasses(prev => prev.map(c => c.id === selectedClasse.id ? { ...c, tuition_fee: res.data.tuition_fee } : c));
      setSelectedClasse(prev => ({ ...prev, tuition_fee: res.data.tuition_fee }));
      alert('Frais de scolarité enregistrés.');
    } catch (err) {
      alert('Erreur: ' + JSON.stringify(err.response?.data));
    } finally { setSavingTuition(false); }
  };

  const openDeleteModal = (e, classe) => {
    e.stopPropagation();
    setDeleteTarget(classe);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleDeleteClasse = async (e) => {
    e.preventDefault();
    if (!deletePassword) { setDeleteError('Veuillez saisir votre mot de passe.'); return; }
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/classes/${deleteTarget.id}/`, { data: { password: deletePassword } });
      setClasses(prev => prev.filter(c => c.id !== deleteTarget.id));
      if (selectedClasse?.id === deleteTarget.id) setSelectedClasse(null);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Suppression impossible.');
    } finally {
      setDeleting(false);
    }
  };

  const openAddModal = (e, levelName) => {
    e.stopPropagation();
    setModalLevel(levelName);
    setFormName(`${levelName} `);
    setFormCapacity(50);
    setFormTuition(0);
    setFormError('');
    setModal(true);
  };

  const handleAddClasse = async (e) => {
    e.preventDefault();
    if (!formName.trim()) { setFormError('Le nom est requis.'); return; }

    setSaving(true);
    setFormError('');
    try {
      // On envoie le nom du niveau ; le backend résout le niveau et l'année
      // courante (création automatique si nécessaire).
      const payload = {
        name: formName.trim(),
        level_name: modalLevel,
        capacity: Number(formCapacity) || 50,
        tuition_fee: Number(formTuition) || 0,
      };
      if (levelsMap[modalLevel]) payload.level = levelsMap[modalLevel];
      if (currentYearId) payload.academic_year = currentYearId;
      const res = await api.post('/classes/', payload);
      // Ajouter la nouvelle classe à l'état local
      setClasses(prev => [...prev, res.data]);
      setModal(false);
      // Sélectionner automatiquement le niveau ajouté
      setSelectedLevel(modalLevel);
      setSelectedClasse(null);
    } catch (err) {
      const data = err.response?.data;
      if (data?.name) setFormError(data.name[0]);
      else if (data?.non_field_errors) setFormError(data.non_field_errors[0]);
      else setFormError('Erreur lors de la création.');
    } finally {
      setSaving(false);
    }
  };

  const totalStudents  = classes.reduce((acc, c) => acc + (c.student_count ?? 0), 0);
  // On affiche toujours tous les niveaux pour permettre la création même sur
  // une base vierge (le backend crée le niveau/l'année au besoin).
  const sortedLevels   = LEVELS;

  const paymentBadge = (status) => {
    const map    = { PAID: ['#d1fae5', '#065f46', 'Payé'], PENDING: ['#fef3c7', '#92400e', 'En attente'], OVERDUE: ['#fee2e2', '#991b1b', 'En retard'] };
    const [bg, color, label] = map[status] || ['#f3f4f6', '#374151', status || '—'];
    return (
      <span style={{ background: bg, color, fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>
        {label}
      </span>
    );
  };

  if (loading) return (
    <div className="loading-container"><div className="spinner" /><p>Chargement des classes...</p></div>
  );

  const levelClassesForSelected = selectedLevel ? classesByLevel(selectedLevel) : [];
  const classeStudents = selectedClasse ? (students[selectedClasse.id] || []) : [];
  const cs = selectedClasse ? classStats[selectedClasse.id] : null;

  return (
    <div>
      {/* En-tête */}
      <div className="page-header">
        <div>
          <h2>Gestion des Classes</h2>
          <p>{classes.length} classe(s) · {totalStudents} élèves — Année 2025-2026</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            background: 'var(--primary-100)', color: 'var(--primary-800)',
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
          }}>
            <FiGrid size={15} /> {sortedLevels.length} niveau{sortedLevels.length > 1 ? 'x' : ''}
          </div>
        </div>
      </div>

      {/* Tuiles des niveaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {sortedLevels.map(levelName => {
          const levelClasses = classesByLevel(levelName);
          const lvlStudents  = levelClasses.reduce((acc, c) => acc + (c.student_count ?? 0), 0);
          const colors       = LEVEL_COLORS[levelName];
          const isActive     = selectedLevel === levelName;

          return (
            <div
              key={levelName}
              onClick={() => handleSelectLevel(levelName)}
              style={{
                background: isActive ? colors.bg : 'white',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 20px 16px',
                cursor: 'pointer',
                border: isActive ? 'none' : `2px solid ${colors.badge}22`,
                boxShadow: isActive ? '0 8px 24px rgba(0,0,0,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Cercle décoratif */}
              <div style={{
                position: 'absolute', top: -20, right: -20,
                width: 80, height: 80, borderRadius: '50%',
                background: isActive ? 'rgba(255,255,255,0.12)' : `${colors.badge}11`,
              }} />

              {/* Bouton + */}
              <button
                onClick={(e) => openAddModal(e, levelName)}
                title={`Ajouter une classe en ${levelName}`}
                style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 24, height: 24,
                  background: isActive ? 'rgba(255,255,255,0.25)' : `${colors.badge}22`,
                  border: 'none', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  color: isActive ? 'white' : colors.badge,
                  fontSize: '1rem', fontWeight: 700,
                  transition: 'background 0.15s',
                  zIndex: 2,
                }}
                onMouseEnter={e => e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.4)' : `${colors.badge}44`}
                onMouseLeave={e => e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.25)' : `${colors.badge}22`}
              >
                <FiPlus size={13} />
              </button>

              <div style={{
                fontSize: '1.6rem', fontWeight: 900,
                color: isActive ? 'white' : colors.badge,
                marginBottom: 4,
              }}>
                {levelName}
              </div>

              <div style={{
                fontSize: '0.82rem',
                color: isActive ? 'rgba(255,255,255,0.85)' : 'var(--gray-500)',
                marginBottom: 12,
              }}>
                {levelClasses.length} classe{levelClasses.length !== 1 ? 's' : ''}
              </div>

              {/* Badges classes */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {levelClasses.map(c => (
                  <span key={c.id} style={{
                    background: isActive ? 'rgba(255,255,255,0.2)' : `${colors.badge}18`,
                    color: isActive ? 'white' : colors.badge,
                    fontSize: '0.72rem', fontWeight: 700,
                    padding: '2px 8px', borderRadius: 999,
                  }}>
                    {c.name}
                  </span>
                ))}
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: '0.78rem',
                color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--gray-400)',
                borderTop: `1px solid ${isActive ? 'rgba(255,255,255,0.15)' : '#f0f0f0'}`,
                paddingTop: 10,
              }}>
                <FiUsers size={12} />
                {lvlStudents} élève{lvlStudents !== 1 ? 's' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Section classes du niveau sélectionné */}
      {selectedLevel && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 8, height: 28, borderRadius: 4,
                background: LEVEL_COLORS[selectedLevel].bg,
              }} />
              <h3 style={{ margin: 0 }}>Classes — {selectedLevel}</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                {levelClassesForSelected.length} classe{levelClassesForSelected.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={(e) => openAddModal(e, selectedLevel)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px',
                  background: LEVEL_COLORS[selectedLevel].bg,
                  color: 'white', border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.82rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <FiPlus size={14} /> Ajouter une classe
              </button>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 8 }}>

            {/* Message si aucune classe */}
            {levelClassesForSelected.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '32px 20px',
                color: 'var(--gray-400)',
              }}>
                <FiGrid size={32} style={{ marginBottom: 8 }} />
                <p style={{ margin: '0 0 16px' }}>Aucune classe pour ce niveau.</p>
                <button
                  onClick={(e) => openAddModal(e, selectedLevel)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 18px',
                    background: LEVEL_COLORS[selectedLevel].bg,
                    color: 'white', border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <FiPlus size={15} /> Créer la première classe
                </button>
              </div>
            ) : (
              <>
                {/* Onglets classes */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {levelClassesForSelected.map(classe => {
                    const isActive = selectedClasse?.id === classe.id;
                    const cStats   = classStats[classe.id];
                    const colors   = LEVEL_COLORS[selectedLevel];
                    return (
                      <button
                        key={classe.id}
                        onClick={() => handleSelectClasse(classe)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                          padding: '10px 16px',
                          background: isActive ? colors.bg : 'var(--gray-50)',
                          border: isActive ? 'none' : '1.5px solid var(--gray-200)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          minWidth: 140,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <FiBook size={13} color={isActive ? 'white' : colors.badge} />
                          <span style={{
                            fontWeight: 700, fontSize: '0.9rem',
                            color: isActive ? 'white' : 'var(--gray-800)',
                          }}>
                            {classe.name}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '0.72rem',
                          color: isActive ? 'rgba(255,255,255,0.75)' : 'var(--gray-500)',
                        }}>
                          {classe.student_count ?? 0} élève{(classe.student_count ?? 0) !== 1 ? 's' : ''}
                        </span>
                        {cStats?.class_average != null && (
                          <span style={{
                            marginTop: 4, fontSize: '0.7rem', fontWeight: 600,
                            color: isActive ? 'rgba(255,255,255,0.9)' : (cStats.class_average >= 10 ? '#065f46' : '#92400e'),
                          }}>
                            Moy. {Number(cStats.class_average).toFixed(1)}/20
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Liste élèves */}
                {selectedClasse && (
                  <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>

                    {/* Bandeau classe */}
                    <div style={{
                      background: LEVEL_COLORS[selectedLevel].bg,
                      padding: '12px 20px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <FiBook size={18} color="white" />
                        <div>
                          <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                            Classe {selectedClasse.name}
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem' }}>
                            {loadingStudents ? 'Chargement...' : `${classeStudents.length} élève${classeStudents.length !== 1 ? 's' : ''}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {cs?.class_average != null && (
                          <div style={{
                            background: 'rgba(255,255,255,0.2)', borderRadius: 8,
                            padding: '6px 14px', textAlign: 'center',
                          }}>
                            <div style={{ color: 'white', fontSize: '1rem', fontWeight: 800 }}>
                              {Number(cs.class_average).toFixed(1)}/20
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.68rem' }}>Moyenne</div>
                          </div>
                        )}
                        {cs?.absent_rate != null && (
                          <div style={{
                            background: 'rgba(255,255,255,0.2)', borderRadius: 8,
                            padding: '6px 14px', textAlign: 'center',
                          }}>
                            <div style={{ color: 'white', fontSize: '1rem', fontWeight: 800 }}>
                              {Math.round(cs.absent_rate)}%
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.68rem' }}>Absents</div>
                          </div>
                        )}
                        <button
                          onClick={(e) => openDeleteModal(e, selectedClasse)}
                          title={`Supprimer la classe ${selectedClasse.name}`}
                          style={{
                            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
                            padding: '0 14px', color: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600,
                          }}
                        >
                          <FiTrash2 size={15} /> Supprimer
                        </button>
                      </div>
                    </div>

                    {/* Documents de la classe */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                      padding: '10px 20px', background: '#fff', borderBottom: '1px solid var(--gray-200)',
                    }}>
                      <button className="btn btn-sm btn-secondary"
                        onClick={() => downloadFile(`/reports/class-roster/${selectedClasse.id}/`, `liste_eleves_${selectedClasse.name}.pdf`)}>
                        <FiDownload size={13} /> Liste des élèves (PDF)
                      </button>
                      <button className="btn btn-sm btn-secondary"
                        onClick={() => downloadFile(`/reports/timetable/${selectedClasse.id}/`, `emploi_du_temps_${selectedClasse.name}.pdf`)}>
                        <FiClock size={13} /> Emploi du temps (PDF)
                      </button>
                    </div>

                    {/* Frais de scolarité de la classe (modifiable) */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                      padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid var(--gray-200)',
                    }}>
                      <FiDollarSign size={15} color="#667085" />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#344054' }}>Frais de scolarité :</span>
                      <input type="number" min={0} step={1000} className="form-control"
                        style={{ maxWidth: 180 }} value={tuitionInput}
                        onChange={e => setTuitionInput(e.target.value)} />
                      <span style={{ fontSize: '0.85rem', color: '#667085' }}>FCFA</span>
                      <button className="btn btn-sm btn-primary" onClick={saveTuition} disabled={savingTuition}>
                        {savingTuition ? '...' : 'Enregistrer'}
                      </button>
                      <span style={{ fontSize: '0.78rem', color: '#98a2b3' }}>
                        (apparaît sur les reçus : total, reste à payer)
                      </span>
                    </div>

                    <TranchesManager
                      key={selectedClasse.id}
                      classeId={selectedClasse.id}
                      tuition={Number(tuitionInput) || Number(selectedClasse.tuition_fee) || 0}
                    />

                    {loadingStudents ? (
                      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}>
                        <div className="spinner" style={{ margin: '0 auto 8px' }} />
                        Chargement des élèves...
                      </div>
                    ) : classeStudents.length === 0 ? (
                      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.875rem' }}>
                        <FiAlertCircle size={28} style={{ marginBottom: 8 }} />
                        <p>Aucun élève dans cette classe</p>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--gray-50)' }}>
                              <th style={thStyle}>#</th>
                              <th style={thStyle}>Matricule</th>
                              <th style={thStyle}>Nom & Prénom</th>
                              <th style={thStyle}>Genre</th>
                              <th style={thStyle}>Contact parent</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                  <FiAward size={12} /> Moyenne
                                </span>
                              </th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Absences</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Paiement</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                  <FiPrinter size={12} /> Bulletin
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {classeStudents.map((student, idx) => (
                              <tr
                                key={student.id}
                                style={{
                                  borderTop: '1px solid var(--gray-100)',
                                  background: idx % 2 === 0 ? 'white' : '#fafafa',
                                  transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = LEVEL_COLORS[selectedLevel].light}
                                onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#fafafa'}
                              >
                                <td style={{ ...tdStyle, color: 'var(--gray-400)', fontWeight: 600 }}>{idx + 1}</td>
                                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                                  {student.matricule}
                                </td>
                                <td style={tdStyle}>
                                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--gray-800)' }}>
                                    {student.last_name} {student.first_name}
                                  </div>
                                </td>
                                <td style={tdStyle}>
                                  <span style={{
                                    fontSize: '0.75rem', fontWeight: 600,
                                    color: student.gender === 'M' ? '#1d4ed8' : '#be185d',
                                    background: student.gender === 'M' ? '#dbeafe' : '#fce7f3',
                                    padding: '2px 8px', borderRadius: 999,
                                  }}>
                                    {student.gender === 'M' ? '♂ Garçon' : '♀ Fille'}
                                  </span>
                                </td>
                                <td style={{ ...tdStyle, fontSize: '0.82rem', color: 'var(--gray-600)' }}>
                                  {student.parent_phone || '—'}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  {student.average != null ? (
                                    <span style={{
                                      fontWeight: 700, fontSize: '0.85rem',
                                      color: student.average >= 10 ? '#065f46' : student.average >= 7 ? '#92400e' : '#991b1b',
                                      background: student.average >= 10 ? '#d1fae5' : student.average >= 7 ? '#fef3c7' : '#fee2e2',
                                      padding: '2px 10px', borderRadius: 999,
                                    }}>
                                      {Number(student.average).toFixed(1)}/20
                                    </span>
                                  ) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  <span style={{
                                    fontWeight: 600, fontSize: '0.8rem',
                                    color: student.absent_count >= 5 ? '#991b1b' : student.absent_count > 0 ? '#92400e' : '#065f46',
                                    background: student.absent_count >= 5 ? '#fee2e2' : student.absent_count > 0 ? '#fef3c7' : '#d1fae5',
                                    padding: '2px 8px', borderRadius: 999,
                                  }}>
                                    {student.absent_count ?? 0}j
                                  </span>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  {paymentBadge(student.payment_status)}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePrintBulletin(student.id, `${student.last_name}_${student.first_name}`);
                                    }}
                                    disabled={printing === student.id}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 5,
                                      padding: '5px 12px',
                                      background: printing === student.id ? 'var(--gray-200)' : LEVEL_COLORS[selectedLevel].bg,
                                      color: printing === student.id ? 'var(--gray-500)' : 'white',
                                      border: 'none', borderRadius: 'var(--radius-sm)',
                                      fontSize: '0.78rem', fontWeight: 600,
                                      cursor: printing === student.id ? 'not-allowed' : 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <FiPrinter size={13} />
                                    {printing === student.id ? 'Génération...' : 'Imprimer'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* État vide global */}
      {classes.length === 0 && !loading && (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>
          <FiGrid size={40} style={{ marginBottom: 12 }} />
          <p>Aucune classe disponible. Cliquez sur <strong>+</strong> pour en créer.</p>
        </div>
      )}

      {/* ─── Modal Supprimer une classe (confirmation mot de passe) ─── */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 420,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #ef4444, #991b1b)', padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>Supprimer la classe</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>{deleteTarget.name}</div>
              </div>
              <button onClick={() => setDeleteTarget(null)} style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                width: 32, height: 32, cursor: 'pointer', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FiX size={16} />
              </button>
            </div>

            <form onSubmit={handleDeleteClasse} style={{ padding: 24 }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--gray-600)', marginTop: 0 }}>
                Cette action est <strong>irréversible</strong>. Les élèves de cette classe
                seront détachés (sans classe). Confirmez avec votre mot de passe.
              </p>

              {deleteError && (
                <div style={{
                  background: '#fee2e2', color: '#991b1b', padding: '10px 14px',
                  borderRadius: 8, fontSize: '0.85rem', marginBottom: 16,
                }}>
                  {deleteError}
                </div>
              )}

              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <FiLock size={13} /> Votre mot de passe <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="password"
                  className="form-control"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  placeholder="Saisissez votre mot de passe"
                  autoFocus
                  autoComplete="current-password"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" onClick={() => setDeleteTarget(null)} style={{
                  padding: '9px 20px', background: 'var(--gray-100)', color: 'var(--gray-700)',
                  border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600,
                  fontSize: '0.85rem', cursor: 'pointer',
                }}>
                  Annuler
                </button>
                <button type="submit" disabled={deleting} style={{
                  padding: '9px 20px', background: deleting ? 'var(--gray-300)' : 'linear-gradient(135deg, #ef4444, #991b1b)',
                  color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600,
                  fontSize: '0.85rem', cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {deleting ? (
                    <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Suppression...</>
                  ) : (
                    <><FiTrash2 size={14} /> Supprimer définitivement</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Ajouter une classe ─── */}
      {modal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 'var(--radius-lg)',
              width: '100%', maxWidth: 440,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            {/* Header modal */}
            <div style={{
              background: LEVEL_COLORS[modalLevel]?.bg,
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                  Nouvelle classe
                </div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem' }}>
                  Niveau {modalLevel}
                </div>
              </div>
              <button
                onClick={() => setModal(false)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Corps modal */}
            <form onSubmit={handleAddClasse} style={{ padding: 24 }}>
              {formError && (
                <div style={{
                  background: '#fee2e2', color: '#991b1b',
                  padding: '10px 14px', borderRadius: 8,
                  fontSize: '0.85rem', marginBottom: 16,
                }}>
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>
                  Nom de la classe <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={`ex. ${modalLevel} A`}
                  required
                  autoFocus
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 4 }}>
                  Exemple : {modalLevel} A, {modalLevel} B, {modalLevel} C…
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>
                  Capacité (élèves)
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={formCapacity}
                  onChange={e => setFormCapacity(e.target.value)}
                  min={1}
                  max={100}
                />
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>
                  Frais de scolarité (FCFA)
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={formTuition}
                  onChange={e => setFormTuition(e.target.value)}
                  min={0}
                  step={1000}
                  placeholder="ex. 150000"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  style={{
                    padding: '9px 20px', background: 'var(--gray-100)',
                    color: 'var(--gray-700)', border: 'none',
                    borderRadius: 'var(--radius-md)', fontWeight: 600,
                    fontSize: '0.85rem', cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 20px',
                    background: saving ? 'var(--gray-300)' : LEVEL_COLORS[modalLevel]?.bg,
                    color: 'white', border: 'none',
                    borderRadius: 'var(--radius-md)', fontWeight: 600,
                    fontSize: '0.85rem', cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {saving ? (
                    <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Création...</>
                  ) : (
                    <><FiPlus size={14} /> Créer la classe</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '10px 16px', textAlign: 'left',
  fontSize: '0.72rem', fontWeight: 700,
  color: 'var(--gray-500)', textTransform: 'uppercase',
  letterSpacing: '0.05em', whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '10px 16px',
  fontSize: '0.875rem',
  color: 'var(--gray-700)',
  verticalAlign: 'middle',
};
