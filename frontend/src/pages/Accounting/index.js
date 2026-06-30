import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { downloadFile } from '../../utils/downloadPdf';
import {
  FiTrendingUp, FiTrendingDown, FiDollarSign, FiDownload,
  FiCreditCard, FiHome, FiBriefcase,
} from 'react-icons/fi';

const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;

function Line({ label, value, bold, color }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '10px 0',
      borderBottom: '1px solid #f1f5f9', fontWeight: bold ? 800 : 500,
    }}>
      <span style={{ color: '#344054' }}>{label}</span>
      <span style={{ color: color || '#101828' }}>{fcfa(value)}</span>
    </div>
  );
}

function Accounting() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/accounting/').then(r => setData(r.data)).catch(() => setData({})).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  const d = data || {};
  const cr = d.compte_resultat || {};
  const caisse = d.caisse || {};
  const banque = d.banque || {};
  const bilan = d.bilan || {};
  const resultPos = (cr.resultat || 0) >= 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Comptabilité avancée</h2>
          <p>Compte de résultat, caisse, banque et bilan</p>
        </div>
        <button className="btn btn-primary" onClick={() => downloadFile('/reports/accounting/export/', 'comptabilite.xlsx')}>
          <FiDownload size={15} /> Export comptable (Excel)
        </button>
      </div>

      {/* Cartes synthèse */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#10b981' }}><FiHome /></div>
          <div className="stat-info"><h4>Solde Caisse</h4><div className="stat-value" style={{ fontSize: '1.1rem' }}>{fcfa(caisse.solde)}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}><FiBriefcase /></div>
          <div className="stat-info"><h4>Solde Banque</h4><div className="stat-value" style={{ fontSize: '1.1rem' }}>{fcfa(banque.solde)}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}><FiDollarSign /></div>
          <div className="stat-info"><h4>Trésorerie</h4><div className="stat-value" style={{ fontSize: '1.1rem' }}>{fcfa(bilan.tresorerie)}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: resultPos ? '#dcfce7' : '#fee2e2', color: resultPos ? '#059669' : '#dc2626' }}>
            {resultPos ? <FiTrendingUp /> : <FiTrendingDown />}
          </div>
          <div className="stat-info"><h4>Résultat</h4>
            <div className="stat-value" style={{ fontSize: '1.1rem', color: resultPos ? '#059669' : '#dc2626' }}>{fcfa(cr.resultat)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Compte de résultat */}
        <div className="card">
          <div className="card-header"><h3>Compte de résultat</h3></div>
          <div className="card-body">
            <Line label="Produits (recettes encaissées)" value={cr.produits} color="#10b981" />
            <Line label="Charges (dépenses)" value={cr.charges} color="#ef4444" />
            <Line label={resultPos ? 'Résultat (excédent)' : 'Résultat (déficit)'} value={cr.resultat} bold color={resultPos ? '#059669' : '#dc2626'} />
          </div>
        </div>

        {/* Bilan simplifié */}
        <div className="card">
          <div className="card-header"><h3>Bilan (simplifié)</h3></div>
          <div className="card-body">
            <Line label="Trésorerie (caisse + banque)" value={bilan.tresorerie} />
            <Line label="Créances (frais à recevoir)" value={bilan.creances} color="#f59e0b" />
            <Line label="Total actif" value={bilan.total_actif} bold color="#1d4ed8" />
          </div>
        </div>

        {/* Caisse */}
        <div className="card">
          <div className="card-header"><h3><FiHome size={15} style={{ marginRight: 6 }} />Caisse</h3></div>
          <div className="card-body">
            <Line label="Entrées" value={caisse.recettes} color="#10b981" />
            <Line label="Sorties" value={caisse.depenses} color="#ef4444" />
            <Line label="Solde caisse" value={caisse.solde} bold />
          </div>
        </div>

        {/* Banque */}
        <div className="card">
          <div className="card-header"><h3><FiBriefcase size={15} style={{ marginRight: 6 }} />Banque</h3></div>
          <div className="card-body">
            <Line label="Entrées" value={banque.recettes} color="#10b981" />
            <Line label="Sorties" value={banque.depenses} color="#ef4444" />
            <Line label="Solde banque" value={banque.solde} bold />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Accounting;
