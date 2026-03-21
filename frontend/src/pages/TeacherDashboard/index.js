import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FiBookOpen, FiUsers, FiClipboard } from 'react-icons/fi';

function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/subjects/my_subjects/')
      .then(r => setSubjects(r.data.results || r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Chargement...</p></div>;

  // Group subjects by class
  const byClass = {};
  subjects.forEach(s => {
    const key = s.classe_name || 'Non assigné';
    if (!byClass[key]) byClass[key] = [];
    byClass[key].push(s);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Bienvenue, {user?.first_name} {user?.last_name}</h2>
          <p>Espace professeur — Gérez vos notes et suivez vos classes</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><FiBookOpen /></div>
          <div className="stat-info">
            <h4>Matières</h4>
            <div className="stat-value">{subjects.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><FiUsers /></div>
          <div className="stat-info">
            <h4>Classes</h4>
            <div className="stat-value">{Object.keys(byClass).length}</div>
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: 16, fontSize: '1.1rem' }}>Mes Matières & Classes</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {subjects.map(s => (
          <div key={s.id} className="card" style={{ cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => navigate(`/teacher/grades?subject_id=${s.id}&classe_id=${s.classe}&classe_name=${s.classe_name}&subject_name=${s.name}`)}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
              }}>
                <FiClipboard size={22} />
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{s.name}</h4>
                <p style={{ fontSize: '0.82rem', color: '#667085' }}>
                  {s.classe_name} · Coeff. {s.coefficient}
                </p>
              </div>
            </div>
          </div>
        ))}
        {subjects.length === 0 && (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>
              Aucune matière assignée. Contactez l'administration.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherDashboard;
