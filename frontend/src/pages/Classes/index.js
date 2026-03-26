import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiChevronDown, FiChevronRight, FiUsers, FiPrinter, FiBook, FiGrid } from 'react-icons/fi';

const LEVELS_ORDER = ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'];

export default function Classes() {
  const [levels, setLevels]         = useState([]);
  const [classes, setClasses]       = useState([]);
  const [classStats, setClassStats] = useState({});  // { classeId: { average, absent_rate, ... } }
  const [students, setStudents]     = useState({});   // { classeId: [...] }
  const [openLevel, setOpenLevel]   = useState(null);
  const [openClasse, setOpenClasse] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [printing, setPrinting]     = useState(null); // studentId en cours d'impression

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [levelsRes, classesRes, statsRes] = await Promise.all([
        api.get('/classes/levels/').catch(() => ({ data: [] })),
        api.get('/classes/?page_size=100').catch(() => ({ data: { results: [], count: 0 } })),
        api.get('/reports/class_stats/').catch(() => ({ data: [] })),
      ]);
      setLevels(levelsRes.data?.results || levelsRes.data || []);
      const cls = classesRes.data?.results || classesRes.data || [];
      setClasses(cls);
      // Index class stats by classe_id
      const statsArr = statsRes.data?.results || statsRes.data || [];
      const statsMap = {};
      statsArr.forEach(s => { statsMap[s.classe_id] = s; });
      setClassStats(statsMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsForClasse = async (classeId) => {
    if (students[classeId]) return;
    try {
      const res = await api.get(`/students/class_summary/?classe_id=${classeId}`);
      setStudents(prev => ({
        ...prev,
        [classeId]: res.data || [],
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleClasse = (classeId) => {
    if (openClasse === classeId) {
      setOpenClasse(null);
    } else {
      setOpenClasse(classeId);
      fetchStudentsForClasse(classeId);
    }
  };

  const handlePrintBulletin = async (studentId, studentName) => {
    setPrinting(studentId);
    try {
      const res = await api.get(`/reports/bulletin/${studentId}/`, {
        responseType: 'blob',
      });
      const url  = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href  = url;
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

  // Grouper les classes par niveau
  const classesByLevel = (levelName) =>
    classes.filter(c => c.level_name === levelName || c.level?.name === levelName);

  // Trier les niveaux selon l'ordre scolaire
  const sortedLevels = LEVELS_ORDER.filter(l =>
    classes.some(c => c.level_name === l || c.level?.name === l)
  );

  const paymentBadge = (status) => {
    const map = { PAID: 'badge-success', PENDING: 'badge-warning', OVERDUE: 'badge-danger' };
    const labels = { PAID: 'Payé', PENDING: 'En attente', OVERDUE: 'En retard' };
    return <span className={`badge ${map[status] || 'badge-info'}`}>{labels[status] || status}</span>;
  };

  if (loading) return (
    <div className="loading-container">
      <div className="spinner" /><p>Chargement des classes...</p>
    </div>
  );

  return (
    <div>
      {/* En-tête */}
      <div className="page-header">
        <div>
          <h2>Gestion des Classes</h2>
          <p>{classes.length} classe(s) — Année scolaire 2025-2026</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            background: 'var(--primary-100)', color: 'var(--primary-800)',
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <FiGrid size={16} /> {sortedLevels.length} niveaux
          </div>
          <div style={{
            background: 'var(--success-100)', color: '#065f46',
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <FiUsers size={16} /> {Object.values(students).flat().length} élèves chargés
          </div>
        </div>
      </div>

      {/* Grille des niveaux */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sortedLevels.map(levelName => {
          const levelClasses = classesByLevel(levelName);
          const isLevelOpen  = openLevel === levelName;
          const totalStudents = levelClasses.reduce((acc, c) =>
            acc + (students[c.id]?.length ?? c.student_count ?? 0), 0
          );

          return (
            <div key={levelName} className="card" style={{ overflow: 'visible' }}>
              {/* Header Niveau */}
              <div
                className="card-header"
                onClick={() => setOpenLevel(isLevelOpen ? null : levelName)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, var(--primary-600), var(--primary-800))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0
                  }}>
                    {levelName.replace('ème', '').replace('nde', '').replace('ère', '')}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{levelName}</h3>
                    <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.82rem' }}>
                      {levelClasses.length} classe(s) &nbsp;•&nbsp;
                      <FiUsers size={12} style={{ verticalAlign: 'middle' }} /> {totalStudents} élèves
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Badges classes */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {levelClasses.map(c => (
                      <span key={c.id} style={{
                        background: 'var(--primary-100)', color: 'var(--primary-700)',
                        padding: '3px 10px', borderRadius: 999,
                        fontSize: '0.75rem', fontWeight: 600
                      }}>{c.name}</span>
                    ))}
                  </div>
                  {isLevelOpen
                    ? <FiChevronDown size={20} color="var(--gray-500)" />
                    : <FiChevronRight size={20} color="var(--gray-500)" />
                  }
                </div>
              </div>

              {/* Classes du niveau */}
              {isLevelOpen && (
                <div className="card-body" style={{ paddingTop: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {levelClasses.map(classe => {
                      const isClasseOpen   = openClasse === classe.id;
                      const classeStudents = students[classe.id] || [];
                      const cs = classStats[classe.id];

                      return (
                        <div key={classe.id} style={{
                          border: '1px solid var(--gray-200)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden'
                        }}>
                          {/* Header Classe */}
                          <div
                            onClick={() => handleToggleClasse(classe.id)}
                            style={{
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px', cursor: 'pointer',
                              background: isClasseOpen ? 'var(--primary-50)' : 'var(--gray-25)',
                              borderBottom: isClasseOpen ? '1px solid var(--gray-200)' : 'none',
                              transition: 'background 0.2s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {isClasseOpen
                                ? <FiChevronDown size={16} color="var(--primary-600)" />
                                : <FiChevronRight size={16} color="var(--gray-400)" />
                              }
                              <FiBook size={16} color="var(--primary-600)" />
                              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{classe.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ color: 'var(--gray-500)', fontSize: '0.82rem' }}>
                                <FiUsers size={13} style={{ verticalAlign: 'middle' }} />&nbsp;
                                {isClasseOpen
                                  ? classeStudents.length
                                  : (classe.student_count ?? '...')} élève(s)
                              </span>
                              {cs?.class_average != null && (
                                <span style={{
                                  fontSize: '0.78rem', fontWeight: 700,
                                  color: cs.class_average >= 10 ? '#065f46' : cs.class_average >= 7 ? '#92400e' : '#991b1b',
                                  background: cs.class_average >= 10 ? '#d1fae5' : cs.class_average >= 7 ? '#fef3c7' : '#fee2e2',
                                  padding: '3px 10px', borderRadius: 999,
                                }}>
                                  Moy. {Number(cs.class_average).toFixed(1)}/20
                                </span>
                              )}
                              {cs?.absent_rate != null && (
                                <span style={{
                                  fontSize: '0.78rem', fontWeight: 700,
                                  color: cs.absent_rate >= 20 ? '#991b1b' : cs.absent_rate >= 10 ? '#92400e' : '#065f46',
                                  background: cs.absent_rate >= 20 ? '#fee2e2' : cs.absent_rate >= 10 ? '#fef3c7' : '#d1fae5',
                                  padding: '3px 10px', borderRadius: 999,
                                }}>
                                  {Math.round(cs.absent_rate)}% absents
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Liste des élèves */}
                          {isClasseOpen && (
                            <div>
                              {classeStudents.length === 0 ? (
                                <div style={{
                                  padding: '24px', textAlign: 'center',
                                  color: 'var(--gray-400)', fontSize: '0.875rem'
                                }}>
                                  Aucun élève dans cette classe
                                </div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--gray-50)' }}>
                                      <th style={thStyle}>#</th>
                                      <th style={thStyle}>Matricule</th>
                                      <th style={thStyle}>Nom & Prénom</th>
                                      <th style={thStyle}>Genre</th>
                                      <th style={thStyle}>Contact Parent</th>
                                      <th style={{ ...thStyle, textAlign: 'center' }}>Moyenne</th>
                                      <th style={{ ...thStyle, textAlign: 'center' }}>Absences</th>
                                      <th style={thStyle}>Paiement</th>
                                      <th style={{ ...thStyle, textAlign: 'center' }}>Bulletin</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {classeStudents.map((student, idx) => (
                                      <tr
                                        key={student.id}
                                        style={{
                                          borderTop: '1px solid var(--gray-100)',
                                          background: idx % 2 === 0 ? 'white' : 'var(--gray-25)',
                                          transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'}
                                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : 'var(--gray-25)'}
                                      >
                                        <td style={tdStyle}>{idx + 1}</td>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                                          {student.matricule}
                                        </td>
                                        <td style={tdStyle}>
                                          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                                            {student.last_name} {student.first_name}
                                          </div>
                                        </td>
                                        <td style={tdStyle}>
                                          <span style={{
                                            fontSize: '0.75rem', fontWeight: 600,
                                            color: student.gender === 'M' ? 'var(--primary-600)' : '#be185d',
                                            background: student.gender === 'M' ? 'var(--primary-100)' : '#fce7f3',
                                            padding: '2px 8px', borderRadius: 999
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
                                              fontWeight: 700,
                                              fontSize: '0.88rem',
                                              color: student.average >= 10
                                                ? '#065f46'
                                                : student.average >= 7
                                                  ? '#92400e'
                                                  : '#991b1b',
                                              background: student.average >= 10
                                                ? '#d1fae5'
                                                : student.average >= 7
                                                  ? '#fef3c7'
                                                  : '#fee2e2',
                                              padding: '2px 8px',
                                              borderRadius: 999,
                                            }}>
                                              {student.average}/20
                                            </span>
                                          ) : (
                                            <span style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>—</span>
                                          )}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                          {student.absent_count > 0 ? (
                                            <span style={{
                                              fontWeight: 600,
                                              fontSize: '0.82rem',
                                              color: student.absent_count >= 5 ? '#991b1b' : '#92400e',
                                              background: student.absent_count >= 5 ? '#fee2e2' : '#fef3c7',
                                              padding: '2px 8px',
                                              borderRadius: 999,
                                            }}>
                                              {student.absent_count}j
                                            </span>
                                          ) : (
                                            <span style={{
                                              color: '#065f46', background: '#d1fae5',
                                              fontSize: '0.82rem', fontWeight: 600,
                                              padding: '2px 8px', borderRadius: 999,
                                            }}>0j</span>
                                          )}
                                        </td>
                                        <td style={tdStyle}>
                                          {paymentBadge(student.payment_status)}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                          <button
                                            onClick={() => handlePrintBulletin(
                                              student.id,
                                              `${student.last_name}_${student.first_name}`
                                            )}
                                            disabled={printing === student.id}
                                            style={{
                                              display: 'inline-flex', alignItems: 'center',
                                              gap: 6, padding: '6px 12px',
                                              background: printing === student.id
                                                ? 'var(--gray-200)'
                                                : 'var(--primary-600)',
                                              color: printing === student.id
                                                ? 'var(--gray-500)' : 'white',
                                              border: 'none', borderRadius: 'var(--radius-sm)',
                                              fontSize: '0.78rem', fontWeight: 600,
                                              cursor: printing === student.id ? 'not-allowed' : 'pointer',
                                              transition: 'all 0.2s'
                                            }}
                                          >
                                            <FiPrinter size={13} />
                                            {printing === student.id ? 'Génération...' : 'Bulletin'}
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sortedLevels.length === 0 && (
          <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>
            <FiGrid size={40} style={{ marginBottom: 12 }} />
            <p>Aucune classe disponible pour cette année scolaire.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Styles inline réutilisables
const thStyle = {
  padding: '10px 16px', textAlign: 'left',
  fontSize: '0.75rem', fontWeight: 700,
  color: 'var(--gray-500)', textTransform: 'uppercase',
  letterSpacing: '0.04em', whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '10px 16px',
  fontSize: '0.875rem',
  color: 'var(--gray-700)',
  verticalAlign: 'middle'
};