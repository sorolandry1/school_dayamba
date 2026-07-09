import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import LicenseGate from './LicenseGate';

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <LicenseGate>
      <div className="app-layout">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </LicenseGate>
  );
}

export default AppLayout;
