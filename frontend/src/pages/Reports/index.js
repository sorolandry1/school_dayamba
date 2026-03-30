import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { downloadFile } from '../../utils/downloadPdf';
import {
  FiDownload, FiBarChart2, FiAward,
  FiDollarSign, FiClock, FiFileText, FiFilter
} from 'react-icons/fi';

const TABS = [
  { key: 'performance', label: 'Performance', icon: <FiAward size={15} /> },
  { key: 'absences', label: 'Absences', icon: <FiClock size={15} /> },
  { key: 'payments', label: 'Comptabilité', icon: <FiDollarSign size={15} /> },
  { key: 'bulletins', label: 'Bulletins', icon: <FiFileText size={15} /> },
];

function avgColor(avg) {
  if (avg >= 16) return '#10b981';
  if (avg >= 14) return '#3b82f6';
  if (avg >= 10) return '#f59e0b';
  return '#ef4444';
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      flex: 1, minWidth: 140, padding: '16px 20px',
      background: '#fff', borderRadius: 12,
      border: '1px solid #e2e8f0', textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: color || '#1a1a2e' }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#667085', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#98a2b3', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Tab: Performance ────────────────────────────────────────────────────────

function PerformanceTab({ classes }) {
  const [selectedClasse, setSelectedClasse] = useState('');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!selectedClasse) return;
    setLoading(true);
    api.get(`/grades/ranking/?classe_id=${selectedClasse}`)
      .then(r => setRankings(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedClasse]);

  const downloadExcel = () => {
    downloadFile(
      `/reports/export/?type=rankings&classe_id=${selectedClasse}`,
      `classement_${selectedClasse}.xlsx`
    );
  };

  const classAvg = rankings.length
    ? (rankings.reduce((s, r) => s + r.general_average, 0) / rankings.length).toFixed(2)
    : 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select className="form-control" style={{ width: 240 }}
          value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
          <option value="">Sélectionner une classe</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedClasse && rankings.length > 0 && (
          <button className="btn btn-secondary" onClick={downloadExcel}>
            <FiDownload size={14} /> Exporter Excel
          </button>
        )}
      </div>

      {!selectedClasse ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60, color: '#98a2b3' }}>
            <FiBarChart2 size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Sélectionnez une classe pour voir le classement</p>
          </div>
        </div>
      ) : loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <>
          {rankings.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <StatCard label="Élèves" value={rankings.length} color="#3b5beb" />
              <StatCard label="Moyenne de classe" value={`${classAvg}/20`} color={avgColor(Number(classAvg))} />
              <StatCard label="Meilleure moyenne" value={`${rankings[0]?.general_average}/20`} color="#10b981" />
              <StatCard label="Élèves ≥ 10" value={rankings.filter(r => r.general_average >= 10).length}
                sub={`/ ${rankings.length}`} color="#f59e0b" />
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h3><FiAward size={16} style={{ marginRight: 8 }} />Classement — {rankings.length} élèves</h3>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Rang</th>
                    <th>Élève</th>
                    <th>Moyenne</th>
                    <th>Appréciation</th>
                    <th style={{ width: 80 }}>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#98a2b3' }}>
                      Aucune note saisie pour cette classe
                    </td></tr>
                  ) : rankings.map(r => (
                    <React.Fragment key={r.student_id}>
                      <tr>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: '50%', fontWeight: 800, fontSize: '0.85rem',
                            background: r.rank <= 3 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#f2f4f7',
                            color: r.rank <= 3 ? 'white' : '#344054',
                          }}>{r.rank}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                        <td>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: avgColor(r.general_average) }}>
                            {r.general_average}/20
                          </span>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                            background: r.general_average >= 14 ? '#dcfce7' : r.general_average >= 10 ? '#fef9c3' : '#fee2e2',
                            color: r.general_average >= 14 ? '#166534' : r.general_average >= 10 ? '#854d0e' : '#991b1b',
                          }}>{r.appreciation}</span>
                        </td>
                        <td>
                          <button className="btn btn-sm btn-secondary"
                            onClick={() => setExpanded(expanded === r.student_id ? null : r.student_id)}>
                            {expanded === r.student_id ? '▲' : '▼'}
                          </button>
                        </td>
                      </tr>
                      {expanded === r.student_id && r.subject_averages?.length > 0 && (
                        <tr>
                          <td colSpan={5} style={{ background: '#f8faff', padding: '12px 24px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {r.subject_averages.map(sa => (
                                <div key={sa.subject} style={{
                                  padding: '6px 14px', borderRadius: 8,
                                  background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.82rem',
                                }}>
                                  <span style={{ color: '#667085' }}>{sa.subject}: </span>
                                  <span style={{ fontWeight: 700, color: avgColor(sa.average) }}>{sa.average}/20</span>
                                  <span style={{ color: '#98a2b3', fontSize: '0.75rem' }}> (×{sa.coefficient})</span>
                                </div>
                              ))}
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

// ─── Tab: Absences ────────────────────────────────────────────────────────────

function AbsencesTab({ classes }) {
  const [selectedClasse, setSelectedClasse] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = () => {
    setLoading(true);
    const params = {};
    if (selectedClasse) params.classe_id = selectedClasse;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    api.get('/reports/attendance/', { params })
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const downloadExcel = () => {
    const p = new URLSearchParams({ type: 'absences' });
    if (selectedClasse) p.set('classe_id', selectedClasse);
    downloadFile(`/reports/export/?${p.toString()}`, 'absences.xlsx');
  };

  const students = data?.students || [];
  const global = data?.global || {};

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, minWidth: 200 }}>
            <label style={{ fontSize: '0.82rem', color: '#667085', marginBottom: 4, display: 'block' }}>Classe</label>
            <select className="form-control" value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
              <option value="">Toutes les classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.82rem', color: '#667085', marginBottom: 4, display: 'block' }}>Du</label>
            <input type="date" className="form-control" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.82rem', color: '#667085', marginBottom: 4, display: 'block' }}>Au</label>
            <input type="date" className="form-control" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={fetchReport}>
            <FiFilter size={14} /> Filtrer
          </button>
          {data && (
            <button className="btn btn-secondary" onClick={downloadExcel}>
              <FiDownload size={14} /> Excel
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : data ? (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard label="Total enregistrements" value={global.total || 0} color="#3b5beb" />
            <StatCard label="Présents" value={global.present || 0} color="#10b981" />
            <StatCard label="Retards" value={global.late || 0} color="#f59e0b" />
            <StatCard label="Absents" value={global.absent || 0} color="#ef4444" />
          </div>

          <div className="card">
            <div className="card-header">
              <h3><FiClock size={16} style={{ marginRight: 8 }} />Récapitulatif par élève ({students.length})</h3>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Classe</th>
                    <th>Jours enregistrés</th>
                    <th>Présents</th>
                    <th>Retards</th>
                    <th>Absents</th>
                    <th>Heures d'absence</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#98a2b3' }}>
                      Aucune donnée pour ces critères
                    </td></tr>
                  ) : students.map(s => (
                    <tr key={s.student_id}>
                      <td style={{ fontWeight: 600 }}>{s.student_name}</td>
                      <td>{s.classe}</td>
                      <td style={{ textAlign: 'center' }}>{s.total_days}</td>
                      <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{s.present}</td>
                      <td style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 600 }}>{s.late}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 10px', borderRadius: 12, fontSize: '0.82rem', fontWeight: 700,
                          background: s.absent > 0 ? '#fee2e2' : '#dcfce7',
                          color: s.absent > 0 ? '#991b1b' : '#166534',
                        }}>{s.absent}</span>
                      </td>
                      <td style={{ textAlign: 'center', color: s.hours_absent > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                        {s.hours_absent}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60, color: '#98a2b3' }}>
            <FiClock size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Cliquez sur "Filtrer" pour afficher le rapport d'absences</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Paiements ────────────────────────────────────────────────────────────

function PaymentsTab({ classes }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClasse, setSelectedClasse] = useState('');

  const fetchData = (classeId) => {
    setLoading(true);
    const params = classeId ? { classe_id: classeId } : {};
    api.get('/reports/payments/', { params })
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(selectedClasse); }, [selectedClasse]);

  const downloadExcel = () => {
    const p = new URLSearchParams({ type: 'payments' });
    if (selectedClasse) p.set('classe_id', selectedClasse);
    downloadFile(`/reports/export/?${p.toString()}`, 'paiements.xlsx');
  };

  const totalCollected = data.reduce((s, r) => s + r.total_collected, 0);
  const totalPending = data.reduce((s, r) => s + r.total_pending, 0);
  const totalOverdue = data.reduce((s, r) => s + r.total_overdue, 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-control" style={{ width: 240 }}
          value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={downloadExcel}>
          <FiDownload size={14} /> Exporter Excel
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Montant collecté" value={`${totalCollected.toLocaleString()} F`} color="#10b981" />
        <StatCard label="En attente" value={`${totalPending.toLocaleString()} F`} color="#f59e0b" />
        <StatCard label="En retard" value={`${totalOverdue.toLocaleString()} F`} color="#ef4444" />
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3><FiDollarSign size={16} style={{ marginRight: 8 }} />Taux de paiement par classe</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Classe</th>
                  <th>Élèves</th>
                  <th>Payés</th>
                  <th>En attente</th>
                  <th>En retard</th>
                  <th>Taux</th>
                  <th>Collecté (FCFA)</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#98a2b3' }}>
                    Aucune donnée disponible
                  </td></tr>
                ) : data.map(r => (
                  <tr key={r.classe_id}>
                    <td style={{ fontWeight: 700 }}>{r.classe_name}</td>
                    <td style={{ textAlign: 'center' }}>{r.total_students}</td>
                    <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{r.paid_count}</td>
                    <td style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 600 }}>{r.pending_count}</td>
                    <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>{r.overdue_count}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 4, width: `${r.rate}%`,
                            background: r.rate >= 80 ? '#10b981' : r.rate >= 50 ? '#f59e0b' : '#ef4444',
                          }} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', minWidth: 42 }}>{r.rate}%</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: '#166534' }}>
                      {r.total_collected.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Bulletins ────────────────────────────────────────────────────────────

function BulletinsTab({ classes }) {
  const [selectedClasse, setSelectedClasse] = useState('');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    if (!selectedClasse) { setRankings([]); return; }
    setLoading(true);
    api.get(`/grades/ranking/?classe_id=${selectedClasse}`)
      .then(r => setRankings(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedClasse]);

  const downloadBulletin = async (studentId, name) => {
    setDownloading(studentId);
    try {
      await downloadFile(`/reports/bulletin/${studentId}/`, `bulletin_${name}.pdf`);
    } finally {
      setDownloading(null);
    }
  };

  const downloadAll = () => {
    const name = classes.find(c => String(c.id) === String(selectedClasse))?.name || selectedClasse;
    downloadFile(`/reports/bulletin/classe/${selectedClasse}/`, `bulletins_${name}.zip`);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-control" style={{ width: 240 }}
          value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
          <option value="">Sélectionner une classe</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedClasse && rankings.length > 0 && (
          <button className="btn btn-primary" onClick={downloadAll}>
            <FiDownload size={14} /> Tous les bulletins (ZIP)
          </button>
        )}
      </div>

      {!selectedClasse ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60, color: '#98a2b3' }}>
            <FiFileText size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Sélectionnez une classe pour générer les bulletins</p>
          </div>
        </div>
      ) : loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3><FiFileText size={16} style={{ marginRight: 8 }} />Bulletins — {rankings.length} élèves</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Rang</th>
                  <th>Élève</th>
                  <th>Moyenne</th>
                  <th>Appréciation</th>
                  <th>Bulletin PDF</th>
                </tr>
              </thead>
              <tbody>
                {rankings.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>
                    Aucune note saisie — impossible de générer les bulletins
                  </td></tr>
                ) : rankings.map(r => (
                  <tr key={r.student_id}>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, borderRadius: '50%', fontWeight: 800, fontSize: '0.85rem',
                        background: r.rank <= 3 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#f2f4f7',
                        color: r.rank <= 3 ? 'white' : '#344054',
                      }}>{r.rank}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                    <td>
                      <span style={{ fontWeight: 800, color: avgColor(r.general_average) }}>
                        {r.general_average}/20
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                        background: r.general_average >= 14 ? '#dcfce7' : r.general_average >= 10 ? '#fef9c3' : '#fee2e2',
                        color: r.general_average >= 14 ? '#166534' : r.general_average >= 10 ? '#854d0e' : '#991b1b',
                      }}>{r.appreciation}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        disabled={downloading === r.student_id}
                        onClick={() => downloadBulletin(r.student_id, r.student_name)}
                      >
                        <FiDownload size={14} />
                        {downloading === r.student_id ? ' ...' : ' PDF'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

function Reports() {
  const [activeTab, setActiveTab] = useState('performance');
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    api.get('/classes/').then(r => setClasses(r.data.results || r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Rapports & Statistiques</h2>
          <p>Performance, absences, paiements et génération de bulletins</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: '#f2f4f7', borderRadius: 12, padding: 4,
        width: 'fit-content',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.88rem', transition: 'all 0.15s',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#3b5beb' : '#667085',
              boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'performance' && <PerformanceTab classes={classes} />}
      {activeTab === 'absences' && <AbsencesTab classes={classes} />}
      {activeTab === 'payments' && <PaymentsTab classes={classes} />}
      {activeTab === 'bulletins' && <BulletinsTab classes={classes} />}
    </div>
  );
}

export default Reports;
