import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  FiBookOpen, FiUsers, FiClipboard, FiBook,
  FiTrendingUp, FiEdit3, FiChevronRight
} from 'react-icons/fi';

function avgColor(avg) {
  if (!avg) return '#98a2b3';
  if (avg >= 16) return '#10b981';
  if (avg >= 14) return '#3b82f6';
  if (avg >= 10) return '#f59e0b';
  return '#ef4444';
}

function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/teachers/dashboard_stats/'),
      api.get('/teachers/lesson-logs/?ordering=-date').catch(() => ({ data: [] })),
      api.get('/teachers/me/').catch(() => ({ data: {} })),
    ]).then(([statsRes, logsRes, meRes]) => {
      setStats(statsRes.data);
      const logs = logsRes.data.results || logsRes.data;
      setRecentLogs(logs.slice(0, 5));
      setMyClasses(meRes.data?.assigned_classes || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  const s = stats || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Bonjour, {user?.first_name} {user?.last_name}</h2>
          <p>Espace professeur — Vue d'ensemble de vos activités</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/teacher/lessons')}>
          <FiEdit3 size={15} /> Nouveau cours
        </button>
      </div>

      {/* Mes classes affectées */}
      {myClasses.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3><FiUsers size={15} style={{ marginRight: 8 }} />Mes classes</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {myClasses.map(c => (
              <span key={c.id} className="badge badge-info" style={{ fontSize: '0.85rem' }}>
                {c.name}{c.level_name ? ` · ${c.level_name}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon blue"><FiBookOpen /></div>
          <div className="stat-info">
            <h4>Matières</h4>
            <div className="stat-value">{s.total_subjects || 0}</div>
            <div className="stat-change">{s.total_classes || 0} classe(s)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><FiUsers /></div>
          <div className="stat-info">
            <h4>Élèves</h4>
            <div className="stat-value">{s.total_students || 0}</div>
            <div className="stat-change">dans vos classes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><FiClipboard /></div>
          <div className="stat-info">
            <h4>Notes saisies</h4>
            <div className="stat-value">{s.total_grades || 0}</div>
            <div className="stat-change">au total</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><FiBook /></div>
          <div className="stat-info">
            <h4>Cahier de texte</h4>
            <div className="stat-value">{s.lesson_count || 0}</div>
            <div className="stat-change">cours enregistrés</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Subjects list */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3><FiBookOpen size={16} style={{ marginRight: 8 }} />Mes matières</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/teacher/grades')}>
              Saisir notes
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {(s.subjects || []).length === 0 ? (
              <p style={{ textAlign: 'center', color: '#98a2b3', padding: 24 }}>
                Aucune matière assignée
              </p>
            ) : (s.subjects || []).map(sub => (
              <div
                key={sub.subject_id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 20px', borderBottom: '1px solid #f2f4f7',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(
                  `/teacher/grades?subject_id=${sub.subject_id}&subject_name=${sub.subject_name}&classe_name=${sub.classe_name}`
                )}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{sub.subject_name}</div>
                  <div style={{ fontSize: '0.78rem', color: '#667085' }}>
                    {sub.classe_name} · {sub.student_count} élèves · {sub.grade_count} notes
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {sub.average !== null && (
                    <span style={{ fontWeight: 800, color: avgColor(sub.average), fontSize: '0.95rem' }}>
                      {sub.average}/20
                    </span>
                  )}
                  <FiChevronRight size={16} color="#98a2b3" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent lesson logs */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3><FiBook size={16} style={{ marginRight: 8 }} />Derniers cours</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/teacher/lessons')}>
              Voir tout
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#98a2b3' }}>
                <FiBook size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                <p style={{ fontSize: '0.85rem' }}>
                  Aucun cours enregistré.<br />
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ marginTop: 12 }}
                    onClick={() => navigate('/teacher/lessons')}
                  >
                    <FiEdit3 size={13} /> Créer une entrée
                  </button>
                </p>
              </div>
            ) : recentLogs.map(log => (
              <div key={log.id} style={{
                padding: '12px 20px', borderBottom: '1px solid #f2f4f7',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{log.topic}</span>
                  <span style={{ fontSize: '0.78rem', color: '#98a2b3' }}>{log.date}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#667085' }}>
                  {log.subject_name} · {log.classe_name}
                  {log.progression_percent > 0 && (
                    <span style={{
                      marginLeft: 8, padding: '1px 8px', borderRadius: 10,
                      background: '#dbeafe', color: '#1d4ed8', fontSize: '0.72rem', fontWeight: 600,
                    }}>
                      {log.progression_percent}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="card-header"><h3><FiTrendingUp size={16} style={{ marginRight: 8 }} />Actions rapides</h3></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Saisir des notes', icon: <FiClipboard />, path: '/teacher/grades', color: '#3b5beb' },
              { label: 'Nouveau cours', icon: <FiEdit3 />, path: '/teacher/lessons', color: '#10b981' },
              { label: 'Mon profil', icon: <FiUsers />, path: '/teacher/profile', color: '#f59e0b' },
            ].map(action => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 20px', borderRadius: 10, border: 'none',
                  background: `${action.color}15`, color: action.color,
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem',
                  transition: 'all 0.15s',
                }}
              >
                {action.icon} {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeacherDashboard;
