import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { FiMenu, FiBell, FiUserPlus, FiDollarSign, FiCheckSquare, FiInbox } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../services/api';

const pageTitles = {
  '/dashboard': 'Tableau de Bord',
  '/students': 'Gestion des Élèves',
  '/classes': 'Gestion des Classes',
  '/teachers': 'Gestion des Professeurs',
  '/bulletins': 'Bulletins',
  '/grades': 'Saisie des Notes',
  '/attendance': 'Suivi des Présences',
  '/payments': 'Gestion Financière',
  '/reports': 'Rapports & Statistiques',
  '/analytics': 'Analyses & Graphiques',
  '/academic-years': 'Années scolaires',
  '/users': 'Gestion des Utilisateurs',
  '/teacher': 'Mon Espace Professeur',
  '/teacher/grades': 'Mes Bulletins',
  '/scan': 'Scanner de Présence',
  '/caisse': 'Espace Caisse',
  '/educator': 'Espace Éducateur',
};

const TYPE_ICON = {
  STUDENT: <FiUserPlus size={15} color="#3b5beb" />,
  PAYMENT: <FiDollarSign size={15} color="#10b981" />,
  SCAN: <FiCheckSquare size={15} color="#f59e0b" />,
};

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

function Header({ onMenuToggle }) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'SchoolPro';

  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const lastIdRef = useRef(0);
  const initializedRef = useRef(false);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const since = initializedRef.current ? `?since=${lastIdRef.current}` : '';
        const res = await api.get(`/auth/notifications/${since}`);
        if (!active) return;
        const fresh = res.data.results || [];
        if (!initializedRef.current) {
          // Premier chargement : on remplit sans notifier
          setItems(fresh.slice().reverse());
          lastIdRef.current = res.data.last_id || 0;
          initializedRef.current = true;
        } else if (fresh.length) {
          setItems(prev => [...fresh.slice().reverse(), ...prev].slice(0, 30));
          setUnread(u => u + fresh.length);
          lastIdRef.current = res.data.last_id || lastIdRef.current;
          // Toast pour les nouveautés (max 3 pour ne pas spammer)
          fresh.slice(-3).forEach(n => toast.info(n.message, { autoClose: 5000 }));
        }
      } catch (_) { /* silencieux */ }
    };

    poll();
    const id = setInterval(poll, 12000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const toggleOpen = () => {
    setOpen(o => !o);
    if (!open) setUnread(0);
  };

  return (
    <header className="top-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn-icon btn-secondary mobile-menu-btn" onClick={onMenuToggle}
          aria-label="Ouvrir le menu" id="menu-toggle">
          <FiMenu size={20} />
        </button>
        <h1 className="header-title">{title}</h1>
      </div>
      <div className="header-actions" style={{ position: 'relative' }}>
        <button className="btn-icon btn-secondary" style={{ position: 'relative' }}
          onClick={toggleOpen} aria-label="Notifications">
          <FiBell size={18} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18,
              padding: '0 4px', borderRadius: 9, background: '#ef4444', color: '#fff',
              fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{unread > 9 ? '9+' : unread}</span>
          )}
        </button>

        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 320, maxHeight: 420,
              overflowY: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
              boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 100,
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f2f4f7', fontWeight: 700, fontSize: '0.9rem' }}>
                Notifications
              </div>
              {items.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#98a2b3' }}>
                  <FiInbox size={28} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: '0.85rem' }}>Aucune notification</div>
                </div>
              ) : items.map(n => (
                <div key={n.id} style={{
                  display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f6f7f9',
                }}>
                  <div style={{ marginTop: 2 }}>{TYPE_ICON[n.type] || <FiBell size={15} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.83rem', color: '#344054' }}>{n.message}</div>
                    <div style={{ fontSize: '0.72rem', color: '#98a2b3', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

export default Header;
