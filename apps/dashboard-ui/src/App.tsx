import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { DashboardPage } from '@/pages/DashboardPage';
import { VentasPage } from '@/pages/VentasPage';
import { LeadsPage } from '@/pages/LeadsPage';
import { PropiedadesPage } from '@/pages/PropiedadesPage';
import { VisitasPage } from '@/pages/VisitasPage';
import { ConversacionesPage } from '@/pages/ConversacionesPage';
import { AccionesPage } from '@/pages/AccionesPage';
import { EmpleadosPage } from '@/pages/EmpleadosPage';
import { TareasPage } from '@/pages/TareasPage';
import { CalidadIaPage } from '@/pages/CalidadIaPage';
import { MarketingDashboardPage } from '@/pages/MarketingDashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { AuthProvider } from '@/auth/AuthContext';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { PanelProvider, usePanel } from '@/panel/PanelContext';

/**
 * Sincroniza el panel activo con la URL: si la URL empieza con /marketing,
 * el panel debe quedar en "marketing"; en cualquier otra ruta -> "bochile".
 * Evita estados zombi (panel marketing en rutas Bochile y viceversa).
 */
function PanelUrlSync() {
  const location = useLocation();
  const { panel, setPanel } = usePanel();
  useEffect(() => {
    const wantsMarketing = location.pathname.startsWith('/marketing');
    if (wantsMarketing && panel !== 'marketing') setPanel('marketing');
    if (!wantsMarketing && panel !== 'bochile') setPanel('bochile');
  }, [location.pathname, panel, setPanel]);
  return null;
}

function ProtectedShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-surface-0 text-text">
      <PanelUrlSync />
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="flex-1 min-w-0">
        <TopBar onMenu={() => setDrawerOpen(true)} />
        <div className="p-3 sm:p-6">
          <Routes>
            {/* PANEL BOCHILE (operativo, completo, para el equipo de la inmobiliaria) */}
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tareas" element={<TareasPage />} />
            <Route path="/ventas" element={<VentasPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/propiedades" element={<PropiedadesPage />} />
            <Route path="/visitas" element={<VisitasPage />} />
            <Route path="/conversaciones" element={<ConversacionesPage />} />
            <Route path="/acciones" element={<AccionesPage />} />
            <Route path="/empleados" element={<EmpleadosPage />} />
            <Route path="/calidad-ia" element={<CalidadIaPage />} />

            {/* PANEL MARKETING (interno WSK — bandeja de tareas derivadas) */}
            <Route path="/marketing" element={<MarketingDashboardPage />} />
            <Route path="/marketing/tareas" element={<Navigate to="/marketing" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PanelProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <ProtectedShell />
              </ProtectedRoute>
            }
          />
        </Routes>
      </PanelProvider>
    </AuthProvider>
  );
}
