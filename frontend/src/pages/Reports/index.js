import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiDownload, FiBarChart2, FiAward } from 'react-icons/fi';

function Reports() {
  const [classes, setClasses] = useState([]);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/classes/current_year/').then(r => setClasses(r.data.results || r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClasse) return;
    setLoading(true);
    api.get(`/grades/ranking/?classe_id=${selectedClasse}`)
      .then(r => setRankings(r.data.results || r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedClasse]);

  const downloadBulletin = (studentId) => {
    const token = localStorage.getItem('access_token');
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
    window.open(`${baseUrl}/reports/bulletin/${studentId}/?token=${token}`, '_blank');
  };

  const avgColor = (avg) => {
    if (avg >= 16) return '#10b981';
    if (avg >= 14) return '#3b82f6';
    if (avg >= 10) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Rapports & Statistiques</h2>
          <p>Classements, moyennes et bulletins PDF</p>
        </div>
      </div>

      <div className="filters-bar">
        <select className="form-control" style={{ width: 240 }}
          value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
          <option value="">Sélectionner une classe</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!selectedClasse ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60, color: '#98a2b3' }}>
            <FiBarChart2 size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Sélectionnez une classe pour voir le classement et générer les bulletins</p>
          </div>
        </div>
      ) : loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3><FiAward size={18} style={{ marginRight: 8 }} />Classement général — {rankings.length} élèves</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Rang</th>
                  <th>Élève</th>
                  <th>Moyenne Générale</th>
                  <th>Appréciation</th>
                  <th>Bulletin</th>
                </tr>
              </thead>
              <tbody>
                {rankings.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>Aucune donnée — Saisissez d'abord des notes</td></tr>
                ) : rankings.map(r => (
                  <tr key={r.student_id}>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, borderRadius: '50%', fontWeight: 800,
                        fontSize: '0.85rem',
                        background: r.rank <= 3 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#f2f4f7',
                        color: r.rank <= 3 ? 'white' : '#344054',
                      }}>
                        {r.rank}
                      </span>
                    </td>
                    <td><strong>{r.student_name}</strong></td>
                    <td>
                      <span style={{
                        fontWeight: 800, fontSize: '1.1rem',
                        color: avgColor(r.general_average)
                      }}>
                        {r.general_average}/20
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        r.general_average >= 14 ? 'badge-success' :
                        r.general_average >= 10 ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {r.appreciation}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => downloadBulletin(r.student_id)}>
                        <FiDownload size={14} /> PDF
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

export default Reports;
