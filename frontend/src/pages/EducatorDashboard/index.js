import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  FiUserCheck, FiClock, FiUserX, FiUsers, FiCamera, FiMessageSquare, FiArrowRight,
} from 'react-icons/fi';

function EducatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [today, setToday] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/attendance/today/');
        setToday(res.data.results || res.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const present = today.filter(a => a.status === 'PRESENT').length;
  const late = today.filter(a => a.status === 'LATE').length;
  const absent = today.filter(a => a.status === 'ABSENT').length;
  const scanned = present + late;

  const cards = [
    { label: 'Présents', value: present, icon: <FiUserCheck />, color: '#10b981' },
    { label: 'En retard', value: late, icon: <FiClock />, color: '#f59e0b' },
    { label: 'Absents', value: absent, icon: <FiUserX />, color: '#ef4444' },
    { label: 'Scannés aujourd\'hui', value: scanned, icon: <FiUsers />, color: '#3b5beb' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Espace Éducateur</h2>
          <p>Bonjour {user?.first_name} — suivi de l'assiduité, de la ponctualité et communication avec les parents.</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {cards.map((c, i) => (
            <div key={i} className="stat-card">
              <div className="stat-icon" style={{ background: c.color + '20', color: c.color }}>
                {c.icon}
              </div>
              <div className="stat-info">
                <h4>{c.label}</h4>
                <div className="stat-value">{c.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {[
          { to: '/attendance', icon: <FiCamera />, title: 'Présences & ponctualité', desc: 'Scanner, consulter et gérer les présences du jour.', color: '#3b5beb' },
          { to: '/communications', icon: <FiMessageSquare />, title: 'Communication parents', desc: 'Envoyer SMS / WhatsApp / Email aux parents.', color: '#10b981' },
          { to: '/students', icon: <FiUsers />, title: 'Élèves', desc: 'Consulter les fiches élèves et coordonnées des parents.', color: '#8b5cf6' },
        ].map((q, i) => (
          <div key={i} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(q.to)}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: q.color + '20',
                color: q.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {q.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{q.title}</div>
                <div style={{ fontSize: '0.82rem', color: '#667085' }}>{q.desc}</div>
              </div>
              <FiArrowRight color="#98a2b3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EducatorDashboard;
