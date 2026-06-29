import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  FiPlus, FiSearch, FiEdit2, FiToggleLeft, FiToggleRight,
  FiKey, FiX, FiUser, FiShield, FiBook, FiLink, FiCopy, FiTrash2, FiCheck
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
  role: 'TEACHER', phone: '', password: '', subject_ids: [],
};

function Users() {
  const { user: currentUser } = useAuth();
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
  const [subjects, setSubjects] = useState([]);
  // Liens d'inscription
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [inviteForm, setInviteForm] = useState({ role: 'TEACHER', note: '', expires_in_days: '' });
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);

  const inviteLink = (token) => `${window.location.origin}/register/${token}`;

  const fetchInvitations = async () => {
    try {
      const res = await api.get('/auth/invitations/');
      setInvitations(res.data.results || res.data);
    } catch (e) { console.error(e); }
  };

  const openInviteModal = () => { setShowInviteModal(true); fetchInvitations(); };

  const createInvitation = async (e) => {
    e.preventDefault();
    setCreatingInvite(true);
    try {
      const payload = { role: inviteForm.role, note: inviteForm.note };
      if (inviteForm.expires_in_days) payload.expires_in_days = Number(inviteForm.expires_in_days);
      await api.post('/auth/invitations/', payload);
      setInviteForm({ role: inviteForm.role, note: '', expires_in_days: '' });
      fetchInvitations();
    } catch (err) {
      alert('Erreur: ' + JSON.stringify(err.response?.data));
    } finally { setCreatingInvite(false); }
  };

  const revokeInvitation = async (id) => {
    if (!window.confirm('Supprimer ce lien d\'inscription ? Il ne sera plus utilisable.')) return;
    try {
      await api.delete(`/auth/invitations/${id}/`);
      fetchInvitations();
    } catch { alert('Suppression impossible.'); }
  };

  const copyLink = async (token) => {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      window.prompt('Copiez le lien :', inviteLink(token));
    }
  };

  // Directeur ne peut pas toucher les comptes Admin
  const canActOn = (targetUser) => {
    if (currentUser?.role === 'DIRECTOR' && targetUser?.role === 'ADMIN') return false;
    return true;
  };

  // Directeur ne peut pas attribuer le rôle Admin
  const availableRoles = Object.entries(ROLE_LABELS).filter(([role]) => {
    if (currentUser?.role === 'DIRECTOR' && role === 'ADMIN') return false;
    return true;
  });

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

  // Charge toutes les matières (pour l'affectation aux professeurs)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/subjects/', { params: { page_size: 500 } });
        setSubjects(res.data.results || res.data);
      } catch (e) { console.error(e); }
    })();
  }, []);

  // Matières groupées par classe pour l'affichage du sélecteur
  const subjectsByClasse = subjects.reduce((acc, s) => {
    const key = s.classe_name || 'Sans classe';
    (acc[key] = acc[key] || []).push(s);
    return acc;
  }, {});

  const toggleSubject = (id) => {
    setForm(f => ({
      ...f,
      subject_ids: f.subject_ids.includes(id)
        ? f.subject_ids.filter(x => x !== id)
        : [...f.subject_ids, id],
    }));
  };

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
      subject_ids: user.assigned_subject_ids || [],
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
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={openInviteModal}>
            <FiLink /> Liens d'inscription
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }}>
            <FiPlus /> Nouvel utilisateur
          </button>
        </div>
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
                      {canActOn(u) ? (
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
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#98a2b3', fontStyle: 'italic' }}>Accès restreint</span>
                      )}
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
                      {availableRoles.map(([role, label]) => (
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

                {form.role === 'TEACHER' && (
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FiBook size={14} /> Matières enseignées
                      {form.subject_ids.length > 0 && (
                        <span style={{
                          marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600,
                          color: ROLE_COLORS.TEACHER,
                        }}>
                          {form.subject_ids.length} sélectionnée(s)
                        </span>
                      )}
                    </label>
                    {subjects.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: '#98a2b3', margin: 0 }}>
                        Aucune matière disponible. Créez d'abord des matières et des classes.
                      </p>
                    ) : (
                      <div style={{
                        maxHeight: 220, overflowY: 'auto', border: '1px solid #e2e8f0',
                        borderRadius: 8, padding: 8,
                      }}>
                        {Object.entries(subjectsByClasse).map(([classeName, list]) => (
                          <div key={classeName} style={{ marginBottom: 8 }}>
                            <div style={{
                              fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                              color: '#98a2b3', margin: '4px 0',
                            }}>
                              {classeName}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                              {list.map(s => {
                                const checked = form.subject_ids.includes(s.id);
                                const takenByOther = s.teacher && !checked;
                                return (
                                  <label key={s.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    fontSize: '0.85rem', cursor: 'pointer', padding: '3px 4px',
                                    borderRadius: 6, background: checked ? ROLE_COLORS.TEACHER + '15' : 'transparent',
                                  }}>
                                    <input type="checkbox" checked={checked}
                                      onChange={() => toggleSubject(s.id)} />
                                    <span>
                                      {s.name}
                                      {takenByOther && (
                                        <span style={{ fontSize: '0.7rem', color: '#f59e0b', display: 'block' }}>
                                          actuel : {s.teacher_name}
                                        </span>
                                      )}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <small style={{ color: '#98a2b3' }}>
                      Cochez les matières (par classe) que ce professeur enseignera.
                    </small>
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

      {/* Modal liens d'inscription */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3><FiLink style={{ marginRight: 8 }} />Liens d'inscription</h3>
              <button className="btn-icon" onClick={() => setShowInviteModal(false)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#667085', marginTop: 0 }}>
                Générez un lien à transmettre à un professeur ou un agent : il créera lui-même
                son compte. Chaque lien est à usage unique.
              </p>

              {/* Formulaire de génération */}
              <form onSubmit={createInvitation} style={{
                display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
                background: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 18,
              }}>
                <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
                  <label>Rôle</label>
                  <select className="form-control" value={inviteForm.role}
                    onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}>
                    <option value="TEACHER">Professeur</option>
                    <option value="AGENT">Agent d'accueil</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                  <label>Repère (facultatif)</label>
                  <input className="form-control" placeholder="Ex : M. Diallo"
                    value={inviteForm.note}
                    onChange={e => setInviteForm({ ...inviteForm, note: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0, width: 120 }}>
                  <label>Expire (jours)</label>
                  <input type="number" min="1" max="365" className="form-control" placeholder="∞"
                    value={inviteForm.expires_in_days}
                    onChange={e => setInviteForm({ ...inviteForm, expires_in_days: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={creatingInvite}>
                  <FiPlus size={14} /> {creatingInvite ? '...' : 'Générer'}
                </button>
              </form>

              {/* Liste des liens */}
              {invitations.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#98a2b3', padding: 20 }}>
                  Aucun lien généré pour l'instant.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {invitations.map(inv => {
                    const status = inv.is_used ? { label: 'Utilisé', color: '#10b981' }
                      : inv.is_expired ? { label: 'Expiré', color: '#ef4444' }
                      : { label: 'Actif', color: '#3b5beb' };
                    return (
                      <div key={inv.id} style={{
                        border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                            background: (ROLE_COLORS[inv.role] || '#667085') + '20',
                            color: ROLE_COLORS[inv.role] || '#667085',
                          }}>
                            {inv.role_display}
                          </span>
                          {inv.note && <span style={{ fontSize: '0.85rem', color: '#344054' }}>{inv.note}</span>}
                          <span style={{
                            marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700,
                            color: status.color,
                          }}>
                            ● {status.label}
                            {inv.is_used && inv.used_by_name ? ` — ${inv.used_by_name}` : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                          <input readOnly className="form-control" value={inviteLink(inv.token)}
                            onFocus={e => e.target.select()}
                            style={{ fontSize: '0.78rem', fontFamily: 'monospace', flex: 1,
                              opacity: inv.is_valid ? 1 : 0.5 }} />
                          {inv.is_valid && (
                            <button type="button" className="btn btn-sm btn-secondary"
                              title="Copier le lien" onClick={() => copyLink(inv.token)}>
                              {copiedToken === inv.token ? <FiCheck size={14} /> : <FiCopy size={14} />}
                            </button>
                          )}
                          <button type="button" className="btn btn-sm btn-danger"
                            title="Supprimer le lien" onClick={() => revokeInvitation(inv.id)}>
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
