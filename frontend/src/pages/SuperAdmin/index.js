import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  FiSettings, FiSliders, FiFileText, FiToggleRight, FiToggleLeft,
  FiSave, FiUpload, FiRefreshCw, FiAlertCircle, FiCheckCircle,
} from 'react-icons/fi';

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  schoolName: 'SchoolPro',
  schoolYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
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
  { key: 'modules', label: 'Modules', icon: <FiToggleRight size={15} /> },
  { key: 'documents', label: 'Documents', icon: <FiFileText size={15} /> },
  { key: 'system', label: 'Système', icon: <FiSettings size={15} /> },
];

function loadSettings() {
  try {
    const saved = localStorage.getItem('schoolSettings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved), modules: { ...DEFAULT_SETTINGS.modules, ...(JSON.parse(saved).modules || {}) } } : { ...DEFAULT_SETTINGS };
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

function PlatformTab({ settings, onChange }) {
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

function DocumentsTab({ settings, onChange }) {
  return (
    <>
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

function SystemTab({ onReset }) {
  const [confirming, setConfirming] = useState(false);

  return (
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
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

function SuperAdmin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('platform');
  const [settings, setSettings] = useState(loadSettings);
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

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
  };

  const handleSave = () => {
    saveSettings(settings);
    showToast('Paramètres enregistrés avec succès.');
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

      {activeTab === 'platform' && <PlatformTab settings={settings} onChange={setSettings} />}
      {activeTab === 'modules' && <ModulesTab settings={settings} onChange={setSettings} />}
      {activeTab === 'documents' && <DocumentsTab settings={settings} onChange={setSettings} />}
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
