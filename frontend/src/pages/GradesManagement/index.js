import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FiPlus, FiEdit2, FiTrash2, FiSave } from 'react-icons/fi';

function GradesManagement() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isTeacher = user?.role === 'TEACHER';

  // Filters
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(searchParams.get('subject_id') || '');
  const [selectedClasse, setSelectedClasse] = useState(searchParams.get('classe_id') || '');

  // Data
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [gradeForm, setGradeForm] = useState({
    student: '', subject: '', value: '', max_value: '20', type_evaluation: 'DEVOIR', comment: ''
  });

  // Page info from URL
  const classeName = searchParams.get('classe_name') || '';
  const subjectName = searchParams.get('subject_name') || '';

  useEffect(() => {
    if (isTeacher) {
      api.get('/subjects/my_subjects/').then(r => setSubjects(r.data.results || r.data)).catch(() => {});
    } else {
      api.get('/subjects/').then(r => setSubjects(r.data.results || r.data)).catch(() => {});
      api.get('/classes/current_year/').then(r => setClasses(r.data.results || r.data)).catch(() => {});
    }
  }, [isTeacher]);

  const fetchData = useCallback(async () => {
    if (!selectedSubject || !selectedClasse) return;
    setLoading(true);
    try {
      const [studRes, gradeRes] = await Promise.all([
        api.get(`/students/by_class/?classe_id=${selectedClasse}`),
        api.get(`/grades/by_subject_class/?subject_id=${selectedSubject}&classe_id=${selectedClasse}`),
      ]);
      setStudents(studRes.data.results || studRes.data);
      setGrades(gradeRes.data.results || gradeRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedSubject, selectedClasse]);

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
      student: studentId, subject: selectedSubject,
      value: '', max_value: '20', type_evaluation: 'DEVOIR', comment: ''
    });
    setShowModal(true);
  };

  const handleEditGrade = (grade) => {
    setEditingGrade(grade);
    setGradeForm({
      student: grade.student, subject: grade.subject,
      value: grade.value, max_value: grade.max_value,
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
    if (subj) setSelectedClasse(String(subj.classe));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{isTeacher ? 'Gestion des Notes' : 'Notes'}</h2>
          <p>{subjectName && classeName ? `${subjectName} — ${classeName}` : 'Sélectionnez une matière et une classe'}</p>
        </div>
      </div>

      <div className="filters-bar">
        <select className="form-control" style={{ width: 240 }}
          value={selectedSubject} onChange={e => handleSubjectChange(e.target.value)}>
          <option value="">Choisir une matière</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.classe_name})</option>
          ))}
        </select>
        {!isTeacher && (
          <select className="form-control" style={{ width: 200 }}
            value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
            <option value="">Choisir une classe</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {(!selectedSubject || !selectedClasse) ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60, color: '#98a2b3' }}>
            <FiPlus size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Sélectionnez une matière pour commencer la saisie des notes</p>
          </div>
        </div>
      ) : loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3>Élèves — {students.length} inscrits</h3>
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
                              <button onClick={() => handleEditGrade(g)}
                                style={{ background: 'none', border: 'none', color: '#3b5beb', padding: 2 }}>
                                <FiEdit2 size={12} />
                              </button>
                              <button onClick={() => handleDeleteGrade(g.id)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', padding: 2 }}>
                                <FiTrash2 size={12} />
                              </button>
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
                        <button className="btn btn-sm btn-primary" onClick={() => handleAddGrade(s.id)}>
                          <FiPlus size={14} /> Note
                        </button>
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
                  <label>Type d'évaluation</label>
                  <select className="form-control" value={gradeForm.type_evaluation}
                    onChange={e => setGradeForm({...gradeForm, type_evaluation: e.target.value})}>
                    <option value="DEVOIR">Devoir</option>
                    <option value="EXAMEN">Examen</option>
                    <option value="ORAL">Oral</option>
                    <option value="TP">Travaux Pratiques</option>
                    <option value="COMPOSITION">Composition</option>
                  </select>
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
