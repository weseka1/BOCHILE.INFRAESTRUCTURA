import { Routes, Route, Navigate } from 'react-router-dom';
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
  return (
    <div className="flex min-h-screen bg-surface-0 text-text">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <TopBar />
        <div className="p-6">
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
