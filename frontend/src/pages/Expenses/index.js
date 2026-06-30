import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiDollarSign, FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiTrendingDown } from 'react-icons/fi';

const CATEGORIES = [
  { value: 'SALAIRES', label: 'Salaires & Charges' },
  { value: 'FOURNITURES', label: 'Fournitures scolaires' },
  { value: 'MAINTENANCE', label: 'Entretien & Maintenance' },
  { value: 'SERVICES', label: 'Services & Abonnements' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'EVENEMENTS', label: 'Événements & Sorties' },
  { value: 'AUTRE', label: 'Autre' },
];

const CAT_COLORS = {
  SALAIRES: '#6366f1',
  FOURNITURES: '#3b82f6',
  MAINTENANCE: '#f59e0b',
  SERVICES: '#8b5cf6',
  TRANSPORT: '#14b8a6',
  EVENEMENTS: '#ec4899',
  AUTRE: '#94a3b8',
};

const EMPTY_FORM = {
  label: '',
  category: 'AUTRE',
  amount: '',
  method: 'CAISSE',
  date: new Date().toISOString().slice(0, 10),
  description: '',
};

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('');

  const fetchAll = () => {
    setLoading(true);
    const params = filterCat ? { category: filterCat } : {};
    Promise.all([
      api.get('/payments/expenses/', { params }),
      api.get('/payments/expenses/stats/'),
    ]).then(([expRes, statsRes]) => {
      setExpenses(expRes.data.results || expRes.data);
      setStats(statsRes.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [filterCat]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModal('form');
  };

  const openEdit = (exp) => {
    setForm({
      label: exp.label,
      category: exp.category,
      amount: exp.amount,
      method: exp.method || 'CAISSE',
      date: exp.date,
      description: exp.description,
    });
    setEditId(exp.id);
    setModal('form');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.patch(`/payments/expenses/${editId}/`, form);
      } else {
        await api.post('/payments/expenses/', form);
      }
      setModal(null);
      fetchAll();
    } catch (err) {
      alert('Erreur: ' + JSON.stringify(err.response?.data));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette dépense ?')) return;
    await api.delete(`/payments/expenses/${id}/`);
    fetchAll();
  };

  const totalExpenses = stats?.total || 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Gestion des Dépenses</h2>
          <p>Suivi des sorties financières de l'établissement</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <FiPlus size={15} /> Nouvelle dépense
        </button>
      </div>

      {/* Summary by category */}
      {stats?.by_category?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3><FiTrendingDown size={16} style={{ marginRight: 8 }} />
              Dépenses totales: <span style={{ color: '#ef4444' }}>{totalExpenses.toLocaleString()} FCFA</span>
            </h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {stats.by_category.map(cat => (
                <div key={cat.category} style={{
                  flex: '1 1 160px', padding: '14px 18px', borderRadius: 10,
                  background: `${CAT_COLORS[cat.category] || '#94a3b8'}15`,
                  border: `1px solid ${CAT_COLORS[cat.category] || '#94a3b8'}30`,
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#667085', marginBottom: 4 }}>{cat.category_label}</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: CAT_COLORS[cat.category] || '#344054' }}>
                    {Number(cat.total).toLocaleString()} F
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#98a2b3', marginTop: 2 }}>{cat.count} entrée(s)</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <select className="form-control" style={{ maxWidth: 260 }}
            value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <h3><FiDollarSign size={16} style={{ marginRight: 8 }} />Dépenses ({expenses.length})</h3>
        </div>
        {loading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Libellé</th>
                  <th>Catégorie</th>
                  <th>Montant (FCFA)</th>
                  <th>Description</th>
                  <th style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#98a2b3' }}>
                    Aucune dépense enregistrée
                  </td></tr>
                ) : expenses.map(exp => (
                  <tr key={exp.id}>
                    <td style={{ color: '#667085', fontSize: '0.85rem' }}>{exp.date}</td>
                    <td style={{ fontWeight: 600 }}>{exp.label}</td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                        background: `${CAT_COLORS[exp.category] || '#94a3b8'}20`,
                        color: CAT_COLORS[exp.category] || '#344054',
                      }}>
                        {exp.category_label}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#ef4444' }}>
                      {Number(exp.amount).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#667085', maxWidth: 240 }}>
                      {exp.description || '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-icon" onClick={() => openEdit(exp)}>
                          <FiEdit2 size={15} />
                        </button>
                        <button className="btn-icon" style={{ color: '#ef4444' }} onClick={() => handleDelete(exp.id)}>
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal === 'form' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{editId ? 'Modifier la dépense' : 'Nouvelle dépense'}</h3>
              <button className="btn-icon" onClick={() => setModal(null)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Libellé *</label>
                  <input className="form-control" required value={form.label}
                    onChange={e => setForm({ ...form, label: e.target.value })}
                    placeholder="Ex: Achat fournitures bureau" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Catégorie *</label>
                    <select className="form-control" value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date *</label>
                    <input type="date" className="form-control" required value={form.date}
                      onChange={e => setForm({ ...form, date: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Montant (FCFA) *</label>
                    <input type="number" className="form-control" required min={0} step={100}
                      value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })}
                      placeholder="Ex: 50000" />
                  </div>
                  <div className="form-group">
                    <label>Payé par</label>
                    <select className="form-control" value={form.method}
                      onChange={e => setForm({ ...form, method: e.target.value })}>
                      <option value="CAISSE">Caisse (espèces)</option>
                      <option value="BANQUE">Banque</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea className="form-control" rows={2} value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Détails supplémentaires..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <FiSave size={14} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Expenses;
