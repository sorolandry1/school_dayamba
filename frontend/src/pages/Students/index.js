import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiDownload } from 'react-icons/fi';

function Students() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClasse, setFilterClasse] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    first_name: '', last_name: '', gender: 'M', classe: '',
    parent_name: '', parent_phone: '', parent_email: '', date_of_birth: '', address: ''
  });

  const fetchStudents = useCallback(async () => {
    try {
      let url = '/students/?';
      if (search) url += `search=${search}&`;
      if (filterClasse) url += `classe=${filterClasse}&`;
      if (filterPayment) url += `payment_status=${filterPayment}&`;
      const res = await api.get(url);
      setStudents(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, filterClasse, filterPayment]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  useEffect(() => {
    api.get('/classes/current_year/').then(r => setClasses(r.data.results || r.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/students/${editing.id}/`, form);
      } else {
        await api.post('/students/', form);
      }
      setShowModal(false);
      setEditing(null);
      setForm({ first_name: '', last_name: '', gender: 'M', classe: '', parent_name: '', parent_phone: '', parent_email: '', date_of_birth: '', address: '' });
      fetchStudents();
    } catch (err) { alert('Erreur: ' + JSON.stringify(err.response?.data)); }
  };

  const handleEdit = (student) => {
    setEditing(student);
    setForm({
      first_name: student.first_name, last_name: student.last_name,
      gender: student.gender || 'M', classe: student.classe || '',
      parent_name: student.parent_name || '', parent_phone: student.parent_phone || '',
      parent_email: student.parent_email || '', date_of_birth: student.date_of_birth || '',
      address: student.address || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet élève ?')) return;
    await api.delete(`/students/${id}/`);
    fetchStudents();
  };

  const handleGenerateQR = async (id) => {
    try {
      await api.post(`/students/${id}/generate_qr/`);
      alert('QR Code généré !');
      fetchStudents();
    } catch { alert('Erreur lors de la génération du QR.'); }
  };

  const paymentBadge = (status) => {
    const map = { PAID: 'badge-success', PENDING: 'badge-warning', OVERDUE: 'badge-danger' };
    const labels = { PAID: 'Payé', PENDING: 'En attente', OVERDUE: 'En retard' };
    return <span className={`badge ${map[status] || 'badge-info'}`}>{labels[status] || status}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Gestion des Élèves</h2>
          <p>{students.length} élèves enregistrés</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ first_name: '', last_name: '', gender: 'M', classe: '', parent_name: '', parent_phone: '', parent_email: '', date_of_birth: '', address: '' }); setShowModal(true); }}>
          <FiPlus /> Nouvel élève
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-input">
          <FiSearch size={16} />
          <input placeholder="Rechercher un élève..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 180 }} value={filterClasse} onChange={e => setFilterClasse(e.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-control" style={{ width: 160 }} value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
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
                  <th>Matricule</th>
                  <th>Nom & Prénom</th>
                  <th>Classe</th>
                  <th>Genre</th>
                  <th>Tél. Parent</th>
                  <th>Paiement</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>Aucun élève trouvé</td></tr>
                ) : students.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.matricule}</strong></td>
                    <td>{s.last_name} {s.first_name}</td>
                    <td>{s.classe_name || '-'}</td>
                    <td>{s.gender === 'M' ? 'Garçon' : 'Fille'}</td>
                    <td>{s.parent_phone || '-'}</td>
                    <td>{paymentBadge(s.payment_status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(s)}><FiEdit2 size={14} /></button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleGenerateQR(s.id)} title="Générer QR"><FiDownload size={14} /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}><FiTrash2 size={14} /></button>
                      </div>
                    </td>
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
              <h3>{editing ? 'Modifier l\'élève' : 'Nouvel élève'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Nom</label>
                    <input className="form-control" required value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Prénom</label>
                    <input className="form-control" required value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Genre</label>
                    <select className="form-control" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Classe</label>
                    <select className="form-control" required value={form.classe} onChange={e => setForm({...form, classe: e.target.value})}>
                      <option value="">Sélectionner</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date de naissance</label>
                    <input type="date" className="form-control" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Nom du parent</label>
                    <input className="form-control" value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tél. Parent</label>
                    <input className="form-control" value={form.parent_phone} onChange={e => setForm({...form, parent_phone: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Email Parent</label>
                    <input type="email" className="form-control" value={form.parent_email} onChange={e => setForm({...form, parent_email: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Adresse</label>
                  <input className="form-control" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
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

export default Students;
