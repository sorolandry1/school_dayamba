import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  FiDollarSign, FiTrendingUp, FiTrendingDown, FiClock, FiAlertCircle,
  FiArrowRight, FiCreditCard,
} from 'react-icons/fi';

const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;

function CaisseDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pay, setPay] = useState(null);
  const [expTotal, setExpTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/payments/stats/').then(r => r.data).catch(() => null),
      api.get('/payments/expenses/stats/').then(r => r.data?.total || 0).catch(() => 0),
    ]).then(([p, e]) => {
      setPay(p);
      setExpTotal(e);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  const collected = pay?.total_collected || 0;
  const pending = pay?.total_pending || 0;
  const overdue = pay?.total_overdue || 0;
  const net = collected - expTotal;

  const cards = [
    { label: 'Total encaissé', value: fmt(collected), icon: <FiTrendingUp />, color: '#10b981' },
    { label: 'Sorties (dépenses)', value: fmt(expTotal), icon: <FiTrendingDown />, color: '#ef4444' },
    { label: 'Solde net', value: fmt(net), icon: <FiDollarSign />, color: net >= 0 ? '#3b5beb' : '#ef4444' },
    { label: 'En attente', value: fmt(pending), icon: <FiClock />, color: '#f59e0b' },
    { label: 'En retard', value: fmt(overdue), icon: <FiAlertCircle />, color: '#b45309' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Espace Caisse</h2>
          <p>Bonjour {user?.first_name} — encaissements, reçus et contrôle des entrées / sorties.</p>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {cards.map((c, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: c.color + '20', color: c.color }}>{c.icon}</div>
            <div className="stat-info">
              <h4>{c.label}</h4>
              <div className="stat-value" style={{ fontSize: '1.15rem' }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {[
          { to: '/payments', icon: <FiCreditCard />, title: 'Paiements & reçus', desc: 'Encaisser les frais, vérifier les montants, émettre les reçus.', color: '#10b981' },
          { to: '/expenses', icon: <FiTrendingDown />, title: 'Dépenses', desc: 'Enregistrer et suivre les sorties d\'argent.', color: '#ef4444' },
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

export default CaisseDashboard;
