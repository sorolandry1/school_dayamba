import React from 'react';
import { useLocation } from 'react-router-dom';
import { FiMenu, FiBell } from 'react-icons/fi';

const pageTitles = {
  '/dashboard': 'Tableau de Bord',
  '/students': 'Gestion des Élèves',
  '/classes': 'Gestion des Classes',
  '/grades': 'Gestion des Notes',
  '/attendance': 'Suivi des Présences',
  '/payments': 'Gestion Financière',
  '/reports': 'Rapports & Statistiques',
  '/teacher': 'Espace Professeur',
  '/teacher/grades': 'Saisie des Notes',
  '/scan': 'Scanner de Présence',
};

function Header({ onMenuToggle }) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'SchoolPro';

  return (
    <header className="top-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn-icon btn-secondary" onClick={onMenuToggle}
          style={{ display: 'none' }}
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
