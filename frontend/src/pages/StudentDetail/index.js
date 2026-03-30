import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { downloadFile } from '../../utils/downloadPdf';
import {
  FiArrowLeft, FiUser, FiBookOpen, FiCalendar, FiDollarSign, FiDownload,
  FiCheckCircle, FiAlertCircle, FiClock, FiCamera, FiUpload,
} from 'react-icons/fi';

function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  const reload = () => {
    api.get(`/students/${id}/situation/`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [id]); // eslint-disable-line

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await api.patch(`/students/${id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      reload();
    } catch (err) {
      alert('Erreur lors de l\'upload : ' + JSON.stringify(err.response?.data));
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!data) return <div style={{ padding: 40, color: '#ef4444' }}>Élève introuvable.</div>;

  const { student, academic, attendance, payments } = data;

  const avgColor = (avg) => {
    if (avg === null || avg === undefined) return '#98a2b3';
    if (avg >= 16) return '#10b981';
    if (avg >= 14) return '#3b82f6';
    if (avg >= 10) return '#f59e0b';
    return '#ef4444';
  };

  const payBadge = (status) => {
    const map = { PAID: 'badge-success', PENDING: 'badge-warning', OVERDUE: 'badge-danger', PARTIAL: 'badge-info' };
    const lbl = { PAID: 'Payé', PENDING: 'En attente', OVERDUE: 'En retard', PARTIAL: 'Partiel' };
    return <span className={`badge ${map[status] || ''}`}>{lbl[status] || status}</span>;
  };

  const appreciation = (avg) => {
    if (!avg) return '-';
    if (avg >= 16) return 'Très Bien';
    if (avg >= 14) return 'Bien';
    if (avg >= 12) return 'Assez Bien';
    if (avg >= 10) return 'Passable';
    return 'Insuffisant';
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/students')}>
            <FiArrowLeft size={16} />
          </button>
          {student.photo ? (
            <img src={student.photo} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f2f4f7', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e2e8f0' }}>
              <FiUser size={20} color="#98a2b3" />
            </div>
          )}
          <div>
            <h2>{student.last_name} {student.first_name}</h2>
            <p>{student.matricule} · {student.classe_name || '-'}</p>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => downloadFile(`/reports/bulletin/${id}/`, `bulletin_${student.last_name}.pdf`)}
        >
          <FiDownload size={15} /> Télécharger bulletin
        </button>
      </div>

      {/* Profil */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiUser size={16} /><h3>Profil</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {/* Photo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                {student.photo ? (
                  <img
                    src={student.photo}
                    alt={student.full_name}
                    style={{ width: 110, height: 110, borderRadius: 12, objectFit: 'cover', border: '3px solid #e2e8f0', display: 'block' }}
                  />
                ) : (
                  <div style={{
                    width: 110, height: 110, borderRadius: 12, border: '3px solid #e2e8f0',
                    background: '#f2f4f7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <FiUser size={48} color="#98a2b3" />
                  </div>
                )}
                {/* Bouton caméra superposé */}
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  title="Changer la photo"
                  style={{
                    position: 'absolute', bottom: -8, right: -8,
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#3b5beb', color: '#fff', border: '2px solid #fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                  }}
                >
                  {uploadingPhoto ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite', display: 'block' }} /> : <FiCamera size={14} />}
                </button>
              </div>

              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                <FiUpload size={13} /> {student.photo ? 'Changer' : 'Ajouter photo'}
              </button>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handlePhotoUpload(e.target.files[0])}
              />
            </div>

            {/* Champs */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px 24px', alignContent: 'start' }}>
              <Field label="Nom" value={student.last_name} />
              <Field label="Prénom" value={student.first_name} />
              <Field label="Genre" value={student.gender === 'M' ? 'Masculin' : 'Féminin'} />
              <Field label="Date de naissance" value={student.date_of_birth || '-'} />
              <Field label="Lieu de naissance" value={student.birth_place || '-'} />
              <Field label="Nationalité" value={student.nationality || '-'} />
              <Field label="Classe" value={student.classe_name || '-'} />
              <Field label="Nom du parent" value={student.parent_name || '-'} />
              <Field label="N° parent" value={student.parent_phone || '-'} />
            </div>
          </div>
        </div>
      </div>

      {/* Notes / Moyennes */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiBookOpen size={16} /><h3>Résultats scolaires</h3>
          </div>
          {academic.general_average !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '0.85rem', color: '#667085' }}>Moyenne générale :</span>
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: avgColor(academic.general_average) }}>
                {academic.general_average}/20
              </span>
              <span className={`badge ${academic.general_average >= 14 ? 'badge-success' : academic.general_average >= 10 ? 'badge-warning' : 'badge-danger'}`}>
                {appreciation(academic.general_average)}
              </span>
            </div>
          )}
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Matière</th>
                <th style={{ textAlign: 'center' }}>Coeff.</th>
                <th style={{ textAlign: 'center' }}>Moyenne</th>
                <th>Notes détaillées</th>
              </tr>
            </thead>
            <tbody>
              {academic.subjects.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 32, color: '#98a2b3' }}>Aucune note saisie</td></tr>
              ) : academic.subjects.map(s => (
                <tr key={s.subject}>
                  <td><strong>{s.subject}</strong></td>
                  <td style={{ textAlign: 'center' }}>{s.coefficient}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: avgColor(s.average) }}>
                    {s.average !== null ? `${s.average}/20` : '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {s.grades.length === 0
                        ? <span style={{ color: '#98a2b3', fontSize: '0.82rem' }}>—</span>
                        : s.grades.map((g, i) => (
                          <span key={i} style={{
                            background: '#f2f4f7', padding: '2px 8px', borderRadius: 6,
                            fontSize: '0.82rem', fontWeight: 600
                          }}>
                            {g.value}/{g.max_value} <span style={{ color: '#98a2b3', fontSize: '0.72rem' }}>{g.type}</span>
                          </span>
                        ))
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Présences */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiCalendar size={16} /><h3>Présences & Absences</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <AttStat icon={<FiCalendar color="#667085" />} label="Total jours" value={attendance.total || 0} color="#344054" />
            <AttStat icon={<FiCheckCircle color="#10b981" />} label="Présent" value={attendance.present || 0} color="#10b981" />
            <AttStat icon={<FiClock color="#f59e0b" />} label="Retard" value={attendance.late || 0} color="#f59e0b" />
            <AttStat icon={<FiAlertCircle color="#ef4444" />} label="Absent" value={attendance.absent || 0} color="#ef4444" />
          </div>
        </div>
      </div>

      {/* Paiements */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiDollarSign size={16} /><h3>Historique des paiements</h3>
          </div>
          <span style={{ fontWeight: 700, color: '#10b981' }}>
            Total payé : {Number(payments.total_paid).toLocaleString()} FCFA
          </span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>N° Reçu</th>
                <th>Type</th>
                <th>Montant</th>
                <th>Date</th>
                <th>Échéance</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {payments.history.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 32, color: '#98a2b3' }}>Aucun paiement enregistré</td></tr>
              ) : payments.history.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.receipt_number}</strong></td>
                  <td>{p.payment_type}</td>
                  <td style={{ fontWeight: 700 }}>{Number(p.amount).toLocaleString()} FCFA</td>
                  <td>{p.payment_date}</td>
                  <td>{p.due_date || '-'}</td>
                  <td>{payBadge(p.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#667085', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function AttStat({ icon, label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 8px', background: '#f9fafb', borderRadius: 10 }}>
      <div style={{ marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.82rem', color: '#667085' }}>{label}</div>
    </div>
  );
}

export default StudentDetail;
