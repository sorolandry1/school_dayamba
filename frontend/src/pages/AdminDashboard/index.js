import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiUsers, FiBookOpen, FiDollarSign, FiCheckCircle, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [dashRes, studRes, payRes] = await Promise.all([
        api.get('/reports/dashboard/').catch(() => ({ data: {} })),
        api.get('/students/stats/').catch(() => ({ data: {} })),
        api.get('/payments/stats/').catch(() => ({ data: {} })),
      ]);
      setStats({
        dashboard: dashRes.data,
        students: studRes.data,
        payments: payRes.data,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Chargement du tableau de bord...</p></div>;

  const d = stats?.dashboard || {};
  const s = stats?.students || {};
  const p = stats?.payments || {};

  const paymentChart = [
    { name: 'Payé', value: p.count_paid || 0 },
    { name: 'En attente', value: p.count_pending || 0 },
    { name: 'En retard', value: p.count_overdue || 0 },
  ];
  const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  const attendanceData = [
    { name: 'Présents', count: d.attendance_today?.present_today || 0 },
    { name: 'Retards', count: d.attendance_today?.late_today || 0 },
    { name: 'Absents', count: d.attendance_today?.absent_today || 0 },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Tableau de Bord</h2>
          <p>Vue d'ensemble de l'établissement</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><FiUsers /></div>
          <div className="stat-info">
            <h4>Élèves</h4>
            <div className="stat-value">{d.total_students || s.total || 0}</div>
            <div className="stat-change">{s.by_gender?.male || 0} garçons · {s.by_gender?.female || 0} filles</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><FiBookOpen /></div>
          <div className="stat-info">
            <h4>Professeurs</h4>
            <div className="stat-value">{d.total_teachers || 0}</div>
            <div className="stat-change">{d.total_classes || 0} classes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><FiDollarSign /></div>
          <div className="stat-info">
            <h4>Recouvrements</h4>
            <div className="stat-value">{Number(p.total_collected || 0).toLocaleString()}</div>
            <div className="stat-change">FCFA collectés</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><FiAlertTriangle /></div>
          <div className="stat-info">
            <h4>Impayés</h4>
            <div className="stat-value">{Number(p.total_overdue || 0).toLocaleString()}</div>
            <div className="stat-change">FCFA en retard</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 8 }}>
        <div className="card">
          <div className="card-header"><h3>Présences du jour</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f7" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {attendanceData.map((_, i) => (
                    <Cell key={i} fill={['#3b5beb', '#f59e0b', '#ef4444'][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Statut des Paiements</h3></div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={paymentChart} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {paymentChart.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3>Résumé rapide</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            <div style={{ textAlign: 'center', padding: 20 }}>
              <FiCheckCircle size={32} color="#10b981" />
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8 }}>{d.attendance_today?.present_today || 0}</div>
              <div style={{ color: '#667085', fontSize: '0.85rem' }}>Présents aujourd'hui</div>
            </div>
            <div style={{ textAlign: 'center', padding: 20 }}>
              <FiClock size={32} color="#f59e0b" />
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8 }}>{d.attendance_today?.late_today || 0}</div>
              <div style={{ color: '#667085', fontSize: '0.85rem' }}>En retard</div>
            </div>
            <div style={{ textAlign: 'center', padding: 20 }}>
              <FiAlertTriangle size={32} color="#ef4444" />
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8 }}>{p.count_overdue || 0}</div>
              <div style={{ color: '#667085', fontSize: '0.85rem' }}>Paiements en retard</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
