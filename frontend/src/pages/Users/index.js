import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  FiPlus, FiSearch, FiEdit2, FiToggleLeft, FiToggleRight,
  FiKey, FiX, FiUser, FiShield
} from 'react-icons/fi';

const ROLE_LABELS = {
  DIRECTOR: 'Directeur',
  TEACHER: 'Professeur',
  AGENT: 'Agent d\'accueil',
  ADMIN: 'Administrateur',
};

const ROLE_COLORS = {
  DIRECTOR: '#3b5beb',
  TEACHER: '#10b981',
  AGENT: '#f59e0b',
  ADMIN: '#8b5cf6',
};

const emptyForm = {
  username: '', email: '', first_name: '', last_name: '',
  role: 'TEACHER', phone: '', password: '',
};

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      let url = '/auth/users/?';
      if (search) url += `search=${search}&`;
      if (filterRole) url += `role=${filterRole}&`;
      const res = await api.get(url);
      setUsers(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, filterRole]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const { password, ...updateData } = form;
        await api.patch(`/auth/users/${editing.id}/`, updateData);
      } else {
        await api.post('/auth/users/', form);
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      fetchUsers();
    } catch (err) { alert('Erreur: ' + JSON.stringify(err.response?.data)); }
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      username: user.username,
      email: user.email || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      role: user.role,
      phone: user.phone || '',
      password: '',
    });
    setShowModal(true);
  };

  const toggleActive = async (user) => {
    const action = user.is_active ? 'désactiver' : 'activer';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} le compte de ${user.first_name} ${user.last_name} ?`)) return;
    await api.post(`/auth/users/${user.id}/toggle_active/`);
    fetchUsers();
  };

  const openResetPassword = (user) => {
    setPasswordTarget(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/auth/users/${passwordTarget.id}/reset_password/`, { password: newPassword });
      alert('Mot de passe réinitialisé avec succès.');
      setShowPasswordModal(false);
    } catch (err) { alert('Erreur: ' + JSON.stringify(err.response?.data)); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Gestion des Utilisateurs</h2>
          <p>{users.length} compte(s) enregistré(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }}>
          <FiPlus /> Nouvel utilisateur
        </button>
      </div>

      {/* Résumé par rôle */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {Object.entries(ROLE_LABELS).map(([role, label]) => {
          const count = users.filter(u => u.role === role).length;
          return (
            <div key={role} className="stat-card" style={{ cursor: 'pointer' }}
              onClick={() => setFilterRole(filterRole === role ? '' : role)}>
              <div className="stat-icon" style={{ background: ROLE_COLORS[role] + '20', color: ROLE_COLORS[role] }}>
                {role === 'DIRECTOR' ? <FiShield /> : <FiUser />}
              </div>
              <div className="stat-info">
                <h4>{label}s</h4>
                <div className="stat-value">{count}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="filters-bar">
        <div className="search-input">
          <FiSearch size={16} />
          <input placeholder="Rechercher un utilisateur..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 180 }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <option key={role} value={role}>{label}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? <div className="loading-container"><div className="spinner" /></div> : (
            <table>
              <thead>
                <tr>
                  <th>Nom & Prénom</th>
                  <th>Identifiant</th>
                  <th>Rôle</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>Aucun utilisateur trouvé</td></tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: (ROLE_COLORS[u.role] || '#667085') + '20',
                          color: ROLE_COLORS[u.role] || '#667085',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.9rem',
                        }}>
                          {(u.first_name?.[0] || '?').toUpperCase()}{(u.last_name?.[0] || '').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.last_name} {u.first_name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{u.username}</td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                        background: (ROLE_COLORS[u.role] || '#667085') + '20',
                        color: ROLE_COLORS[u.role] || '#667085',
                      }}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td>{u.email || '-'}</td>
                    <td>{u.phone || '-'}</td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-secondary" title="Modifier" onClick={() => openEdit(u)}>
                          <FiEdit2 size={14} />
                        </button>
                        <button className="btn btn-sm btn-secondary" title="Réinitialiser mot de passe" onClick={() => openResetPassword(u)}>
                          <FiKey size={14} />
                        </button>
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-secondary'}`}
                          title={u.is_active ? 'Désactiver' : 'Activer'}
                          onClick={() => toggleActive(u)}
                        >
                          {u.is_active ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal création/modification */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Nom</label>
                    <input className="form-control" required value={form.last_name}
                      onChange={e => setForm({...form, last_name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Prénom</label>
                    <input className="form-control" required value={form.first_name}
                      onChange={e => setForm({...form, first_name: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Identifiant (login)</label>
                    <input className="form-control" required value={form.username}
                      onChange={e => setForm({...form, username: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Rôle</label>
                    <select className="form-control" value={form.role}
                      onChange={e => setForm({...form, role: e.target.value})}>
                      {Object.entries(ROLE_LABELS).map(([role, label]) => (
                        <option key={role} value={role}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" className="form-control" value={form.email}
                      onChange={e => setForm({...form, email: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Téléphone</label>
                    <input className="form-control" value={form.phone}
                      onChange={e => setForm({...form, phone: e.target.value})} />
                  </div>
                </div>
                {!editing && (
                  <div className="form-group">
                    <label>Mot de passe</label>
                    <input type="password" className="form-control" required minLength={8}
                      value={form.password} placeholder="Minimum 8 caractères"
                      onChange={e => setForm({...form, password: e.target.value})} />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Modifier' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal reset mot de passe */}
      {showPasswordModal && passwordTarget && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Réinitialiser le mot de passe</h3>
              <button className="btn-icon" onClick={() => setShowPasswordModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                <p style={{ color: '#667085', marginBottom: 16 }}>
                  Compte : <strong>{passwordTarget.first_name} {passwordTarget.last_name}</strong>
                </p>
                <div className="form-group">
                  <label>Nouveau mot de passe</label>
                  <input type="password" className="form-control" required minLength={8}
                    value={newPassword} placeholder="Minimum 8 caractères"
                    onChange={e => setNewPassword(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary"><FiKey size={14} /> Réinitialiser</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
