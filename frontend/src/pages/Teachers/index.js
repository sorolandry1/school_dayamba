import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiSearch, FiEye, FiX, FiGrid, FiSave, FiClock } from 'react-icons/fi';
import { downloadFile } from '../../utils/downloadPdf';

function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [profileTeacher, setProfileTeacher] = useState(null);
  // Affectation de classes
  const [classes, setClasses] = useState([]);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignIds, setAssignIds] = useState([]);
  const [savingAssign, setSavingAssign] = useState(false);

  const fetchTeachers = useCallback(async () => {
    try {
      let url = '/teachers/';
      if (search) url += `?search=${search}`;
      const res = await api.get(url);
      setTeachers(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  useEffect(() => {
    api.get('/classes/', { params: { page_size: 500 } })
      .then(r => setClasses(r.data.results || r.data)).catch(() => {});
  }, []);

  const classesByLevel = classes.reduce((acc, c) => {
    const key = c.level_name || 'Autres';
    (acc[key] = acc[key] || []).push(c);
    return acc;
  }, {});

  const openAssign = (teacher) => {
    setAssignTarget(teacher);
    setAssignIds(teacher.assigned_class_ids || []);
  };

  const toggleAssign = (id) => setAssignIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const saveAssign = async () => {
    setSavingAssign(true);
    try {
      await api.post(`/teachers/${assignTarget.id}/assign_classes/`, { class_ids: assignIds });
      setAssignTarget(null);
      fetchTeachers();
    } catch (err) {
      alert('Erreur: ' + JSON.stringify(err.response?.data));
    } finally { setSavingAssign(false); }
  };

  const handleViewProfile = (teacher) => {
    setProfileTeacher(teacher);
    setShowProfile(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Professeurs</h2>
          <p>{teachers.length} professeur(s) enregistré(s)</p>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-input">
          <FiSearch size={16} />
          <input
            placeholder="Rechercher un professeur..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? <div className="loading-container"><div className="spinner" /></div> : (
            <table>
              <thead>
                <tr>
                  <th>Nom & Prénom</th>
                  <th>Matière / Spécialité</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Matières enseignées</th>
                  <th>Classes affectées</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>
                      Aucun professeur trouvé
                    </td>
                  </tr>
                ) : teachers.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.last_name} {t.first_name}</strong></td>
                    <td>{t.speciality || '-'}</td>
                    <td>{t.phone || '-'}</td>
                    <td>{t.email || '-'}</td>
                    <td>
                      {t.subjects && t.subjects.length > 0
                        ? t.subjects.map(s => s.name).join(', ')
                        : '-'}
                    </td>
                    <td>
                      {t.assigned_classes && t.assigned_classes.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {t.assigned_classes.map(c => (
                            <span key={c.id} className="badge badge-info">{c.name}</span>
                          ))}
                        </div>
                      ) : <span style={{ color: '#98a2b3' }}>-</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          title="Voir profil"
                          onClick={() => handleViewProfile(t)}
                        >
                          <FiEye size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          title="Emploi du temps (PDF)"
                          onClick={() => downloadFile(`/reports/teacher-timetable/${t.id}/`, `emploi_du_temps_${t.last_name}_${t.first_name}.pdf`)}
                        >
                          <FiClock size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          title="Affecter des classes"
                          onClick={() => openAssign(t)}
                        >
                          <FiGrid size={14} /> Classes
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

      {/* Modal affectation de classes */}
      {assignTarget && (
        <div className="modal-overlay" onClick={() => setAssignTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3><FiGrid style={{ marginRight: 8 }} />Affecter des classes</h3>
              <button className="btn-icon" onClick={() => setAssignTarget(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#667085', marginTop: 0 }}>
                Professeur : <strong>{assignTarget.last_name} {assignTarget.first_name}</strong>
                {assignIds.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: '0.8rem', fontWeight: 600, color: '#10b981' }}>
                    {assignIds.length} classe(s) sélectionnée(s)
                  </span>
                )}
              </p>
              {classes.length === 0 ? (
                <p style={{ color: '#98a2b3' }}>Aucune classe disponible. Créez d'abord des classes.</p>
              ) : (
                <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
                  {Object.entries(classesByLevel).map(([levelName, list]) => (
                    <div key={levelName} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#98a2b3', margin: '4px 0' }}>
                        {levelName}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                        {list.map(c => {
                          const checked = assignIds.includes(c.id);
                          return (
                            <label key={c.id} style={{
                              display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem',
                              cursor: 'pointer', padding: '3px 4px', borderRadius: 6,
                              background: checked ? '#e0f2fe' : 'transparent',
                            }}>
                              <input type="checkbox" checked={checked} onChange={() => toggleAssign(c.id)} />
                              {c.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAssignTarget(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveAssign} disabled={savingAssign}>
                <FiSave size={14} /> {savingAssign ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal profil professeur */}
      {showProfile && profileTeacher && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Profil du professeur</h3>
              <button className="btn-icon" onClick={() => setShowProfile(false)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                <ProfileField label="Nom" value={profileTeacher.last_name} />
                <ProfileField label="Prénom" value={profileTeacher.first_name} />
                <ProfileField label="Matière / Spécialité" value={profileTeacher.speciality || '-'} />
                <ProfileField label="Contact (téléphone)" value={profileTeacher.phone || '-'} />
                <ProfileField label="Email" value={profileTeacher.email || '-'} />
                <ProfileField label="Nom d'utilisateur" value={profileTeacher.username || '-'} />
              </div>
              {profileTeacher.subjects && profileTeacher.subjects.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: '0.75rem', color: '#667085', marginBottom: 6 }}>
                    Matières enseignées
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {profileTeacher.subjects.map(s => (
                      <span key={s.id} className="badge badge-info">{s.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowProfile(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#667085', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 500, color: '#101828' }}>{value}</div>
    </div>
  );
}

export default Teachers;
