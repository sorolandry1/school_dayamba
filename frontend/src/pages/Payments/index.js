import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiPlus, FiSearch, FiDollarSign } from 'react-icons/fi';

function Payments() {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    student: '', amount: '', payment_type: 'SCOLARITE', status: 'PAID', due_date: '', notes: ''
  });

  const fetchPayments = useCallback(async () => {
    try {
      let url = '/payments/?';
      if (search) url += `search=${search}&`;
      if (filterStatus) url += `status=${filterStatus}&`;
      const [payRes, statsRes] = await Promise.all([
        api.get(url),
        api.get('/payments/stats/'),
      ]);
      setPayments(payRes.data.results || payRes.data);
      setStats(statsRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, filterStatus]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  useEffect(() => {
    api.get('/students/?page_size=1000').then(r => setStudents(r.data.results || r.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/payments/', form);
      setShowModal(false);
      setForm({ student: '', amount: '', payment_type: 'SCOLARITE', status: 'PAID', due_date: '', notes: '' });
      fetchPayments();
    } catch (err) { alert('Erreur: ' + JSON.stringify(err.response?.data)); }
  };

  const statusBadge = (status) => {
    const map = { PAID: 'badge-success', PENDING: 'badge-warning', OVERDUE: 'badge-danger', PARTIAL: 'badge-info' };
    const labels = { PAID: 'Payé', PENDING: 'En attente', OVERDUE: 'En retard', PARTIAL: 'Partiel' };
    return <span className={`badge ${map[status] || ''}`}>{labels[status] || status}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Gestion Financière</h2>
          <p>Suivi des paiements et frais scolaires</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> Nouveau paiement
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><FiDollarSign /></div>
          <div className="stat-info">
            <h4>Total collecté</h4>
            <div className="stat-value">{Number(stats.total_collected || 0).toLocaleString()}</div>
            <div className="stat-change">FCFA</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><FiDollarSign /></div>
          <div className="stat-info">
            <h4>En attente</h4>
            <div className="stat-value">{Number(stats.total_pending || 0).toLocaleString()}</div>
            <div className="stat-change">{stats.count_pending || 0} paiements</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><FiDollarSign /></div>
          <div className="stat-info">
            <h4>En retard</h4>
            <div className="stat-value">{Number(stats.total_overdue || 0).toLocaleString()}</div>
            <div className="stat-change">{stats.count_overdue || 0} paiements</div>
          </div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-input">
          <FiSearch size={16} />
          <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tout statut</option>
          <option value="PAID">Payé</option>
          <option value="PENDING">En attente</option>
          <option value="OVERDUE">En retard</option>
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? <div className="loading-container"><div className="spinner" /></div> : (
            <table>
              <thead>
                <tr>
                  <th>N° Reçu</th>
                  <th>Élève</th>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Date</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>Aucun paiement trouvé</td></tr>
                ) : payments.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.receipt_number}</strong></td>
                    <td>{p.student_name}</td>
                    <td>{p.payment_type}</td>
                    <td style={{ fontWeight: 700 }}>{Number(p.amount).toLocaleString()} FCFA</td>
                    <td>{new Date(p.payment_date).toLocaleDateString('fr-FR')}</td>
                    <td>{statusBadge(p.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Enregistrer un paiement</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Élève</label>
                  <select className="form-control" required value={form.student}
                    onChange={e => setForm({...form, student: e.target.value})}>
                    <option value="">Sélectionner un élève</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.last_name} {s.first_name} ({s.matricule})</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Montant (FCFA)</label>
                    <input type="number" className="form-control" required value={form.amount}
                      onChange={e => setForm({...form, amount: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select className="form-control" value={form.payment_type}
                      onChange={e => setForm({...form, payment_type: e.target.value})}>
                      <option value="INSCRIPTION">Inscription</option>
                      <option value="SCOLARITE">Scolarité</option>
                      <option value="EXAMEN">Examen</option>
                      <option value="AUTRE">Autre</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Statut</label>
                    <select className="form-control" value={form.status}
                      onChange={e => setForm({...form, status: e.target.value})}>
                      <option value="PAID">Payé</option>
                      <option value="PENDING">En attente</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Échéance</label>
                    <input type="date" className="form-control" value={form.due_date}
                      onChange={e => setForm({...form, due_date: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <input className="form-control" value={form.notes}
                    onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Payments;
