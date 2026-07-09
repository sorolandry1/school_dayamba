import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiPlus, FiSearch, FiDollarSign, FiEdit2, FiTrash2, FiPrinter, FiLayers } from 'react-icons/fi';

const emptyForm = {
  student: '', amount: '', payment_type: 'SCOLARITE',
  status: 'PAID', method: 'CAISSE', due_date: '', notes: ''
};

const TYPE_LABELS = {
  INSCRIPTION: 'Inscription', SCOLARITE: 'Scolarité',
  EXAMEN: 'Examen', AUTRE: 'Autre'
};

function Payments() {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [pension, setPension] = useState(null);      // situation pension chargée
  const [pensionLoading, setPensionLoading] = useState(false);
  const [showPension, setShowPension] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      let url = '/payments/?ordering=-payment_date&';
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

  const openCreate = () => {
    setEditing(null); setForm(emptyForm);
    setStudentSearch(''); setShowStudentDropdown(false);
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      student: p.student,
      amount: p.amount,
      payment_type: p.payment_type,
      status: p.status,
      method: p.method || 'CAISSE',
      due_date: p.due_date || '',
      notes: p.notes || '',
    });
    setStudentSearch(p.student_name || '');
    setShowStudentDropdown(false);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/payments/${editing.id}/`, form);
      } else {
        await api.post('/payments/', form);
      }
      setShowModal(false);
      fetchPayments();
    } catch (err) { alert('Erreur: ' + JSON.stringify(err.response?.data)); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce paiement ?')) return;
    await api.delete(`/payments/${id}/`);
    fetchPayments();
  };

  const printReceipt = async (p) => {
    const studentName = p.student_name || '-';
    const fcfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

    // Ouvre la fenêtre IMMÉDIATEMENT (dans le geste utilisateur) pour éviter
    // le blocage par le navigateur, puis on la remplit après l'appel réseau.
    const w = window.open('', '_blank', 'width=600,height=700');

    // Récupère le cumul déjà versé par l'élève pour calculer le reste
    const tuition = Number(p.class_tuition || 0);
    let totalPaid = 0;
    if (p.student) {
      try {
        const res = await api.get(`/payments/student_history/?student_id=${p.student}`);
        totalPaid = Number(res.data.total_paid || 0);
      } catch (_) {}
    }
    const reste = Math.max(0, tuition - totalPaid);
    const nextDate = p.due_date ? new Date(p.due_date).toLocaleDateString('fr-FR') : '—';

    const scolariteBlock = tuition > 0 ? `
      <div class="divider"></div>
      <div class="row"><span class="label">Scolarité totale (${p.classe_name || ''})</span><span class="value">${fcfa(tuition)}</span></div>
      <div class="row"><span class="label">Total déjà versé</span><span class="value">${fcfa(totalPaid)}</span></div>
      <div class="row"><span class="label">Reste à payer</span><span class="value" style="color:${reste > 0 ? '#c53030' : '#276749'}">${fcfa(reste)}</span></div>
      <div class="row"><span class="label">Date du prochain versement</span><span class="value">${nextDate}</span></div>
    ` : `
      <div class="row"><span class="label">Date du prochain versement</span><span class="value">${nextDate}</span></div>
    `;

    if (!w) { alert('Veuillez autoriser les fenêtres pop-up pour imprimer le reçu.'); return; }
    w.document.write(`
      <html><head><title>Reçu ${p.receipt_number}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; }
        h1 { color: #1a365d; font-size: 22px; text-align: center; margin-bottom: 4px; }
        .subtitle { text-align: center; color: #4a5568; margin-bottom: 30px; }
        .divider { border-top: 2px solid #e2e8f0; margin: 20px 0; }
        .row { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { color: #718096; font-size: 14px; }
        .value { font-weight: bold; font-size: 14px; }
        .amount { font-size: 24px; font-weight: 900; color: #2b6cb0; text-align: center; margin: 20px 0; }
        .footer { text-align: center; color: #a0aec0; font-size: 12px; margin-top: 40px; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; background: #c6f6d5; color: #276749; font-size: 12px; }
      </style></head><body>
      <h1>SchoolPro — REÇU DE PAIEMENT</h1>
      <div class="subtitle">Reçu N° <strong>${p.receipt_number}</strong></div>
      <div class="divider"></div>
      <div class="row"><span class="label">Élève</span><span class="value">${studentName}</span></div>
      <div class="row"><span class="label">Type de paiement</span><span class="value">${TYPE_LABELS[p.payment_type] || p.payment_type}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${new Date(p.payment_date).toLocaleDateString('fr-FR')}</span></div>
      <div class="row"><span class="label">Statut</span><span class="value"><span class="badge">${p.status}</span></span></div>
      ${p.notes ? `<div class="row"><span class="label">Notes</span><span class="value">${p.notes}</span></div>` : ''}
      <div class="divider"></div>
      <div class="row"><span class="label">Montant versé (ce reçu)</span><span class="value">${fcfa(p.amount)}</span></div>
      <div class="amount">${fcfa(p.amount)}</div>
      ${scolariteBlock}
      <div class="divider"></div>
      <div class="footer">SchoolPro · Gestion Scolaire · Document généré le ${new Date().toLocaleDateString('fr-FR')}</div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const openPension = async (p) => {
    if (!p.student) { alert('Aucun élève associé à ce paiement.'); return; }
    setShowPension(true);
    setPension(null);
    setPensionLoading(true);
    try {
      const res = await api.get(`/payments/pension/?student_id=${p.student}`);
      setPension(res.data);
    } catch (e) {
      setPension({ error: true });
    } finally { setPensionLoading(false); }
  };

  const trancheStatusBadge = (t) => {
    if (t.status === 'PAID') return <span className="badge badge-success">Soldée</span>;
    if (t.status === 'PARTIAL') return <span className="badge badge-info">Partielle</span>;
    if (t.overdue) return <span className="badge badge-danger">En retard</span>;
    return <span className="badge badge-warning">À venir</span>;
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
        <button className="btn btn-primary" onClick={openCreate}>
          <FiPlus /> Nouveau paiement
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><FiDollarSign /></div>
          <div className="stat-info">
            <h4>Total collecté</h4>
            <div className="stat-value">{Number(stats.total_collected || 0).toLocaleString()}</div>
            <div className="stat-change">FCFA — {stats.count_paid || 0} paiements</div>
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
          <input placeholder="Rechercher élève ou N° reçu..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tout statut</option>
          <option value="PAID">Payé</option>
          <option value="PENDING">En attente</option>
          <option value="OVERDUE">En retard</option>
          <option value="PARTIAL">Partiel</option>
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
                  <th>Échéance</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>Aucun paiement trouvé</td></tr>
                ) : payments.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.receipt_number}</strong></td>
                    <td>{p.student_name}</td>
                    <td>{TYPE_LABELS[p.payment_type] || p.payment_type}</td>
                    <td style={{ fontWeight: 700 }}>{Number(p.amount).toLocaleString()} FCFA</td>
                    <td>{new Date(p.payment_date).toLocaleDateString('fr-FR')}</td>
                    <td>{p.due_date ? new Date(p.due_date).toLocaleDateString('fr-FR') : '-'}</td>
                    <td>{statusBadge(p.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-secondary" title="Situation pension" onClick={() => openPension(p)}><FiLayers size={14} /></button>
                        <button className="btn btn-sm btn-secondary" title="Imprimer reçu" onClick={() => printReceipt(p)}><FiPrinter size={14} /></button>
                        <button className="btn btn-sm btn-secondary" title="Modifier" onClick={() => openEdit(p)}><FiEdit2 size={14} /></button>
                        <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => handleDelete(p.id)}><FiTrash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showPension && (
        <div className="modal-overlay" onClick={() => setShowPension(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Situation de pension {pension?.student_name ? `— ${pension.student_name}` : ''}</h3>
              <button className="btn-icon" onClick={() => setShowPension(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {pensionLoading ? (
                <div className="loading-container"><div className="spinner" /></div>
              ) : !pension || pension.error ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#98a2b3' }}>Impossible de charger la situation.</div>
              ) : (
                <>
                  {(() => {
                    const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' };
                    const labelStyle = { color: '#718096', fontSize: '0.85rem' };
                    const valStyle = { fontWeight: 700, fontSize: '0.85rem' };
                    return (
                      <div style={{ marginBottom: 16 }}>
                        <div style={rowStyle}><span style={labelStyle}>Classe</span><span style={valStyle}>{pension.classe_name || '—'}</span></div>
                        <div style={rowStyle}><span style={labelStyle}>Scolarité</span><span style={valStyle}>{Number(pension.tuition).toLocaleString('fr-FR')} FCFA</span></div>
                        {pension.discount_amount > 0 && (
                          <>
                            <div style={rowStyle}><span style={labelStyle}>Remise{pension.discount_reason ? ` (${pension.discount_reason})` : ''}</span><span style={{ ...valStyle, color: '#276749' }}>- {Number(pension.discount_amount).toLocaleString('fr-FR')} FCFA</span></div>
                            <div style={rowStyle}><span style={labelStyle}>Net à payer</span><span style={valStyle}>{Number(pension.net_due).toLocaleString('fr-FR')} FCFA</span></div>
                          </>
                        )}
                        <div style={rowStyle}><span style={labelStyle}>Total versé</span><span style={valStyle}>{Number(pension.total_paid).toLocaleString('fr-FR')} FCFA</span></div>
                        <div style={rowStyle}><span style={labelStyle}>Reste à payer</span><span style={{ ...valStyle, color: pension.reste > 0 ? '#c53030' : '#276749' }}>{Number(pension.reste).toLocaleString('fr-FR')} FCFA</span></div>
                      </div>
                    );
                  })()}

                  {pension.tranches && pension.tranches.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--gray-50, #f8fafc)', textAlign: 'left' }}>
                          <th style={{ padding: '8px' }}>Tranche</th>
                          <th style={{ padding: '8px' }}>Dû</th>
                          <th style={{ padding: '8px' }}>Payé</th>
                          <th style={{ padding: '8px' }}>Reste</th>
                          <th style={{ padding: '8px' }}>Échéance</th>
                          <th style={{ padding: '8px' }}>État</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pension.tranches.map(t => (
                          <tr key={t.id} style={{ borderTop: '1px solid #eef0f4' }}>
                            <td style={{ padding: '8px', fontWeight: 600 }}>{t.label}</td>
                            <td style={{ padding: '8px' }}>{Number(t.effective_amount).toLocaleString('fr-FR')}</td>
                            <td style={{ padding: '8px' }}>{Number(t.allocated).toLocaleString('fr-FR')}</td>
                            <td style={{ padding: '8px' }}>{Number(t.remaining).toLocaleString('fr-FR')}</td>
                            <td style={{ padding: '8px' }}>{t.due_date ? new Date(t.due_date).toLocaleDateString('fr-FR') : '—'}</td>
                            <td style={{ padding: '8px' }}>{trancheStatusBadge(t)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 20, color: '#98a2b3', fontSize: '0.85rem' }}>
                      Aucune tranche définie pour cette classe. Définissez l'échéancier depuis la page Classes.
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPension(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Modifier le paiement' : 'Enregistrer un paiement'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Élève</label>
                  <div style={{ position: 'relative' }}>
                    <FiSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#98a2b3', pointerEvents: 'none' }} />
                    <input
                      className="form-control"
                      style={{ paddingLeft: 32 }}
                      placeholder="Rechercher un élève inscrit..."
                      value={studentSearch}
                      required={!form.student}
                      autoComplete="off"
                      onChange={e => {
                        setStudentSearch(e.target.value);
                        setForm({ ...form, student: '' });
                        setShowStudentDropdown(true);
                      }}
                      onFocus={() => setShowStudentDropdown(true)}
                      onBlur={() => setTimeout(() => setShowStudentDropdown(false), 150)}
                    />
                  </div>
                  {showStudentDropdown && (
                    <div style={{
                      position: 'absolute', zIndex: 100, background: '#fff',
                      border: '1px solid #e2e8f0', borderRadius: 8, width: '100%',
                      maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.10)'
                    }}>
                      {students
                        .filter(s => {
                          const q = studentSearch.toLowerCase();
                          return !q || s.last_name?.toLowerCase().includes(q) || s.first_name?.toLowerCase().includes(q) || s.matricule?.toLowerCase().includes(q);
                        })
                        .slice(0, 50)
                        .map(s => (
                          <div key={s.id}
                            style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                            onMouseDown={() => {
                              setForm({ ...form, student: s.id });
                              setStudentSearch(`${s.last_name} ${s.first_name} (${s.matricule})`);
                              setShowStudentDropdown(false);
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}
                          >
                            <strong>{s.last_name} {s.first_name}</strong>
                            <span style={{ marginLeft: 8, color: '#718096', fontSize: 13 }}>{s.matricule}</span>
                            {s.classe_name && <span style={{ marginLeft: 8, color: '#a0aec0', fontSize: 12 }}>{s.classe_name}</span>}
                          </div>
                        ))
                      }
                      {students.filter(s => {
                        const q = studentSearch.toLowerCase();
                        return !q || s.last_name?.toLowerCase().includes(q) || s.first_name?.toLowerCase().includes(q) || s.matricule?.toLowerCase().includes(q);
                      }).length === 0 && (
                        <div style={{ padding: '10px 14px', color: '#98a2b3', textAlign: 'center' }}>Aucun élève trouvé</div>
                      )}
                    </div>
                  )}
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
                      <option value="PARTIAL">Partiel</option>
                      <option value="PENDING">En attente</option>
                      <option value="OVERDUE">En retard</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Échéance (prochain versement)</label>
                    <input type="date" className="form-control" value={form.due_date}
                      onChange={e => setForm({...form, due_date: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Mode d'encaissement</label>
                  <select className="form-control" value={form.method}
                    onChange={e => setForm({...form, method: e.target.value})}>
                    <option value="CAISSE">Caisse (espèces)</option>
                    <option value="BANQUE">Banque (virement/chèque)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <input className="form-control" value={form.notes}
                    onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Modifier' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Payments;
