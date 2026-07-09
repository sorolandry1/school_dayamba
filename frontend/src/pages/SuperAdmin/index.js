import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { downloadFile } from '../../utils/downloadPdf';
import { SINGLE_SCHOOL_MODE } from '../../config';

// Convertit une data URL (base64) en Blob pour l'upload du logo
function dataURLtoBlob(dataurl) {
  try {
    const comma = dataurl.indexOf(',');
    const head = dataurl.slice(0, comma);
    const body = dataurl.slice(comma + 1);
    const mime = head.match(/:(.*?);/)[1];
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch { return null; }
}
import {
  FiSettings, FiSliders, FiFileText, FiToggleRight, FiToggleLeft,
  FiSave, FiUpload, FiRefreshCw, FiAlertCircle, FiCheckCircle,
  FiLayout, FiArrowRight, FiPlus, FiEdit2, FiTrash2, FiX, FiHome,
  FiGlobe,
} from 'react-icons/fi';

// ─── Constantes ───────────────────────────────────────────────────────────────

const SCHOOL_TYPE_OPTIONS = [
  { value: 'all', label: 'Tous les établissements' },
  { value: 'primaire', label: 'École primaire' },
  { value: 'college', label: 'Collège' },
  { value: 'lycee', label: 'Lycée' },
  { value: 'universite', label: 'Université' },
  { value: 'technique', label: 'Enseignement technique' },
  { value: 'prive', label: 'Établissement privé' },
];

const DEFAULT_SETTINGS = {
  schoolName: 'SchoolPro',
  schoolYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  schoolType: 'all',
  selectedEcoleId: null,
  matriculeFormat: '',
  receiptFormat: '',
  periodSystem: 'TRIMESTER',
  hoursPerDay: 6,
  themeColor: '#1a3c8f',
  accentColor: '#3b5beb',
  logoUrl: '',
  modules: {
    payments: true,
    reports: true,
    communications: true,
    expenses: true,
    bulletins: true,
    attendance: true,
    grades: true,
    subjects: true,
    logs: true,
    studentCards: true,
  },
  documents: {
    bulletinHeader: '',
    receiptHeader: '',
    cardFooter: 'Document officiel — Ne pas reproduire',
  },
};

const MODULE_LABELS = {
  payments: 'Comptabilité (Paiements)',
  reports: 'Rapports & Statistiques',
  communications: 'Communications',
  expenses: 'Dépenses',
  bulletins: 'Bulletins',
  attendance: 'Présences / Scanner QR',
  grades: 'Gestion des notes',
  subjects: 'Matières',
  logs: 'Journal d\'activité',
  studentCards: 'Cartes Scolaires',
};

const TABS = [
  { key: 'platform', label: 'Plateforme', icon: <FiSliders size={15} /> },
  ...(SINGLE_SCHOOL_MODE ? [] : [{ key: 'schools', label: 'Établissements', icon: <FiHome size={15} /> }]),
  { key: 'modules', label: 'Modules', icon: <FiToggleRight size={15} /> },
  { key: 'documents', label: 'Documents', icon: <FiFileText size={15} /> },
  { key: 'system', label: 'Système', icon: <FiSettings size={15} /> },
];

function loadSettings() {
  try {
    const saved = localStorage.getItem('schoolSettings');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      modules: { ...DEFAULT_SETTINGS.modules, ...(parsed.modules || {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s) {
  localStorage.setItem('schoolSettings', JSON.stringify(s));
  // Broadcast à d'autres onglets
  window.dispatchEvent(new Event('schoolSettingsChanged'));
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 20 }}>
      <h4 style={{ margin: '0 0 18px', color: '#1a1a2e', fontSize: '0.95rem', fontWeight: 700 }}>{title}</h4>
      {children}
    </div>
  );
}

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 32, right: 32, zIndex: 9999,
      background: type === 'success' ? '#10b981' : '#ef4444',
      color: '#fff', padding: '12px 20px', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)', fontWeight: 600, fontSize: '0.9rem',
    }}>
      {type === 'success' ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} />}
      {msg}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function PlatformTab({ settings, onChange, ecoles, selectedEcoleId, onSelectEcole }) {
  const logoRef = useRef();

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange({ ...settings, logoUrl: ev.target.result });
    reader.readAsDataURL(file);
  };

  return (
    <>
      {!SINGLE_SCHOOL_MODE && (
      <SectionCard title="Contexte école">
        <div className="form-group">
          <label>École sélectionnée</label>
          <select className="form-control" value={selectedEcoleId || ''} onChange={e => onSelectEcole(e.target.value || null)}>
            <option value="">Plateforme entière</option>
            {ecoles.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <small style={{ color: '#667085', fontSize: '0.78rem', marginTop: 4, display: 'block' }}>
            Sélectionnez une école pour les actions de super-administrateur et les rapports filtrés.
          </small>
        </div>
      </SectionCard>
      )}
      <SectionCard title="Identité de l'établissement">
        <div className="form-row">
          <div className="form-group">
            <label>Nom de l'établissement</label>
            <input className="form-control" value={settings.schoolName}
              onChange={e => onChange({ ...settings, schoolName: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Année scolaire</label>
            <input className="form-control" value={settings.schoolYear} placeholder="ex: 2025-2026"
              onChange={e => onChange({ ...settings, schoolYear: e.target.value })} />
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 8 }}>
          <label>Type d'établissement</label>
          <select className="form-control" value={settings.schoolType || 'all'}
            onChange={e => onChange({ ...settings, schoolType: e.target.value })}
            style={{ maxWidth: 300 }}>
            {SCHOOL_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <small style={{ color: '#667085', fontSize: '0.78rem', marginTop: 4, display: 'block' }}>
            Utilisé pour sélectionner automatiquement le modèle de document correspondant.
          </small>
        </div>
      </SectionCard>
      <SectionCard title="Numérotation (matricules & reçus)">
        <div className="form-row">
          <div className="form-group">
            <label>Format des matricules</label>
            <input className="form-control" value={settings.matriculeFormat || ''}
              placeholder="ELV-{SEQ:0004}"
              onChange={e => onChange({ ...settings, matriculeFormat: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Format des reçus</label>
            <input className="form-control" value={settings.receiptFormat || ''}
              placeholder="REC-{AAAA}-{SEQ:0004}"
              onChange={e => onChange({ ...settings, receiptFormat: e.target.value })} />
          </div>
        </div>
        <small style={{ color: '#667085', fontSize: '0.78rem', marginTop: 4, display: 'block' }}>
          Jetons disponibles : <code>{'{AAAA}'}</code> année (4 chiffres), <code>{'{AA}'}</code> année (2 chiffres),
          <code>{' {SEQ}'}</code> compteur, <code>{'{SEQ:0004}'}</code> compteur zéro-préfixé.
          Laisser vide pour conserver les valeurs par défaut. Les numéros déjà attribués ne changent pas.
        </small>
      </SectionCard>
      <SectionCard title="Bulletins (périodes & assiduité)">
        <div className="form-row">
          <div className="form-group">
            <label>Découpage de l'année</label>
            <select className="form-control" value={settings.periodSystem || 'TRIMESTER'}
              onChange={e => onChange({ ...settings, periodSystem: e.target.value })}>
              <option value="TRIMESTER">Trimestres (3)</option>
              <option value="SEMESTER">Semestres (2)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Heures de cours par jour</label>
            <input type="number" min={1} max={12} step={0.5} className="form-control"
              value={settings.hoursPerDay ?? 6}
              onChange={e => onChange({ ...settings, hoursPerDay: e.target.value })} />
          </div>
        </div>
        <small style={{ color: '#667085', fontSize: '0.78rem', marginTop: 4, display: 'block' }}>
          Le découpage détermine les bulletins périodiques (par trimestre/semestre) et annuels.
          Les « heures par jour » servent à convertir les absences en heures sur le bulletin.
          Décision de fin d'année : Admis(e) si moyenne annuelle ≥ 10, cas limite entre 9 et 10, sinon redouble.
        </small>
      </SectionCard>

      <SectionCard title="Logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 80, height: 80, border: '2px dashed #e2e8f0', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#f8fafc', overflow: 'hidden',
          }}>
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ color: '#98a2b3', fontSize: '0.75rem', textAlign: 'center', padding: 8 }}>Aucun logo</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => logoRef.current.click()}>
              <FiUpload size={14} /> Choisir un logo
            </button>
            {settings.logoUrl && (
              <button className="btn btn-secondary" style={{ color: '#ef4444' }}
                onClick={() => onChange({ ...settings, logoUrl: '' })}>
                Supprimer
              </button>
            )}
            <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Couleurs du thème">
        <div className="form-row">
          <div className="form-group">
            <label>Couleur principale (sidebar, cartes)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={settings.themeColor}
                onChange={e => onChange({ ...settings, themeColor: e.target.value })}
                style={{ width: 48, height: 40, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              <input className="form-control" value={settings.themeColor} style={{ maxWidth: 120 }}
                onChange={e => onChange({ ...settings, themeColor: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Couleur d'accent (boutons, liens)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={settings.accentColor}
                onChange={e => onChange({ ...settings, accentColor: e.target.value })}
                style={{ width: 48, height: 40, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              <input className="form-control" value={settings.accentColor} style={{ maxWidth: 120 }}
                onChange={e => onChange({ ...settings, accentColor: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Aperçu */}
        <div style={{ marginTop: 16, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ background: settings.themeColor, color: '#fff', padding: '12px 16px', fontWeight: 700, fontSize: '0.85rem' }}>
            Aperçu — Barre latérale
          </div>
          <div style={{ padding: 16, background: '#f8fafc', display: 'flex', gap: 8 }}>
            <button style={{ background: settings.accentColor, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: '0.82rem', cursor: 'default' }}>
              Bouton principal
            </button>
            <button style={{ background: 'transparent', color: settings.accentColor, border: `1px solid ${settings.accentColor}`, borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: '0.82rem', cursor: 'default' }}>
              Bouton secondaire
            </button>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

function ModulesTab({ settings, onChange }) {
  const toggleModule = (key) => {
    onChange({
      ...settings,
      modules: { ...settings.modules, [key]: !settings.modules[key] },
    });
  };

  return (
    <SectionCard title="Activer / Désactiver les modules">
      <p style={{ color: '#667085', fontSize: '0.85rem', marginBottom: 20 }}>
        Les modules désactivés ne sont plus accessibles depuis la navigation. Les données ne sont pas supprimées.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Object.entries(MODULE_LABELS).map(([key, label]) => {
          const enabled = settings.modules[key] !== false;
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: enabled ? '#f0fdf4' : '#fafafa',
              border: `1px solid ${enabled ? '#bbf7d0' : '#e2e8f0'}`,
              borderRadius: 8, transition: 'all 0.15s',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1a1a2e' }}>{label}</div>
              </div>
              <button onClick={() => toggleModule(key)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: enabled ? '#10b981' : '#98a2b3', transition: 'color 0.15s',
              }}>
                {enabled ? <FiToggleRight size={30} /> : <FiToggleLeft size={30} />}
              </button>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function DocumentsTab({ settings, onChange, onNavigateToEditor }) {
  return (
    <>
      {/* ── Éditeur visuel ── */}
      <div style={{
        background: 'linear-gradient(135deg, #3b5beb 0%, #4c1d95 100%)',
        borderRadius: 12, padding: 24, marginBottom: 20, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <FiLayout size={20} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Éditeur visuel de documents</h3>
          </div>
          <p style={{ margin: 0, fontSize: '0.88rem', opacity: 0.9, lineHeight: 1.5 }}>
            Personnalisez entièrement vos bulletins, reçus et cartes scolaires — logo, couleurs, polices, mise en page, glisser-déposer des sections.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {['Bulletins scolaires', 'Reçus de paiement', 'Cartes scolaires'].map(d => (
              <span key={d} style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: '0.78rem', fontWeight: 600 }}>{d}</span>
            ))}
          </div>
        </div>
        <button
          onClick={onNavigateToEditor}
          style={{
            background: '#fff', color: '#3b5beb', border: 'none', borderRadius: 10,
            padding: '12px 22px', cursor: 'pointer', fontWeight: 800, fontSize: '0.92rem',
            display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', flexShrink: 0,
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          }}
        >
          Ouvrir l'éditeur <FiArrowRight size={16} />
        </button>
      </div>

      <SectionCard title="Bulletins scolaires">
        <div className="form-group">
          <label>En-tête personnalisé (texte ou HTML simple)</label>
          <textarea className="form-control" rows={3}
            value={settings.documents.bulletinHeader}
            placeholder="Ex: MINISTÈRE DE L'EDUCATION — École Primaire Publique de..."
            onChange={e => onChange({ ...settings, documents: { ...settings.documents, bulletinHeader: e.target.value } })}
          />
        </div>
      </SectionCard>

      <SectionCard title="Reçus de paiement">
        <div className="form-group">
          <label>En-tête personnalisé</label>
          <textarea className="form-control" rows={3}
            value={settings.documents.receiptHeader}
            placeholder="Ex: Nom de l'école, adresse, téléphone..."
            onChange={e => onChange({ ...settings, documents: { ...settings.documents, receiptHeader: e.target.value } })}
          />
        </div>
      </SectionCard>

      <SectionCard title="Cartes scolaires">
        <div className="form-group">
          <label>Pied de carte</label>
          <input className="form-control"
            value={settings.documents.cardFooter}
            onChange={e => onChange({ ...settings, documents: { ...settings.documents, cardFooter: e.target.value } })}
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <p style={{ color: '#667085', fontSize: '0.82rem' }}>
            Le logo, le nom de l'établissement et les couleurs définis dans l'onglet "Plateforme" sont automatiquement utilisés sur toutes les cartes scolaires.
          </p>
        </div>
      </SectionCard>
    </>
  );
}

function SchoolsTab({ selectedEcoleId, onSelectEcole }) {
  const [ecoles, setEcoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const showMessage = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 4000);
  };

  const fetchEcoles = useCallback(async () => {
    try {
      const res = await api.get('/auth/ecoles/', { skipEcoleScope: true });
      setEcoles(res.data.results || res.data);
    } catch (err) {
      console.error(err);
      showMessage('Impossible de charger les établissements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEcoles(); }, [fetchEcoles]);

  const openCreate = () => {
    setForm({ name: '', address: '', phone: '', email: '', is_active: true });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (e) => {
    setForm({ name: e.name || '', address: e.address || '', phone: e.phone || '', email: e.email || '', is_active: e.is_active !== false });
    setEditId(e.id);
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) await api.patch(`/auth/ecoles/${editId}/`, form, { skipEcoleScope: true });
      else await api.post('/auth/ecoles/', form, { skipEcoleScope: true });
      setModal(false);
      await fetchEcoles();
      showMessage(editId ? 'Établissement mis à jour.' : 'Établissement créé.');
    } catch (err) {
      showMessage(err.response?.data?.detail || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (e) => {
    try {
      await api.patch(`/auth/ecoles/${e.id}/`, { is_active: !e.is_active }, { skipEcoleScope: true });
      await fetchEcoles();
    } catch {
      showMessage('Action impossible.');
    }
  };

  const remove = async (e) => {
    if (!window.confirm(`Supprimer l'établissement "${e.name}" ?`)) return;
    try {
      await api.delete(`/auth/ecoles/${e.id}/`, { skipEcoleScope: true });
      await fetchEcoles();
      showMessage('Établissement supprimé.');
    } catch {
      showMessage('Suppression impossible.');
    }
  };

  const handleContextSelection = (e) => {
    onSelectEcole(e.id);
    showMessage(`Contexte actif : ${e.name}`);
  };

  return (
    <>
      <SectionCard title="Vue d’ensemble des établissements">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#1a1a2e' }}>Plateforme multi-établissements</div>
            <div style={{ color: '#667085', fontSize: '0.85rem', marginTop: 4 }}>
              Gérez plusieurs écoles clientes depuis une seule interface et basculez rapidement le contexte d’administration.
            </div>
          </div>
          <button className="btn btn-primary" onClick={openCreate}><FiPlus size={14} /> Nouvel établissement</button>
        </div>
        {selectedEcoleId ? (
          <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: '#eff6ff', color: '#1d4ed8', fontSize: '0.9rem' }}>
            <FiGlobe size={14} style={{ marginRight: 6 }} /> Contexte actif pour l’établissement n°{selectedEcoleId}.
          </div>
        ) : (
          <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: '#f8fafc', color: '#475467', fontSize: '0.9rem' }}>
            Le contexte plateforme est actuellement appliqué à toutes les écoles.
          </div>
        )}
        {message && (
          <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#f0fdf4', color: '#166534', fontSize: '0.9rem' }}>{message}</div>
        )}
      </SectionCard>

      <SectionCard title="Liste des établissements">
        {loading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Établissement</th><th>Contact</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {ecoles.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: 28, color: '#98a2b3' }}>Aucun établissement</td></tr>
                ) : ecoles.map(e => (
                  <tr key={e.id}>
                    <td>
                      <strong><FiHome size={13} style={{ marginRight: 6 }} />{e.name}</strong>
                      {e.address && <div style={{ fontSize: '0.78rem', color: '#98a2b3' }}>{e.address}</div>}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {e.phone || '—'}{e.email ? <div style={{ color: '#98a2b3', fontSize: '0.78rem' }}>{e.email}</div> : null}
                    </td>
                    <td>
                      <span className={`badge ${e.is_active ? 'badge-success' : 'badge-danger'}`}>{e.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-secondary" title="Activer ce contexte" onClick={() => handleContextSelection(e)}><FiGlobe size={14} /></button>
                        <button className="btn btn-sm btn-secondary" title="Modifier" onClick={() => openEdit(e)}><FiEdit2 size={14} /></button>
                        <button className="btn btn-sm btn-secondary" title={e.is_active ? 'Désactiver' : 'Activer'} onClick={() => toggleActive(e)}>{e.is_active ? 'Désactiver' : 'Activer'}</button>
                        <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => remove(e)}><FiTrash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>{editId ? 'Modifier l’établissement' : 'Nouvel établissement'}</h3>
              <button className="btn-icon" onClick={() => setModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nom de l’établissement *</label>
                  <input className="form-control" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Adresse</label>
                  <input className="form-control" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Téléphone</label>
                    <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" className="form-control" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  Établissement actif
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement...' : (editId ? 'Modifier' : 'Créer')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function SystemTab({ onReset }) {
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreRef = useRef();

  const doRestore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('ATTENTION : la restauration remplace les données actuelles par celles du fichier. Continuer ?')) return;
    setRestoring(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('confirm', 'true');
      const res = await api.post('/reports/restore/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert(res.data?.message || 'Restauration effectuée.');
    } catch (err) {
      alert('Erreur : ' + (err.response?.data?.error || 'restauration impossible.'));
    } finally { setRestoring(false); }
  };

  return (
    <>
    <SectionCard title="Sauvegarde & restauration">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#1d4ed8' }}>Télécharger une sauvegarde</div>
            <div style={{ fontSize: '0.8rem', color: '#2563eb', marginTop: 2 }}>
              Exporte toutes les données (élèves, notes, paiements, salaires…) dans un fichier JSON.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => downloadFile('/reports/backup/', `sauvegarde_${new Date().toISOString().slice(0,10)}.json`)}>
            <FiSave size={14} /> Sauvegarder
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#b91c1c' }}>Restaurer une sauvegarde</div>
            <div style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: 2 }}>
              Remplace les données actuelles par celles du fichier JSON. Opération sensible.
            </div>
          </div>
          <input ref={restoreRef} type="file" accept=".json" hidden onChange={doRestore} />
          <button className="btn btn-danger" disabled={restoring} onClick={() => restoreRef.current?.click()}>
            <FiUpload size={14} /> {restoring ? 'Restauration…' : 'Restaurer'}
          </button>
        </div>
      </div>
    </SectionCard>
    <SectionCard title="Paramètres système">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8,
        }}>
          <div>
            <div style={{ fontWeight: 700, color: '#c2410c' }}>Réinitialiser les paramètres</div>
            <div style={{ fontSize: '0.8rem', color: '#ea580c', marginTop: 2 }}>
              Remet tous les paramètres à leurs valeurs par défaut (logo, couleurs, modules, textes).
            </div>
          </div>
          {confirming ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" onClick={() => { onReset(); setConfirming(false); }}>
                Confirmer
              </button>
              <button className="btn btn-secondary" onClick={() => setConfirming(false)}>Annuler</button>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={() => setConfirming(true)}>
              <FiRefreshCw size={14} /> Réinitialiser
            </button>
          )}
        </div>

        <div style={{
          padding: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
          fontSize: '0.82rem', color: '#166534',
        }}>
          <strong>Version :</strong> SchoolPro 1.0.0<br />
          <strong>Moteur :</strong> React 18 + Django REST Framework<br />
          <strong>Les paramètres</strong> sont stockés localement dans le navigateur et appliqués instantanément.
        </div>
      </div>
    </SectionCard>
    </>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

function SuperAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('platform');
  const [settings, setSettings] = useState(loadSettings);
  const [ecoles, setEcoles] = useState([]);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  // Seul l'Admin peut accéder
  if (user?.role !== 'ADMIN') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
        <FiAlertCircle size={48} style={{ color: '#ef4444' }} />
        <h3 style={{ color: '#1a1a2e' }}>Accès réservé à l'Administrateur</h3>
        <p style={{ color: '#667085' }}>Vous n'avez pas les permissions requises pour accéder à ce panneau.</p>
      </div>
    );
  }

  // Charge l'identité école persistée côté backend (prioritaire sur le local)
  useEffect(() => {
    api.get('/reports/platform-settings/').then(r => {
      const d = r.data || {};
      setSettings(prev => ({
        ...prev,
        schoolName: d.school_name || prev.schoolName,
        schoolYear: d.school_year || prev.schoolYear,
        schoolType: d.school_type || prev.schoolType,
        matriculeFormat: d.matricule_format ?? prev.matriculeFormat,
        receiptFormat: d.receipt_format ?? prev.receiptFormat,
        periodSystem: d.period_system || prev.periodSystem,
        hoursPerDay: d.hours_per_day ?? prev.hoursPerDay,
        logoUrl: d.logo_url || prev.logoUrl,
        documents: { ...prev.documents, bulletinHeader: d.bulletin_header ?? prev.documents.bulletinHeader },
      }));
    }).catch(() => { });
  }, []);

  useEffect(() => {
    api.get('/auth/ecoles/').then(r => setEcoles(r.data.results || r.data)).catch(() => { });
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
  };

  const handleSelectEcole = (ecoleId) => {
    const next = { ...settings, selectedEcoleId: ecoleId ? Number(ecoleId) : null };
    setSettings(next);
    saveSettings(next);
    showToast(ecoleId ? 'École sélectionnée pour le contexte admin.' : 'Contexte plateforme rétabli.');
  };

  const handleSave = async () => {
    saveSettings(settings);
    // Persiste l'identité école côté backend (pour les documents générés)
    try {
      const fd = new FormData();
      fd.append('school_name', settings.schoolName || '');
      fd.append('school_year', settings.schoolYear || '');
      fd.append('school_type', settings.schoolType || 'all');
      fd.append('matricule_format', settings.matriculeFormat || '');
      fd.append('receipt_format', settings.receiptFormat || '');
      fd.append('period_system', settings.periodSystem || 'TRIMESTER');
      fd.append('hours_per_day', settings.hoursPerDay ?? 6);
      fd.append('bulletin_header', settings.documents?.bulletinHeader || '');
      if (settings.logoUrl && settings.logoUrl.startsWith('data:')) {
        const blob = dataURLtoBlob(settings.logoUrl);
        if (blob) fd.append('logo', blob, 'logo.png');
      }
      // Laisser Axios gérer l'en-tête Content-Type pour FormData afin d'inclure le boundary.
      await api.patch('/reports/platform-settings/', fd);
      showToast('Paramètres enregistrés (appliqués aux documents).');
    } catch {
      showToast('Enregistré localement, mais échec côté serveur.', 'error');
    }
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    saveSettings({ ...DEFAULT_SETTINGS });
    showToast('Paramètres réinitialisés.');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiSettings style={{ marginRight: 8 }} />Panneau Super Administrateur</h2>
          <p>Personnalisation complète de la plateforme</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          <FiSave size={14} /> Enregistrer les modifications
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: '#f2f4f7', borderRadius: 12, padding: 4, width: 'fit-content',
      }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.88rem', transition: 'all 0.15s',
            background: activeTab === tab.key ? '#fff' : 'transparent',
            color: activeTab === tab.key ? '#3b5beb' : '#667085',
            boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'platform' && <PlatformTab
        settings={settings}
        onChange={setSettings}
        ecoles={ecoles}
        selectedEcoleId={settings.selectedEcoleId}
        onSelectEcole={handleSelectEcole}
      />}
      {activeTab === 'schools' && <SchoolsTab selectedEcoleId={settings.selectedEcoleId} onSelectEcole={handleSelectEcole} />}
      {activeTab === 'modules' && <ModulesTab settings={settings} onChange={setSettings} />}
      {activeTab === 'documents' && <DocumentsTab settings={settings} onChange={setSettings} onNavigateToEditor={() => navigate('/document-editor')} />}
      {activeTab === 'system' && <SystemTab onReset={handleReset} />}

      {/* Bouton save sticky en bas */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn btn-primary" onClick={handleSave}>
          <FiSave size={14} /> Enregistrer les modifications
        </button>
      </div>

      <Toast msg={toast.msg} type={toast.type} />
    </div>
  );
}

export default SuperAdmin;
