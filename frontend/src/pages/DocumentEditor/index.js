/**
 * DocumentEditor — Éditeur visuel de documents (type Canva)
 * Bulletins scolaires · Reçus de paiement · Cartes scolaires
 */
import React, { useState, useEffect, useCallback, useRef, useContext, createContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  FiArrowLeft, FiSave, FiTrash2, FiPlus, FiStar,
  FiFileText, FiCreditCard, FiDollarSign, FiRefreshCw,
  FiCheck, FiUpload, FiImage, FiType, FiLayout,
  FiSliders, FiGrid, FiX, FiMove, FiEye, FiEyeOff,
  FiZap, FiCopy,
} from 'react-icons/fi';

// ─────────────────────────────────────────────────────────────
// FONTS & PRESETS
// ─────────────────────────────────────────────────────────────
const FONTS = [
  { key: 'Arial, sans-serif', label: 'Arial' },
  { key: '"Helvetica Neue", Helvetica, sans-serif', label: 'Helvetica' },
  { key: '"Times New Roman", serif', label: 'Times New Roman' },
  { key: 'Georgia, serif', label: 'Georgia' },
  { key: '"Courier New", monospace', label: 'Courier New' },
  { key: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS' },
  { key: 'Verdana, sans-serif', label: 'Verdana' },
  { key: '"Palatino Linotype", serif', label: 'Palatino' },
];

const PRESET_PALETTES = {
  classic:    { primary: '#1a365d', headerBg: '#1a365d', headerText: '#ffffff', tableHeader: '#2b6cb0', tableRowAlt: '#f7fafc', accent: '#ebf8ff', border: '#e2e8f0', text: '#1a202c', cardBg: '#ffffff' },
  modern:     { primary: '#3b5beb', headerBg: '#3b5beb', headerText: '#ffffff', tableHeader: '#3b5beb', tableRowAlt: '#f0f4ff', accent: '#e7f5ff', border: '#dee2e6', text: '#212529', cardBg: '#ffffff' },
  minimalist: { primary: '#212529', headerBg: '#343a40', headerText: '#ffffff', tableHeader: '#343a40', tableRowAlt: '#f8f9fa', accent: '#f8f9fa', border: '#dee2e6', text: '#212529', cardBg: '#ffffff' },
  premium:    { primary: '#4c1d95', headerBg: '#4c1d95', headerText: '#fde68a', tableHeader: '#6d28d9', tableRowAlt: '#faf5ff', accent: '#faf5ff', border: '#e9d5ff', text: '#1a1a2e', cardBg: '#fffbeb' },
  green:      { primary: '#14532d', headerBg: '#166534', headerText: '#ffffff', tableHeader: '#15803d', tableRowAlt: '#f0fdf4', accent: '#f0fdf4', border: '#bbf7d0', text: '#1a202c', cardBg: '#ffffff' },
  warm:       { primary: '#92400e', headerBg: '#b45309', headerText: '#ffffff', tableHeader: '#d97706', tableRowAlt: '#fffbeb', accent: '#fef3c7', border: '#fde68a', text: '#292524', cardBg: '#fffbeb' },
};

const PRESETS = [
  { key: 'classic',    label: 'Classique',    desc: 'Traditionnel scolaire' },
  { key: 'modern',     label: 'Moderne',      desc: 'Design contemporain' },
  { key: 'minimalist', label: 'Minimaliste',  desc: 'Sobre et élégant' },
  { key: 'premium',    label: 'Premium',      desc: 'Prestige violet' },
  { key: 'green',      label: 'Nature',       desc: 'Tons verts' },
  { key: 'warm',       label: 'Chaleureux',   desc: 'Tons ambrés' },
];

// ─────────────────────────────────────────────────────────────
// DYNAMIC TOKEN SYSTEM
// ─────────────────────────────────────────────────────────────

/** Context for registering the currently-focused field so tokens can be inserted */
const FieldFocusCtx = createContext({ register: () => {} });

/** All injectable tokens, grouped by category */
export const DYNAMIC_TOKENS = [
  // ── Élève ──
  { key: '{{NOM_PRENOM}}',      label: 'Nom & Prénom',       category: 'eleve',     sample: 'DUPONT Jean',        desc: 'Nom de famille + prénom' },
  { key: '{{NOM}}',             label: 'Nom de famille',     category: 'eleve',     sample: 'DUPONT',             desc: 'Nom de famille seul' },
  { key: '{{PRENOM}}',          label: 'Prénom',             category: 'eleve',     sample: 'Jean',               desc: 'Prénom seul' },
  { key: '{{MATRICULE}}',       label: 'Matricule',          category: 'eleve',     sample: 'ELV-2024-001',       desc: 'Identifiant unique élève' },
  { key: '{{CLASSE}}',          label: 'Classe',             category: 'eleve',     sample: '6ème A',             desc: 'Nom de la classe' },
  { key: '{{DATE_NAISSANCE}}',  label: 'Date de naissance',  category: 'eleve',     sample: '15/01/2010',         desc: 'Date de naissance' },
  { key: '{{LIEU_NAISSANCE}}',  label: 'Lieu de naissance',  category: 'eleve',     sample: 'Ouagadougou',        desc: 'Lieu de naissance' },
  // ── Académique ──
  { key: '{{MOYENNE}}',         label: 'Moyenne générale',   category: 'academique',sample: '13.25/20',           desc: 'Moyenne générale de l\'élève' },
  { key: '{{RANG}}',            label: 'Rang',               category: 'academique',sample: '5/35',               desc: 'Rang dans la classe' },
  { key: '{{MENTION}}',         label: 'Mention',            category: 'academique',sample: 'Assez Bien',         desc: 'Mention (TB/B/AB/P/Insuff.)' },
  { key: '{{APPRECIATION}}',    label: 'Appréciation',       category: 'academique',sample: 'Travail satisfaisant',desc: 'Appréciation libre du prof.' },
  { key: '{{MOY_CLASSE}}',      label: 'Moy. classe',        category: 'academique',sample: '12.80/20',           desc: 'Moyenne générale de la classe' },
  { key: '{{TOTAL_COEFF}}',     label: 'Total coefficients', category: 'academique',sample: '15',                 desc: 'Somme de tous les coefficients' },
  { key: '{{NB_MATIERES}}',     label: 'Nombre de matières', category: 'academique',sample: '6',                  desc: 'Nombre de matières évaluées' },
  // ── Document ──
  { key: '{{NUMERO_DOC}}',      label: 'N° document',        category: 'document',  sample: 'BUL-2024-A1B2',      desc: 'Identifiant unique du document' },
  { key: '{{ANNEE_SCOLAIRE}}',  label: 'Année scolaire',     category: 'document',  sample: '2024-2025',          desc: 'Année scolaire en cours' },
  { key: '{{DATE_EMISSION}}',   label: "Date d'émission",    category: 'document',  sample: '15/01/2025',         desc: 'Date de génération' },
  { key: '{{TRIMESTRE}}',       label: 'Trimestre',          category: 'document',  sample: '1er Trimestre',      desc: 'Trimestre / semestre' },
  { key: '{{NOM_ETABLISSEMENT}}',label: "Nom de l'école",    category: 'document',  sample: 'Lycée Municipal',    desc: 'Nom de l\'établissement' },
  { key: '{{EFFECTIF_CLASSE}}', label: 'Effectif classe',    category: 'document',  sample: '35',                 desc: 'Nombre d\'élèves dans la classe' },
  // ── Paiement (pour les reçus) ──
  { key: '{{MONTANT}}',         label: 'Montant',            category: 'paiement',  sample: '150 000 FCFA',       desc: 'Montant du paiement' },
  { key: '{{TYPE_PAIEMENT}}',   label: 'Type de paiement',   category: 'paiement',  sample: 'Frais de scolarité', desc: 'Catégorie du paiement' },
  { key: '{{NUMERO_RECU}}',     label: 'N° du reçu',         category: 'paiement',  sample: 'RCU-2024-00123',     desc: 'Numéro unique du reçu' },
  { key: '{{DATE_PAIEMENT}}',   label: 'Date paiement',      category: 'paiement',  sample: '15/01/2025',         desc: 'Date à laquelle le paiement a été fait' },
  { key: '{{STATUT_PAIEMENT}}', label: 'Statut paiement',    category: 'paiement',  sample: 'Payé',               desc: 'Statut du paiement (Payé/En attente)' },
];

const TOKEN_CATEGORIES = {
  eleve:      { label: 'Élève',        color: '#3b5beb', bg: '#e8edff' },
  academique: { label: 'Académique',   color: '#0891b2', bg: '#e0f7fa' },
  document:   { label: 'Document',     color: '#6d28d9', bg: '#f0e6ff' },
  paiement:   { label: 'Paiement',     color: '#059669', bg: '#d1fae5' },
};

/** Replace tokens with their sample values for the live preview */
function resolveForPreview(text) {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  DYNAMIC_TOKENS.forEach(t => {
    result = result.split(t.key).join(t.sample);
  });
  return result;
}

// ─────────────────────────────────────────────────────────────
// DEFAULT CONFIG
// ─────────────────────────────────────────────────────────────
function buildDefaultConfig(docType) {
  const base = {
    colors: { ...PRESET_PALETTES.classic },
    typography: {
      fontFamily: 'Arial, sans-serif',
      titleSize: 15,
      subtitleSize: 12,
      bodySize: 9,
      tableSize: 9,
      titleWeight: 800,
      titleAlign: 'center',
    },
    layout: {
      logo: '',           // base64
      logoWidth: 52,
      logoHeight: 52,
      backgroundImage: '', // base64
      backgroundOpacity: 0.08,
      pageMargin: 15,
      headerStyle: 'band', // 'band' | 'minimal' | 'bordered'
    },
    header: {
      schoolName: '',
      subtitle: docType === 'bulletin' ? 'BULLETIN DE NOTES'
        : docType === 'receipt' ? 'REÇU DE PAIEMENT'
        : 'CARTE SCOLAIRE',
      showLogo: true,
      showAcademicYear: true,
      showTrimester: docType === 'bulletin',
      trimesterText: '1er Trimestre',
      address: '',
      phone: '',
    },
    footer: { show: true, text: 'Document officiel — Ne pas reproduire', size: 8 },
  };

  if (docType === 'bulletin') {
    return {
      ...base,
      sectionsOrder: ['studentInfo', 'gradesTable', 'summary', 'appreciations', 'signatures'],
      studentInfo: {
        show: true, showDateOfBirth: true, showBirthPlace: true,
        showClassSize: true, showMatricule: true,
      },
      gradesTable: {
        show: true, showCoefficient: true, showWeightedAverage: true,
        showAppreciation: true, showSignatureCol: false, stripeRows: true,
      },
      summary: {
        show: true, showLiterary: true, showScientific: true,
        showOther: false, showGeneralAverage: true, showRank: true,
        showMention: true, showClassAverage: true, showTotalCoeff: true,
      },
      appreciations: {
        show: true, mainTeacherLabel: 'Prof. Principal', adminLabel: 'Administration',
      },
      signatures: {
        show: true, showDirector: true, showSupervisor: true,
        directorLabel: 'Le Directeur', supervisorLabel: "L'Encadreur",
      },
      security: { showUniqueId: true, showQrCode: false },
    };
  }
  if (docType === 'receipt') {
    return {
      ...base,
      footer: { show: true, text: 'Ce reçu tient lieu de quittance — Bonne scolarité', size: 8 },
      body: {
        showStudentInfo: true, showPaymentDetails: true,
        showAmountWords: true, currency: 'FCFA',
      },
      signatures: { show: true, cashierLabel: 'Le Caissier', directorLabel: 'Le Directeur' },
      security: { showReceiptNumber: true, showQrCode: false },
    };
  }
  // card
  return {
    ...base,
    footer: { show: true, text: 'Document officiel', size: 7 },
    body: {
      showPhoto: true, showName: true, showMatricule: true,
      showClasse: true, showYear: true, showDateOfBirth: false,
    },
    security: { showQrCode: true, showUniqueId: true },
  };
}

// ─────────────────────────────────────────────────────────────
// SMALL UTILITY COMPONENTS
// ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', marginBottom: 2 }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10, position: 'relative',
          background: checked ? '#3b5beb' : '#d0d5dd', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      <span style={{ fontSize: '0.83rem', color: '#344054' }}>{label}</span>
    </label>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontSize: '0.82rem', color: '#344054' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 30, height: 30, borderRadius: 6, background: value || '#fff', border: '2px solid #e2e8f0', overflow: 'hidden', cursor: 'pointer' }}>
          <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
            style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }} />
        </div>
        <span style={{ fontSize: '0.72rem', color: '#667085', fontFamily: 'monospace', minWidth: 58 }}>{value}</span>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', tokenAware = false }) {
  const inputRef = useRef(null);
  const { register } = useContext(FieldFocusCtx);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <label style={{ fontSize: '0.76rem', color: '#667085' }}>{label}</label>
        {tokenAware && <span style={{ fontSize: '0.65rem', color: '#3b5beb', fontWeight: 600 }}>⚡ tokens</span>}
      </div>
      <input
        ref={inputRef}
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        onFocus={() => tokenAware && register(inputRef.current, onChange)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '6px 9px', borderRadius: 6, fontSize: '0.83rem', boxSizing: 'border-box',
          border: `1px solid #d0d5dd`,
        }}
      />
    </div>
  );
}

/** Multi-line token-aware textarea */
function TokenTextarea({ label, value, onChange, placeholder, rows = 2 }) {
  const ref = useRef(null);
  const { register } = useContext(FieldFocusCtx);

  // Highlight tokens in a read-only overlay (display only)
  const parts = (value || '').split(/({{[^}]+}})/g);

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <label style={{ fontSize: '0.76rem', color: '#667085' }}>{label}</label>
        <span style={{ fontSize: '0.65rem', color: '#3b5beb', fontWeight: 600 }}>⚡ tokens</span>
      </div>
      <textarea
        ref={ref}
        value={value || ''}
        rows={rows}
        onChange={e => onChange(e.target.value)}
        onFocus={() => register(ref.current, onChange)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '6px 9px', borderRadius: 6, border: '1px solid #d0d5dd',
          fontSize: '0.83rem', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
          lineHeight: 1.5,
        }}
      />
      {/* Token preview strip */}
      {parts.some(p => p.startsWith('{{')) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
          {parts.filter(p => p.startsWith('{{') && p.endsWith('}}')).map((p, i) => {
            const tok = DYNAMIC_TOKENS.find(t => t.key === p);
            const cat = TOKEN_CATEGORIES[tok?.category];
            return (
              <span key={i} style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 3, background: cat?.bg || '#f2f4f7', color: cat?.color || '#344054', fontWeight: 600 }}>
                {tok?.label || p}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange, min = 1, max = 100 }) {
  return (
    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '0.82rem', color: '#344054' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={() => onChange(Math.max(min, (value || min) - 1))} style={numBtnSt}>−</button>
        <span style={{ minWidth: 28, textAlign: 'center', fontSize: '0.85rem', fontWeight: 700 }}>{value}</span>
        <button onClick={() => onChange(Math.min(max, (value || min) + 1))} style={numBtnSt}>+</button>
      </div>
    </div>
  );
}
const numBtnSt = { width: 24, height: 24, borderRadius: 5, border: '1px solid #d0d5dd', background: '#f2f4f7', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' };

function SectionTitle({ title }) {
  return <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#667085', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 14, paddingBottom: 4, borderBottom: '1px solid #f2f4f7' }}>{title}</div>;
}

function ImageUploadBtn({ label, value, onChange, onClear }) {
  const ref = useRef();
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target.result);
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: '0.76rem', color: '#667085', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{
          width: 56, height: 44, border: '1px dashed #d0d5dd', borderRadius: 6,
          background: '#f8fafc', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {value
            ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <FiImage size={18} color="#d0d5dd" />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={() => ref.current?.click()} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d0d5dd', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <FiUpload size={11} /> {value ? 'Changer' : 'Choisir'}
          </button>
          {value && <button onClick={onClear} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: '#ef4444' }}>Retirer</button>}
        </div>
        <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DYNAMIC BLOCKS PANEL
// ─────────────────────────────────────────────────────────────
function DynamicBlocksPanel({ insertToken, docType }) {
  const [activeField, setActiveField] = useState(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(null);
  const { getActive } = useContext(FieldFocusCtx);

  const categories = Object.entries(TOKEN_CATEGORIES);
  const filtered = search
    ? DYNAMIC_TOKENS.filter(t => t.label.toLowerCase().includes(search.toLowerCase()) || t.key.toLowerCase().includes(search.toLowerCase()))
    : null;

  const handleInsert = (token) => {
    const inserted = insertToken(token.key);
    if (!inserted) {
      // Fallback: copy to clipboard
      navigator.clipboard?.writeText(token.key);
      setCopied(token.key);
      setTimeout(() => setCopied(null), 1800);
    }
  };

  const handleCopy = (e, key) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  // Tokens relevant to current doc type
  const relevantCats = docType === 'receipt'
    ? ['eleve', 'document', 'paiement']
    : docType === 'card'
    ? ['eleve', 'document']
    : ['eleve', 'academique', 'document'];

  const TokenChip = ({ token }) => {
    const cat = TOKEN_CATEGORIES[token.category];
    const isCopied = copied === token.key;
    return (
      <div
        onClick={() => handleInsert(token)}
        title={token.desc}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 9px', borderRadius: 7, border: `1px solid ${cat.bg}`,
          background: cat.bg, cursor: 'pointer', marginBottom: 5,
          transition: 'all 0.12s', userSelect: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = cat.color; e.currentTarget.style.boxShadow = `0 0 0 2px ${cat.color}22`; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = cat.bg; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#344054' }}>{token.label}</div>
          <div style={{ fontSize: '0.67rem', color: cat.color, fontFamily: 'monospace', marginTop: 1 }}>{token.key}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 6 }}>
          <button
            onClick={e => handleCopy(e, token.key)}
            title="Copier le token"
            style={{
              padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: isCopied ? cat.color : 'rgba(255,255,255,0.7)',
              color: isCopied ? '#fff' : cat.color, fontSize: '0.68rem', fontWeight: 700,
            }}
          >
            {isCopied ? '✓' : <FiCopy size={10} />}
          </button>
          <span style={{
            padding: '2px 7px', borderRadius: 4,
            background: cat.color, color: '#fff',
            fontSize: '0.68rem', fontWeight: 700,
          }}>
            + Insérer
          </span>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* How-to banner */}
      <div style={{ background: '#e8edff', borderRadius: 8, padding: '9px 10px', marginBottom: 12, fontSize: '0.78rem', color: '#3b5beb', lineHeight: 1.4 }}>
        <strong>Comment utiliser :</strong><br />
        1. Cliquez sur un champ texte <span style={{ background: '#3b5beb', color: '#fff', borderRadius: 3, padding: '0 4px', fontSize: '0.7rem' }}>⚡ tokens</span> dans les onglets En-tête ou Sections.<br />
        2. Cliquez sur <strong>+ Insérer</strong> — le token sera ajouté à la position du curseur.<br />
        3. Dans l'aperçu, le token affiche sa valeur réelle.
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un bloc..."
        style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid #d0d5dd', fontSize: '0.82rem', boxSizing: 'border-box', marginBottom: 10 }}
      />

      {filtered ? (
        <>
          {filtered.length === 0
            ? <p style={{ color: '#98a2b3', fontSize: '0.8rem', textAlign: 'center' }}>Aucun résultat</p>
            : filtered.map(t => <TokenChip key={t.key} token={t} />)
          }
        </>
      ) : (
        categories.filter(([k]) => relevantCats.includes(k)).map(([catKey, catMeta]) => {
          const tokens = DYNAMIC_TOKENS.filter(t => t.category === catKey);
          return (
            <div key={catKey} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '4px 0', borderBottom: '1px solid #f2f4f7' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: catMeta.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: catMeta.color, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {catMeta.label}
                </span>
                <span style={{ fontSize: '0.67rem', color: '#98a2b3', fontWeight: 400 }}>({tokens.length} blocs)</span>
              </div>
              {tokens.map(t => <TokenChip key={t.key} token={t} />)}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SAMPLE DATA FOR PREVIEW
// ─────────────────────────────────────────────────────────────
const SAMPLE_SUBJECTS = [
  { name: 'Mathématiques', coeff: 4, avg: 14.5, wa: 58.0, appr: 'Bien' },
  { name: 'Français',      coeff: 4, avg: 12.0, wa: 48.0, appr: 'Assez Bien' },
  { name: 'Sciences',      coeff: 2, avg: 15.5, wa: 31.0, appr: 'Très Bien' },
  { name: 'Histoire-Géo',  coeff: 2, avg: 11.0, wa: 22.0, appr: 'Passable' },
  { name: 'Anglais',       coeff: 2, avg: 13.5, wa: 27.0, appr: 'Assez Bien' },
  { name: 'EPS',           coeff: 1, avg: 16.0, wa: 16.0, appr: 'Très Bien' },
];

// ─────────────────────────────────────────────────────────────
// DRAGGABLE SECTION WRAPPER
// ─────────────────────────────────────────────────────────────
function DragSection({ id, index, total, onMove, children, isEditing }) {
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);

  if (!isEditing) return children;
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('idx', String(index)); setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const from = parseInt(e.dataTransfer.getData('idx')); if (from !== index) onMove(from, index); }}
      style={{
        opacity: dragging ? 0.45 : 1,
        outline: over ? '2px dashed #3b5beb' : 'none',
        outlineOffset: 2,
        borderRadius: 4,
        position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute', top: 4, right: 4, zIndex: 10,
        background: 'rgba(59,91,235,0.12)', borderRadius: 4, padding: '2px 5px',
        cursor: 'grab', display: 'flex', alignItems: 'center', gap: 3,
        fontSize: '0.68rem', color: '#3b5beb', fontWeight: 700,
        userSelect: 'none',
      }}>
        <FiMove size={10} /> déplacer
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BULLETIN PREVIEW
// ─────────────────────────────────────────────────────────────
function BulletinPreview({ config, isEditing, onMoveSection }) {
  const co = config.colors || {};
  const ty = config.typography || {};
  const ly = config.layout || {};
  const h  = config.header || {};
  const si = config.studentInfo || {};
  const gt = config.gradesTable || {};
  const sum = config.summary || {};
  const app = config.appreciations || {};
  const sig = config.signatures || {};
  const sec = config.security || {};
  const foot = config.footer || {};
  const order = config.sectionsOrder || ['studentInfo','gradesTable','summary','appreciations','signatures'];

  const font = ty.fontFamily || 'Arial, sans-serif';
  const sn   = resolveForPreview(h.schoolName) || 'NOM DE L\'ÉTABLISSEMENT';
  const margin = (ly.pageMargin || 15) + 'px';

  const thSt = {
    padding: '5px 8px', fontSize: (ty.tableSize || 9), fontWeight: 700, textAlign: 'left',
    background: co.tableHeader || co.primary || '#1a365d', color: '#fff',
  };
  const tdSt = { padding: '4px 8px', fontSize: (ty.tableSize || 9), borderBottom: `1px solid ${co.border || '#e2e8f0'}` };

  const headerStyle = ly.headerStyle || 'band';

  // Section render map
  const SECTIONS = {
    studentInfo: si.show !== false && (
      <div style={{ padding: `8px ${margin}`, borderBottom: `1px solid ${co.border || '#e2e8f0'}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 20px', fontSize: ty.bodySize || 9 }}>
          <div><span style={{ color: '#667085' }}>Nom & Prénom : </span><strong>DUPONT Jean</strong></div>
          {si.showMatricule !== false && <div><span style={{ color: '#667085' }}>Matricule : </span><strong>ELV-2024-001</strong></div>}
          <div><span style={{ color: '#667085' }}>Classe : </span><strong>6ème A</strong></div>
          <div><span style={{ color: '#667085' }}>Rang : </span><strong>5/35</strong></div>
          {si.showDateOfBirth !== false && <div><span style={{ color: '#667085' }}>Né(e) le : </span><strong>15/01/2010</strong></div>}
          {si.showBirthPlace !== false && <div><span style={{ color: '#667085' }}>Lieu : </span><strong>Ouagadougou</strong></div>}
          {si.showClassSize !== false && <div><span style={{ color: '#667085' }}>Effectif : </span><strong>35 élèves</strong></div>}
        </div>
      </div>
    ),
    gradesTable: gt.show !== false && (
      <div style={{ padding: `8px ${margin}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thSt}>Matière</th>
              {gt.showCoefficient !== false && <th style={{ ...thSt, width: 48, textAlign: 'center' }}>Coeff.</th>}
              <th style={{ ...thSt, width: 60, textAlign: 'center' }}>Moy.</th>
              {gt.showWeightedAverage !== false && <th style={{ ...thSt, width: 68, textAlign: 'center' }}>Moy. Pond.</th>}
              {gt.showAppreciation !== false && <th style={{ ...thSt, width: 88 }}>Appréciation</th>}
              {gt.showSignatureCol && <th style={{ ...thSt, width: 72, textAlign: 'center' }}>Signature</th>}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_SUBJECTS.map((row, i) => (
              <tr key={i} style={{ background: gt.stripeRows !== false && i % 2 === 1 ? (co.tableRowAlt || '#f7fafc') : '#fff' }}>
                <td style={tdSt}><strong>{row.name}</strong></td>
                {gt.showCoefficient !== false && <td style={{ ...tdSt, textAlign: 'center' }}>{row.coeff}</td>}
                <td style={{ ...tdSt, textAlign: 'center', fontWeight: 700, color: row.avg >= 14 ? '#10b981' : row.avg >= 10 ? '#f59e0b' : '#ef4444' }}>{row.avg}/20</td>
                {gt.showWeightedAverage !== false && <td style={{ ...tdSt, textAlign: 'center' }}>{row.wa}</td>}
                {gt.showAppreciation !== false && <td style={{ ...tdSt, fontSize: (ty.tableSize || 9) - 0.5 }}>{row.appr}</td>}
                {gt.showSignatureCol && <td style={tdSt}></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    summary: sum.show !== false && (
      <div style={{ padding: `0 ${margin} 8px` }}>
        <div style={{ background: co.accent || '#ebf8ff', border: `1px solid ${co.border || '#e2e8f0'}`, borderRadius: 6, padding: '8px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: (ty.bodySize || 9), color: co.primary || '#1a365d', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Bilan</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 10px', fontSize: (ty.bodySize || 9) - 0.5 }}>
            {sum.showLiterary !== false && <div><div style={{ color: '#667085', fontSize: (ty.bodySize || 9) - 1.5 }}>Matières litt.</div><strong>12.50/20</strong></div>}
            {sum.showScientific !== false && <div><div style={{ color: '#667085', fontSize: (ty.bodySize || 9) - 1.5 }}>Matières sci.</div><strong>14.25/20</strong></div>}
            {sum.showGeneralAverage !== false && <div><div style={{ color: '#667085', fontSize: (ty.bodySize || 9) - 1.5 }}>Moy. générale</div><strong style={{ color: co.primary || '#1a365d', fontSize: (ty.bodySize || 9) + 2 }}>13.25/20</strong></div>}
            {sum.showRank !== false && <div><div style={{ color: '#667085', fontSize: (ty.bodySize || 9) - 1.5 }}>Rang</div><strong>5/35</strong></div>}
            {sum.showMention !== false && <div><div style={{ color: '#667085', fontSize: (ty.bodySize || 9) - 1.5 }}>Mention</div><strong>Assez Bien</strong></div>}
            {sum.showClassAverage !== false && <div><div style={{ color: '#667085', fontSize: (ty.bodySize || 9) - 1.5 }}>Moy. classe</div><strong>12.80/20</strong></div>}
            {sum.showTotalCoeff !== false && <div><div style={{ color: '#667085', fontSize: (ty.bodySize || 9) - 1.5 }}>Total Coeff.</div><strong>15</strong></div>}
          </div>
        </div>
      </div>
    ),
    appreciations: app.show !== false && (
      <div style={{ padding: `0 ${margin} 8px` }}>
        <div style={{ border: `1px solid ${co.border || '#e2e8f0'}`, borderRadius: 6, padding: '8px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: ty.bodySize || 9, marginBottom: 3 }}>{app.mainTeacherLabel || 'Prof. Principal'} :</div>
            <div style={{ borderBottom: `1px solid ${co.border || '#e2e8f0'}`, height: 20 }}></div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: ty.bodySize || 9, marginBottom: 3 }}>{app.adminLabel || 'Administration'} :</div>
            <div style={{ borderBottom: `1px solid ${co.border || '#e2e8f0'}`, height: 20 }}></div>
          </div>
        </div>
      </div>
    ),
    signatures: sig.show !== false && (
      <div style={{ padding: `0 ${margin} 8px`, display: 'flex', justifyContent: 'space-around', fontSize: ty.bodySize || 9 }}>
        {sig.showDirector !== false && (
          <div style={{ textAlign: 'center', width: 120 }}>
            <div style={{ fontWeight: 700 }}>{sig.directorLabel || 'Le Directeur'}</div>
            <div style={{ height: 32, borderBottom: `1px solid ${co.border || '#e2e8f0'}`, marginTop: 24 }}></div>
          </div>
        )}
        {sig.showSupervisor !== false && (
          <div style={{ textAlign: 'center', width: 120 }}>
            <div style={{ fontWeight: 700 }}>{sig.supervisorLabel || "L'Encadreur"}</div>
            <div style={{ height: 32, borderBottom: `1px solid ${co.border || '#e2e8f0'}`, marginTop: 24 }}></div>
          </div>
        )}
      </div>
    ),
  };

  return (
    <div style={{ width: 794, minHeight: 1100, background: '#fff', fontFamily: font, color: co.text || '#1a202c', position: 'relative', overflow: 'hidden' }}>
      {/* Background image */}
      {ly.backgroundImage && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${ly.backgroundImage})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: ly.backgroundOpacity || 0.08,
          pointerEvents: 'none',
        }} />
      )}

      {/* HEADER */}
      {headerStyle === 'band' && (
        <div style={{ background: co.headerBg || co.primary || '#1a365d', color: co.headerText || '#fff', padding: `14px ${margin}`, display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          {h.showLogo && ly.logo && (
            <img src={ly.logo} alt="logo" style={{ width: ly.logoWidth || 52, height: ly.logoHeight || 52, objectFit: 'contain', flexShrink: 0, borderRadius: 6 }} />
          )}
          {h.showLogo && !ly.logo && (
            <div style={{ width: ly.logoWidth || 52, height: ly.logoHeight || 52, borderRadius: 8, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, flexShrink: 0 }}>
              {sn.charAt(0)}
            </div>
          )}
          <div style={{ flex: 1, textAlign: ty.titleAlign || 'center' }}>
            <div style={{ fontWeight: ty.titleWeight || 800, fontSize: ty.titleSize || 15, letterSpacing: 1 }}>{sn}</div>
            {h.address && <div style={{ fontSize: (ty.bodySize || 9) - 0.5, opacity: 0.8 }}>{h.address}</div>}
            {h.phone && <div style={{ fontSize: (ty.bodySize || 9) - 0.5, opacity: 0.8 }}>Tél : {h.phone}</div>}
            {h.showAcademicYear && <div style={{ fontSize: ty.subtitleSize || 10, opacity: 0.85, marginTop: 2 }}>Année scolaire 2024-2025</div>}
            <div style={{ fontSize: (ty.subtitleSize || 10) + 2, fontWeight: 700, marginTop: 3, textTransform: 'uppercase', letterSpacing: 2 }}>{h.subtitle || 'BULLETIN DE NOTES'}</div>
            {h.showTrimester && <div style={{ fontSize: (ty.bodySize || 9) - 0.5, opacity: 0.8 }}>{resolveForPreview(h.trimesterText) || '1er Trimestre'}</div>}
          </div>
        </div>
      )}
      {headerStyle === 'minimal' && (
        <div style={{ padding: `12px ${margin}`, borderBottom: `2px solid ${co.primary || '#1a365d'}`, display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          {h.showLogo && ly.logo && <img src={ly.logo} alt="logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />}
          <div>
            <div style={{ fontWeight: ty.titleWeight || 800, fontSize: ty.titleSize || 15, color: co.primary || '#1a365d' }}>{sn}</div>
            {h.showAcademicYear && <div style={{ fontSize: ty.bodySize || 9, color: '#667085' }}>Année 2024-2025</div>}
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: (ty.subtitleSize || 12), fontWeight: 700, color: co.primary || '#1a365d', textTransform: 'uppercase' }}>{h.subtitle}</div>
            {h.showTrimester && <div style={{ fontSize: ty.bodySize || 9, color: '#667085' }}>{h.trimesterText || '1er Trimestre'}</div>}
          </div>
        </div>
      )}
      {headerStyle === 'bordered' && (
        <div style={{ margin: `${margin} ${margin} 0`, border: `2px solid ${co.primary || '#1a365d'}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          {h.showLogo && ly.logo && <img src={ly.logo} alt="logo" style={{ width: 48, height: 48, objectFit: 'contain' }} />}
          <div style={{ flex: 1, textAlign: ty.titleAlign || 'center' }}>
            <div style={{ fontWeight: ty.titleWeight || 800, fontSize: ty.titleSize || 15, color: co.primary || '#1a365d' }}>{sn}</div>
            {h.showAcademicYear && <div style={{ fontSize: ty.bodySize || 9, color: '#667085' }}>Année 2024-2025</div>}
            <div style={{ fontSize: ty.subtitleSize || 12, fontWeight: 700, color: co.primary || '#1a365d', marginTop: 2, textTransform: 'uppercase' }}>{h.subtitle}</div>
          </div>
        </div>
      )}

      {/* ORDERED SECTIONS */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {order.filter(k => SECTIONS[k]).map((key, idx) => (
          <DragSection key={key} id={key} index={idx} total={order.length} onMove={onMoveSection} isEditing={isEditing}>
            {SECTIONS[key]}
          </DragSection>
        ))}
      </div>

      {/* FOOTER */}
      <div style={{ position: 'relative', zIndex: 1, padding: `6px ${margin}`, borderTop: `1px solid ${co.border || '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: foot.size || 8, color: '#667085' }}>
        {sec.showUniqueId !== false && <span>ID : BUL-2024-A1B2C3</span>}
        {foot.show !== false && <span>{resolveForPreview(foot.text)}</span>}
        {sec.showQrCode && <div style={{ width: 28, height: 28, background: '#1a202c', borderRadius: 3 }} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RECEIPT PREVIEW
// ─────────────────────────────────────────────────────────────
function ReceiptPreview({ config }) {
  const co = config.colors || {};
  const ty = config.typography || {};
  const ly = config.layout || {};
  const h  = config.header || {};
  const body = config.body || {};
  const sig = config.signatures || {};
  const sec = config.security || {};
  const foot = config.footer || {};
  const sn = resolveForPreview(h.schoolName) || 'NOM DE L\'ÉTABLISSEMENT';
  const currency = body.currency || 'FCFA';
  const margin = (ly.pageMargin || 15) + 'px';
  const font = ty.fontFamily || 'Arial, sans-serif';

  return (
    <div style={{ width: 794, minHeight: 1000, background: '#fff', fontFamily: font, color: co.text || '#1a202c', position: 'relative', overflow: 'hidden' }}>
      {ly.backgroundImage && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: `url(${ly.backgroundImage})`, backgroundSize: 'cover', opacity: ly.backgroundOpacity || 0.08, pointerEvents: 'none' }} />
      )}
      {/* Header */}
      <div style={{ background: co.headerBg || co.primary || '#1a365d', color: co.headerText || '#fff', padding: `16px ${margin}`, textAlign: ty.titleAlign || 'center', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
        {h.showLogo && ly.logo && <img src={ly.logo} alt="logo" style={{ width: ly.logoWidth || 48, height: ly.logoHeight || 48, objectFit: 'contain', flexShrink: 0 }} />}
        <div style={{ flex: 1, textAlign: ty.titleAlign || 'center' }}>
          <div style={{ fontWeight: ty.titleWeight || 800, fontSize: ty.titleSize || 16 }}>{sn}</div>
          {h.address && <div style={{ fontSize: (ty.bodySize || 9) - 0.5, opacity: 0.8 }}>{resolveForPreview(h.address)}</div>}
          <div style={{ fontSize: ty.subtitleSize || 13, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 2 }}>{resolveForPreview(h.subtitle) || 'REÇU DE PAIEMENT'}</div>
        </div>
      </div>
      <div style={{ padding: `16px ${margin}`, position: 'relative', zIndex: 1 }}>
        {sec.showReceiptNumber !== false && (
          <div style={{ textAlign: 'right', fontSize: ty.bodySize || 10, marginBottom: 12, color: '#667085' }}>
            N° Reçu : <strong style={{ color: co.primary || '#1a365d' }}>RCU-2024-00123</strong>&nbsp;&nbsp;|&nbsp;&nbsp;Date : <strong>15/01/2025</strong>
          </div>
        )}
        {body.showStudentInfo !== false && (
          <div style={{ background: co.accent || '#ebf8ff', border: `1px solid ${co.border || '#e2e8f0'}`, borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
            {[['Élève', 'DUPONT Jean'], ['Matricule', 'ELV-2024-001'], ['Classe', '6ème A']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', gap: 8, fontSize: ty.bodySize || 10, marginBottom: 3 }}>
                <span style={{ fontWeight: 700, minWidth: 80 }}>{l} :</span><span>{v}</span>
              </div>
            ))}
          </div>
        )}
        {body.showPaymentDetails !== false && (
          <div style={{ border: `1px solid ${co.border || '#e2e8f0'}`, borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
            {[['Type', 'Frais de scolarité'], ['Montant', `150 000 ${currency}`], ['Statut', 'Payé']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', gap: 8, fontSize: ty.bodySize || 10, marginBottom: 3 }}>
                <span style={{ fontWeight: 700, minWidth: 80 }}>{l} :</span><span>{v}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign: 'center', padding: '14px 0', fontSize: 26, fontWeight: 800, color: co.primary || '#1a365d' }}>150 000 {currency}</div>
        {sig.show !== false && (
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 36, fontSize: ty.bodySize || 9 }}>
            <div style={{ textAlign: 'center', width: 130 }}>
              <div style={{ fontWeight: 700 }}>{sig.cashierLabel || 'Le Caissier'}</div>
              <div style={{ height: 30, borderBottom: `1px solid ${co.border || '#e2e8f0'}`, marginTop: 22 }}></div>
            </div>
            <div style={{ textAlign: 'center', width: 130 }}>
              <div style={{ fontWeight: 700 }}>{sig.directorLabel || 'Le Directeur'}</div>
              <div style={{ height: 30, borderBottom: `1px solid ${co.border || '#e2e8f0'}`, marginTop: 22 }}></div>
            </div>
          </div>
        )}
        {foot.show !== false && (
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: foot.size || 8.5, color: '#667085', borderTop: `1px solid ${co.border || '#e2e8f0'}`, paddingTop: 8 }}>
            {resolveForPreview(foot.text)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CARD PREVIEW
// ─────────────────────────────────────────────────────────────
function CardPreview({ config }) {
  const co = config.colors || {};
  const ty = config.typography || {};
  const ly = config.layout || {};
  const h  = config.header || {};
  const body = config.body || {};
  const sec = config.security || {};
  const foot = config.footer || {};
  const sn = resolveForPreview(h.schoolName) || 'ÉTABLISSEMENT';
  const font = ty.fontFamily || 'Arial, sans-serif';

  const Card = () => (
    <div style={{ width: 240, border: `1.5px solid ${co.border || co.primary || '#1a365d'}`, borderRadius: 8, overflow: 'hidden', background: co.cardBg || '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', fontFamily: font }}>
      <div style={{ background: co.headerBg || co.primary || '#1a365d', color: co.headerText || '#fff', padding: '7px 10px', textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          {h.showLogo && ly.logo && <img src={ly.logo} alt="" style={{ height: 18, objectFit: 'contain' }} />}
          {sn}
        </div>
        <div style={{ fontSize: 7.5, opacity: 0.9 }}>{h.subtitle || 'CARTE SCOLAIRE'}</div>
        {h.showAcademicYear && <div style={{ fontSize: 7, opacity: 0.8 }}>2024-2025</div>}
      </div>
      <div style={{ display: 'flex', padding: '7px 8px', gap: 7 }}>
        {body.showPhoto !== false && (
          <div style={{ width: 44, height: 56, background: '#f2f4f7', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#98a2b3', border: `1px dashed ${co.border || '#e2e8f0'}` }}>Photo</div>
        )}
        <div style={{ flex: 1, fontSize: 8 }}>
          {body.showName !== false && <div style={{ fontWeight: 700, marginBottom: 2 }}>DUPONT Jean</div>}
          {body.showMatricule !== false && <div style={{ color: '#667085' }}>ELV-2024-001</div>}
          {body.showClasse !== false && <div style={{ color: '#667085' }}>6ème A</div>}
          {body.showYear !== false && <div style={{ color: '#667085' }}>2024-2025</div>}
          {body.showDateOfBirth !== false && <div style={{ color: '#667085' }}>15/01/2010</div>}
        </div>
        {sec.showQrCode && <div style={{ width: 32, height: 32, background: '#1a202c', borderRadius: 3, flexShrink: 0, alignSelf: 'flex-end' }} title="QR" />}
      </div>
      {foot.show !== false && (
        <div style={{ borderTop: `1px solid ${co.border || '#e2e8f0'}`, padding: '3px 8px', fontSize: foot.size || 6.5, color: '#667085', textAlign: 'center' }}>
          {resolveForPreview(foot.text) || 'Document officiel'}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ width: 794, minHeight: 600, background: '#f8f9fa', padding: '30px 30px', display: 'flex', flexWrap: 'wrap', gap: 20, alignContent: 'flex-start' }}>
      {Array(6).fill(0).map((_, i) => <Card key={i} />)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RIGHT PANEL TABS
// ─────────────────────────────────────────────────────────────
function ColorsPanel({ config, update }) {
  const co = config.colors || {};
  const set = (key, val) => update('colors', { ...co, [key]: val });
  return (
    <div>
      <SectionTitle title="Couleurs principales" />
      <ColorRow label="Couleur primaire" value={co.primary} onChange={v => set('primary', v)} />
      <SectionTitle title="En-tête" />
      <ColorRow label="Fond en-tête" value={co.headerBg} onChange={v => set('headerBg', v)} />
      <ColorRow label="Texte en-tête" value={co.headerText} onChange={v => set('headerText', v)} />
      <SectionTitle title="Tableau des notes" />
      <ColorRow label="Fond en-tête tableau" value={co.tableHeader} onChange={v => set('tableHeader', v)} />
      <ColorRow label="Lignes alternées" value={co.tableRowAlt} onChange={v => set('tableRowAlt', v)} />
      <SectionTitle title="Éléments" />
      <ColorRow label="Couleur accent / bilan" value={co.accent} onChange={v => set('accent', v)} />
      <ColorRow label="Bordures" value={co.border} onChange={v => set('border', v)} />
      <ColorRow label="Texte principal" value={co.text} onChange={v => set('text', v)} />
      <ColorRow label="Fond carte" value={co.cardBg || '#ffffff'} onChange={v => set('cardBg', v)} />
    </div>
  );
}

function TypographyPanel({ config, update }) {
  const ty = config.typography || {};
  const set = (k, v) => update('typography', { ...ty, [k]: v });
  return (
    <div>
      <SectionTitle title="Police de caractères" />
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: '0.76rem', color: '#667085', display: 'block', marginBottom: 3 }}>Famille de police</label>
        <select value={ty.fontFamily || 'Arial, sans-serif'} onChange={e => set('fontFamily', e.target.value)}
          style={{ width: '100%', padding: '6px 9px', borderRadius: 6, border: '1px solid #d0d5dd', fontSize: '0.83rem' }}>
          {FONTS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <div style={{ marginTop: 6, fontSize: '0.85rem', fontFamily: ty.fontFamily, padding: '5px 8px', background: '#f8fafc', borderRadius: 4, color: '#344054' }}>
          Aperçu : DUPONT Jean — 6ème A — 2024-2025
        </div>
      </div>
      <SectionTitle title="Tailles de police" />
      <NumberField label="Titre principal" value={ty.titleSize || 15} onChange={v => set('titleSize', v)} min={10} max={28} />
      <NumberField label="Sous-titre" value={ty.subtitleSize || 12} onChange={v => set('subtitleSize', v)} min={8} max={22} />
      <NumberField label="Corps du texte" value={ty.bodySize || 9} onChange={v => set('bodySize', v)} min={7} max={16} />
      <NumberField label="Tableau" value={ty.tableSize || 9} onChange={v => set('tableSize', v)} min={7} max={14} />
      <NumberField label="Graisse du titre" value={ty.titleWeight || 800} onChange={v => set('titleWeight', v)} min={400} max={900} />
      <SectionTitle title="Alignement" />
      <div style={{ display: 'flex', gap: 4 }}>
        {['left', 'center', 'right'].map(a => (
          <button key={a} onClick={() => set('titleAlign', a)} style={{
            flex: 1, padding: '6px', borderRadius: 6, border: `1px solid ${ty.titleAlign === a ? '#3b5beb' : '#d0d5dd'}`,
            background: ty.titleAlign === a ? '#e8edff' : '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
            color: ty.titleAlign === a ? '#3b5beb' : '#344054',
          }}>
            {a === 'left' ? '⬅ Gauche' : a === 'center' ? '↔ Centre' : 'Droite ➡'}
          </button>
        ))}
      </div>
    </div>
  );
}

function LayoutPanel({ config, update, docType }) {
  const ly = config.layout || {};
  const set = (k, v) => update('layout', { ...ly, [k]: v });
  const h = config.header || {};
  const setH = (k, v) => update('header', { ...h, [k]: v });

  return (
    <div>
      <SectionTitle title="Logo de l'établissement" />
      <ImageUploadBtn
        label="Logo (PNG, JPG, SVG)"
        value={ly.logo}
        onChange={v => set('logo', v)}
        onClear={() => set('logo', '')}
      />
      {ly.logo && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <NumberField label="Largeur (px)" value={ly.logoWidth || 52} onChange={v => set('logoWidth', v)} min={20} max={120} />
          <NumberField label="Hauteur (px)" value={ly.logoHeight || 52} onChange={v => set('logoHeight', v)} min={20} max={120} />
        </div>
      )}
      <Toggle checked={h.showLogo !== false} onChange={v => setH('showLogo', v)} label="Afficher le logo dans l'en-tête" />

      <SectionTitle title="Image de fond (watermark)" />
      <ImageUploadBtn
        label="Image de fond"
        value={ly.backgroundImage}
        onChange={v => set('backgroundImage', v)}
        onClear={() => set('backgroundImage', '')}
      />
      {ly.backgroundImage && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: '0.76rem', color: '#667085', marginBottom: 2 }}>Opacité : {Math.round((ly.backgroundOpacity || 0.08) * 100)}%</div>
          <input type="range" min={1} max={50} value={Math.round((ly.backgroundOpacity || 0.08) * 100)}
            onChange={e => set('backgroundOpacity', e.target.value / 100)}
            style={{ width: '100%' }}
          />
        </div>
      )}

      <SectionTitle title="Style d'en-tête" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
        {[
          { key: 'band', label: '■ Bande colorée (fond coloré pleine largeur)' },
          { key: 'minimal', label: '— Ligne inférieure (trait + logo)' },
          { key: 'bordered', label: '□ Encadré (bordure rectangulaire)' },
        ].map(opt => (
          <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: '0.82rem', color: '#344054' }}>
            <input type="radio" name="headerStyle" value={opt.key}
              checked={(ly.headerStyle || 'band') === opt.key}
              onChange={() => set('headerStyle', opt.key)}
            />
            {opt.label}
          </label>
        ))}
      </div>

      <SectionTitle title="Marges de la page" />
      <NumberField label="Marge (px)" value={ly.pageMargin || 15} onChange={v => set('pageMargin', v)} min={5} max={40} />
    </div>
  );
}

function HeaderPanel({ config, update, docType }) {
  const h = config.header || {};
  const foot = config.footer || {};
  const set = (k, v) => update('header', { ...h, [k]: v });
  return (
    <div>
      <SectionTitle title="Identité" />
      <Field tokenAware label="Nom de l'établissement" value={h.schoolName} onChange={v => set('schoolName', v)} placeholder="Ex: {{NOM_ETABLISSEMENT}}" />
      <Field tokenAware label="Adresse" value={h.address} onChange={v => set('address', v)} placeholder="Ex: BP 123, Ouagadougou" />
      <Field label="Téléphone" value={h.phone} onChange={v => set('phone', v)} placeholder="Ex: +226 25 XX XX XX" />
      <SectionTitle title="Titre du document" />
      <Field tokenAware label="Titre affiché" value={h.subtitle} onChange={v => set('subtitle', v)} placeholder="Ex: BULLETIN — {{ANNEE_SCOLAIRE}}" />
      {docType === 'bulletin' && (
        <>
          <div style={{ marginTop: 6 }}>
            <Toggle checked={h.showAcademicYear !== false} onChange={v => set('showAcademicYear', v)} label="Afficher l'année scolaire" />
          </div>
          <div style={{ marginTop: 6 }}>
            <Toggle checked={h.showTrimester !== false} onChange={v => set('showTrimester', v)} label="Afficher le trimestre" />
          </div>
          {h.showTrimester !== false && (
            <Field tokenAware label="Texte du trimestre" value={h.trimesterText} onChange={v => set('trimesterText', v)} placeholder="Ex: {{TRIMESTRE}}" />
          )}
        </>
      )}
      <SectionTitle title="Pied de page" />
      <Toggle checked={foot.show !== false} onChange={v => update('footer', { ...foot, show: v })} label="Afficher le pied de page" />
      {foot.show !== false && (
        <>
          <TokenTextarea label="Texte du pied de page" value={foot.text} onChange={v => update('footer', { ...foot, text: v })} placeholder="Ex: Bulletin de {{NOM_PRENOM}} — ID: {{NUMERO_DOC}} — {{DATE_EMISSION}}" />
          <NumberField label="Taille du texte" value={foot.size || 8} onChange={v => update('footer', { ...foot, size: v })} min={6} max={12} />
        </>
      )}
    </div>
  );
}

function BulletinSectionsPanel({ config, update }) {
  const si  = config.studentInfo || {};
  const gt  = config.gradesTable || {};
  const sum = config.summary || {};
  const app = config.appreciations || {};
  const sig = config.signatures || {};
  const sec = config.security || {};
  const setSI  = (k, v) => update('studentInfo',  { ...si,  [k]: v });
  const setGT  = (k, v) => update('gradesTable',  { ...gt,  [k]: v });
  const setSum = (k, v) => update('summary',       { ...sum, [k]: v });
  const setApp = (k, v) => update('appreciations', { ...app, [k]: v });
  const setSig = (k, v) => update('signatures',    { ...sig, [k]: v });
  const setSec = (k, v) => update('security',      { ...sec, [k]: v });

  const S = ({ t, children }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#344054', marginBottom: 6, paddingBottom: 3, borderBottom: '1px solid #f2f4f7' }}>{t}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 10, padding: '7px 10px', background: '#e8edff', borderRadius: 7, fontSize: '0.78rem', color: '#3b5beb', fontWeight: 600 }}>
        💡 Glissez les sections dans l'aperçu pour les réorganiser
      </div>
      <S t="Infos élève">
        <Toggle checked={si.show !== false} onChange={v => setSI('show', v)} label="Afficher la section" />
        <Toggle checked={si.showDateOfBirth !== false} onChange={v => setSI('showDateOfBirth', v)} label="Date de naissance" />
        <Toggle checked={si.showBirthPlace !== false} onChange={v => setSI('showBirthPlace', v)} label="Lieu de naissance" />
        <Toggle checked={si.showClassSize !== false} onChange={v => setSI('showClassSize', v)} label="Effectif classe" />
        <Toggle checked={si.showMatricule !== false} onChange={v => setSI('showMatricule', v)} label="Matricule" />
      </S>
      <S t="Tableau des notes">
        <Toggle checked={gt.show !== false} onChange={v => setGT('show', v)} label="Afficher le tableau" />
        <Toggle checked={gt.showCoefficient !== false} onChange={v => setGT('showCoefficient', v)} label="Coefficient" />
        <Toggle checked={gt.showWeightedAverage !== false} onChange={v => setGT('showWeightedAverage', v)} label="Moyenne pondérée" />
        <Toggle checked={gt.showAppreciation !== false} onChange={v => setGT('showAppreciation', v)} label="Appréciation" />
        <Toggle checked={gt.showSignatureCol || false} onChange={v => setGT('showSignatureCol', v)} label="Colonne signature" />
        <Toggle checked={gt.stripeRows !== false} onChange={v => setGT('stripeRows', v)} label="Lignes alternées" />
      </S>
      <S t="Bilan">
        <Toggle checked={sum.show !== false} onChange={v => setSum('show', v)} label="Afficher le bilan" />
        <Toggle checked={sum.showLiterary !== false} onChange={v => setSum('showLiterary', v)} label="Matières littéraires" />
        <Toggle checked={sum.showScientific !== false} onChange={v => setSum('showScientific', v)} label="Matières scientifiques" />
        <Toggle checked={sum.showGeneralAverage !== false} onChange={v => setSum('showGeneralAverage', v)} label="Moyenne générale" />
        <Toggle checked={sum.showRank !== false} onChange={v => setSum('showRank', v)} label="Rang" />
        <Toggle checked={sum.showMention !== false} onChange={v => setSum('showMention', v)} label="Mention" />
        <Toggle checked={sum.showClassAverage !== false} onChange={v => setSum('showClassAverage', v)} label="Moyenne de la classe" />
        <Toggle checked={sum.showTotalCoeff !== false} onChange={v => setSum('showTotalCoeff', v)} label="Total coefficients" />
      </S>
      <S t="Appréciations">
        <Toggle checked={app.show !== false} onChange={v => setApp('show', v)} label="Afficher les appréciations" />
        <Field tokenAware label="Label Prof. principal" value={app.mainTeacherLabel} onChange={v => setApp('mainTeacherLabel', v)} placeholder="Prof. Principal" />
        <Field tokenAware label="Label Administration" value={app.adminLabel} onChange={v => setApp('adminLabel', v)} placeholder="Administration" />
        <TokenTextarea label="Texte appréciation (facultatif)" value={app.defaultText} onChange={v => setApp('defaultText', v)} placeholder="Ex: Élève {{NOM_PRENOM}}, {{MENTION}} — Moy. {{MOYENNE}}" rows={2} />
      </S>
      <S t="Signatures">
        <Toggle checked={sig.show !== false} onChange={v => setSig('show', v)} label="Afficher les signatures" />
        <Field tokenAware label="Label Directeur" value={sig.directorLabel} onChange={v => setSig('directorLabel', v)} placeholder="Le Directeur" />
        <Field tokenAware label="Label Encadreur" value={sig.supervisorLabel} onChange={v => setSig('supervisorLabel', v)} placeholder="L'Encadreur" />
      </S>
      <S t="Sécurité">
        <Toggle checked={sec.showUniqueId !== false} onChange={v => setSec('showUniqueId', v)} label="ID unique du bulletin" />
        <Toggle checked={sec.showQrCode || false} onChange={v => setSec('showQrCode', v)} label="QR Code" />
      </S>
    </div>
  );
}

function ReceiptSectionsPanel({ config, update }) {
  const body = config.body || {};
  const sig  = config.signatures || {};
  const sec  = config.security || {};
  const setBody = (k, v) => update('body', { ...body, [k]: v });
  const setSig  = (k, v) => update('signatures', { ...sig, [k]: v });
  const setSec  = (k, v) => update('security', { ...sec, [k]: v });
  const S = ({ t, children }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#344054', marginBottom: 6, paddingBottom: 3, borderBottom: '1px solid #f2f4f7' }}>{t}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    </div>
  );
  return (
    <div>
      <S t="Corps du reçu">
        <Toggle checked={body.showStudentInfo !== false} onChange={v => setBody('showStudentInfo', v)} label="Infos élève" />
        <Toggle checked={body.showPaymentDetails !== false} onChange={v => setBody('showPaymentDetails', v)} label="Détails du paiement" />
        <Field label="Devise" value={body.currency} onChange={v => setBody('currency', v)} placeholder="FCFA" />
        <TokenTextarea label="Texte libre (corps)" value={body.customText} onChange={v => setBody('customText', v)} placeholder="Ex: Reçu de {{NOM_PRENOM}} — Classe {{CLASSE}} — {{DATE_PAIEMENT}}" rows={2} />
      </S>
      <S t="Signatures">
        <Toggle checked={sig.show !== false} onChange={v => setSig('show', v)} label="Afficher les signatures" />
        <Field tokenAware label="Label Caissier" value={sig.cashierLabel} onChange={v => setSig('cashierLabel', v)} placeholder="Le Caissier" />
        <Field tokenAware label="Label Directeur" value={sig.directorLabel} onChange={v => setSig('directorLabel', v)} placeholder="Le Directeur" />
      </S>
      <S t="Sécurité">
        <Toggle checked={sec.showReceiptNumber !== false} onChange={v => setSec('showReceiptNumber', v)} label="Numéro du reçu" />
        <Toggle checked={sec.showQrCode || false} onChange={v => setSec('showQrCode', v)} label="QR Code" />
      </S>
    </div>
  );
}

function CardSectionsPanel({ config, update }) {
  const body = config.body || {};
  const sec  = config.security || {};
  const setBody = (k, v) => update('body', { ...body, [k]: v });
  const setSec  = (k, v) => update('security', { ...sec, [k]: v });
  const S = ({ t, children }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#344054', marginBottom: 6, paddingBottom: 3, borderBottom: '1px solid #f2f4f7' }}>{t}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    </div>
  );
  return (
    <div>
      <S t="Champs affichés">
        <Toggle checked={body.showPhoto !== false} onChange={v => setBody('showPhoto', v)} label="Photo de l'élève" />
        <Toggle checked={body.showName !== false} onChange={v => setBody('showName', v)} label="Nom & prénom" />
        <Toggle checked={body.showMatricule !== false} onChange={v => setBody('showMatricule', v)} label="Matricule" />
        <Toggle checked={body.showClasse !== false} onChange={v => setBody('showClasse', v)} label="Classe" />
        <Toggle checked={body.showYear !== false} onChange={v => setBody('showYear', v)} label="Année scolaire" />
        <Toggle checked={body.showDateOfBirth || false} onChange={v => setBody('showDateOfBirth', v)} label="Date de naissance" />
      </S>
      <S t="Sécurité">
        <Toggle checked={sec.showQrCode !== false} onChange={v => setSec('showQrCode', v)} label="QR Code" />
        <Toggle checked={sec.showUniqueId !== false} onChange={v => setSec('showUniqueId', v)} label="ID unique" />
      </S>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function DocumentEditor() {
  const navigate = useNavigate();
  const [docType, setDocType] = useState('bulletin');
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [config, setConfig] = useState(() => buildDefaultConfig('bulletin'));
  const [templateName, setTemplateName] = useState('');
  const [activeTab, setActiveTab] = useState('colors');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isEditing, setIsEditing] = useState(true); // drag mode

  const schoolSettings = (() => {
    try { return JSON.parse(localStorage.getItem('schoolSettings') || '{}'); } catch { return {}; }
  })();

  // Apply school name from platform settings
  useEffect(() => {
    if (!config.header?.schoolName && schoolSettings.schoolName) {
      setConfig(prev => ({ ...prev, header: { ...prev.header, schoolName: schoolSettings.schoolName } }));
    }
    if (!config.layout?.logo && schoolSettings.logoUrl) {
      setConfig(prev => ({ ...prev, layout: { ...prev.layout, logo: schoolSettings.logoUrl } }));
    }
  }, []); // eslint-disable-line

  const loadTemplates = useCallback(async (type) => {
    try {
      const res = await api.get(`/reports/templates/?document_type=${type}`);
      setTemplates(res.data);
    } catch { setTemplates([]); }
  }, []);

  useEffect(() => { loadTemplates(docType); }, [docType, loadTemplates]);

  const switchDocType = (type) => {
    setDocType(type);
    setSelectedId(null);
    const base = buildDefaultConfig(type);
    // preserve school identity
    base.header.schoolName = config.header?.schoolName || '';
    base.layout.logo = config.layout?.logo || '';
    setConfig(base);
    setTemplateName('');
    setIsDirty(false);
    setActiveTab('colors');
  };

  const loadTemplate = (tmpl) => {
    setSelectedId(tmpl.id);
    setConfig(tmpl.config);
    setTemplateName(tmpl.name);
    setIsDirty(false);
  };

  const applyPreset = (key) => {
    setConfig(prev => ({ ...prev, colors: { ...PRESET_PALETTES[key] }, style_preset: key }));
    setIsDirty(true);
  };

  const update = useCallback((key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const moveSection = useCallback((from, to) => {
    setConfig(prev => {
      const order = [...(prev.sectionsOrder || ['studentInfo','gradesTable','summary','appreciations','signatures'])];
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      return { ...prev, sectionsOrder: order };
    });
    setIsDirty(true);
  }, []);

  const save = async () => {
    if (!templateName.trim()) { toast.error('Veuillez saisir un nom pour ce modèle.'); return; }
    setSaving(true);
    try {
      const payload = { name: templateName, document_type: docType, style_preset: config.style_preset || 'classic', config };
      if (selectedId) {
        const res = await api.put(`/reports/templates/${selectedId}/`, payload);
        setTemplates(prev => prev.map(t => t.id === selectedId ? res.data : t));
        toast.success('Modèle mis à jour !');
      } else {
        const res = await api.post('/reports/templates/', payload);
        setTemplates(prev => [res.data, ...prev]);
        setSelectedId(res.data.id);
        toast.success('Modèle créé !');
      }
      setIsDirty(false);
    } catch { toast.error('Erreur lors de la sauvegarde.'); }
    finally { setSaving(false); }
  };

  const setDefault = async () => {
    if (!selectedId) { toast.error('Sauvegardez d\'abord le modèle.'); return; }
    try {
      await api.put(`/reports/templates/${selectedId}/`, { is_default: true });
      setTemplates(prev => prev.map(t => ({ ...t, is_default: t.id === selectedId })));
      toast.success('Modèle défini par défaut !');
    } catch { toast.error('Erreur.'); }
  };

  const deleteTemplate = async () => {
    if (!selectedId) return;
    if (!window.confirm('Supprimer ce modèle ?')) return;
    try {
      await api.delete(`/reports/templates/${selectedId}/`);
      setTemplates(prev => prev.filter(t => t.id !== selectedId));
      setSelectedId(null);
      setConfig(buildDefaultConfig(docType));
      setTemplateName('');
      toast.success('Modèle supprimé.');
    } catch { toast.error('Erreur.'); }
  };

  // ── Token insertion via focused field ──
  const activeFieldElRef  = useRef(null); // DOM element
  const activeFieldSetRef = useRef(null); // onChange setter

  const fieldFocusCtxValue = {
    register: (el, setter) => {
      activeFieldElRef.current  = el;
      activeFieldSetRef.current = setter;
    },
  };

  /** Insert a token at the cursor of the currently-focused token-aware field.
   *  Returns true if inserted, false if no field is focused. */
  const insertToken = useCallback((tokenKey) => {
    const el     = activeFieldElRef.current;
    const setter = activeFieldSetRef.current;
    if (!el || !setter) return false;
    const start   = el.selectionStart ?? (el.value || '').length;
    const end     = el.selectionEnd   ?? start;
    const current = el.value || '';
    const next    = current.slice(0, start) + tokenKey + current.slice(end);
    setter(next);
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + tokenKey.length;
      el.setSelectionRange(pos, pos);
    });
    setIsDirty(true);
    return true;
  }, []); // eslint-disable-line

  const EDITOR_TABS = [
    { key: 'colors',     label: 'Couleurs',    icon: <FiSliders size={13} /> },
    { key: 'typography', label: 'Typo',        icon: <FiType size={13} /> },
    { key: 'layout',     label: 'Mise en page',icon: <FiLayout size={13} /> },
    { key: 'header',     label: 'En-tête',     icon: <FiFileText size={13} /> },
    { key: 'sections',   label: 'Sections',    icon: <FiGrid size={13} /> },
    { key: 'blocks',     label: 'Blocs ⚡',    icon: <FiZap size={13} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, Arial, sans-serif' }}>

      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/super-admin')} style={{ background: '#f2f4f7', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: '0.82rem', color: '#344054' }}>
          <FiArrowLeft size={15} /> Retour
        </button>

        <div style={{ width: 1, height: 24, background: '#e2e8f0', flexShrink: 0 }} />

        {/* Doc type selector */}
        {[
          { key: 'bulletin', label: 'Bulletin', icon: <FiFileText size={14} /> },
          { key: 'receipt',  label: 'Reçu',     icon: <FiDollarSign size={14} /> },
          { key: 'card',     label: 'Carte',    icon: <FiCreditCard size={14} /> },
        ].map(dt => (
          <button key={dt.key} onClick={() => switchDocType(dt.key)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
            borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
            background: docType === dt.key ? '#3b5beb' : '#f2f4f7',
            color: docType === dt.key ? '#fff' : '#344054',
          }}>
            {dt.icon}{dt.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Template name */}
        <input
          value={templateName}
          onChange={e => { setTemplateName(e.target.value); setIsDirty(true); }}
          placeholder="Nom du modèle..."
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d0d5dd', fontSize: '0.88rem', width: 200 }}
        />
        {isDirty && <span style={{ fontSize: '0.73rem', color: '#f59e0b', fontWeight: 700, whiteSpace: 'nowrap' }}>● Non sauvegardé</span>}

        <button onClick={() => { setSelectedId(null); setConfig(buildDefaultConfig(docType)); setTemplateName(''); setIsDirty(false); }} title="Nouveau modèle"
          style={{ background: '#f2f4f7', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', color: '#344054', fontWeight: 600 }}>
          <FiPlus size={14} /> Nouveau
        </button>
        {selectedId && (
          <button onClick={setDefault} title="Modèle par défaut"
            style={{ background: '#f2f4f7', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', color: '#f59e0b', fontWeight: 600 }}>
            <FiStar size={14} /> Défaut
          </button>
        )}
        {selectedId && (
          <button onClick={deleteTemplate} title="Supprimer"
            style={{ background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', color: '#ef4444', fontWeight: 600 }}>
            <FiTrash2 size={14} />
          </button>
        )}
        <button onClick={save} disabled={saving}
          style={{ background: '#3b5beb', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
          {saving ? <FiRefreshCw size={14} /> : <FiSave size={14} />}
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      {/* ── 3-COLUMN BODY ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT: Presets + Saved templates ── */}
        <div style={{ width: 228, borderRight: '1px solid #e2e8f0', background: '#fafbfc', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          {/* Presets */}
          <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Styles prédéfinis</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {PRESETS.map(p => (
                <button key={p.key} onClick={() => applyPreset(p.key)} title={p.desc} style={{
                  border: `2px solid ${config.style_preset === p.key ? '#3b5beb' : '#e2e8f0'}`,
                  borderRadius: 7, padding: '6px 4px', cursor: 'pointer', background: '#fff',
                  textAlign: 'center', transition: 'all 0.15s',
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: PRESET_PALETTES[p.key].primary, margin: '0 auto 3px' }} />
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#344054', lineHeight: 1.2 }}>{p.label}</div>
                  {config.style_preset === p.key && <div style={{ color: '#3b5beb', fontSize: '0.65rem' }}>✓</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Saved templates */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Modèles sauvegardés</div>
            {templates.length === 0
              ? <p style={{ fontSize: '0.78rem', color: '#98a2b3', textAlign: 'center', marginTop: 12 }}>Aucun modèle<br />Créez-en un !</p>
              : templates.map(t => (
                  <div key={t.id} onClick={() => loadTemplate(t)} style={{
                    padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 5,
                    background: selectedId === t.id ? '#e8edff' : '#fff',
                    border: `1px solid ${selectedId === t.id ? '#3b5beb' : '#e2e8f0'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#344054' }}>{t.name}</span>
                      {t.is_default && <span style={{ fontSize: '0.65rem', background: '#10b981', color: '#fff', borderRadius: 3, padding: '1px 5px' }}>Défaut</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: (t.config?.colors?.primary || '#1a365d') }} />
                      <span style={{ fontSize: '0.7rem', color: '#98a2b3' }}>{t.style_preset} · {new Date(t.updated_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
              ))
            }
          </div>
        </div>

        {/* ── CENTER: PREVIEW ── */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#e9ecef', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
          {/* Preview toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: '#fff', borderRadius: 10, padding: '6px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <span style={{ fontSize: '0.75rem', color: '#667085', fontWeight: 600 }}>Aperçu temps réel</span>
            {docType === 'bulletin' && (
              <button onClick={() => setIsEditing(e => !e)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${isEditing ? '#3b5beb' : '#d0d5dd'}`,
                background: isEditing ? '#e8edff' : '#fff',
                cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600,
                color: isEditing ? '#3b5beb' : '#667085',
              }}>
                <FiMove size={12} /> {isEditing ? 'Mode glisser-déposer actif' : 'Activer le glisser-déposer'}
              </button>
            )}
            <span style={{ fontSize: '0.7rem', color: '#98a2b3' }}>Échelle 72%</span>
          </div>

          <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', marginBottom: -200 }}>
            {docType === 'bulletin' && <BulletinPreview config={config} isEditing={isEditing} onMoveSection={moveSection} />}
            {docType === 'receipt'  && <ReceiptPreview config={config} />}
            {docType === 'card'     && <CardPreview config={config} />}
          </div>
        </div>

        {/* ── RIGHT: EDITOR PANELS ── */}
        <FieldFocusCtx.Provider value={fieldFocusCtxValue}>
        <div style={{ width: 298, borderLeft: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #e2e8f0', background: '#fafbfc', padding: '4px 6px', gap: 2 }}>
            {EDITOR_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 9px',
                borderRadius: 6, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: '0.77rem', fontWeight: 600,
                background: activeTab === tab.key
                  ? (tab.key === 'blocks' ? '#7c3aed' : '#3b5beb')
                  : 'transparent',
                color: activeTab === tab.key ? '#fff' : (tab.key === 'blocks' ? '#7c3aed' : '#667085'),
                flexShrink: 0,
              }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          {/* Panel body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {activeTab === 'colors'     && <ColorsPanel config={config} update={update} />}
            {activeTab === 'typography' && <TypographyPanel config={config} update={update} />}
            {activeTab === 'layout'     && <LayoutPanel config={config} update={update} docType={docType} />}
            {activeTab === 'header'     && <HeaderPanel config={config} update={update} docType={docType} />}
            {activeTab === 'sections' && docType === 'bulletin' && <BulletinSectionsPanel config={config} update={update} />}
            {activeTab === 'sections' && docType === 'receipt'  && <ReceiptSectionsPanel config={config} update={update} />}
            {activeTab === 'sections' && docType === 'card'     && <CardSectionsPanel config={config} update={update} />}
            {activeTab === 'blocks' && <DynamicBlocksPanel insertToken={insertToken} docType={docType} />}
          </div>
        </div>
        </FieldFocusCtx.Provider>

      </div>
    </div>
  );
}
