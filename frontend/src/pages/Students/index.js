import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiEye, FiX,
  FiFileText, FiUpload, FiDownload, FiCheck, FiAlertCircle,
  FiSkipForward, FiChevronDown, FiChevronUp, FiCamera, FiUser,
} from 'react-icons/fi';

const emptyForm = {
  first_name: '', last_name: '', gender: 'M', classe: '',
  date_of_birth: '', birth_place: '', nationality: '',
  parent_name: '', parent_phone: '', parent_email: '', address: '',
  photo: null,  // File object
};

function Students() {
  const navigate = useNavigate();
  const [students, setStudents]         = useState([]);
  const [stats, setStats]               = useState(null);   // { total, capacity, capacity_remaining }
  const [classes, setClasses]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterClasse, setFilterClasse] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [showProfile, setShowProfile]   = useState(false);
  const [profileStudent, setProfileStudent] = useState(null);
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState(emptyForm);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoInputRef                   = useRef(null);
  // Import state
  const [showImport, setShowImport]     = useState(false);

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

  const fetchStats = useCallback(() => {
    api.get('/students/stats/').then(r => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    api.get('/classes/current_year/').then(r => setClasses(r.data.results || r.data)).catch(() => {});
  }, []);

  const handlePhotoChange = (file) => {
    if (!file) return;
    setForm(f => ({ ...f, photo: file }));
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (key === 'photo') {
          if (val instanceof File) fd.append('photo', val);
        } else if (val !== '' && val !== null && val !== undefined) {
          fd.append(key, val);
        }
      });
      if (editing) {
        await api.patch(`/students/${editing.id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/students/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      setPhotoPreview(null);
      fetchStudents();
      fetchStats();
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.detail || (typeof data === 'object' ? JSON.stringify(data) : data) || err.message;
      alert('Erreur: ' + msg);
    }
  };

  const handleEdit = (student) => {
    setEditing(student);
    setForm({
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      gender: student.gender || 'M',
      classe: student.classe || '',
      date_of_birth: student.date_of_birth || '',
      birth_place: student.birth_place || '',
      nationality: student.nationality || '',
      parent_name: student.parent_name || '',
      parent_phone: student.parent_phone || '',
      parent_email: student.parent_email || '',
      address: student.address || '',
      photo: null,
    });
    setPhotoPreview(student.photo_url || null);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet élève ?')) return;
    await api.delete(`/students/${id}/`);
    fetchStudents();
    fetchStats();
  };

  const handleViewProfile = (student) => {
    setProfileStudent(student);
    setShowProfile(true);
  };

  const paymentBadge = (status) => {
    const map    = { PAID: 'badge-success', PENDING: 'badge-warning', OVERDUE: 'badge-danger' };
    const labels = { PAID: 'Payé', PENDING: 'En attente', OVERDUE: 'En retard' };
    return <span className={`badge ${map[status] || 'badge-info'}`}>{labels[status] || status}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Gestion des Élèves</h2>
          {stats ? (
            <p style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span><strong>{stats.total}</strong> / {stats.capacity} élèves actifs</span>
              <span className={`badge ${stats.capacity_remaining === 0 ? 'badge-danger' : stats.capacity_remaining <= 200 ? 'badge-warning' : 'badge-success'}`}>
                {stats.capacity_remaining === 0
                  ? 'Capacité maximale atteinte'
                  : `${stats.capacity_remaining} places restantes`}
              </span>
            </p>
          ) : (
            <p>{students.length} élèves enregistrés</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowImport(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FiUpload size={15} /> Importer
          </button>
          <button
            className="btn btn-primary"
            disabled={stats?.capacity_remaining === 0}
            title={stats?.capacity_remaining === 0 ? 'Capacité maximale de l\'établissement atteinte' : ''}
            onClick={() => { setEditing(null); setForm(emptyForm); setPhotoPreview(null); setShowModal(true); }}
          >
            <FiPlus /> Nouvel élève
          </button>
        </div>
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
                  <th style={{ width: 48 }}>Photo</th>
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
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: 40, color: '#98a2b3' }}>Aucun élève trouvé</td></tr>
                ) : students.map(s => (
                  <tr key={s.id}>
                    <td>
                      {s.photo_url ? (
                        <img src={s.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f2f4f7', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e2e8f0' }}>
                          <FiUser size={16} color="#98a2b3" />
                        </div>
                      )}
                    </td>
                    <td><strong>{s.matricule}</strong></td>
                    <td>{s.last_name} {s.first_name}</td>
                    <td>{s.classe_name || '-'}</td>
                    <td>{s.gender === 'M' ? 'Garçon' : 'Fille'}</td>
                    <td>{s.parent_phone || '-'}</td>
                    <td>{paymentBadge(s.payment_status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-secondary" title="Fiche complète" onClick={() => navigate(`/students/${s.id}`)}><FiFileText size={14} /></button>
                        <button className="btn btn-sm btn-secondary" title="Voir profil" onClick={() => handleViewProfile(s)}><FiEye size={14} /></button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(s)}><FiEdit2 size={14} /></button>
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

      {/* ── Modal Import ─────────────────────────────────────────────────── */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); fetchStudents(); }}
        />
      )}

      {/* ── Modal profil élève ───────────────────────────────────────────── */}
      {showProfile && profileStudent && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Profil de l'élève</h3>
              <button className="btn-icon" onClick={() => setShowProfile(false)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                <ProfileField label="Nom" value={profileStudent.last_name} />
                <ProfileField label="Prénom" value={profileStudent.first_name} />
                <ProfileField label="Date de naissance" value={profileStudent.date_of_birth || '-'} />
                <ProfileField label="Lieu de naissance" value={profileStudent.birth_place || '-'} />
                <ProfileField label="Nationalité" value={profileStudent.nationality || '-'} />
                <ProfileField label="Genre" value={profileStudent.gender === 'M' ? 'Masculin' : 'Féminin'} />
                <ProfileField label="Classe" value={profileStudent.classe_name || '-'} />
                <ProfileField label="Matricule" value={profileStudent.matricule} />
                <ProfileField label="Nom du parent" value={profileStudent.parent_name || '-'} />
                <ProfileField label="N° parent" value={profileStudent.parent_phone || '-'} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowProfile(false)}>Fermer</button>
              <button className="btn btn-primary" onClick={() => { setShowProfile(false); handleEdit(profileStudent); }}>Modifier</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ajout/modification ─────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? "Modifier l'élève" : 'Nouvel élève'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* ── Photo upload ── */}
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    style={{
                      width: 80, height: 80, borderRadius: '50%', cursor: 'pointer',
                      border: '2px dashed #e2e8f0', background: '#f8fafc',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', flexShrink: 0, position: 'relative',
                    }}
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <FiUser size={32} color="#98a2b3" />
                    )}
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0,
                      background: '#3b5beb', borderRadius: '50%',
                      width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <FiCamera size={12} color="#fff" />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Photo de l'élève</div>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '5px 12px' }}
                      onClick={() => photoInputRef.current?.click()}>
                      <FiUpload size={13} /> {photoPreview ? 'Changer la photo' : 'Ajouter une photo'}
                    </button>
                    {photoPreview && (
                      <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '5px 12px', marginLeft: 6, color: '#ef4444' }}
                        onClick={() => { setPhotoPreview(null); setForm(f => ({ ...f, photo: null })); }}>
                        Supprimer
                      </button>
                    )}
                    <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handlePhotoChange(e.target.files[0])} />
                    <div style={{ fontSize: '0.72rem', color: '#98a2b3', marginTop: 4 }}>JPG, PNG — max 5 Mo</div>
                  </div>
                </div>

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
                    <label>Date de naissance</label>
                    <input type="date" className="form-control" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Lieu de naissance</label>
                    <input className="form-control" value={form.birth_place} onChange={e => setForm({...form, birth_place: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nationalité</label>
                    <input className="form-control" value={form.nationality} onChange={e => setForm({...form, nationality: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Genre</label>
                    <select className="form-control" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Classe</label>
                  <select className="form-control" required value={form.classe} onChange={e => setForm({...form, classe: e.target.value})}>
                    <option value="">Sélectionner</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nom du parent</label>
                    <input className="form-control" value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>N° parent</label>
                    <input className="form-control" value={form.parent_phone} onChange={e => setForm({...form, parent_phone: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email parent</label>
                    <input type="email" className="form-control" value={form.parent_email} onChange={e => setForm({...form, parent_email: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Adresse</label>
                    <input className="form-control" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                  </div>
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

// ── Import Modal ──────────────────────────────────────────────────────────────

function ImportModal({ onClose, onSuccess }) {
  const fileRef           = useRef(null);
  const [file, setFile]   = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);   // { created, skipped, errors, total }
  const [showErrors, setShowErrors] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/students/import_template/', { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', 'modele_import_eleves.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch { alert('Erreur lors du téléchargement du modèle.'); }
  };

  const handleFilePick = (picked) => {
    if (!picked) return;
    const ext = picked.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'csv'].includes(ext)) {
      alert('Format non supporté. Utilisez un fichier .xlsx ou .csv');
      return;
    }
    setFile(picked);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFilePick(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/students/import_students/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur lors de l\'import.';
      setResult({ apiError: msg });
    } finally {
      setUploading(false);
    }
  };

  const done = result && !result.apiError;
  const allOk = done && result.errors.length === 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        {/* Header */}
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiUpload size={18} /> Import d'élèves
          </h3>
          <button className="btn-icon" onClick={onClose}><FiX /></button>
        </div>

        <div className="modal-body">
          {/* Step 1 — Download template */}
          {!done && (
            <div style={{
              background: '#f0f9ff', border: '1px solid #bae6fd',
              borderRadius: 8, padding: '14px 16px', marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0369a1' }}>
                  Télécharger le modèle Excel
                </div>
                <div style={{ fontSize: '0.78rem', color: '#0284c7', marginTop: 2 }}>
                  Colonnes en bleu clair = obligatoires · Remplissez à partir de la ligne 2
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleDownloadTemplate}
                style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              >
                <FiDownload size={14} /> Modèle .xlsx
              </button>
            </div>
          )}

          {/* Step 2 — Drop zone */}
          {!done && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--primary-500)' : file ? '#22c55e' : 'var(--gray-300)'}`,
                borderRadius: 10,
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'var(--primary-50)' : file ? '#f0fdf4' : 'var(--gray-25)',
                transition: 'all 0.2s',
                marginBottom: 16,
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                style={{ display: 'none' }}
                onChange={e => handleFilePick(e.target.files[0])}
              />
              {file ? (
                <div>
                  <FiCheck size={32} color="#22c55e" style={{ marginBottom: 8 }} />
                  <div style={{ fontWeight: 600, color: '#166534' }}>{file.name}</div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>
                    {(file.size / 1024).toFixed(1)} Ko — Cliquer pour changer
                  </div>
                </div>
              ) : (
                <div>
                  <FiUpload size={32} color="var(--gray-400)" style={{ marginBottom: 8 }} />
                  <div style={{ fontWeight: 600, color: 'var(--gray-600)' }}>
                    Glissez votre fichier ici ou cliquez pour parcourir
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: 4 }}>
                    Formats acceptés : .xlsx · .csv
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Colonnes attendues */}
          {!done && (
            <div style={{
              background: 'var(--gray-50)', borderRadius: 8,
              padding: '10px 14px', fontSize: '0.78rem', color: 'var(--gray-500)',
            }}>
              <strong style={{ color: 'var(--gray-700)' }}>Colonnes attendues :</strong>{' '}
              <span style={{ color: 'var(--primary-600)', fontWeight: 600 }}>nom · prenom · genre · classe</span>
              {' '}(obligatoires) ·{' '}
              date_naissance · lieu_naissance · nationalite · nom_parent · tel_parent · email_parent · adresse
            </div>
          )}

          {/* API error */}
          {result?.apiError && (
            <div style={{
              background: '#fee2e2', border: '1px solid #fca5a5',
              borderRadius: 8, padding: '12px 16px',
              color: '#991b1b', display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <FiAlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>{result.apiError}</div>
            </div>
          )}

          {/* Results */}
          {done && (
            <div>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                <StatCard
                  icon={<FiCheck size={20} />}
                  value={result.created}
                  label="Créés"
                  color="#166534" bg="#dcfce7"
                />
                <StatCard
                  icon={<FiSkipForward size={20} />}
                  value={result.skipped}
                  label="Ignorés (doublon)"
                  color="#92400e" bg="#fef3c7"
                />
                <StatCard
                  icon={<FiAlertCircle size={20} />}
                  value={result.errors.length}
                  label="Erreurs"
                  color="#991b1b" bg="#fee2e2"
                />
              </div>

              {/* Success message */}
              {allOk && (
                <div style={{
                  background: '#dcfce7', border: '1px solid #86efac',
                  borderRadius: 8, padding: '12px 16px',
                  color: '#166534', display: 'flex', gap: 10, alignItems: 'center',
                  fontWeight: 600,
                }}>
                  <FiCheck size={18} />
                  {result.created} élève(s) importé(s) avec succès.
                  {result.skipped > 0 && ` ${result.skipped} doublon(s) ignoré(s).`}
                </div>
              )}

              {/* Error details */}
              {result.errors.length > 0 && (
                <div style={{ border: '1px solid #fca5a5', borderRadius: 8, overflow: 'hidden' }}>
                  <button
                    onClick={() => setShowErrors(v => !v)}
                    style={{
                      width: '100%', padding: '10px 16px',
                      background: '#fee2e2', border: 'none', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontWeight: 600, color: '#991b1b', fontSize: '0.875rem',
                    }}
                  >
                    <span><FiAlertCircle size={14} style={{ marginRight: 6 }} />{result.errors.length} ligne(s) en erreur</span>
                    {showErrors ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                  </button>
                  {showErrors && (
                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                      {result.errors.map((err, i) => (
                        <div key={i} style={{
                          padding: '10px 16px',
                          borderTop: '1px solid #fecaca',
                          background: i % 2 === 0 ? '#fff' : '#fff7f7',
                        }}>
                          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 2 }}>
                            Ligne {err.row} — {err.data ? Object.values(err.data).filter(Boolean).join(' · ') : ''}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#991b1b', fontWeight: 500 }}>
                            {err.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {!done ? (
            <>
              <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!file || uploading}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {uploading ? (
                  <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Import en cours...</>
                ) : (
                  <><FiUpload size={15} /> Lancer l'import</>
                )}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => { setResult(null); setFile(null); }}>
                Nouvel import
              </button>
              <button className="btn btn-primary" onClick={onSuccess}>
                Fermer et actualiser
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, color, bg }) {
  return (
    <div style={{
      background: bg, borderRadius: 10, padding: '16px 12px',
      textAlign: 'center',
    }}>
      <div style={{ color, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color, marginTop: 4, fontWeight: 500 }}>{label}</div>
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

export default Students;
