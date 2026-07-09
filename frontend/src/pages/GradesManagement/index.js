import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiDownload, FiUpload } from 'react-icons/fi';
import { downloadFile } from '../../utils/downloadPdf';

function GradesManagement() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isTeacher = user?.role === 'TEACHER';
  // Seuls les professeurs (et l'admin technique) saisissent/modifient les notes.
  // Le directeur consulte en lecture seule.
  const canEdit = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  // Filters
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assignedClasses, setAssignedClasses] = useState([]); // classes affectées au prof
  const [selectedSubject, setSelectedSubject] = useState(searchParams.get('subject_id') || ''); // id (non-prof)
  const [selectedSubjectName, setSelectedSubjectName] = useState(searchParams.get('subject_name') || ''); // prof
  const [selectedClasse, setSelectedClasse] = useState(searchParams.get('classe_id') || '');

  // Data
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [gradeForm, setGradeForm] = useState({
    student: '', subject: '', value: '', max_value: '20', period: '1', type_evaluation: 'Devoir', comment: ''
  });
  const [periodSystem, setPeriodSystem] = useState('TRIMESTER');
  const periodOptions = (periodSystem === 'SEMESTER'
    ? [['1', '1er Semestre'], ['2', '2e Semestre']]
    : [['1', '1er Trimestre'], ['2', '2e Trimestre'], ['3', '3e Trimestre']]);

  // Page info from URL
  const classeName = searchParams.get('classe_name') || '';
  const subjectName = searchParams.get('subject_name') || '';

  useEffect(() => {
    api.get('/reports/platform-settings/').then(r => setPeriodSystem(r.data?.period_system || 'TRIMESTER')).catch(() => {});
  }, []);

  useEffect(() => {
    if (isTeacher) {
      // Le prof saisit selon SES matières et SES classes affectées
      Promise.all([
        api.get('/subjects/my_subjects/').then(r => r.data.results || r.data).catch(() => []),
        api.get('/teachers/me/').then(r => r.data?.assigned_classes || []).catch(() => []),
      ]).then(([subs, assigned]) => {
        setSubjects(subs);
        setAssignedClasses(assigned);
      });
    } else {
      api.get('/subjects/').then(r => setSubjects(r.data.results || r.data)).catch(() => {});
      api.get('/classes/current_year/').then(r => setClasses(r.data.results || r.data)).catch(() => {});
    }
  }, [isTeacher]);

  // ── Listes dérivées pour le professeur ─────────────────────────────────────
  // Noms de matières distincts que le prof enseigne
  const subjectNames = isTeacher ? Array.from(new Set(subjects.map(s => s.name))) : [];

  // Classes proposées une fois la matière choisie : UNIQUEMENT celles où le prof
  // enseigne cette matière (sinon, matière générale → ses classes affectées)
  const classOptions = (() => {
    if (!isTeacher) return classes;
    if (!selectedSubjectName) return [];
    const entries = subjects.filter(s => s.name === selectedSubjectName);
    const withClass = entries.filter(s => s.classe);
    if (withClass.length) {
      const map = {};
      withClass.forEach(s => { map[s.classe] = { id: s.classe, name: s.classe_name }; });
      return Object.values(map);
    }
    return assignedClasses; // matière sans classe → toutes les classes affectées
  })();

  // Id réel de la matière (résolu depuis nom + classe pour le prof)
  const effectiveSubjectId = (() => {
    if (!isTeacher) return selectedSubject;
    if (!selectedSubjectName) return '';
    let e = subjects.find(s => s.name === selectedSubjectName && String(s.classe) === String(selectedClasse));
    if (!e) e = subjects.find(s => s.name === selectedSubjectName && !s.classe);
    return e ? e.id : '';
  })();

  const fetchData = useCallback(async () => {
    if (!effectiveSubjectId || !selectedClasse) return;
    setLoading(true);
    try {
      const [studRes, gradeRes] = await Promise.all([
        api.get(`/students/by_class/?classe_id=${selectedClasse}`),
        api.get(`/grades/by_subject_class/?subject_id=${effectiveSubjectId}&classe_id=${selectedClasse}`),
      ]);
      setStudents(studRes.data.results || studRes.data);
      setGrades(gradeRes.data.results || gradeRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [effectiveSubjectId, selectedClasse]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getStudentGrades = (studentId) => grades.filter(g => g.student === studentId);

  const getAverage = (studentId) => {
    const sg = getStudentGrades(studentId);
    if (sg.length === 0) return '-';
    const avg = sg.reduce((sum, g) => sum + parseFloat(g.value), 0) / sg.length;
    return avg.toFixed(2);
  };

  const handleAddGrade = (studentId) => {
    setEditingGrade(null);
    setGradeForm({
      student: studentId, subject: effectiveSubjectId,
      value: '', max_value: '20', period: gradeForm.period || '1', type_evaluation: 'Devoir', comment: ''
    });
    setShowModal(true);
  };

  const handleEditGrade = (grade) => {
    setEditingGrade(grade);
    setGradeForm({
      student: grade.student, subject: grade.subject,
      value: grade.value, max_value: grade.max_value,
      period: String(grade.period || '1'),
      type_evaluation: grade.type_evaluation, comment: grade.comment || ''
    });
    setShowModal(true);
  };

  const handleDeleteGrade = async (gradeId) => {
    if (!window.confirm('Supprimer cette note ?')) return;
    await api.delete(`/grades/${gradeId}/`);
    fetchData();
  };

  const handleSubmitGrade = async (e) => {
    e.preventDefault();
    try {
      if (editingGrade) {
        await api.put(`/grades/${editingGrade.id}/`, gradeForm);
      } else {
        await api.post('/grades/', gradeForm);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert('Erreur: ' + JSON.stringify(err.response?.data));
    }
  };

  const handleSubjectChange = (subjectId) => {
    setSelectedSubject(subjectId);
    const subj = subjects.find(s => s.id === parseInt(subjectId));
    // Auto-sélection de la classe seulement si la matière est rattachée à une classe
    if (subj && subj.classe) setSelectedClasse(String(subj.classe));
  };

  const importGrades = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/grades/import_grades/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { created, errors } = res.data;
      let msg = `${created} note(s) importée(s).`;
      if (errors?.length) msg += `\n${errors.length} ligne(s) en erreur :\n` + errors.slice(0, 10).map(x => `Ligne ${x.row}: ${x.message}`).join('\n');
      alert(msg);
      fetchData();
    } catch (err) { alert('Erreur: ' + JSON.stringify(err.response?.data)); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{isTeacher ? 'Gestion des Notes' : 'Notes'}</h2>
          <p>{subjectName && classeName ? `${subjectName} — ${classeName}` : 'Sélectionnez une matière et une classe'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selectedClasse && <>
            <button className="btn btn-secondary" onClick={() => downloadFile(`/reports/class-roster/${selectedClasse}/`, 'liste_eleves.pdf')}>
              <FiDownload size={15} /> Liste élèves
            </button>
            <button className="btn btn-secondary" onClick={() => downloadFile(`/reports/timetable/${selectedClasse}/`, 'emploi_du_temps.pdf')}>
              <FiDownload size={15} /> Emploi du temps
            </button>
          </>}
          <button className="btn btn-secondary" onClick={() => downloadFile(`/reports/export/?type=grades${selectedClasse ? `&classe_id=${selectedClasse}` : ''}`, 'notes.xlsx')}>
            <FiDownload size={15} /> Exporter
          </button>
          {canEdit && <>
            <button className="btn btn-secondary" onClick={() => downloadFile('/grades/import_template/', 'modele_import_notes.xlsx')}>
              <FiDownload size={15} /> Modèle
            </button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
              <FiUpload size={15} /> Importer
              <input type="file" accept=".xlsx,.csv" hidden onChange={importGrades} />
            </label>
          </>}
        </div>
      </div>

      <div className="filters-bar">
        {isTeacher ? (
          <select className="form-control" style={{ width: 240 }}
            value={selectedSubjectName}
            onChange={e => { setSelectedSubjectName(e.target.value); setSelectedClasse(''); }}>
            <option value="">Choisir une matière</option>
            {subjectNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        ) : (
          <select className="form-control" style={{ width: 240 }}
            value={selectedSubject} onChange={e => handleSubjectChange(e.target.value)}>
            <option value="">Choisir une matière</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.classe_name})</option>
            ))}
          </select>
        )}
        <select className="form-control" style={{ width: 200 }}
          value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}
          disabled={isTeacher && !selectedSubjectName}>
          <option value="">
            {isTeacher && !selectedSubjectName ? 'Choisir d\'abord la matière' : 'Choisir une classe'}
          </option>
          {classOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {(!effectiveSubjectId || !selectedClasse) ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60, color: '#98a2b3' }}>
            <FiPlus size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Sélectionnez une matière puis une classe pour commencer la saisie des notes</p>
          </div>
        </div>
      ) : loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3>Élèves — {students.length} inscrits</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-secondary"
                onClick={() => downloadFile(
                  `/reports/subject-sheet/?subject_id=${effectiveSubjectId}&classe_id=${selectedClasse}&order=merit`,
                  'feuille_notes_merite.pdf')}>
                <FiDownload size={14} /> PDF mérite
              </button>
              <button className="btn btn-sm btn-secondary"
                onClick={() => downloadFile(
                  `/reports/subject-sheet/?subject_id=${effectiveSubjectId}&classe_id=${selectedClasse}&order=alpha`,
                  'feuille_notes_alphabetique.pdf')}>
                <FiDownload size={14} /> PDF alphabétique
              </button>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nom & Prénom</th>
                  <th>Notes saisies</th>
                  <th>Moyenne</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  const sg = getStudentGrades(s.id);
                  const avg = getAverage(s.id);
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.last_name} {s.first_name}</strong></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {sg.length === 0 && <span style={{ color: '#98a2b3', fontSize: '0.82rem' }}>Aucune note</span>}
                          {sg.map(g => (
                            <div key={g.id} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: '#f2f4f7', padding: '3px 8px', borderRadius: 6, fontSize: '0.82rem'
                            }}>
                              <span style={{ fontWeight: 600 }}>{g.value}/{g.max_value}</span>
                              <span style={{ color: '#98a2b3', fontSize: '0.7rem' }}>{g.type_evaluation}</span>
                              {canEdit && (
                                <>
                                  <button onClick={() => handleEditGrade(g)}
                                    style={{ background: 'none', border: 'none', color: '#3b5beb', padding: 2 }}>
                                    <FiEdit2 size={12} />
                                  </button>
                                  <button onClick={() => handleDeleteGrade(g.id)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', padding: 2 }}>
                                    <FiTrash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700, fontSize: '1rem',
                          color: avg !== '-' && parseFloat(avg) >= 10 ? '#10b981' : avg !== '-' ? '#ef4444' : '#98a2b3'
                        }}>
                          {avg !== '-' ? `${avg}/20` : '-'}
                        </span>
                      </td>
                      <td>
                        {canEdit ? (
                          <button className="btn btn-sm btn-primary" onClick={() => handleAddGrade(s.id)}>
                            <FiPlus size={14} /> Note
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#98a2b3', fontStyle: 'italic' }}>Lecture seule</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingGrade ? 'Modifier la note' : 'Ajouter une note'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmitGrade}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Note</label>
                    <input type="number" step="0.25" min="0" className="form-control"
                      required value={gradeForm.value}
                      onChange={e => setGradeForm({...gradeForm, value: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Sur (max)</label>
                    <input type="number" className="form-control"
                      value={gradeForm.max_value}
                      onChange={e => setGradeForm({...gradeForm, max_value: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Période</label>
                  <select className="form-control" value={gradeForm.period}
                    onChange={e => setGradeForm({...gradeForm, period: e.target.value})}>
                    {periodOptions.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Type d'évaluation</label>
                  <input className="form-control" list="eval-types"
                    placeholder="Ex : Devoir, Interrogation, Composition..."
                    value={gradeForm.type_evaluation}
                    onChange={e => setGradeForm({...gradeForm, type_evaluation: e.target.value})} />
                  <datalist id="eval-types">
                    <option value="Devoir" />
                    <option value="Interrogation" />
                    <option value="Examen" />
                    <option value="Oral" />
                    <option value="Travaux Pratiques" />
                    <option value="Composition" />
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Commentaire (optionnel)</label>
                  <input className="form-control" value={gradeForm.comment}
                    onChange={e => setGradeForm({...gradeForm, comment: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary"><FiSave size={16} /> Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GradesManagement;
