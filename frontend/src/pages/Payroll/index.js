import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiPlus, FiEdit2, FiTrash2, FiUsers, FiDollarSign, FiBriefcase, FiPrinter } from 'react-icons/fi';
import { downloadFile } from '../../utils/downloadPdf';

const emptyStaff = {
  first_name: '', last_name: '', position: '', phone: '', email: '',
  base_salary: '', hire_date: '', is_active: true,
};

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const emptySalary = () => ({
  staff_type: 'TEACHER', teacher: '', admin_staff: '',
  period: currentPeriod(), amount: '', method: 'CAISSE',
  payment_date: new Date().toISOString().slice(0, 10), notes: '',
});

const fcfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

export default function Payroll() {
  const [tab, setTab] = useState('salaries');
  const [teachers, setTeachers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  // Staff modal
  const [showStaff, setShowStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState(emptyStaff);

  // Salary modal
  const [showSalary, setShowSalary] = useState(false);
  const [editingSalary, setEditingSalary] = useState(null);
  const [salaryForm, setSalaryForm] = useState(emptySalary());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, sRes, salRes, statRes] = await Promise.all([
        api.get('/teachers/?page_size=500').catch(() => ({ data: [] })),
        api.get('/payroll/staff/?page_size=500').catch(() => ({ data: [] })),
        api.get('/payroll/salaries/?ordering=-payment_date').catch(() => ({ data: [] })),
        api.get('/payroll/salaries/stats/').catch(() => ({ data: {} })),
      ]);
      setTeachers(tRes.data.results || tRes.data);
      setStaff(sRes.data.results || sRes.data);
      setSalaries(salRes.data.results || salRes.data);
      setStats(statRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Personnel administratif ──
  const openCreateStaff = () => { setEditingStaff(null); setStaffForm(emptyStaff); setShowStaff(true); };
  const openEditStaff = (s) => {
    setEditingStaff(s);
    setStaffForm({
      first_name: s.first_name, last_name: s.last_name, position: s.position || '',
      phone: s.phone || '', email: s.email || '', base_salary: s.base_salary || '',
      hire_date: s.hire_date || '', is_active: s.is_active,
    });
    setShowStaff(true);
  };
  const submitStaff = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...staffForm, base_salary: Number(staffForm.base_salary) || 0, hire_date: staffForm.hire_date || null };
      if (editingStaff) await api.put(`/payroll/staff/${editingStaff.id}/`, payload);
      else await api.post('/payroll/staff/', payload);
      setShowStaff(false); fetchAll();
    } catch (err) { alert('Erreur: ' + JSON.stringify(err.response?.data)); }
  };
  const deleteStaff = async (id) => {
    if (!window.confirm('Supprimer ce membre du personnel ?')) return;
    await api.delete(`/payroll/staff/${id}/`); fetchAll();
  };

  // ── Salaires ──
  const openCreateSalary = () => { setEditingSalary(null); setSalaryForm(emptySalary()); setShowSalary(true); };
  const openEditSalary = (s) => {
    setEditingSalary(s);
    setSalaryForm({
      staff_type: s.staff_type, teacher: s.teacher || '', admin_staff: s.admin_staff || '',
      period: s.period, amount: s.amount, method: s.method,
      payment_date: s.payment_date, notes: s.notes || '',
    });
    setShowSalary(true);
  };
  // Pré-remplit le montant avec le salaire de base à la sélection de l'employé
  const selectEmployee = (id) => {
    if (salaryForm.staff_type === 'TEACHER') {
      const t = teachers.find(x => String(x.id) === String(id));
      setSalaryForm(f => ({ ...f, teacher: id, admin_staff: '', amount: f.amount || (t?.base_salary || '') }));
    } else {
      const s = staff.find(x => String(x.id) === String(id));
      setSalaryForm(f => ({ ...f, admin_staff: id, teacher: '', amount: f.amount || (s?.base_salary || '') }));
    }
  };
  const submitSalary = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        staff_type: salaryForm.staff_type,
        teacher: salaryForm.staff_type === 'TEACHER' ? salaryForm.teacher : null,
        admin_staff: salaryForm.staff_type === 'ADMIN' ? salaryForm.admin_staff : null,
        period: salaryForm.period,
        amount: Number(salaryForm.amount) || 0,
        method: salaryForm.method,
        payment_date: salaryForm.payment_date,
        notes: salaryForm.notes,
      };
      if (editingSalary) await api.put(`/payroll/salaries/${editingSalary.id}/`, payload);
      else await api.post('/payroll/salaries/', payload);
      setShowSalary(false); fetchAll();
    } catch (err) { alert('Erreur: ' + JSON.stringify(err.response?.data)); }
  };
  const deleteSalary = async (id) => {
    if (!window.confirm('Supprimer ce versement ? La dépense liée sera aussi supprimée.')) return;
    await api.delete(`/payroll/salaries/${id}/`); fetchAll();
  };

  const TabBtn = ({ id, icon, label }) => (
    <button onClick={() => setTab(id)} style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '8px 20px', borderRadius: 9,
      border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
      background: tab === id ? '#fff' : 'transparent', color: tab === id ? '#3b5beb' : '#667085',
      boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
    }}>{icon} {label}</button>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Salaires & Personnel</h2>
          <p>Rémunération du personnel enseignant et administratif</p>
        </div>
        {tab === 'salaries'
          ? <button className="btn btn-primary" onClick={openCreateSalary}><FiPlus /> Verser un salaire</button>
          : <button className="btn btn-primary" onClick={openCreateStaff}><FiPlus /> Nouveau personnel</button>}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon red"><FiDollarSign /></div>
          <div className="stat-info">
            <h4>Total salaires versés</h4>
            <div className="stat-value">{Number(stats.total || 0).toLocaleString('fr-FR')}</div>
            <div className="stat-change">FCFA — {stats.count || 0} versements</div>
          </div>
        </div>
        {(stats.by_type || []).map(r => (
          <div className="stat-card" key={r.staff_type}>
            <div className="stat-icon blue"><FiUsers /></div>
            <div className="stat-info">
              <h4>{r.staff_type_label}</h4>
              <div className="stat-value">{Number(r.total || 0).toLocaleString('fr-FR')}</div>
              <div className="stat-change">FCFA — {r.count} versement(s)</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, margin: '16px 0', background: '#f2f4f7', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        <TabBtn id="salaries" icon={<FiDollarSign size={15} />} label="Versements de salaire" />
        <TabBtn id="staff" icon={<FiBriefcase size={15} />} label="Personnel administratif" />
      </div>

      {loading ? <div className="loading-container"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-container">
            {tab === 'salaries' ? (
              <table>
                <thead>
                  <tr>
                    <th>Période</th><th>Employé</th><th>Type</th><th>Montant</th>
                    <th>Mode</th><th>Date</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salaries.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>Aucun versement enregistré</td></tr>
                  ) : salaries.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.period}</strong></td>
                      <td>{s.employee_name}<div style={{ fontSize: '0.75rem', color: '#98a2b3' }}>{s.employee_position}</div></td>
                      <td>{s.staff_type_label}</td>
                      <td style={{ fontWeight: 700 }}>{fcfa(s.amount)}</td>
                      <td>{s.method_label}</td>
                      <td>{new Date(s.payment_date).toLocaleDateString('fr-FR')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-secondary" title="Fiche de paie" onClick={() => downloadFile(`/payroll/salaries/${s.id}/payslip/`, `fiche_paie_${s.period}_${s.employee_name}.pdf`)}><FiPrinter size={14} /></button>
                          <button className="btn btn-sm btn-secondary" title="Modifier" onClick={() => openEditSalary(s)}><FiEdit2 size={14} /></button>
                          <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => deleteSalary(s.id)}><FiTrash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Nom</th><th>Poste</th><th>Téléphone</th><th>Salaire de base</th>
                    <th>Statut</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>Aucun personnel administratif</td></tr>
                  ) : staff.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.full_name}</strong></td>
                      <td>{s.position || '—'}</td>
                      <td>{s.phone || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{fcfa(s.base_salary)}</td>
                      <td>{s.is_active ? <span className="badge badge-success">Actif</span> : <span className="badge badge-danger">Inactif</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-secondary" title="Modifier" onClick={() => openEditStaff(s)}><FiEdit2 size={14} /></button>
                          <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => deleteStaff(s.id)}><FiTrash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal salaire */}
      {showSalary && (
        <div className="modal-overlay" onClick={() => setShowSalary(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingSalary ? 'Modifier le versement' : 'Verser un salaire'}</h3>
              <button className="btn-icon" onClick={() => setShowSalary(false)}>&times;</button>
            </div>
            <form onSubmit={submitSalary}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Type de personnel</label>
                    <select className="form-control" value={salaryForm.staff_type}
                      onChange={e => setSalaryForm({ ...salaryForm, staff_type: e.target.value, teacher: '', admin_staff: '' })}>
                      <option value="TEACHER">Enseignant</option>
                      <option value="ADMIN">Personnel administratif</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Employé</label>
                    <select className="form-control" required
                      value={salaryForm.staff_type === 'TEACHER' ? salaryForm.teacher : salaryForm.admin_staff}
                      onChange={e => selectEmployee(e.target.value)}>
                      <option value="">Sélectionner…</option>
                      {(salaryForm.staff_type === 'TEACHER' ? teachers : staff).map(x => (
                        <option key={x.id} value={x.id}>{x.full_name}{x.position ? ` (${x.position})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Période (mois)</label>
                    <input type="month" className="form-control" required value={salaryForm.period}
                      onChange={e => setSalaryForm({ ...salaryForm, period: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Montant (FCFA)</label>
                    <input type="number" min={0} step={1000} className="form-control" required value={salaryForm.amount}
                      onChange={e => setSalaryForm({ ...salaryForm, amount: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Mode de paiement</label>
                    <select className="form-control" value={salaryForm.method}
                      onChange={e => setSalaryForm({ ...salaryForm, method: e.target.value })}>
                      <option value="CAISSE">Caisse (espèces)</option>
                      <option value="BANQUE">Banque (virement/chèque)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date de versement</label>
                    <input type="date" className="form-control" required value={salaryForm.payment_date}
                      onChange={e => setSalaryForm({ ...salaryForm, payment_date: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <input className="form-control" value={salaryForm.notes}
                    onChange={e => setSalaryForm({ ...salaryForm, notes: e.target.value })} />
                </div>
                <div style={{ fontSize: '0.78rem', color: '#98a2b3' }}>
                  Ce versement est enregistré comme charge (catégorie Salaires) et minore le solde net.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSalary(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">{editingSalary ? 'Modifier' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal personnel */}
      {showStaff && (
        <div className="modal-overlay" onClick={() => setShowStaff(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingStaff ? 'Modifier le personnel' : 'Nouveau personnel administratif'}</h3>
              <button className="btn-icon" onClick={() => setShowStaff(false)}>&times;</button>
            </div>
            <form onSubmit={submitStaff}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Nom</label>
                    <input className="form-control" required value={staffForm.last_name}
                      onChange={e => setStaffForm({ ...staffForm, last_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Prénom</label>
                    <input className="form-control" required value={staffForm.first_name}
                      onChange={e => setStaffForm({ ...staffForm, first_name: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Poste</label>
                  <input className="form-control" placeholder="ex: Secrétaire, Comptable, Gardien…"
                    value={staffForm.position}
                    onChange={e => setStaffForm({ ...staffForm, position: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Téléphone</label>
                    <input className="form-control" value={staffForm.phone}
                      onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" className="form-control" value={staffForm.email}
                      onChange={e => setStaffForm({ ...staffForm, email: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Salaire de base (FCFA)</label>
                    <input type="number" min={0} step={1000} className="form-control" value={staffForm.base_salary}
                      onChange={e => setStaffForm({ ...staffForm, base_salary: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Date d'embauche</label>
                    <input type="date" className="form-control" value={staffForm.hire_date}
                      onChange={e => setStaffForm({ ...staffForm, hire_date: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={staffForm.is_active}
                      onChange={e => setStaffForm({ ...staffForm, is_active: e.target.checked })} />
                    Actif
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowStaff(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">{editingStaff ? 'Modifier' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
