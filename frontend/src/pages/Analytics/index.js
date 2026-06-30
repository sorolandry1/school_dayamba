import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';

const fcfa = (v) => `${Number(v || 0).toLocaleString('fr-FR')} FCFA`;

function ChartCard({ title, children }) {
  return (
    <div className="card">
      <div className="card-header"><h3>{title}</h3></div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={280}>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/charts/')
      .then(r => setData(r.data))
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Chargement des graphiques...</p></div>;

  const d = data || {};
  const payments = d.payments_evolution || [];
  const finance = d.finance || [];
  const absent = d.absenteeism || [];
  const success = d.success || [];
  const empty = !payments.length && !finance.length && !absent.length && !success.length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Analyses & Graphiques</h2>
          <p>Évolution des paiements, absentéisme, réussite et finances</p>
        </div>
      </div>

      {empty && (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 48, color: '#98a2b3' }}>
          Pas encore assez de données pour générer les graphiques.
        </div></div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ChartCard title="Évolution des paiements (encaissés)">
          <LineChart data={payments}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f7" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip formatter={v => fcfa(v)} />
            <Line type="monotone" dataKey="montant" name="Encaissé" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Finances — Recettes vs Dépenses">
          <BarChart data={finance}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f7" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip formatter={v => fcfa(v)} />
            <Legend />
            <Bar dataKey="recettes" name="Recettes" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="depenses" name="Dépenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Absentéisme (taux mensuel %)">
          <LineChart data={absent}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f7" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={v => `${v}%`} />
            <Legend />
            <Line type="monotone" dataKey="taux_absence" name="Absences" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="taux_retard" name="Retards" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Réussite par classe (taux ≥ 10/20 %)">
          <BarChart data={success}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f7" />
            <XAxis dataKey="classe" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
            <Tooltip formatter={(v, n) => n === 'taux_reussite' ? `${v}%` : `${v}/20`} />
            <Bar dataKey="taux_reussite" name="Taux de réussite">
              {success.map((e, i) => (
                <Cell key={i} fill={e.taux_reussite >= 50 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}

export default Analytics;
