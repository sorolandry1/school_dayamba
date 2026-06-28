import React from 'react';
import { useLocation } from 'react-router-dom';
import { FiMenu, FiBell } from 'react-icons/fi';

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
  '/users': 'Gestion des Utilisateurs',
  '/teacher': 'Mon Espace Professeur',
  '/teacher/grades': 'Mes Bulletins',
  '/scan': 'Scanner de Présence',
};

function Header({ onMenuToggle }) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'SchoolPro';

  return (
    <header className="top-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn-icon btn-secondary mobile-menu-btn" onClick={onMenuToggle}
          aria-label="Ouvrir le menu"
          id="menu-toggle">
          <FiMenu size={20} />
        </button>
        <h1 className="header-title">{title}</h1>
      </div>
      <div className="header-actions">
        <button className="btn-icon btn-secondary" style={{ position: 'relative' }}>
          <FiBell size={18} />
        </button>
      </div>
    </header>
  );
}

export default Header;
