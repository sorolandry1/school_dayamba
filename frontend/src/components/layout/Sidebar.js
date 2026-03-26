import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiUsers, FiBook, FiClipboard, FiDollarSign,
  FiBarChart2, FiCamera, FiLogOut, FiGrid,
  FiFileText, FiShield, FiUserCheck, FiActivity, FiUser,
  FiMessageSquare, FiEdit3
} from 'react-icons/fi';

const ROLE_LABELS = {
  DIRECTOR: 'Directeur',
  TEACHER: 'Professeur',
  AGENT: 'Agent d\'accueil',
  ADMIN: 'Administrateur',
};

function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // --- DIRECTEUR ---
  const directorLinks = [
    { section: 'Tableau de bord' },
    { to: '/dashboard', icon: <FiHome />, label: 'Tableau de bord' },

    { section: 'Établissement' },
    { to: '/students', icon: <FiUsers />, label: 'Élèves' },
    { to: '/teachers', icon: <FiBook />, label: 'Professeurs' },
    { to: '/classes', icon: <FiGrid />, label: 'Classes' },

    { section: 'Scolarité' },
    { to: '/bulletins', icon: <FiFileText />, label: 'Bulletins' },
    { to: '/attendance', icon: <FiCamera />, label: 'Présences' },

    { section: 'Administration' },
    { to: '/payments', icon: <FiDollarSign />, label: 'Paiements' },
    { to: '/reports', icon: <FiBarChart2 />, label: 'Rapports' },
    { to: '/communications', icon: <FiMessageSquare />, label: 'Communications' },
    { to: '/subjects', icon: <FiBook />, label: 'Matières' },
    { to: '/users', icon: <FiShield />, label: 'Utilisateurs' },
    { to: '/logs', icon: <FiActivity />, label: 'Journal d\'activité' },
  ];

  // --- PROFESSEUR ---
  const teacherLinks = [
    { section: 'Mon espace' },
    { to: '/teacher', icon: <FiHome />, label: 'Tableau de bord' },
    { to: '/teacher/profile', icon: <FiUser />, label: 'Mon profil' },
    { section: 'Pédagogie' },
    { to: '/teacher/grades', icon: <FiClipboard />, label: 'Saisie des notes' },
    { to: '/teacher/lessons', icon: <FiEdit3 />, label: 'Cahier de texte' },
  ];

  // --- AGENT D'ACCUEIL ---
  const agentLinks = [
    { section: 'Présences' },
    { to: '/scan', icon: <FiCamera />, label: 'Scanner QR' },
    { to: '/attendance', icon: <FiUserCheck />, label: 'Présences du jour' },
  ];

  let links = directorLinks;
  if (user?.role === 'TEACHER') links = teacherLinks;
  else if (user?.role === 'AGENT') links = agentLinks;

  const initials = user
    ? `${(user.first_name || '')[0] || ''}${(user.last_name || '')[0] || ''}`.toUpperCase()
    : '?';

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">SP</div>
        <div>
          <h1>SchoolPro</h1>
          <span>Gestion Scolaire</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((item, idx) => {
          if (item.section) {
            return (
              <div key={`section-${idx}`} className="sidebar-section-title" style={{ marginTop: idx === 0 ? 0 : 8 }}>
                {item.section}
              </div>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/teacher' || item.to === '/dashboard'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.first_name} {user?.last_name}</div>
          <div className="sidebar-user-role">{ROLE_LABELS[user?.role] || user?.role}</div>
        </div>
        <button onClick={handleLogout} className="btn-icon" title="Déconnexion"
          style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none' }}>
          <FiLogOut size={18} />
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
