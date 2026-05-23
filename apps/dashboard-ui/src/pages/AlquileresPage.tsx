import { useLeads } from '@/hooks/useLeads';
import { usePropiedades } from '@/hooks/usePropiedades';
import { useContratos } from '@/hooks/useContratos';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/charts/StatCard';
import { Users, Home, FileText, KeyRound, Sparkles, Calendar, ArrowUpRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Lead, Propiedad } from '@/types/domain';

const isAlquiler = (op?: string) => {
  const s = String(op || '').toLowerCase();
  return s === 'alquiler' || s === 'rent' || s.includes('alquil') || s.includes('rent');
};

export function AlquileresPage() {
  const navigate = useNavigate();
  const { data: leads, isLoading: l1 } = useLeads();
  const { data: props, isLoading: l2 } = usePropiedades();
  const { data: contratos, isLoading: l3 } = useContratos();

  const stats = useMemo(() => {
    const la = (leads ?? []).filter((l: Lead) => isAlquiler(l.operacion));
    const pa = (props ?? []).filter((p: Propiedad) => isAlquiler(p.operacion));
    const calif = la.filter(l => Number(l.score || 0) >= 70).length;
    const solicitudes = la.filter(l => String(l.etapa||'').toLowerCase().replace(/[\s_]/g,'') === 'solicitovisita').length;
    const totalContratos = (contratos ?? []).length;
    const presupProm = la.length > 0 ? Math.round(la.reduce((s,l)=>s+Number(l.presupuesto_max||0),0)/la.length) : 0;
    return { leadsTotal: la.length, leadsCalif: calif, solicitudes, propsTotal: pa.length, contratos: totalContratos, presupProm };
  }, [leads, props, contratos]);

  if (l1 || l2 || l3) return <div className="text-text-muted">Cargando alquileres...</div>;

  const leadsAlquiler = (leads ?? []).filter((l: Lead) => isAlquiler(l.operacion));

  return (
    <>
      <PageHeader title="Dashboard Alquileres" subtitle="KPIs e indicadores del área de alquiler de propiedades" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Leads de alquiler" value={stats.leadsTotal} icon={Users} accent="blue" to="/leads?op=alquiler" />
        <StatCard label="Calificados ≥70" value={stats.leadsCalif} icon={Sparkles} accent="pink" to="/leads?op=alquiler&score=70" />
        <StatCard label="Solicitan visita/llamado" value={stats.solicitudes} icon={Calendar} accent="amber" to="/visitas" />
        <StatCard label="Propiedades en alquiler" value={stats.propsTotal} icon={Home} accent="gold" to="/propiedades?op=alquiler" />
        <StatCard label="Contratos activos" value={stats.contratos} icon={FileText} accent="green" to="/contratos" />
        <StatCard label="Presup. promedio ARS/mes" value={stats.presupProm ? '$ ' + stats.presupProm.toLocaleString('es-AR') : '-'} icon={KeyRound} accent="green" />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm uppercase tracking-wider text-text-muted">Leads de alquiler recientes</h3>
          <Link to="/leads?op=alquiler" className="text-xs text-accent hover:underline flex items-center gap-1">
            Ver todos <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-1">
          {leadsAlquiler.slice(0, 10).map((l: Lead) => (
            <button
              key={l.lead_id}
              type="button"
              onClick={() => navigate(`/conversaciones?lead=${l.lead_id}`)}
              className="w-full flex items-center justify-between gap-2 py-2 px-2 -mx-2 rounded-lg border-b border-border/30 last:border-0 hover:bg-surface-2 transition-colors text-left group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">{l.nombre || l.lead_id}</div>
                <div className="text-xs text-text-muted truncate">{l.tipo_propiedad || '?'} · {l.zona_pref || '?'} · {l.ambientes ? l.ambientes + ' dorm' : '?'} · {l.presupuesto_max ? l.presupuesto_max + ' ' + (l.moneda || '') : '?'}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-amber-400">{l.etapa || 'Nuevo'} · {l.score || 0}</span>
                <ArrowUpRight className="w-3 h-3 text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
          {leadsAlquiler.length === 0 && (
            <p className="text-text-muted text-sm text-center py-4">Sin leads de alquiler todavía.</p>
          )}
        </div>
      </Card>
    </>
  );
}
