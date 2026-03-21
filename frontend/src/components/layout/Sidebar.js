import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiUsers, FiBook, FiClipboard, FiDollarSign,
  FiBarChart2, FiCamera, FiSettings, FiLogOut, FiBookOpen, FiGrid
} from 'react-icons/fi';

function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminLinks = [
    { to: '/dashboard', icon: <FiHome />, label: 'Tableau de bord' },
    { to: '/students', icon: <FiUsers />, label: 'Élèves' },
    { to: '/classes', icon: <FiGrid />, label: 'Classes' },
    { to: '/grades', icon: <FiClipboard />, label: 'Notes' },
    { to: '/attendance', icon: <FiCamera />, label: 'Présences' },
    { to: '/payments', icon: <FiDollarSign />, label: 'Paiements' },
    { to: '/reports', icon: <FiBarChart2 />, label: 'Rapports' },
  ];

  const teacherLinks = [
    { to: '/teacher', icon: <FiHome />, label: 'Mon espace' },
    { to: '/teacher/grades', icon: <FiClipboard />, label: 'Gestion des notes' },
  ];

  const agentLinks = [
    { to: '/scan', icon: <FiCamera />, label: 'Scanner QR' },
    { to: '/attendance', icon: <FiBookOpen />, label: 'Présences du jour' },
  ];

  let links = adminLinks;
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
        <div className="sidebar-section-title">Navigation</div>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.first_name} {user?.last_name}</div>
          <div className="sidebar-user-role">{user?.role}</div>
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
