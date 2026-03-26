import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { downloadFile } from '../../utils/downloadPdf';
import { FiDownload, FiAward, FiFileText } from 'react-icons/fi';

function Bulletins() {
  const [classes, setClasses] = useState([]);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [rankings, setRankings] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState(null);

  useEffect(() => {
    api.get('/classes/current_year/').then(r => setClasses(r.data.results || r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClasse) { setRankings([]); setSubjects([]); return; }
    setLoading(true);
    Promise.all([
      api.get(`/grades/ranking/?classe_id=${selectedClasse}`),
      api.get(`/subjects/?classe=${selectedClasse}`),
    ])
      .then(([rankRes, subjRes]) => {
        const data = rankRes.data.results || rankRes.data;
        setRankings(data);
        // Build subject list from first student's subject_averages (consistent order)
        if (data.length > 0 && data[0].subject_averages) {
          setSubjects(data[0].subject_averages.map(sa => sa.subject));
        } else {
          const subjData = subjRes.data.results || subjRes.data;
          setSubjects(subjData.map(s => s.name));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedClasse]);

  const downloadBulletin = (studentId, studentName, e) => {
    e.stopPropagation();
    downloadFile(`/reports/bulletin/${studentId}/`, `bulletin_${studentName}.pdf`);
  };

  const downloadBulletinsClasse = () => {
    downloadFile(`/reports/bulletin/classe/${selectedClasse}/`, `bulletins_${classeName}.zip`);
  };

  const getSubjectAvg = (student, subjectName) => {
    if (!student.subject_averages) return '-';
    const sa = student.subject_averages.find(s => s.subject === subjectName);
    if (!sa) return '-';
    return sa.average;
  };

  const avgColor = (avg) => {
    if (avg === '-') return '#98a2b3';
    if (avg >= 16) return '#10b981';
    if (avg >= 14) return '#3b82f6';
    if (avg >= 10) return '#f59e0b';
    return '#ef4444';
  };

  const appreciationBadge = (appreciation, avg) => {
    const cls = avg >= 14 ? 'badge-success' : avg >= 10 ? 'badge-warning' : 'badge-danger';
    return <span className={`badge ${cls}`}>{appreciation}</span>;
  };

  const classeName = classes.find(c => String(c.id) === String(selectedClasse))?.name || '';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Bulletins</h2>
          <p>Résultats et moyennes par élève</p>
        </div>
      </div>

      <div className="filters-bar">
        <select
          className="form-control"
          style={{ width: 240 }}
          value={selectedClasse}
          onChange={e => setSelectedClasse(e.target.value)}
        >
          <option value="">Sélectionner une classe</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedClasse && rankings.length > 0 && (
          <button className="btn btn-primary" onClick={downloadBulletinsClasse}>
            <FiDownload size={15} /> Télécharger tous les bulletins (ZIP)
          </button>
        )}
      </div>

      {!selectedClasse ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 60, color: '#98a2b3' }}>
            <FiFileText size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Sélectionnez une classe pour afficher les bulletins</p>
          </div>
        </div>
      ) : loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : rankings.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 60, color: '#98a2b3' }}>
            <p>Aucune note saisie pour cette classe.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Tableau récapitulatif */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiAward size={18} />
              <h3>Classement — {classeName} — {rankings.length} élèves</h3>
            </div>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 50 }}>Rang</th>
                    <th style={{ minWidth: 160 }}>Nom & Prénom</th>
                    {subjects.map(s => (
                      <th key={s} style={{ minWidth: 90, textAlign: 'center' }}>{s}</th>
                    ))}
                    <th style={{ minWidth: 110, textAlign: 'center' }}>Moy. Générale</th>
                    <th style={{ minWidth: 110 }}>Appréciation</th>
                    <th style={{ minWidth: 90 }}>Bulletin</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map(r => (
                    <React.Fragment key={r.student_id}>
                      <tr
                        style={{ cursor: 'pointer', background: expandedStudent === r.student_id ? '#f0f4ff' : undefined }}
                        onClick={() => setExpandedStudent(expandedStudent === r.student_id ? null : r.student_id)}
                      >
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: '50%', fontWeight: 800, fontSize: '0.85rem',
                            background: r.rank <= 3 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#f2f4f7',
                            color: r.rank <= 3 ? 'white' : '#344054',
                          }}>
                            {r.rank}
                          </span>
                        </td>
                        <td><strong>{r.student_name}</strong></td>
                        {subjects.map(s => {
                          const val = getSubjectAvg(r, s);
                          return (
                            <td key={s} style={{ textAlign: 'center', fontWeight: 600, color: avgColor(val) }}>
                              {val !== '-' ? `${val}/20` : '-'}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: avgColor(r.general_average) }}>
                            {r.general_average}/20
                          </span>
                        </td>
                        <td>{appreciationBadge(r.appreciation, r.general_average)}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={e => downloadBulletin(r.student_id, r.student_name, e)}
                            title="Télécharger le bulletin PDF"
                          >
                            <FiDownload size={14} /> PDF
                          </button>
                        </td>
                      </tr>

                      {/* Détail bulletin élève (ligne expandable) */}
                      {expandedStudent === r.student_id && (
                        <tr>
                          <td colSpan={subjects.length + 5} style={{ padding: 0 }}>
                            <div style={{
                              background: '#f8faff', borderLeft: '4px solid #3b5beb',
                              padding: '16px 24px', margin: '0 8px 8px'
                            }}>
                              <div style={{ fontWeight: 700, marginBottom: 12, color: '#344054' }}>
                                Bulletin détaillé — {r.student_name}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                {r.subject_averages && r.subject_averages.map(sa => (
                                  <div key={sa.subject} style={{
                                    background: 'white', borderRadius: 8, padding: '10px 14px',
                                    border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                  }}>
                                    <div>
                                      <div style={{ fontSize: '0.82rem', color: '#667085' }}>{sa.subject}</div>
                                      <div style={{ fontSize: '0.75rem', color: '#98a2b3' }}>Coeff. {sa.coefficient}</div>
                                    </div>
                                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: avgColor(sa.average) }}>
                                      {sa.average}/20
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ marginTop: 14, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div>
                                  <span style={{ color: '#667085', fontSize: '0.85rem' }}>Moyenne générale : </span>
                                  <strong style={{ color: avgColor(r.general_average), fontSize: '1.05rem' }}>
                                    {r.general_average}/20
                                  </strong>
                                </div>
                                <div>
                                  <span style={{ color: '#667085', fontSize: '0.85rem' }}>Rang : </span>
                                  <strong>{r.rank}/{rankings.length}</strong>
                                </div>
                                <div>
                                  <span style={{ color: '#667085', fontSize: '0.85rem' }}>Appréciation : </span>
                                  {appreciationBadge(r.appreciation, r.general_average)}
                                </div>
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={e => downloadBulletin(r.student_id, r.student_name, e)}
                                >
                                  <FiDownload size={14} /> Télécharger PDF
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Bulletins;
