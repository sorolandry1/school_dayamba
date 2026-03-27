
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import {
  FiHome, FiUsers, FiBook, FiClipboard, FiDollarSign,
  FiBarChart2, FiCamera, FiLogOut, FiGrid,
  FiFileText, FiShield, FiUserCheck, FiActivity, FiUser,
  FiMessageSquare, FiEdit3, FiGlobe
} from 'react-icons/fi';

function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const switchLang = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  const currentLang = i18n.language;

  // --- DIRECTEUR ---
  const directorLinks = [
    { section: t('sidebar.sections.dashboard') },
    { to: '/dashboard', icon: <FiHome />, label: t('sidebar.links.dashboard') },

    { section: t('sidebar.sections.etablissement') },
    { to: '/students', icon: <FiUsers />, label: t('sidebar.links.students') },
    { to: '/teachers', icon: <FiBook />, label: t('sidebar.links.teachers') },
    { to: '/classes', icon: <FiGrid />, label: t('sidebar.links.classes') },

    { section: t('sidebar.sections.scolarite') },
    { to: '/bulletins', icon: <FiFileText />, label: t('sidebar.links.bulletins') },
    { to: '/attendance', icon: <FiCamera />, label: t('sidebar.links.attendance') },

    { section: t('sidebar.sections.administration') },
    { to: '/payments', icon: <FiDollarSign />, label: t('sidebar.links.payments') },
    { to: '/reports', icon: <FiBarChart2 />, label: t('sidebar.links.reports') },
    { to: '/communications', icon: <FiMessageSquare />, label: t('sidebar.links.communications') },
    { to: '/subjects', icon: <FiBook />, label: t('sidebar.links.subjects') },
    { to: '/users', icon: <FiShield />, label: t('sidebar.links.users') },
    { to: '/logs', icon: <FiActivity />, label: t('sidebar.links.logs') },
  ];

  // --- PROFESSEUR ---
  const teacherLinks = [
    { section: t('sidebar.sections.mon_espace') },
    { to: '/teacher', icon: <FiHome />, label: t('sidebar.links.dashboard') },
    { to: '/teacher/profile', icon: <FiUser />, label: t('sidebar.links.my_profile') },
    { section: t('sidebar.sections.pedagogie') },
    { to: '/teacher/grades', icon: <FiClipboard />, label: t('sidebar.links.grades') },
    { to: '/teacher/lessons', icon: <FiEdit3 />, label: t('sidebar.links.lessons') },
  ];

  // --- AGENT D'ACCUEIL ---
  const agentLinks = [
    { section: t('sidebar.sections.presences') },
    { to: '/scan', icon: <FiCamera />, label: t('sidebar.links.scan') },
    { to: '/attendance', icon: <FiUserCheck />, label: t('sidebar.links.attendance_today') },
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
          <h1>{t('app.name')}</h1>
          <span>{t('app.tagline')}</span>
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

      {/* Sélecteur de langue */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <FiGlobe size={13} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
        <button
          onClick={() => switchLang('fr')}
          style={{
            background: currentLang === 'fr' ? 'rgba(255,255,255,0.18)' : 'none',
            border: 'none', borderRadius: 6,
            color: currentLang === 'fr' ? 'white' : 'rgba(255,255,255,0.45)',
            fontWeight: currentLang === 'fr' ? 700 : 400,
            fontSize: '0.75rem', padding: '3px 8px', cursor: 'pointer',
          }}
        >
          Français
        </button>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>|</span>
        <button
          onClick={() => switchLang('mos')}
          style={{
            background: currentLang === 'mos' ? 'rgba(255,255,255,0.18)' : 'none',
            border: 'none', borderRadius: 6,
            color: currentLang === 'mos' ? 'white' : 'rgba(255,255,255,0.45)',
            fontWeight: currentLang === 'mos' ? 700 : 400,
            fontSize: '0.75rem', padding: '3px 8px', cursor: 'pointer',
          }}
        >
          Mooré
        </button>
      </div>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.first_name} {user?.last_name}</div>
          <div className="sidebar-user-role">{t(`sidebar.roles.${user?.role}`, { defaultValue: user?.role })}</div>
        </div>
        <button onClick={handleLogout} className="btn-icon" title={t('sidebar.logout')}
          style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none' }}>
          <FiLogOut size={18} />
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
