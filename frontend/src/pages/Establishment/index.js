import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FiSave, FiUpload, FiHome, FiKey } from 'react-icons/fi';

const SCHOOL_TYPES = [
  ['all', 'Tous les établissements'], ['primaire', 'École primaire'],
  ['college', 'Collège'], ['lycee', 'Lycée'], ['universite', 'Université'],
  ['technique', 'Enseignement technique'], ['prive', 'Établissement privé'],
];

const empty = {
  school_name: '', school_year: '', school_type: 'all', bulletin_header: '',
  matricule_format: '', receipt_format: '', period_system: 'TRIMESTER', hours_per_day: 6,
};

function Section({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header"><h3>{title}</h3></div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function LicenseSection() {
  const { user } = useAuth();
  const [st, setSt] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = () => api.get('/license/status/').then(r => setSt(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const activate = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      const r = await api.post('/license/activate/', { code: code.trim() });
      setSt(r.data); setCode(''); setMsg('Licence activée.');
    } catch (err) { setMsg(err.response?.data?.error || 'Activation impossible.'); }
    finally { setBusy(false); }
  };
  if (!st) return null;
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header"><h3>Licence</h3></div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
          <div><span style={{ color: '#6b7280' }}>Statut : </span><strong>{st.plan_label}{st.trial ? ' (essai)' : ''}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Jours restants : </span>
            <strong style={{ color: st.days_left <= 7 ? '#dc2626' : '#059669' }}>{st.days_left}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Échéance : </span><strong>{new Date(st.expires_at).toLocaleDateString('fr-FR')}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Identifiant machine : </span><strong style={{ fontFamily: 'monospace' }}>{st.machine_id}</strong></div>
        </div>
        {user?.role === 'ADMIN' ? (
          <form onSubmit={activate} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, margin: 0 }}>
              <label>Code d'activation (renouvellement)</label>
              <input className="form-control" style={{ fontFamily: 'monospace' }} value={code}
                onChange={e => setCode(e.target.value)} placeholder="Collez le code reçu…" />
            </div>
            <button className="btn btn-primary" disabled={busy || !code.trim()} type="submit"><FiKey size={14} /> Activer</button>
          </form>
        ) : (
          <small style={{ color: '#6b7280' }}>Seul l'administrateur peut activer un code.</small>
        )}
        {msg && <div style={{ marginTop: 8, fontSize: '0.85rem', color: msg.includes('activée') ? '#059669' : '#dc2626' }}>{msg}</div>}
      </div>
    </div>
  );
}

export default function Establishment() {
  const [form, setForm] = useState(empty);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const logoRef = useRef();

  useEffect(() => {
    api.get('/reports/platform-settings/').then(r => {
      const d = r.data || {};
      setForm({
        school_name: d.school_name || '', school_year: d.school_year || '',
        school_type: d.school_type || 'all', bulletin_header: d.bulletin_header || '',
        matricule_format: d.matricule_format || '', receipt_format: d.receipt_format || '',
        period_system: d.period_system || 'TRIMESTER', hours_per_day: d.hours_per_day ?? 6,
      });
      setLogoUrl(d.logo_url || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const onLogo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const save = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
      if (logoFile) fd.append('logo', logoFile);
      await api.patch('/reports/platform-settings/', fd);
      showToast('Paramètres enregistrés.');
    } catch (err) {
      showToast('Erreur lors de l\'enregistrement.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiHome style={{ marginRight: 8 }} />Paramètres de l'établissement</h2>
          <p>Identité, numérotation et configuration des bulletins</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <FiSave size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      <LicenseSection />

      <Section title="Identité">
        <div className="form-row">
          <div className="form-group">
            <label>Nom de l'établissement</label>
            <input className="form-control" value={form.school_name}
              onChange={e => setForm({ ...form, school_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Année scolaire</label>
            <input className="form-control" placeholder="2025-2026" value={form.school_year}
              onChange={e => setForm({ ...form, school_year: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Type d'établissement</label>
          <select className="form-control" style={{ maxWidth: 320 }} value={form.school_type}
            onChange={e => setForm({ ...form, school_type: e.target.value })}>
            {SCHOOL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Logo</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {(logoPreview || logoUrl) && (
              <img src={logoPreview || logoUrl} alt="logo" style={{ height: 64, width: 64, objectFit: 'contain', border: '1px solid #eef0f4', borderRadius: 8 }} />
            )}
            <input ref={logoRef} type="file" accept="image/*" hidden onChange={onLogo} />
            <button type="button" className="btn btn-secondary" onClick={() => logoRef.current?.click()}>
              <FiUpload size={14} /> Choisir un logo
            </button>
          </div>
        </div>
        <div className="form-group">
          <label>En-tête des documents (bulletins, reçus)</label>
          <textarea className="form-control" rows={3} value={form.bulletin_header}
            onChange={e => setForm({ ...form, bulletin_header: e.target.value })}
            placeholder="Ministère… / Direction régionale… / BP, téléphone…" />
        </div>
      </Section>

      <Section title="Numérotation">
        <div className="form-row">
          <div className="form-group">
            <label>Format des matricules</label>
            <input className="form-control" placeholder="ELV-{SEQ:0004}" value={form.matricule_format}
              onChange={e => setForm({ ...form, matricule_format: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Format des reçus</label>
            <input className="form-control" placeholder="REC-{AAAA}-{SEQ:0004}" value={form.receipt_format}
              onChange={e => setForm({ ...form, receipt_format: e.target.value })} />
          </div>
        </div>
        <small style={{ color: '#667085' }}>
          Jetons : {'{AAAA}'} année, {'{AA}'} année (2 chiffres), {'{SEQ}'} / {'{SEQ:0004}'} compteur. Laisser vide pour les valeurs par défaut.
        </small>
      </Section>

      <Section title="Bulletins">
        <div className="form-row">
          <div className="form-group">
            <label>Découpage de l'année</label>
            <select className="form-control" value={form.period_system}
              onChange={e => setForm({ ...form, period_system: e.target.value })}>
              <option value="TRIMESTER">Trimestres (3)</option>
              <option value="SEMESTER">Semestres (2)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Heures de cours par jour</label>
            <input type="number" min={1} max={12} step={0.5} className="form-control" value={form.hours_per_day}
              onChange={e => setForm({ ...form, hours_per_day: e.target.value })} />
          </div>
        </div>
      </Section>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#111827', color: '#fff', padding: '12px 18px', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
