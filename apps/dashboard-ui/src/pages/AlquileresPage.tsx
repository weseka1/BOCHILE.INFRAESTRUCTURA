import { useLeads } from '@/hooks/useLeads';
import { usePropiedades } from '@/hooks/usePropiedades';
import { useContratos } from '@/hooks/useContratos';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/charts/StatCard';
import { Users, Home, FileText, KeyRound, Sparkles, Calendar } from 'lucide-react';
import { useMemo } from 'react';
import type { Lead, Propiedad } from '@/types/domain';

const isAlquiler = (op?: string) => {
  const s = String(op || '').toLowerCase();
  return s === 'alquiler' || s === 'rent' || s.includes('alquil') || s.includes('rent');
};

export function AlquileresPage() {
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

  return (
    <>
      <PageHeader title="Dashboard Alquileres" subtitle="KPIs e indicadores del area de alquiler de propiedades" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Leads de alquiler" value={stats.leadsTotal} icon={Users} accent="blue" />
        <StatCard label="Calificados ≥70" value={stats.leadsCalif} icon={Sparkles} accent="pink" />
        <StatCard label="Solicitan visita/llamado" value={stats.solicitudes} icon={Calendar} accent="amber" />
        <StatCard label="Propiedades en alquiler" value={stats.propsTotal} icon={Home} accent="gold" />
        <StatCard label="Contratos activos" value={stats.contratos} icon={FileText} accent="green" />
        <StatCard label="Presup. promedio ARS/mes" value={stats.presupProm ? '$ '+stats.presupProm.toLocaleString('es-AR') : '-'} icon={KeyRound} accent="green" />
      </div>

      <Card>
        <h3 className="text-sm uppercase tracking-wider text-text-muted mb-3">Leads de alquiler recientes</h3>
        <div className="space-y-2">
          {(leads ?? []).filter((l:Lead) => isAlquiler(l.operacion)).slice(0, 10).map((l:Lead) => (
            <div key={l.lead_id} className="flex items-center justify-between gap-2 py-2 border-b border-border/30 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">{l.nombre || l.lead_id}</div>
                <div className="text-xs text-text-muted truncate">{l.tipo_propiedad || '?'} · {l.zona_pref || '?'} · {l.ambientes ? l.ambientes+' dorm' : '?'} · {l.presupuesto_max ? l.presupuesto_max+' '+(l.moneda||''):'?'}</div>
              </div>
              <div className="text-xs text-amber-400 shrink-0">{l.etapa || 'Nuevo'} · {l.score || 0}</div>
            </div>
          ))}
          {(leads ?? []).filter((l:Lead) => isAlquiler(l.operacion)).length === 0 && (
            <p className="text-text-muted text-sm text-center py-4">Sin leads de alquiler todavia.</p>
          )}
        </div>
      </Card>
    </>
  );
}
