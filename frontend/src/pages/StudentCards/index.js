import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { FiSearch, FiPrinter, FiDownload, FiFilter, FiCreditCard, FiUser } from 'react-icons/fi';

// ─── Carte individuelle ───────────────────────────────────────────────────────

function StudentCard({ student, schoolName, schoolYear, logoUrl, themeColor }) {
  const color = themeColor || '#1a3c8f';
  const photo = student.photo_url;
  const qr = student.qr_code_url;

  return (
    <div className="student-card-print" style={{
      width: 320, minHeight: 190, borderRadius: 12,
      background: '#fff', border: `2px solid ${color}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      pageBreakInside: 'avoid',
    }}>
      {/* En-tête */}
      <div style={{
        background: color, color: '#fff',
        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {logoUrl ? (
          <img src={logoUrl} alt="logo" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, background: '#fff' }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 4, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13 }}>SP</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.78rem', letterSpacing: 0.5 }}>{schoolName || 'SchoolPro'}</div>
          <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>CARTE SCOLAIRE — {schoolYear || new Date().getFullYear()}</div>
        </div>
      </div>

      {/* Corps */}
      <div style={{ display: 'flex', flex: 1, padding: '10px 12px', gap: 10 }}>
        {/* Photo */}
        <div style={{ flexShrink: 0 }}>
          {photo ? (
            <img src={photo} alt="photo" style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 6, border: `2px solid ${color}` }} />
          ) : (
            <div style={{
              width: 64, height: 80, borderRadius: 6, border: `2px solid ${color}`,
              background: '#f2f4f7', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#98a2b3',
            }}>
              <FiUser size={28} />
            </div>
          )}
        </div>

        {/* Infos */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1a1a2e', lineHeight: 1.2 }}>
            {student.last_name?.toUpperCase()} {student.first_name}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#667085' }}>
            <span style={{ fontWeight: 600 }}>Matricule :</span> {student.matricule}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#667085' }}>
            <span style={{ fontWeight: 600 }}>Classe :</span> {student.classe_name}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#98a2b3', marginTop: 2 }}>
            Année scolaire : {schoolYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`}
          </div>
        </div>

        {/* QR Code */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {qr ? (
            <img src={qr} alt="qr" style={{ width: 60, height: 60 }} />
          ) : (
            <div style={{
              width: 60, height: 60, background: '#f2f4f7', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6rem', color: '#98a2b3', textAlign: 'center', padding: 4,
            }}>
              QR<br />{student.matricule}
            </div>
          )}
          <div style={{ fontSize: '0.55rem', color: '#98a2b3', marginTop: 2, textAlign: 'center' }}>Scan pour vérifier</div>
        </div>
      </div>

      {/* Pied */}
      <div style={{
        background: '#f8fafc', borderTop: `1px solid ${color}22`,
        padding: '4px 12px', fontSize: '0.6rem', color: '#98a2b3', textAlign: 'center',
      }}>
        Document officiel — Ne pas reproduire
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

function StudentCards() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClasse, setFilterClasse] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [printing, setPrinting] = useState(false);
  const printRef = useRef();

  // Paramètres (lus depuis localStorage via SuperAdmin)
  const settings = (() => {
    try { return JSON.parse(localStorage.getItem('schoolSettings') || '{}'); } catch { return {}; }
  })();

  useEffect(() => {
    Promise.all([
      api.get('/students/?page_size=500'),
      api.get('/classes/'),
    ]).then(([sRes, cRes]) => {
      setStudents(sRes.data.results || sRes.data);
      setClasses(cRes.data.results || cRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.last_name?.toLowerCase().includes(q) || s.first_name?.toLowerCase().includes(q) || s.matricule?.toLowerCase().includes(q);
    const matchClasse = !filterClasse || String(s.classe) === filterClasse;
    return matchSearch && matchClasse;
  });

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map(s => s.id)));
  const clearSelection = () => setSelected(new Set());

  const cardsToPrint = selected.size > 0
    ? filtered.filter(s => selected.has(s.id))
    : filtered;

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);
  };

  const handleExportPDF = () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    const cardsHtml = cardsToPrint.map(s => {
      const color = settings.themeColor || '#1a3c8f';
      const photo = s.photo_url ? `<img src="${s.photo_url}" style="width:64px;height:80px;object-fit:cover;border-radius:6px;border:2px solid ${color}" />` : `<div style="width:64px;height:80px;border-radius:6px;border:2px solid ${color};background:#f2f4f7;display:flex;align-items:center;justify-content:center;color:#98a2b3;font-size:11px;text-align:center">Photo</div>`;
      const qr = s.qr_code_url ? `<img src="${s.qr_code_url}" style="width:60px;height:60px" />` : `<div style="width:60px;height:60px;background:#f2f4f7;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#98a2b3;text-align:center;padding:4px">QR<br>${s.matricule}</div>`;
      return `<div style="width:320px;min-height:190px;border-radius:12px;background:#fff;border:2px solid ${color};overflow:hidden;display:inline-flex;flex-direction:column;font-family:Arial,sans-serif;margin:8px;vertical-align:top;page-break-inside:avoid">
        <div style="background:${color};color:#fff;padding:8px 12px;display:flex;align-items:center;gap:10px">
          <div style="flex:1"><div style="font-weight:800;font-size:0.78rem">${settings.schoolName || 'SchoolPro'}</div><div style="font-size:0.65rem;opacity:0.85">CARTE SCOLAIRE — ${settings.schoolYear || new Date().getFullYear()}</div></div>
        </div>
        <div style="display:flex;flex:1;padding:10px 12px;gap:10px">
          ${photo}
          <div style="flex:1">
            <div style="font-weight:800;font-size:0.85rem;color:#1a1a2e">${s.last_name?.toUpperCase()} ${s.first_name}</div>
            <div style="font-size:0.72rem;color:#667085"><b>Matricule :</b> ${s.matricule}</div>
            <div style="font-size:0.72rem;color:#667085"><b>Classe :</b> ${s.classe_name}</div>
            <div style="font-size:0.7rem;color:#98a2b3;margin-top:2px">Année : ${settings.schoolYear || `${new Date().getFullYear()}-${new Date().getFullYear()+1}`}</div>
          </div>
          ${qr}
        </div>
        <div style="background:#f8fafc;border-top:1px solid ${color}22;padding:4px 12px;font-size:0.6rem;color:#98a2b3;text-align:center">Document officiel — Ne pas reproduire</div>
      </div>`;
    }).join('');

    w.document.write(`<html><head><title>Cartes Scolaires</title>
      <style>@media print{body{margin:0}}.cards{display:flex;flex-wrap:wrap;gap:8px;padding:16px}</style>
      </head><body><div class="cards">${cardsHtml}</div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiCreditCard style={{ marginRight: 8 }} />Cartes Scolaires</h2>
          <p>Génération et impression des cartes avec QR code</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.size > 0 && (
            <button className="btn btn-secondary" onClick={clearSelection}>
              Désélectionner ({selected.size})
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleExportPDF} disabled={filtered.length === 0}>
            <FiDownload size={14} /> Export PDF
          </button>
          <button className="btn btn-primary" onClick={handlePrint} disabled={printing || filtered.length === 0}>
            <FiPrinter size={14} /> {printing ? '...' : `Imprimer (${cardsToPrint.length})`}
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="filters-bar">
        <div className="search-input">
          <FiSearch size={16} />
          <input placeholder="Rechercher par nom, prénom, matricule..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 180 }} value={filterClasse}
          onChange={e => setFilterClasse(e.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={selectAll}>
          <FiFilter size={14} /> Tout sélectionner ({filtered.length})
        </button>
      </div>

      {/* Info sélection */}
      {selected.size > 0 && (
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, fontSize: '0.85rem', color: '#1d4ed8',
        }}>
          {selected.size} carte(s) sélectionnée(s) — L'impression et l'export PDF ne concerneront que ces cartes.
        </div>
      )}

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 60, color: '#98a2b3' }}>
            <FiCreditCard size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Aucun élève trouvé</p>
          </div>
        </div>
      ) : (
        <div ref={printRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {filtered.map(s => (
            <div key={s.id} onClick={() => toggleSelect(s.id)} style={{ cursor: 'pointer' }}>
              <div style={{
                outline: selected.has(s.id) ? `3px solid #3b5beb` : '3px solid transparent',
                borderRadius: 14, transition: 'outline 0.15s',
              }}>
                <StudentCard
                  student={s}
                  schoolName={settings.schoolName}
                  schoolYear={settings.schoolYear}
                  logoUrl={settings.logoUrl}
                  themeColor={settings.themeColor}
                />
              </div>
              {selected.has(s.id) && (
                <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#3b5beb', marginTop: 4, fontWeight: 600 }}>
                  Sélectionnée
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Styles d'impression */}
      <style>{`
        @media print {
          body > *:not(#print-root) { display: none !important; }
          .student-card-print { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

export default StudentCards;
