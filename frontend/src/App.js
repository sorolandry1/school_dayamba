import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/global.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import Students from './pages/Students';
import GradesManagement from './pages/GradesManagement';
import AttendanceScanner from './pages/AttendanceScanner';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import TeacherDashboard from './pages/TeacherDashboard';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard
    if (user.role === 'TEACHER') return <Navigate to="/teacher" replace />;
    if (user.role === 'AGENT') return <Navigate to="/scan" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? (
          <Navigate to={user?.role === 'TEACHER' ? '/teacher' : user?.role === 'AGENT' ? '/scan' : '/dashboard'} replace />
        ) : <Login />
      } />

      {/* Admin / Director routes */}
      <Route element={
        <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR']}>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<AdminDashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/classes" element={<div style={{padding: 20}}><h2>Gestion des Classes</h2><p style={{color: '#667085', marginTop: 8}}>Module disponible dans l'administration Django (/admin)</p></div>} />
        <Route path="/grades" element={<GradesManagement />} />
        <Route path="/attendance" element={<AttendanceScanner />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/reports" element={<Reports />} />
      </Route>

      {/* Teacher routes */}
      <Route element={
        <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR', 'TEACHER']}>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/grades" element={<GradesManagement />} />
      </Route>

      {/* Agent routes */}
      <Route element={
        <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR', 'AGENT']}>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route path="/scan" element={<AttendanceScanner />} />
      </Route>

      {/* Default */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/unauthorized" element={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column' }}>
          <h1 style={{ fontSize: '3rem', color: '#ef4444' }}>403</h1>
          <p style={{ color: '#667085' }}>Accès non autorisé</p>
        </div>
      } />
      <Route path="*" element={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column' }}>
          <h1 style={{ fontSize: '3rem', color: '#98a2b3' }}>404</h1>
          <p style={{ color: '#667085' }}>Page non trouvée</p>
        </div>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <ToastContainer position="top-right" autoClose={3000} />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
