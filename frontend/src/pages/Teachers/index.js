import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiSearch, FiEye, FiX } from 'react-icons/fi';

function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [profileTeacher, setProfileTeacher] = useState(null);

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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>
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
                      <button
                        className="btn btn-sm btn-secondary"
                        title="Voir profil"
                        onClick={() => handleViewProfile(t)}
                      >
                        <FiEye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

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
