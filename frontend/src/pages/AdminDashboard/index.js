import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  FiUsers, FiBookOpen, FiDollarSign, FiCheckCircle,
  FiClock, FiAlertTriangle, FiTrendingDown, FiTrendingUp,
} from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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
  const exp = d.expenses || {};

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

  const totalCollected = Number(p.total_collected || 0);
  const totalExpenses  = Number(exp.total_expenses || 0);
  const netBalance     = Number(exp.net_balance ?? (totalCollected - totalExpenses));

  const financeData = [
    { name: 'Recettes', montant: totalCollected },
    { name: 'Dépenses', montant: totalExpenses },
    { name: 'Solde net', montant: netBalance },
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
          <div className="stat-info" style={{ flex: 1, minWidth: 0 }}>
            <h4>Élèves</h4>
            <div className="stat-value">{d.total_students || s.total || 0}</div>
            {(() => {
              const total = d.total_students || s.total || 0;
              const male = s.by_gender?.male || 0;
              const female = s.by_gender?.female || 0;
              const pctMale = total > 0 ? Math.round((male / total) * 100) : 0;
              const pctFemale = total > 0 ? Math.round((female / total) * 100) : 0;
              return (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                    <span style={{ color: '#2563eb', fontWeight: 600 }}>♂ {pctMale}%</span>
                    <span style={{ color: '#be185d', fontWeight: 600 }}>♀ {pctFemale}%</span>
                  </div>
                  <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: '#fce7f3' }}>
                    <div style={{ width: `${pctMale}%`, background: '#2563eb', transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 3 }}>
                    {male} garçons · {female} filles
                  </div>
                </div>
              );
            })()}
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
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}><FiTrendingDown /></div>
          <div className="stat-info">
            <h4>Dépenses</h4>
            <div className="stat-value">{totalExpenses.toLocaleString()}</div>
            <div className="stat-change">FCFA de dépenses</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: netBalance >= 0 ? '#d1fae5' : '#fef2f2', color: netBalance >= 0 ? '#059669' : '#dc2626' }}>
            {netBalance >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
          </div>
          <div className="stat-info">
            <h4>Solde net</h4>
            <div className="stat-value" style={{ color: netBalance >= 0 ? '#059669' : '#dc2626' }}>
              {netBalance >= 0 ? '+' : ''}{netBalance.toLocaleString()}
            </div>
            <div className="stat-change">FCFA {netBalance >= 0 ? 'excédent' : 'déficit'}</div>
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

      {/* ── COMPTABILITÉ ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        <div className="card">
          <div className="card-header"><h3>Comptabilité — Vue d'ensemble</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={financeData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f7" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip formatter={v => `${Number(v).toLocaleString()} FCFA`} />
                <Bar dataKey="montant" radius={[6, 6, 0, 0]}>
                  {financeData.map((entry, i) => (
                    <Cell key={i} fill={i === 0 ? '#10b981' : i === 1 ? '#f59e0b' : (netBalance >= 0 ? '#3b5beb' : '#ef4444')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Bilan financier</h3></div>
          <div className="card-body">
            {[
              { label: 'Total recettes', value: totalCollected, color: '#10b981', icon: <FiTrendingUp size={18} /> },
              { label: 'Total dépenses', value: totalExpenses,  color: '#f59e0b', icon: <FiTrendingDown size={18} /> },
              { label: 'Solde net',      value: netBalance,     color: netBalance >= 0 ? '#3b5beb' : '#ef4444', icon: netBalance >= 0 ? <FiTrendingUp size={18} /> : <FiTrendingDown size={18} /> },
              { label: 'Paiements en attente', value: Number(p.total_pending || 0), color: '#6366f1', icon: <FiClock size={18} /> },
            ].map(row => (
              <div key={row.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ color: row.color }}>{row.icon}</div>
                  <span style={{ fontSize: '0.88rem', color: '#344054', fontWeight: 500 }}>{row.label}</span>
                </div>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: row.color }}>
                  {row.value >= 0 ? '' : '-'}{Math.abs(row.value).toLocaleString()} FCFA
                </span>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: '0.75rem', color: '#98a2b3', marginBottom: 6 }}>
                Taux de recouvrement
              </div>
              <div style={{ background: '#f1f5f9', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                {(() => {
                  const total = totalCollected + Number(p.total_pending || 0) + Number(p.total_overdue || 0);
                  const pct = total > 0 ? Math.min(100, Math.round(totalCollected / total * 100)) : 0;
                  return (
                    <div style={{ width: `${pct}%`, height: '100%', background: '#10b981', transition: 'width 0.5s', borderRadius: 999 }} />
                  );
                })()}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#667085', marginTop: 4 }}>
                {(() => {
                  const total = totalCollected + Number(p.total_pending || 0) + Number(p.total_overdue || 0);
                  return total > 0 ? `${Math.min(100, Math.round(totalCollected / total * 100))}% des frais perçus` : 'Aucune donnée';
                })()}
              </div>
            </div>
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
