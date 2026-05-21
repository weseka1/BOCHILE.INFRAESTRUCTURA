import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { DashboardPage } from '@/pages/DashboardPage';
import { LeadsPage } from '@/pages/LeadsPage';
import { PropiedadesPage } from '@/pages/PropiedadesPage';
import { VisitasPage } from '@/pages/VisitasPage';
import { ContratosPage } from '@/pages/ContratosPage';
import { ConversacionesPage } from '@/pages/ConversacionesPage';
import { AccionesPage } from '@/pages/AccionesPage';
import { EmpleadosPage } from '@/pages/EmpleadosPage';

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-surface-0 text-text">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="flex-1 min-w-0">
        <TopBar onMenu={() => setDrawerOpen(true)} />
        <div className="p-3 sm:p-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/propiedades" element={<PropiedadesPage />} />
            <Route path="/visitas" element={<VisitasPage />} />
            <Route path="/contratos" element={<ContratosPage />} />
            <Route path="/conversaciones" element={<ConversacionesPage />} />
            <Route path="/acciones" element={<AccionesPage />} />
            <Route path="/empleados" element={<EmpleadosPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
