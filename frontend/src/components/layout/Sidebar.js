
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import React, { useState } from 'react';
import api from '../../services/api';
import {
  FiHome, FiUsers, FiBook, FiClipboard, FiDollarSign,
  FiBarChart2, FiCamera, FiLogOut, FiGrid,
  FiFileText, FiShield, FiUserCheck, FiActivity, FiUser,
  FiMessageSquare, FiEdit3, FiGlobe, FiCreditCard, FiSettings, FiLayout,
  FiKey, FiX, FiEye, FiEyeOff,
} from 'react-icons/fi';

function getModules() {
  try {
    const s = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
    return { ...{ payments: true, reports: true, communications: true, expenses: true, bulletins: true, attendance: true, grades: true, subjects: true, logs: true, studentCards: true }, ...(s.modules || {}) };
  } catch { return {}; }
}

function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.new_password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (form.new_password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    setLoading(true);
    try {
      await api.put('/auth/change-password/', { old_password: form.old_password, new_password: form.new_password });
      setSuccess('Mot de passe modifié avec succès !');
      setForm({ old_password: '', new_password: '', confirm: '' });
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.response?.data?.old_password?.[0] || err.response?.data?.detail || 'Erreur lors du changement.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: '28px 28px 24px', width: 360, maxWidth: '94vw',
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#e8edff', borderRadius: 8, padding: 8, display: 'flex' }}>
              <FiKey size={18} color="#3b5beb" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1a1a2e' }}>Modifier le mot de passe</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#98a2b3' }}>
            <FiX size={18} />
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.83rem', color: '#dc2626', fontWeight: 600 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.83rem', color: '#16a34a', fontWeight: 600 }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {[
            { key: 'old_password', label: 'Mot de passe actuel', show: showOld, toggle: () => setShowOld(v => !v) },
            { key: 'new_password', label: 'Nouveau mot de passe', show: showNew, toggle: () => setShowNew(v => !v) },
            { key: 'confirm',      label: 'Confirmer le nouveau', show: showNew, toggle: () => setShowNew(v => !v) },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#344054', marginBottom: 5 }}>{f.label}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={f.show ? 'text' : 'password'}
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '9px 36px 9px 12px', borderRadius: 8, border: '1px solid #d0d5dd', fontSize: '0.88rem', boxSizing: 'border-box', outline: 'none' }}
                />
                <button type="button" onClick={f.toggle} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#98a2b3', display: 'flex',
                }}>
                  {f.show ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #d0d5dd',
              background: '#fff', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: '#344054',
            }}>Annuler</button>
            <button type="submit" disabled={loading} style={{
              flex: 2, padding: '10px', borderRadius: 8, border: 'none',
              background: loading ? '#b1c3fb' : '#3b5beb', color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.88rem', fontWeight: 700,
            }}>
              {loading ? 'Enregistrement...' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const modules = getModules();
  const [showPwdModal, setShowPwdModal] = useState(false);

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
    ...(modules.studentCards !== false ? [{ to: '/student-cards', icon: <FiCreditCard />, label: t('sidebar.links.student_cards') }] : []),

    { section: t('sidebar.sections.scolarite') },
    ...(modules.bulletins !== false ? [{ to: '/bulletins', icon: <FiFileText />, label: t('sidebar.links.bulletins') }] : []),
    ...(modules.grades !== false ? [{ to: '/grades', icon: <FiClipboard />, label: t('sidebar.links.grades') }] : []),
    ...(modules.attendance !== false ? [{ to: '/attendance', icon: <FiCamera />, label: t('sidebar.links.attendance') }] : []),

    { section: t('sidebar.sections.administration') },
    ...(modules.payments !== false ? [{ to: '/payments', icon: <FiDollarSign />, label: t('sidebar.links.payments') }] : []),
    ...(modules.reports !== false ? [{ to: '/reports', icon: <FiBarChart2 />, label: t('sidebar.links.reports') }] : []),
    { to: '/analytics', icon: <FiBarChart2 />, label: t('sidebar.links.analytics', { defaultValue: 'Analyses' }) },
    { to: '/academic-years', icon: <FiGrid />, label: t('sidebar.links.academic_years', { defaultValue: 'Années scolaires' }) },
    ...(modules.communications !== false ? [{ to: '/communications', icon: <FiMessageSquare />, label: t('sidebar.links.communications') }] : []),
    ...(modules.subjects !== false ? [{ to: '/subjects', icon: <FiBook />, label: t('sidebar.links.subjects') }] : []),
    ...(modules.expenses !== false ? [{ to: '/expenses', icon: <FiDollarSign />, label: t('sidebar.links.expenses') }] : []),
    { to: '/users', icon: <FiShield />, label: t('sidebar.links.users') },
    ...(modules.logs !== false ? [{ to: '/logs', icon: <FiActivity />, label: t('sidebar.links.logs') }] : []),
    ...(user?.role === 'ADMIN' ? [
      { to: '/super-admin', icon: <FiSettings />, label: t('sidebar.links.super_admin') },
      { to: '/document-editor', icon: <FiLayout />, label: 'Éditeur de documents' },
    ] : []),
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

  // --- ÉDUCATEUR ---
  const educatorLinks = [
    { section: t('sidebar.sections.mon_espace') },
    { to: '/educator', icon: <FiHome />, label: t('sidebar.links.dashboard') },
    { section: t('sidebar.sections.presences') },
    { to: '/attendance', icon: <FiCamera />, label: t('sidebar.links.attendance') },
    { section: t('sidebar.sections.suivi', { defaultValue: 'Suivi & relations' }) },
    { to: '/students', icon: <FiUsers />, label: t('sidebar.links.students') },
    { to: '/classes', icon: <FiGrid />, label: t('sidebar.links.classes') },
    { to: '/teachers', icon: <FiBook />, label: t('sidebar.links.teachers') },
    { to: '/bulletins', icon: <FiFileText />, label: t('sidebar.links.bulletins') },
    { to: '/communications', icon: <FiMessageSquare />, label: t('sidebar.links.communications') },
  ];

  // --- CAISSE ---
  const caisseLinks = [
    { section: t('sidebar.sections.mon_espace') },
    { to: '/caisse', icon: <FiHome />, label: t('sidebar.links.dashboard') },
    { section: t('sidebar.sections.administration') },
    { to: '/payments', icon: <FiDollarSign />, label: t('sidebar.links.payments') },
    { to: '/expenses', icon: <FiDollarSign />, label: t('sidebar.links.expenses') },
  ];

  let links = directorLinks;
  if (user?.role === 'TEACHER') links = teacherLinks;
  else if (user?.role === 'AGENT') links = agentLinks;
  else if (user?.role === 'EDUCATEUR') links = educatorLinks;
  else if (user?.role === 'CAISSE') links = caisseLinks;

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
        <button onClick={() => setShowPwdModal(true)} title="Modifier le mot de passe"
          style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px' }}>
          <FiKey size={16} />
        </button>
        <button onClick={handleLogout} className="btn-icon" title={t('sidebar.logout')}
          style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none' }}>
          <FiLogOut size={18} />
        </button>
      </div>
      {showPwdModal && <ChangePasswordModal onClose={() => setShowPwdModal(false)} />}
    </aside>
  );
}

export default Sidebar;
