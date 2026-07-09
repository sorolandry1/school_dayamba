import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FiUser, FiPhone, FiMail, FiBook, FiSave, FiKey, FiX, FiClock } from 'react-icons/fi';
import { downloadFile } from '../../utils/downloadPdf';

function TeacherProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ phone: '', email: '' });
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/auth/me/'),
      api.get('/teachers/me/'),
    ]).then(([meRes, teacherRes]) => {
      setProfile({ ...meRes.data, teacher: teacherRes.data });
      setForm({ phone: meRes.data.phone || '', email: meRes.data.email || '' });
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/auth/me/', form);
      setProfile(prev => ({ ...prev, ...form }));
      setEditing(false);
    } catch (err) { alert('Erreur: ' + JSON.stringify(err.response?.data)); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');
    if (pwdForm.new_password !== pwdForm.confirm) {
      setPwdError('Les mots de passe ne correspondent pas.');
      return;
    }
    try {
      await api.put('/auth/change-password/', {
        old_password: pwdForm.old_password,
        new_password: pwdForm.new_password,
      });
      alert('Mot de passe modifié avec succès.');
      setShowPwdModal(false);
      setPwdForm({ old_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwdError(err.response?.data?.old_password?.[0] || 'Erreur lors du changement de mot de passe.');
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!profile) return null;

  const teacher = profile.teacher;
  const subjects = teacher?.subjects || [];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h2>Mon Profil</h2>
          <p>Informations personnelles et paramètres du compte</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => downloadFile('/reports/teacher-timetable/', 'mon_emploi_du_temps.pdf')}>
            <FiClock size={15} /> Mon emploi du temps
          </button>
          <button className="btn btn-secondary" onClick={() => setShowPwdModal(true)}>
            <FiKey size={15} /> Changer le mot de passe
          </button>
        </div>
      </div>

      {/* Avatar + identité */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b5beb, #1e40af)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '1.8rem', fontWeight: 800, flexShrink: 0,
          }}>
            {(profile.first_name?.[0] || '?').toUpperCase()}{(profile.last_name?.[0] || '').toUpperCase()}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{profile.last_name} {profile.first_name}</h3>
            <p style={{ margin: '4px 0 0', color: '#667085' }}>Professeur · {profile.username}</p>
            <span style={{
              display: 'inline-block', marginTop: 6, padding: '3px 12px',
              background: '#dcfce7', color: '#166534', borderRadius: 20,
              fontSize: '0.78rem', fontWeight: 600,
            }}>
              Compte actif
            </span>
          </div>
        </div>
      </div>

      {/* Informations modifiables */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3><FiUser size={16} style={{ marginRight: 8 }} />Informations de contact</h3>
          {!editing && (
            <button className="btn btn-sm btn-secondary" onClick={() => setEditing(true)}>Modifier</button>
          )}
        </div>
        <div className="card-body">
          {editing ? (
            <form onSubmit={handleSave}>
              <div className="form-row">
                <div className="form-group">
                  <label><FiPhone size={13} /> Téléphone</label>
                  <input className="form-control" value={form.phone}
                    onChange={e => setForm({...form, phone: e.target.value})}
                    placeholder="Ex: 0708090011" />
                </div>
                <div className="form-group">
                  <label><FiMail size={13} /> Email</label>
                  <input type="email" className="form-control" value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary"><FiSave size={14} /> Enregistrer</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Annuler</button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
              <Field icon={<FiUser />} label="Nom" value={profile.last_name} />
              <Field icon={<FiUser />} label="Prénom" value={profile.first_name} />
              <Field icon={<FiPhone />} label="Téléphone" value={profile.phone || '—'} />
              <Field icon={<FiMail />} label="Email" value={profile.email || '—'} />
            </div>
          )}
        </div>
      </div>

      {/* Matières et classes */}
      <div className="card">
        <div className="card-header">
          <h3><FiBook size={16} style={{ marginRight: 8 }} />Mes matières assignées</h3>
        </div>
        <div className="card-body">
          {subjects.length === 0 ? (
            <p style={{ color: '#98a2b3', textAlign: 'center', padding: 20 }}>
              Aucune matière assignée. Contactez le directeur.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {subjects.map(s => (
                <div key={s.id} style={{
                  padding: '14px 16px', borderRadius: 10,
                  border: '1px solid #e2e8f0', background: '#f8faff',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#667085', marginTop: 2 }}>
                      {s.classe_name} · Coeff. {s.coefficient}
                    </div>
                  </div>
                  <span style={{
                    background: '#dbeafe', color: '#1d4ed8',
                    padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                  }}>
                    {s.coefficient}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal changement mot de passe */}
      {showPwdModal && (
        <div className="modal-overlay" onClick={() => setShowPwdModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Changer le mot de passe</h3>
              <button className="btn-icon" onClick={() => setShowPwdModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="modal-body">
                {pwdError && (
                  <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
                    {pwdError}
                  </div>
                )}
                <div className="form-group">
                  <label>Mot de passe actuel</label>
                  <input type="password" className="form-control" required value={pwdForm.old_password}
                    onChange={e => setPwdForm({...pwdForm, old_password: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Nouveau mot de passe</label>
                  <input type="password" className="form-control" required minLength={8}
                    value={pwdForm.new_password}
                    onChange={e => setPwdForm({...pwdForm, new_password: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Confirmer le nouveau mot de passe</label>
                  <input type="password" className="form-control" required
                    value={pwdForm.confirm}
                    onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPwdModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary"><FiKey size={14} /> Modifier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ icon, label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#667085', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}

export default TeacherProfile;
